import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createUser, pool, sql, uniq } from "../../tests/helpers.ts";
import { makeGiftCard, makeProduct, stockOf } from "../../tests/fixtures.ts";
import {
  ANON_KEY,
  fakeJwt,
  SERVICE_KEY,
  startFakeResend,
  startFakeStripe,
  startFakeSupabase,
} from "../../tests/fakes/servers.ts";
import { createCheckoutHandler } from "./handler.ts";

// Verschachtelter Formular-Body, wie stripe-node ihn sendet (Werte sind Strings, Arrays, Objekte).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeForm = Record<string, any>;

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let stripe: Awaited<ReturnType<typeof startFakeStripe>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;
// Mit echter Uhr: Die Datenbank rechnet mit der echten Zeit (Reservierungen, offene Kassen).
let liveHandler: (req: Request) => Promise<Response>;

beforeAll(async () => {
  supa = await startFakeSupabase();
  stripe = await startFakeStripe();
  resend = await startFakeResend();
  const env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test/",
        STRIPE_SECRET_KEY: "sk_test_fake",
        STRIPE_API_BASE: stripe.url,
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
        EMAIL_FROM: "Axion <bestellung@shop.test>",
        SHOP_NOTIFY_EMAIL: "shop@shop.test",
        SHOP_CONTACT_EMAIL: "hallo@shop.test",
      })[k],
  );
  handler = createCheckoutHandler(createDeps(env, { now: () => new Date("2026-10-12T10:00:00Z") }));
  liveHandler = createCheckoutHandler(createDeps(env));
});

afterAll(async () => {
  await Promise.all([supa.close(), stripe.close(), resend.close()]);
  await pool.end();
});

