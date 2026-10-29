import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import { makeProduct } from "../../tests/fixtures.ts";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeSupabase,
} from "../../tests/fakes/servers.ts";
import { createStockAlertHandler } from "./handler.ts";

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
  handler = createStockAlertHandler(createDeps(env));
});

afterAll(async () => {
  await Promise.all([supa.close(), resend.close()]);
  await pool.end();
});

/** Jede Anfrage bekommt eine eigene IP, damit sich die Tests nicht gegenseitig ins IP-Limit bringen. */
function post(body: unknown, ip = `10.1.0.${++ipCounter}`) {
  return handler(
    new Request("https://fn.test/stock-alert", {
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

function tokenFrom(text: string): string {
  const m = text.match(/\/benachrichtigung\/bestaetigen\?token=([0-9a-f]{48})/);
  if (!m) throw new Error(`Kein Bestätigungslink in: ${text}`);
  return m[1]!;
}

async function soldOutVariant(): Promise<string> {
  const p = await makeProduct({ priceCents: 10000, stocks: [0] });
  return p.variants[0]!.id;
}

describe("stock-alert: anfragen", () => {
  it("Honeypot gefüllt: stille Antwort, keine Zeile, keine E-Mail", async () => {
    const variantId = await soldOutVariant();
    const email = `${uniq("bot")}@example.ch`;
    const before = resend.sent.length;
    const res = await post({ action: "request", variantId, email, website: "http://spam" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(resend.sent.length).toBe(before);
    expect(
      await sql("select 1 from public.stock_alerts where variant_id = $1", [variantId]),
    ).toHaveLength(0);
  });

  it("scheitert die Bestätigungs-E-Mail: 502 EMAIL_FAILED", async () => {
    const variantId = await soldOutVariant();
    resend.failNext();
    const res = await post({
      action: "request",
      variantId,
      email: `${uniq("mailfail")}@example.ch`,
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "EMAIL_FAILED" });
  });

  it("ungültige E-Mail oder Variant-ID: 400", async () => {
    const variantId = await soldOutVariant();
    const badMail = await post({ action: "request", variantId, email: "keine-adresse" });
    expect(badMail.status).toBe(400);
    expect(await badMail.json()).toEqual({ error: "INVALID_EMAIL" });
    const badId = await post({ action: "request", variantId: "kein-uuid", email: "a@example.ch" });
    expect(badId.status).toBe(400);
    expect(await badId.json()).toEqual({ error: "BAD_REQUEST" });
    expect((await post({ action: "unbekannt" })).status).toBe(400);
  });

  it("unbekannte Grösse: 404; vorrätige Grösse: 409 IN_STOCK", async () => {
    const unknown = await post({
      action: "request",
      variantId: "00000000-0000-4000-8000-000000000000",
      email: `${uniq("x")}@example.ch`,
    });
    expect(unknown.status).toBe(404);
    const inStock = await makeProduct({ priceCents: 10000, stocks: [3] });
    const res = await post({
      action: "request",
      variantId: inStock.variants[0]!.id,
      email: `${uniq("x")}@example.ch`,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "IN_STOCK" });
  });

  it("schickt die Bestätigungsmail an die normalisierte Adresse und speichert «pending»", async () => {
    const variantId = await soldOutVariant();
    const email = `${uniq("Alert")}@Example.ch`;
    const before = resend.sent.length;
    const res = await post({ action: "request", variantId, email: `  ${email} `, locale: "en" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const mails = resend.sent.slice(before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toEqual([email.toLowerCase()]);
    expect(mails[0]!.subject).toBe("Please confirm your alert");
    expect(mails[0]!.text).toMatch(
      /https:\/\/shop\.test\/en\/benachrichtigung\/bestaetigen\?token=[0-9a-f]{48}/,
    );
    const row = await sql<{ status: string; locale: string }>(
      "select status, locale from public.stock_alerts where variant_id = $1",
      [variantId],
    );
    expect(row).toEqual([{ status: "pending", locale: "en" }]);
  });

  it("Limit pro Adresse: nach fünf Anfragen pro Stunde 429", async () => {
    const variantId = await soldOutVariant();
    const email = `${uniq("viel")}@example.ch`;
    for (let i = 0; i < 5; i++)
      expect((await post({ action: "request", variantId, email })).status).toBe(200);
    const res = await post({ action: "request", variantId, email });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
  });

  it("Limit pro IP: nach zehn Anfragen 429", async () => {
    const variantId = await soldOutVariant();
    const ip = `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    let last = 200;
    for (let i = 0; i < 11; i++) {
      last = (await post({ action: "request", variantId, email: `${uniq("ip")}@example.ch` }, ip))
        .status;
    }
    expect(last).toBe(429);
  });
});

describe("stock-alert: bestätigen", () => {
  it("Token bestätigt den Wunsch; ein zweiter Klick ist harmlos", async () => {
    const variantId = await soldOutVariant();
    const email = `${uniq("ok")}@example.ch`;
    const before = resend.sent.length;
    await post({ action: "request", variantId, email });
    const token = tokenFrom(resend.sent[before]!.text);
    const res = await post({ action: "confirm", token });
    expect(await res.json()).toEqual({ status: "confirmed" });
    expect(await post({ action: "confirm", token }).then((r) => r.json())).toEqual({
      status: "confirmed",
    });
    const row = await sql<{ status: string }>(
      "select status from public.stock_alerts where variant_id = $1",
      [variantId],
    );
    expect(row[0]!.status).toBe("confirmed");
  });

  it("ungültiges Token: 400; unbekanntes oder schon benutztes Token: invalid", async () => {
    const bad = await post({ action: "confirm", token: "zu-kurz" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "INVALID_TOKEN" });
    const unknown = await post({ action: "confirm", token: "0".repeat(48) });
    expect(await unknown.json()).toEqual({ status: "invalid" });

    // Nach dem Versand («notified») ist das Token entwertet.
    const variantId = await soldOutVariant();
    const before = resend.sent.length;
    await post({ action: "request", variantId, email: `${uniq("used")}@example.ch` });
    const token = tokenFrom(resend.sent[before]!.text);
    await post({ action: "confirm", token });
    await sql(
      "update public.stock_alerts set status = 'notified', token_hash = null, email = 'entfernt@invalid' where variant_id = $1",
      [variantId],
    );
    expect(await post({ action: "confirm", token }).then((r) => r.json())).toEqual({
      status: "invalid",
    });
  });
});
