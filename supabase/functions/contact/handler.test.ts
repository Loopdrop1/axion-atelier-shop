import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeSupabase,
} from "../../tests/fakes/servers";
import { createContactHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;
let ipCounter = 0;

function makeEnv(extra: Record<string, string> = {}) {
  return readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
        EMAIL_FROM: "Axion <shop@axion.test>",
        SHOP_CONTACT_EMAIL: "info@axion.test",
        ...extra,
      })[k],
  );
}

const GLOBAL_KEYS = ["contact-global", "contact-global-day"];
const hash = "encode(extensions.digest($1::text, 'sha256'), 'hex')";

async function setHits(key: string, hits: number) {
  await sql(
    `insert into private.rate_limits (key, window_start, hits) values (${hash}, now(), $2)
     on conflict (key) do update set window_start = now(), hits = $2`,
    [key, hits],
  );
}

async function resetGlobal() {
  for (const key of GLOBAL_KEYS)
    await sql(`delete from private.rate_limits where key = ${hash}`, [key]);
}

beforeAll(async () => {
  supa = await startFakeSupabase();
  resend = await startFakeResend();
  handler = createContactHandler(createDeps(makeEnv()));
  await resetGlobal();
});

afterAll(async () => {
  await Promise.all([supa.close(), resend.close()]);
  await pool.end();
});

