import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, uniq } from "../../tests/helpers";
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

beforeAll(async () => {
  supa = await startFakeSupabase();
  resend = await startFakeResend();
  handler = createContactHandler(createDeps(makeEnv()));
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
});