function post(body: unknown, headers: Record<string, string> = {}, h = handler) {
  return h(
    new Request("https://fn.test/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.test", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("checkout: Warenkorb", () => {
  it("erstellt eine Stripe-Session mit DB-Preisen, Coupon und Bestellbezug", async () => {
    const p = await makeProduct({ priceCents: 48900, stocks: [3] });
    const card = await makeGiftCard(5000);
    const res = await post({
      kind: "cart",
      locale: "en",
      email: "max@example.ch",
      giftCardCode: card,
      lines: [{ variantId: p.variants[0]!.id, quantity: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://shop.test");
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.test\//);

    const coupon = stripe.calls.find((c) => c.path === "/v1/coupons")!;
    expect(coupon.body).toMatchObject({
      amount_off: "5000",
      currency: "chf",
      duration: "once",
      max_redemptions: "1",
      name: "Gift card",
    });
    const session = stripe.calls.findLast((c) => c.path === "/v1/checkout/sessions")!
      .body as StripeForm;
    expect(session["mode"]).toBe("payment");
    expect(session["locale"]).toBe("en");
    expect(session["payment_method_types"]).toBeUndefined();
    expect(session["integration_identifier"]).toMatch(/^axion_shop_checkout_[A-Z]{8}$/);
    expect(session["line_items"][0]).toMatchObject({
      quantity: "2",
      price_data: {
        currency: "chf",
        unit_amount: "48900",
        product_data: { name: expect.stringMatching(/^Test EN /) },
      },
    });
    expect(session["discounts"][0].coupon).toMatch(/^co_/);
    // Ohne SHIPPING_COUNTRIES nur Schweiz (Liechtenstein erst nach Entscheid des Kunden, eigenes Konsumentenrecht)
    expect(session["shipping_address_collection"]).toEqual({ allowed_countries: ["CH"] });
    expect(session["shipping_options"][0].shipping_rate_data.fixed_amount).toEqual({
      amount: "0",
      currency: "chf",
    });
    expect(session["success_url"]).toMatch(
      /^https:\/\/shop\.test\/en\/bestellung\/[0-9a-f-]{36}\?bezahlt=1$/,
    );
    expect(session["cancel_url"]).toMatch(
      /^https:\/\/shop\.test\/en\/warenkorb\?abgebrochen=[0-9a-f-]{36}$/,
    );
    // Stripe verlangt mindestens 30 Minuten ab Erstellung; 31, damit Netzwerkzeit nicht stört
    expect(Number(session["expires_at"])).toBe(
      Math.floor(new Date("2026-10-12T10:31:00Z").getTime() / 1000),
    );
    const orderId = session["metadata"].order_id as string;
    expect(session["client_reference_id"]).toBe(orderId);
    const order = await sql<{ status: string; total_cents: number; stripe_session_id: string }>(
      "select status, total_cents, stripe_session_id from public.orders where id = $1",
      [orderId],
    );
    expect(order[0]).toMatchObject({ status: "pending", total_cents: 92800 });
    expect(order[0]!.stripe_session_id).toMatch(/^cs_test_/);
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
  });

  it("Gutschein deckt alles: Stripe-Session ohne Zahlbetrag, damit Stripe die Lieferadresse erfasst", async () => {
    const p = await makeProduct({ priceCents: 12900, stocks: [2], category: "westen" });
    const card = await makeGiftCard(20000);
    const sentBefore = resend.sent.length;
    const res = await post({
      kind: "cart",
      locale: "de",
      email: "lea@example.ch",
      giftCardCode: card,
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    });
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    const coupon = stripe.calls.findLast((c) => c.path === "/v1/coupons")!.body as StripeForm;
    expect(coupon["amount_off"]).toBe("12900");
    const session = stripe.calls.findLast((c) => c.path === "/v1/checkout/sessions")!
      .body as StripeForm;
    expect(session["shipping_address_collection"]).toEqual({ allowed_countries: ["CH"] });
    expect(session["shipping_options"][0].shipping_rate_data.fixed_amount.amount).toBe("0");
    expect(session["payment_intent_data"]).toBeUndefined();
    expect(resend.sent.length).toBe(sentBefore);
    const order = await sql<{ status: string; total_cents: number }>(
      "select status, total_cents from public.orders where email = 'lea@example.ch' order by created_at desc limit 1",
    );
    expect(order[0]).toEqual({ status: "pending", total_cents: 0 });
  });

  it("ausverkauft: 409 mit verfügbarer Menge", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const res = await post({
      kind: "cart",
      email: "a@example.ch",
      lines: [{ variantId: p.variants[0]!.id, quantity: 3 }],
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "OUT_OF_STOCK",
      items: [{ variantId: p.variants[0]!.id, available: 1 }],
    });
  });

  it("ungültiger Rabattcode: 422 mit Grund", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const res = await post({
      kind: "cart",
      email: "a@example.ch",
      discountCode: "NIX",
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "DISCOUNT_INVALID", reason: "not_found" });
  });

  it("kurzer Stripe-Ausfall: stripe-node wiederholt selbst und die Kasse klappt", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    stripe.failNextSession(1);
    const res = await post({
      kind: "cart",
      email: "a@example.ch",
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    });
    expect(res.status).toBe(200);
  });

  it("anhaltender Stripe-Fehler: 502 und die Reservierung wird zurückgegeben", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    stripe.failNextSession(3);
    const res = await post({
      kind: "cart",
      email: "a@example.ch",
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    });
    expect(res.status).toBe(502);
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
  });

  it("eingeloggte Kundschaft: Bestellung hängt am Konto, E-Mail aus dem Konto", async () => {
    const user = await createUser();
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const res = await post(
      { kind: "cart", lines: [{ variantId: p.variants[0]!.id, quantity: 1 }] },
      { authorization: `Bearer ${fakeJwt({ sub: user.id, email: user.email })}` },
    );
    expect(res.status).toBe(200);
    const order = await sql<{ user_id: string; email: string }>(
      "select user_id, email from public.orders where user_id = $1",
      [user.id],
    );
    expect(order[0]).toEqual({ user_id: user.id, email: user.email });
  });

  it("ungültige Eingaben: 400", async () => {
    for (const body of [
      { kind: "cart", email: "a@example.ch", lines: [] },
      { kind: "cart", email: "a@example.ch", lines: [{ variantId: "x", quantity: 1 }] },
      { kind: "cart", lines: [{ variantId: "00000000-0000-4000-8000-000000000000", quantity: 1 }] },
      { kind: "irgendwas", email: "a@example.ch" },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }
    const bad = await handler(
      new Request("https://fn.test/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "kein json",
      }),
    );
    expect(bad.status).toBe(400);
    // ohne JSON-Content-Type (z. B. text/plain von einer fremden Seite ohne CORS-Prüfung): 415
    const plain = await handler(
      new Request("https://fn.test/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "cart", email: "a@example.ch", lines: [] }),
      }),
    );
    expect(plain.status).toBe(415);
  });
});

describe("checkout: Geschenkgutschein", () => {
  it("erstellt eine Session für den Gutscheinbetrag ohne Lieferadresse", async () => {
    const res = await post({
      kind: "gift_card",
      locale: "de",
      email: "tom@example.ch",
      amountCents: 15000,
      recipientName: "Lea",
      recipientEmail: "lea@example.ch",
      message: "Alles Gute",
    });
    expect(res.status).toBe(200);
    const session = stripe.calls.findLast((c) => c.path === "/v1/checkout/sessions")!
      .body as StripeForm;
    expect(session["line_items"][0]).toMatchObject({
      quantity: "1",
      price_data: {
        unit_amount: "15000",
        product_data: { name: "Axion-Geschenkgutschein", description: "Für Lea" },
      },
    });
    expect(session["shipping_address_collection"]).toBeUndefined();
    expect(session["cancel_url"]).toMatch(
      /^https:\/\/shop\.test\/geschenkgutschein\?abgebrochen=[0-9a-f-]{36}$/,
    );
    expect(session["metadata"].kind).toBe("gift_card");
  });

  it("ungültige Empfängeradresse: 400 INVALID_RECIPIENT_EMAIL", async () => {
    const res = await post({
      kind: "gift_card",
      email: "tom@example.ch",
      amountCents: 15000,
      recipientEmail: "lea@",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("INVALID_RECIPIENT_EMAIL");
  });

  it("Betrag ausserhalb der Grenzen: 400", async () => {
    const res = await post({ kind: "gift_card", email: "tom@example.ch", amountCents: 500 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("INVALID_AMOUNT");
  });
});

describe("checkout: CORS", () => {
  it("erlaubt nur die Shop-Domain (Vorschau und localhost nur mit ALLOW_PREVIEW_ORIGINS=1)", async () => {
    for (const [origin, allowed] of [
      ["https://shop.test", true],
      ["https://id-preview--abc.lovable.app", false],
      ["http://localhost:5174", false],
      ["https://boese.example", false],
    ] as const) {
      const res = await handler(
        new Request("https://fn.test/checkout", { method: "OPTIONS", headers: { origin } }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe(allowed ? origin : null);
    }
  });
});

describe("checkout: Abbruch in der Stripe-Kasse", () => {
  it("gibt die Reservierung über das Token aus der cancel_url frei und beendet die Stripe-Session", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const res = await post({
      kind: "cart",
      email: "a@example.ch",
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    });
    expect(res.status).toBe(200);
    expect(await stockOf(p.variants[0]!.id)).toBe(0);
    const session = stripe.calls.findLast((c) => c.path === "/v1/checkout/sessions")!
      .body as StripeForm;
    const token = String(session["cancel_url"]).split("abgebrochen=")[1]!;
    const release = await post({ kind: "release", token });
    expect(await release.json()).toEqual({ released: true });
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
    expect(
      stripe.calls.some((c) => /\/v1\/checkout\/sessions\/cs_test_[^/]+\/expire$/.test(c.path)),
    ).toBe(true);
    const again = await post({ kind: "release", token });
    expect(await again.json()).toEqual({ released: false });
    expect((await post({ kind: "release", token: "kaputt" })).status).toBe(400);
  });
});

describe("checkout: Abbruch bei schon bezahlter Session", () => {
  it("gibt nichts frei, Gutschein bleibt verbraucht (kein doppelter Einsatz)", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const card = await makeGiftCard(4000);
    const res = await post({
      kind: "cart",
      email: `${uniq("bezahlt")}@example.ch`,
      giftCardCode: card,
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    });
    expect(res.status).toBe(200);
    const session = stripe.calls.findLast((c) => c.path === "/v1/checkout/sessions")!
      .body as StripeForm;
    const token = String(session["cancel_url"]).split("abgebrochen=")[1]!;
    const row = await sql<{ stripe_session_id: string }>(
      "select stripe_session_id from public.orders where status_token = $1",
      [token],
    );
    stripe.completeSession(row[0]!.stripe_session_id);
    const release = await post({ kind: "release", token });
    expect(await release.json()).toEqual({ released: false });
    expect(await stockOf(p.variants[0]!.id)).toBe(0);
    const balance = await sql<{ balance_cents: number }>(
      "select balance_cents from public.gift_cards where code = $1",
      [card],
    );
    expect(balance[0]!.balance_cents).toBe(0);
    const order = await sql<{ status: string }>(
      "select status from public.orders where status_token = $1",
      [token],
    );
    expect(order[0]!.status).toBe("pending");
  });
});

describe("checkout: Schutz vor Missbrauch", () => {
  it("höchstens 3 offene Kassen pro E-Mail-Adresse", async () => {
    const p = await makeProduct({ priceCents: 1000, stocks: [10] });
    const email = `${uniq("viel")}@example.ch`;
    const once = () =>
      post(
        { kind: "cart", email, lines: [{ variantId: p.variants[0]!.id, quantity: 1 }] },
        {},
        liveHandler,
      );
    for (let i = 0; i < 3; i++) expect((await once()).status).toBe(200);
    const fourth = await once();
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toEqual({ error: "TOO_MANY_CHECKOUTS" });
    expect(await stockOf(p.variants[0]!.id)).toBe(7);
  });

  it("höchstens 3 neue Kassen pro IP-Adresse in 35 Minuten (verschiedene E-Mail-Adressen)", async () => {
    const p = await makeProduct({ priceCents: 1000, stocks: [100] });
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const results: { status: number; body: unknown }[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await post(
        {
          kind: "cart",
          email: `${uniq("ip")}@example.ch`,
          lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
        },
        { "cf-connecting-ip": ip },
        liveHandler,
      );
      results.push({ status: res.status, body: await res.json() });
    }
    expect(results.slice(0, 3).every((r) => r.status === 200)).toBe(true);
    expect(results[3]).toEqual({ status: 429, body: { error: "TOO_MANY_CHECKOUTS" } });
    expect(await stockOf(p.variants[0]!.id)).toBe(97);
  });

  it("ohne erkennbare IP gilt ein gemeinsamer Zähler (30 in 30 Minuten)", async () => {
    await sql("delete from private.rate_limits where key = private.hash_token($1)", [
      "checkout-noip",
    ]);
    const p = await makeProduct({ priceCents: 1000, stocks: [100] });
    let last = 0;
    for (let i = 0; i < 31; i++) {
      const res = await post(
        {
          kind: "cart",
          email: `${uniq("noip")}@example.ch`,
          lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
        },
        {},
        liveHandler,
      );
      last = res.status;
      if (i < 30) expect(res.status).toBe(200);
    }
    expect(last).toBe(429);
    await sql("delete from private.rate_limits where key = private.hash_token($1)", [
      "checkout-noip",
    ]);
  });
});

describe("checkout: Höchstmengen", () => {
  const send = (lines: { variantId: string; quantity: number }[]) =>
    post({ kind: "cart", email: `${uniq("menge")}@example.ch`, lines });

  it("mehr als 3 Stück je Grösse: 400 INVALID_LINES, auch auf mehrere Zeilen verteilt", async () => {
    const p = await makeProduct({ priceCents: 1000, stocks: [50] });
    const id = p.variants[0]!.id;
    for (const lines of [
      [{ variantId: id, quantity: 4 }],
      [
        { variantId: id, quantity: 2 },
        { variantId: id, quantity: 2 },
      ],
    ]) {
      const res = await send(lines);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("INVALID_LINES");
    }
    expect(await stockOf(id)).toBe(50);
  });

  it("mehr als 20 Stück je Bestellung: 400 INVALID_LINES; genau 20 gehen", async () => {
    const p = await makeProduct({ priceCents: 1000, stocks: Array(7).fill(10) });
    const ids = p.variants.map((v) => v.id);
    const six = ids.slice(0, 6).map((variantId) => ({ variantId, quantity: 3 }));
    const over = await send([...six, { variantId: ids[6]!, quantity: 3 }]);
    expect(over.status).toBe(400);
    expect(await over.json()).toEqual({
      error: "INVALID_LINES",
      detail: { reason: "order_quantity" },
    });
    expect((await send([...six, { variantId: ids[6]!, quantity: 2 }])).status).toBe(200);
  });
});

describe("checkout: Erinnerung an abgebrochene Kasse (Einwilligung)", () => {
  async function optIn(body: Record<string, unknown>) {
    const p = await makeProduct({ priceCents: 20000, stocks: [3] });
    const res = await post({
      kind: "cart",
      locale: "de",
      email: `${uniq("remind")}@example.ch`,
      lines: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      ...body,
    });
    expect(res.status).toBe(200);
    const { orderNumber } = (await res.json()) as { orderNumber: number };
    return (
      await sql<{ reminder_opt_in: boolean | null; reminder_sent_at: string | null }>(
        "select reminder_opt_in, reminder_sent_at from public.orders where number = $1",
        [orderNumber],
      )
    )[0]!;
  }

  it("remind: true speichert die Einwilligung an der Bestellung", async () => {
    expect(await optIn({ remind: true })).toEqual({
      reminder_opt_in: true,
      reminder_sent_at: null,
    });
  });

  it("ohne Angabe oder mit anderem Wert bleibt die Einwilligung aus", async () => {
    expect((await optIn({})).reminder_opt_in).toBe(false);
    expect((await optIn({ remind: false })).reminder_opt_in).toBe(false);
    expect((await optIn({ remind: "true" })).reminder_opt_in).toBe(false);
    expect((await optIn({ remind: 1 })).reminder_opt_in).toBe(false);
  });

  it("Geschenkgutschein-Kauf: kein Erinnerungsmerker, auch wenn remind mitgeschickt wird", async () => {
    const res = await post({
      kind: "gift_card",
      locale: "de",
      amountCents: 5000,
      email: `${uniq("gk")}@example.ch`,
      remind: true,
    });
    expect(res.status).toBe(200);
    const { orderNumber, statusToken } = (await res.json()) as {
      orderNumber: number;
      statusToken: string;
    };
    const row = await sql<{ reminder_opt_in: boolean | null; status_token: string }>(
      "select reminder_opt_in, status_token from public.orders where number = $1",
      [orderNumber],
    );
    expect(row[0]!.reminder_opt_in).toBe(false);
    // Die Seite braucht das Token, um die Reservierung bei «Zurück» im Browser freizugeben
    expect(statusToken).toBe(row[0]!.status_token);
  });
});