/** Jede Anfrage bekommt eine eigene IP, damit sich die Tests nicht gegenseitig ins IP-Limit bringen. */
function post(body: unknown, ip = `10.1.0.${++ipCounter}`, h = handler) {
  return h(
    new Request("https://fn.test/contact", {
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

const MESSAGE = "Guten Tag, gibt es den Anzug Limmat auch in Grösse 58?";

describe("contact", () => {
  it("schickt die Nachricht an den Shop, Antwort geht direkt an die Kundschaft", async () => {
    const email = `${uniq("Kunde")}@Example.ch`;
    const before = resend.sent.length;
    const res = await post({
      name: "  Max\n Muster ",
      email: ` ${email} `,
      message: `  ${MESSAGE}\nDanke!  `,
      locale: "en",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(resend.sent.length).toBe(before + 1);
    const mail = resend.sent.at(-1)!;
    expect(mail.to).toEqual(["info@axion.test"]);
    expect(mail.from).toBe("Axion <shop@axion.test>");
    expect(mail.reply_to).toBe(email.toLowerCase());
    expect(mail.subject).toBe("Kontaktformular: Max Muster");
    expect(mail.text).toContain(`${MESSAGE}\nDanke!`);
    expect(mail.text).toContain("auf Englisch geschrieben");
    expect(mail.html).toContain("Grösse 58");
  });

  it("maskiert HTML aus der Nachricht", async () => {
    const res = await post({
      name: "<b>Max</b>",
      email: `${uniq("html")}@example.ch`,
      message: "<script>alert(1)</script> bitte zurückrufen",
    });
    expect(res.status).toBe(200);
    const mail = resend.sent.at(-1)!;
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("verstecktes Feld ausgefüllt (Bot): Antwort «gesendet», aber keine E-Mail", async () => {
    const before = resend.sent.length;
    const res = await post({
      name: "Bot",
      email: "bot@example.ch",
      message: MESSAGE,
      website: "https://spam.example",
    });
    expect(res.status).toBe(200);
    expect(resend.sent.length).toBe(before);
  });

  it("fehlende oder falsche Angaben: 400 mit Code", async () => {
    const ok = { name: "Max", email: "max@example.ch", message: MESSAGE };
    for (const [body, code] of [
      [{ ...ok, name: " " }, "NAME_REQUIRED"],
      [{ ...ok, email: "max(at)example.ch" }, "INVALID_EMAIL"],
      [{ ...ok, message: "Hallo" }, "MESSAGE_TOO_SHORT"],
      [{ ...ok, message: "x".repeat(4001) }, "MESSAGE_TOO_LONG"],
    ] as const) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: code });
    }
  });

  it("bremst: höchstens 3 Nachrichten pro Adresse und Stunde, 5 pro IP", async () => {
    const email = `${uniq("viel")}@example.ch`;
    for (let i = 0; i < 3; i++)
      expect((await post({ name: "Max", email, message: MESSAGE })).status).toBe(200);
    const fourth = await post({ name: "Max", email, message: MESSAGE });
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toEqual({ error: "RATE_LIMITED" });

    const ip = "10.9.9.9";
    for (let i = 0; i < 5; i++)
      expect(
        (await post({ name: "Max", email: `${uniq("ip")}@example.ch`, message: MESSAGE }, ip))
          .status,
      ).toBe(200);
    expect(
      (await post({ name: "Max", email: `${uniq("ip")}@example.ch`, message: MESSAGE }, ip)).status,
    ).toBe(429);
  });

  it("ohne Shop-Adresse: 503; E-Mail-Dienst gestört: 502", async () => {
    const noTarget = createContactHandler(
      createDeps(makeEnv({ SHOP_CONTACT_EMAIL: "", SHOP_NOTIFY_EMAIL: "" })),
    );
    const res = await post(
      { name: "Max", email: `${uniq("leer")}@example.ch`, message: MESSAGE },
      undefined,
      noTarget,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "NOT_CONFIGURED" });

    resend.failNext();
    const failed = await post({
      name: "Max",
      email: `${uniq("fail")}@example.ch`,
      message: MESSAGE,
    });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "EMAIL_FAILED" });
  });

  it("nur von erlaubten Seiten (CORS) und nur POST", async () => {
    const res = await handler(new Request("https://fn.test/contact", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("fremde Webseite mit text/plain (ohne CORS-Prüfung): 415, keine E-Mail", async () => {
    const before = resend.sent.length;
    const res = await handler(
      new Request("https://fn.test/contact", {
        method: "POST",
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          origin: "https://boese.example",
          "x-forwarded-for": "10.2.0.1",
        },
        body: JSON.stringify({
          name: "Max",
          email: `${uniq("fremd")}@example.ch`,
          message: MESSAGE,
        }),
      }),
    );
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "UNSUPPORTED_MEDIA_TYPE" });
    expect(resend.sent.length).toBe(before);
  });

  it("IPv6: alle Adressen eines /64-Netzes teilen sich das IP-Limit", async () => {
    const send = (i: number) =>
      post(
        { name: "Max", email: `${uniq("v6")}@example.ch`, message: MESSAGE },
        `2001:db8:a:b::${i}`,
      );
    for (let i = 1; i <= 5; i++) expect((await send(i)).status).toBe(200);
    expect((await send(6)).status).toBe(429);
    // leerer erster Eintrag in X-Forwarded-For hebelt die Bremse nicht aus
    const emptyFirst = await post(
      { name: "Max", email: `${uniq("v6")}@example.ch`, message: MESSAGE },
      ", 2001:db8:a:b::8",
    );
    expect(emptyFirst.status).toBe(429);
  });

  it("Zähler nur als Prüfwert: weder E-Mail-Adresse noch IP im Klartext", async () => {
    const email = `${uniq("klartext")}@example.ch`;
    expect((await post({ name: "Max", email, message: MESSAGE }, "10.3.0.1")).status).toBe(200);
    const plain = await sql(
      "select key from private.rate_limits where key like '%' || $1 || '%' or key like '%10.3.0.1%'",
      [email],
    );
    expect(plain).toEqual([]);
    const hashed = await sql(`select hits from private.rate_limits where key = ${hash}`, [
      `contact-email:${email}`,
    ]);
    expect(hashed).toEqual([{ hits: 1 }]);
  });

  it("Deckel für alle (20 pro Stunde, 50 pro Tag): 503 BUSY, keine E-Mail", async () => {
    const before = resend.sent.length;
    const body = () => ({ name: "Max", email: `${uniq("voll")}@example.ch`, message: MESSAGE });
    try {
      await setHits("contact-global", 20);
      const hour = await post(body());
      expect(hour.status).toBe(503);
      expect(await hour.json()).toEqual({ error: "BUSY" });

      await resetGlobal();
      await setHits("contact-global-day", 50);
      const day = await post(body());
      expect(day.status).toBe(503);
      expect(await day.json()).toEqual({ error: "BUSY" });
      expect(resend.sent.length).toBe(before);
    } finally {
      await resetGlobal();
    }
  });
});
