import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createUser, pool, sql, type TestUser } from "../../tests/helpers.ts";
import { makeProduct, reserve, rpc } from "../../tests/fixtures.ts";
import {
  ANON_KEY,
  fakeJwt,
  SERVICE_KEY,
  startFakeAi,
  startFakeResend,
  startFakeSupabase,
} from "../../tests/fakes/servers.ts";
import { createAdminActionsHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let ai: Awaited<ReturnType<typeof startFakeAi>>;
let handler: (req: Request) => Promise<Response>;
let admin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  supa = await startFakeSupabase();
  resend = await startFakeResend();
  ai = await startFakeAi();
  const env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
        LOVABLE_API_KEY: "lov_test",
        TRANSLATE_API_BASE: `${ai.url}/v1`,
      })[k],
  );
  handler = createAdminActionsHandler(createDeps(env));
  admin = await createUser(undefined, { admin: true });
  customer = await createUser();
});

afterAll(async () => {
  await Promise.all([supa.close(), resend.close(), ai.close()]);
  await pool.end();
});

function post(body: unknown, user: TestUser | null = admin) {
  return handler(
    new Request("https://fn.test/admin-actions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.test",
        ...(user
          ? { authorization: `Bearer ${fakeJwt({ sub: user.id, email: user.email })}` }
          : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function paidOrder(locale: "de" | "en" = "de") {
  const p = await makeProduct({ priceCents: 25000, stocks: [3] });
  const r = await reserve({
    lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
    email: "kunde@example.ch",
    locale,
  });
  await rpc("complete_order", [
    r.order_id,
    JSON.stringify({
      amount_total_cents: r.total_cents,
      email: "kunde@example.ch",
      payment_method: "twint",
      name: "Max Muster",
      address: { line1: "Dorfstrasse 2", postal_code: "8498", city: "Gibswil", country: "CH" },
    }),
  ]);
  return r;
}

describe("admin-actions: Zugriff", () => {
  it("ohne Anmeldung 401, ohne Admin-Rolle 403", async () => {
    expect((await post({ action: "ship" }, null)).status).toBe(401);
    const res = await post({ action: "ship" }, customer);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "FORBIDDEN" });
  });

  it("unbekannte Aktion: 400", async () => {
    expect((await post({ action: "alles_loeschen" })).status).toBe(400);
  });
});

describe("admin-actions: Versand", () => {
  it("markiert als versendet, speichert die Sendungsnummer und schickt die Versandmeldung", async () => {
    const r = await paidOrder();
    const before = resend.sent.length;
    const res = await post({
      action: "ship",
      orderId: r.order_id,
      trackingNumber: " 99.00.123456.12345678 ",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "shipped",
      trackingNumber: "99.00.123456.12345678",
      emailed: true,
    });
    const mail = resend.sent[before]!;
    expect(mail.to).toEqual(["kunde@example.ch"]);
    expect(mail.subject).toBe(`Deine Bestellung AX-${r.order_number} ist unterwegs`);
    expect(mail.text).toContain(
      "https://www.post.ch/swisspost-tracking?formattedParcelCodes=99.00.123456.12345678",
    );
    const row = await sql<{
      status: string;
      tracking_number: string;
      shipping_sent_at: Date | null;
    }>("select status, tracking_number, shipping_sent_at from public.orders where id = $1", [
      r.order_id,
    ]);
    expect(row[0]).toMatchObject({ status: "shipped", tracking_number: "99.00.123456.12345678" });
    expect(row[0]!.shipping_sent_at).not.toBeNull();
  });

  it("ohne Benachrichtigung: keine E-Mail", async () => {
    const r = await paidOrder();
    const before = resend.sent.length;
    const res = await post({ action: "ship", orderId: r.order_id, notify: false });
    expect(await res.json()).toEqual({ status: "shipped", trackingNumber: null, emailed: false });
    expect(resend.sent.length).toBe(before);
  });

  it("offene Bestellung: 409; ungültige Sendungsnummer: 400; unbekannte Bestellung: 404", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const pending = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const res = await post({ action: "ship", orderId: pending.order_id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ORDER_NOT_SHIPPABLE" });
    const paid = await paidOrder();
    const bad = await post({ action: "ship", orderId: paid.order_id, trackingNumber: "<b>x</b>" });
    expect(await bad.json()).toEqual({ error: "INVALID_TRACKING" });
    const missing = await post({ action: "ship", orderId: "00000000-0000-4000-8000-000000000000" });
    expect(missing.status).toBe(404);
    expect((await post({ action: "ship", orderId: "kein-uuid" })).status).toBe(400);
  });

  it("E-Mail scheitert: Versand bleibt gespeichert, Antwort meldet den Fehler; erneut senden klappt", async () => {
    const r = await paidOrder("en");
    resend.failNext();
    const res = await post({ action: "ship", orderId: r.order_id, trackingNumber: "ABC123456" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "shipped",
      trackingNumber: "ABC123456",
      emailed: false,
      emailError: true,
    });
    const before = resend.sent.length;
    const again = await post({ action: "resend_shipping", orderId: r.order_id });
    expect(await again.json()).toEqual({ emailed: true, to: "kunde@example.ch" });
    expect(resend.sent[before]!.subject).toBe(`Your order AX-${r.order_number} is on its way`);
    expect(resend.sent[before]!.idempotencyKey).toBeUndefined();
  });
});

describe("admin-actions: Bestätigung erneut senden", () => {
  it("schickt die Bestellbestätigung, optional an eine andere Adresse; offene Bestellung 409", async () => {
    const r = await paidOrder();
    let before = resend.sent.length;
    expect(
      await (await post({ action: "resend_confirmation", orderId: r.order_id })).json(),
    ).toEqual({ emailed: true, to: "kunde@example.ch" });
    expect(resend.sent[before]!.subject).toBe(`Bestellbestätigung AX-${r.order_number}`);
    before = resend.sent.length;
    await post({ action: "resend_confirmation", orderId: r.order_id, to: "Neu@Example.ch" });
    expect(resend.sent[before]!.to).toEqual(["neu@example.ch"]);
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const pending = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const res = await post({ action: "resend_confirmation", orderId: pending.order_id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ORDER_NOT_PAID" });
  });
});

describe("admin-actions: Gutscheine", () => {
  it("stellt einen Gutschein aus, vermerkt das Admin und schickt ihn an die beschenkte Person", async () => {
    const before = resend.sent.length;
    const res = await post({
      action: "issue_gift_card",
      amountCents: 15000,
      locale: "de",
      recipientEmail: "Lea@Example.ch",
      recipientName: "Lea",
      senderName: "Axion",
      message: "Danke für deine Treue",
      note: "Kulanz",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      giftCard: { id: string; code: string; balance_cents: number };
      emailed: boolean;
    };
    expect(body.emailed).toBe(true);
    expect(body.giftCard.code).toMatch(
      /^AXN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
    expect(body.giftCard.balance_cents).toBe(15000);
    const mail = resend.sent[before]!;
    expect(mail.to).toEqual(["lea@example.ch"]);
    expect(mail.text).toContain(body.giftCard.code);
    const row = await sql<{ created_by: string; note: string }>(
      "select created_by, note from public.gift_cards where id = $1",
      [body.giftCard.id],
    );
    expect(row[0]).toEqual({ created_by: admin.id, note: "Kulanz" });
  });

  it("ohne E-Mail-Adresse oder mit send=false: nur ausstellen (z. B. für den Laden)", async () => {
    const before = resend.sent.length;
    const a = (await (await post({ action: "issue_gift_card", amountCents: 5000 })).json()) as {
      emailed: boolean;
      giftCard: { code: string };
    };
    expect(a.emailed).toBe(false);
    const b = (await (
      await post({
        action: "issue_gift_card",
        amountCents: 5000,
        recipientEmail: "x@example.ch",
        send: false,
      })
    ).json()) as { emailed: boolean };
    expect(b.emailed).toBe(false);
    expect(resend.sent.length).toBe(before);
  });

  it("ungültiger Betrag oder Adresse: 400", async () => {
    expect(await (await post({ action: "issue_gift_card", amountCents: 50 })).json()).toEqual({
      error: "INVALID_AMOUNT",
    });
    expect(await (await post({ action: "issue_gift_card", amountCents: "100" })).json()).toEqual({
      error: "INVALID_AMOUNT",
    });
    expect(
      await (
        await post({ action: "issue_gift_card", amountCents: 5000, recipientEmail: "kaputt" })
      ).json(),
    ).toEqual({ error: "INVALID_EMAIL" });
  });

  it("Gutschein erneut senden: an die beschenkte Person oder eine andere Adresse; unbekannt 404", async () => {
    const issued = (await (
      await post({
        action: "issue_gift_card",
        amountCents: 7500,
        locale: "en",
        recipientEmail: "tom@example.ch",
        send: false,
      })
    ).json()) as { giftCard: { id: string; code: string } };
    let before = resend.sent.length;
    expect(
      await (await post({ action: "resend_gift_card", giftCardId: issued.giftCard.id })).json(),
    ).toEqual({ emailed: true, to: "tom@example.ch" });
    expect(resend.sent[before]!.subject).toBe("Your Axion gift card worth CHF 75.00");
    before = resend.sent.length;
    await post({
      action: "resend_gift_card",
      giftCardId: issued.giftCard.id,
      to: "anna@example.ch",
    });
    expect(resend.sent[before]!.to).toEqual(["anna@example.ch"]);
    expect(
      (
        await post({
          action: "resend_gift_card",
          giftCardId: "00000000-0000-4000-8000-000000000000",
        })
      ).status,
    ).toBe(404);
  });
});

describe("admin-actions: Übersetzung", () => {
  it("übersetzt Texte über das AI-Gateway, leere bleiben leer", async () => {
    const before = ai.calls.length;
    const res = await post({
      action: "translate",
      texts: ["Anzug Limmat", "", "Reine Schurwolle"],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      translations: ["EN: Anzug Limmat", "", "EN: Reine Schurwolle"],
    });
    expect(ai.calls.length).toBe(before + 1);
    expect(ai.calls.at(-1)!.authorization).toBe("Bearer lov_test");
    expect(ai.calls.at(-1)!.body.model).toBe("google/gemini-2.5-flash");
  });

  it("nur fürs Admin: ohne Anmeldung 401, Kundschaft 403", async () => {
    expect((await post({ action: "translate", texts: ["Anzug"] }, null)).status).toBe(401);
    expect((await post({ action: "translate", texts: ["Anzug"] }, customer)).status).toBe(403);
  });

  it("falsche oder zu grosse Eingaben: 400", async () => {
    for (const [texts, code] of [
      [undefined, "BAD_REQUEST"],
      [[], "BAD_REQUEST"],
      [["ok", 3], "BAD_REQUEST"],
      [Array.from({ length: 61 }, () => "x"), "TOO_MANY_TEXTS"],
      [["x".repeat(4001)], "TEXT_TOO_LONG"],
      [Array.from({ length: 5 }, () => "x".repeat(3500)), "TEXT_TOO_LONG"],
    ] as const) {
      const res = await post({ action: "translate", texts });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: code });
    }
  });

  it("Tagesdeckel pro Admin (500 Anfragen): 429 DAILY_LIMIT ohne Aufruf des Gateways", async () => {
    const key = "encode(extensions.digest($1::text, 'sha256'), 'hex')";
    await sql(
      `insert into private.rate_limits (key, window_start, hits) values (${key}, now(), 500)
       on conflict (key) do update set window_start = now(), hits = 500`,
      [`translate:${admin.id}`],
    );
    try {
      const before = ai.calls.length;
      const res = await post({ action: "translate", texts: ["Anzug"] });
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ error: "DAILY_LIMIT" });
      expect(ai.calls.length).toBe(before);
      // nur leere Texte: kein Aufruf, zählt nicht
      const empty = await post({ action: "translate", texts: ["", " "] });
      expect(empty.status).toBe(200);
      expect(await empty.json()).toEqual({ translations: ["", ""] });
    } finally {
      await sql(`delete from private.rate_limits where key = ${key}`, [`translate:${admin.id}`]);
    }
  });

  it("Guthaben aufgebraucht: 503, Gateway überlastet: 429, Gateway kaputt: 502", async () => {
    for (const [status, expected, code] of [
      [402, 503, "TRANSLATION_UNAVAILABLE"],
      [429, 429, "RATE_LIMITED"],
      [500, 502, "TRANSLATION_FAILED"],
    ] as const) {
      ai.failNext(status);
      const res = await post({ action: "translate", texts: ["Anzug"] });
      expect(res.status).toBe(expected);
      expect(await res.json()).toEqual({ error: code });
    }
  });
});
