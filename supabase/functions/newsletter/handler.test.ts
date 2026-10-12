import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeSupabase,
} from "../../tests/fakes/servers";
import { createNewsletterHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;
let ipCounter = 0;

beforeAll(async () => {
  supa = await startFakeSupabase();
  resend = await startFakeResend();
  const env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
      })[k],
  );
  handler = createNewsletterHandler(createDeps(env));
});

afterAll(async () => {
  await Promise.all([supa.close(), resend.close()]);
  await pool.end();
});

/** Jede Anfrage bekommt eine eigene IP, damit sich die Tests nicht gegenseitig ins IP-Limit bringen. */
function post(body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return handler(
    new Request("https://fn.test/newsletter", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.test",
        "x-forwarded-for": `${ip}, 172.16.0.1`,
      },
      body: JSON.stringify(body),
    }),
  );
}

const CONSENT = "Ja, ich möchte den Axion-Newsletter erhalten. Abmelden ist jederzeit möglich.";

function tokenFrom(text: string, page: "bestaetigen" | "abmelden"): string {
  const m = text.match(new RegExp(`/newsletter/${page}\\?token=([0-9a-f]{48})`));
  if (!m) throw new Error(`Kein ${page}-Link in: ${text}`);
  return m[1]!;
}

describe("newsletter: anmelden", () => {
  it("speichert «pending» mit Einwilligung und schickt die Bestätigung an die normalisierte Adresse", async () => {
    const email = `${uniq("News")}@Example.ch`;
    const before = resend.sent.length;
    const res = await post({
      action: "subscribe",
      email: `  ${email} `,
      consent: CONSENT,
      locale: "de",
      source: "footer",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const mails = resend.sent.slice(before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toEqual([email.toLowerCase()]);
    expect(mails[0]!.subject).toBe("Bitte bestätige deine Anmeldung");
    expect(mails[0]!.text).toMatch(
      /^https:\/\/shop\.test\/newsletter\/bestaetigen\?token=[0-9a-f]{48}$/m,
    );
    const row = await sql<{ status: string; consent_text: string; source: string }>(
      "select status, consent_text, source from public.newsletter_subscribers where email = $1",
      [email.toLowerCase()],
    );
    expect(row[0]).toEqual({ status: "pending", consent_text: CONSENT, source: "footer" });
  });

  it("englisch: Link mit /en und englischer Betreff", async () => {
    const before = resend.sent.length;
    await post({
      action: "subscribe",
      email: `${uniq("en")}@example.ch`,
      consent: CONSENT,
      locale: "en",
    });
    const mail = resend.sent[before]!;
    expect(mail.subject).toBe("Please confirm your subscription");
    expect(mail.text).toMatch(/https:\/\/shop\.test\/en\/newsletter\/bestaetigen\?token=/);
  });

  it("bereits bestätigte Adresse: gleiche Antwort, keine E-Mail", async () => {
    const email = `${uniq("dabei")}@example.ch`;
    let before = resend.sent.length;
    await post({ action: "subscribe", email, consent: CONSENT });
    const t = tokenFrom(resend.sent[before]!.text, "bestaetigen");
    await post({ action: "confirm", token: t });
    before = resend.sent.length;
    const res = await post({ action: "subscribe", email, consent: CONSENT });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(resend.sent.length).toBe(before);
  });

  it("verstecktes Bot-Feld ausgefüllt: tut so, als ob, speichert aber nichts", async () => {
    const email = `${uniq("bot")}@example.ch`;
    const before = resend.sent.length;
    const res = await post({
      action: "subscribe",
      email,
      consent: CONSENT,
      website: "https://spam.example",
    });
    expect(await res.json()).toEqual({ ok: true });
    expect(resend.sent.length).toBe(before);
    expect(
      await sql("select 1 from public.newsletter_subscribers where email = $1", [email]),
    ).toHaveLength(0);
  });

  it("ohne Einwilligung oder mit ungültiger Adresse: 400", async () => {
    const noConsent = await post({
      action: "subscribe",
      email: `${uniq("x")}@example.ch`,
      consent: "  ",
    });
    expect(noConsent.status).toBe(400);
    expect(await noConsent.json()).toEqual({ error: "CONSENT_REQUIRED" });
    const badMail = await post({ action: "subscribe", email: "keine-adresse", consent: CONSENT });
    expect(await badMail.json()).toEqual({ error: "INVALID_EMAIL" });
  });

  it("mehr als 3 Anmeldungen derselben Adresse pro Stunde: 429", async () => {
    const email = `${uniq("oft")}@example.ch`;
    for (let i = 0; i < 3; i++)
      expect((await post({ action: "subscribe", email, consent: CONSENT })).status).toBe(200);
    const res = await post({ action: "subscribe", email, consent: CONSENT });
    expect(res.status).toBe(429);
  });

  it("mehr als 10 Anmeldungen von derselben IP pro Stunde: 429 (IP aus X-Forwarded-For)", async () => {
    const ip = `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 10; i++) {
      expect(
        (
          await post(
            { action: "subscribe", email: `${uniq("ip")}@example.ch`, consent: CONSENT },
            ip,
          )
        ).status,
      ).toBe(200);
    }
    expect(
      (await post({ action: "subscribe", email: `${uniq("ip")}@example.ch`, consent: CONSENT }, ip))
        .status,
    ).toBe(429);
  });
});

describe("newsletter: bestätigen und abmelden", () => {
  it("bestätigt, schickt die Willkommens-E-Mail mit Abmeldelink genau einmal", async () => {
    const email = `${uniq("ok")}@example.ch`;
    let before = resend.sent.length;
    await post({ action: "subscribe", email, consent: CONSENT, locale: "de" });
    const t = tokenFrom(resend.sent[before]!.text, "bestaetigen");
    before = resend.sent.length;
    const res = await post({ action: "confirm", token: t });
    expect(await res.json()).toEqual({ status: "confirmed" });
    const welcome = resend.sent.slice(before);
    expect(welcome).toHaveLength(1);
    expect(welcome[0]!.subject).toBe("Willkommen bei Axion");
    expect(tokenFrom(welcome[0]!.text, "abmelden")).toBe(t);
    expect(welcome[0]!.html).toContain(`/newsletter/abmelden?token=${t}`);
    const again = await post({ action: "confirm", token: t });
    expect(await again.json()).toEqual({ status: "confirmed" });
    expect(resend.sent.length - before).toBe(1);
    const row = await sql<{ status: string; confirmed_at: Date | null }>(
      "select status, confirmed_at from public.newsletter_subscribers where email = $1",
      [email],
    );
    expect(row[0]!.status).toBe("confirmed");
    expect(row[0]!.confirmed_at).not.toBeNull();
  });

  it("mit Willkommensrabatt: Code in der E-Mail", async () => {
    await sql("update public.shop_settings set newsletter_welcome_percent = 10");
    try {
      let before = resend.sent.length;
      await post({
        action: "subscribe",
        email: `${uniq("rabatt")}@example.ch`,
        consent: CONSENT,
        locale: "en",
      });
      const t = tokenFrom(resend.sent[before]!.text, "bestaetigen");
      before = resend.sent.length;
      await post({ action: "confirm", token: t });
      const mail = resend.sent[before]!;
      expect(mail.text).toContain("10% off your next order");
      expect(mail.text).toMatch(/WILLKOMMEN-[0-9A-F]{6}/);
    } finally {
      await sql("update public.shop_settings set newsletter_welcome_percent = null");
    }
  });

  it("abmelden setzt «unsubscribed»; der alte Bestätigungslink meldet nicht wieder an", async () => {
    const email = `${uniq("weg")}@example.ch`;
    const before = resend.sent.length;
    await post({ action: "subscribe", email, consent: CONSENT });
    const t = tokenFrom(resend.sent[before]!.text, "bestaetigen");
    await post({ action: "confirm", token: t });
    const res = await post({ action: "unsubscribe", token: t });
    expect(await res.json()).toEqual({ status: "unsubscribed" });
    expect(
      (
        await sql<{ status: string }>(
          "select status from public.newsletter_subscribers where email = $1",
          [email],
        )
      )[0]!.status,
    ).toBe("unsubscribed");
    const reconfirm = await post({ action: "confirm", token: t });
    expect(await reconfirm.json()).toEqual({ status: "unsubscribed" });
  });

  it("unbekannter Token: «invalid»; falsches Format: 400", async () => {
    const unknown = await post({ action: "confirm", token: "a".repeat(48) });
    expect(await unknown.json()).toEqual({ status: "invalid" });
    const bad = await post({ action: "unsubscribe", token: "<script>" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "INVALID_TOKEN" });
    const action = await post({ action: "loeschen" });
    expect(action.status).toBe(400);
  });
});
