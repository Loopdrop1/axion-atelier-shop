import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import { makeGiftCard, makeProduct, reserve, rpc, stockOf } from "../../tests/fixtures.ts";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeStripe,
  startFakeSupabase,
} from "../../tests/fakes/servers.ts";
import { createStripeWebhookHandler } from "./handler.ts";

const SECRET = "whsec_test_secret";
let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let stripe: Awaited<ReturnType<typeof startFakeStripe>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;
const signer = new Stripe("sk_test_signer");

beforeAll(async () => {
  supa = await startFakeSupabase();
  stripe = await startFakeStripe({ paymentMethod: "twint" });
  resend = await startFakeResend();
  const env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        STRIPE_SECRET_KEY: "sk_test_fake",
        STRIPE_WEBHOOK_SECRET: SECRET,
        STRIPE_API_BASE: stripe.url,
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
        SHOP_NOTIFY_EMAIL: "shop@shop.test",
      })[k],
  );
  handler = createStripeWebhookHandler(createDeps(env));
});

afterAll(async () => {
  await Promise.all([supa.close(), stripe.close(), resend.close()]);
  await pool.end();
});

async function deliver(type: string, object: Record<string, unknown>, id = uniq("evt")) {
  const payload = JSON.stringify({
    id,
    object: "event",
    type,
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = await signer.webhooks.generateTestHeaderStringAsync({ payload, secret: SECRET });
  return handler(
    new Request("https://fn.test/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: payload,
    }),
  );
}

function session(orderId: string, extra: Record<string, unknown> = {}) {
  return {
    id: uniq("cs_test"),
    object: "checkout.session",
    client_reference_id: orderId,
    metadata: { order_id: orderId },
    payment_status: "paid",
    payment_intent: uniq("pi"),
    amount_total: 10000,
    customer_details: { email: "kundin@example.ch", name: "Anna Muster", phone: null },
    collected_information: {
      shipping_details: {
        name: "Anna Muster",
        address: {
          line1: "Bahnhofstrasse 1",
          line2: null,
          postal_code: "8001",
          city: "Zürich",
          country: "CH",
        },
      },
    },
    ...extra,
  };
}

async function pendingOrder(
  price = 10000,
  opts: { email?: string; locale?: "de" | "en"; remind?: boolean } = {},
) {
  const p = await makeProduct({ priceCents: price, stocks: [10] });
  const r = await reserve({
    lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
    email: opts.email ?? "kundin@example.ch",
    ...(opts.locale ? { locale: opts.locale } : {}),
  });
  if (opts.remind) await rpc("set_order_reminder", [r.order_id, true]);
  return { product: p, order: r };
}

describe("stripe-webhook", () => {
  it("lehnt falsche Signaturen ab", async () => {
    const res = await handler(
      new Request("https://fn.test/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=falsch" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("verbucht die Zahlung, speichert Adresse und Zahlungsart und schickt die E-Mails genau einmal", async () => {
    const { order } = await pendingOrder();
    const before = resend.sent.length;
    const evtId = uniq("evt");
    const s = session(order.order_id);
    expect((await deliver("checkout.session.completed", s, evtId)).status).toBe(200);
    const row = await sql<{
      status: string;
      payment_method: string;
      shipping_name: string;
      shipping_address: { city: string };
      needs_attention: boolean;
    }>(
      "select status, payment_method, shipping_name, shipping_address, needs_attention from public.orders where id = $1",
      [order.order_id],
    );
    expect(row[0]).toMatchObject({
      status: "paid",
      payment_method: "twint",
      shipping_name: "Anna Muster",
      shipping_address: { city: "Zürich" },
      needs_attention: false,
    });
    const mails = resend.sent.slice(before);
    expect(mails.map((m: { to: string[] }) => m.to[0])).toEqual([
      "kundin@example.ch",
      "shop@shop.test",
    ]);
    expect(mails[0]!.text).toContain("Bahnhofstrasse 1");
    expect(mails[0]!.text).toContain("TWINT");

    const dup = await deliver("checkout.session.completed", s, evtId);
    expect(await dup.json()).toEqual({ received: true, duplicate: true });
    const again = await deliver("checkout.session.completed", s);
    expect(again.status).toBe(200);
    expect(resend.sent.length - before).toBe(2);
  });

  it("asynchrone Zahlung: erst bei async_payment_succeeded verbuchen", async () => {
    const { order } = await pendingOrder();
    await deliver(
      "checkout.session.completed",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    expect(
      (
        await sql<{ status: string }>("select status from public.orders where id = $1", [
          order.order_id,
        ])
      )[0]!.status,
    ).toBe("pending");
    await deliver("checkout.session.async_payment_succeeded", session(order.order_id));
    expect(
      (
        await sql<{ status: string }>("select status from public.orders where id = $1", [
          order.order_id,
        ])
      )[0]!.status,
    ).toBe("paid");
  });

  it("abgelaufene Session storniert und gibt Bestand zurück", async () => {
    const { product, order } = await pendingOrder();
    expect(await stockOf(product.variants[0]!.id)).toBe(9);
    await deliver(
      "checkout.session.expired",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    expect(await stockOf(product.variants[0]!.id)).toBe(10);
    expect(
      (
        await sql<{ status: string }>("select status from public.orders where id = $1", [
          order.order_id,
        ])
      )[0]!.status,
    ).toBe("cancelled");
  });

  it("fehlgeschlagene asynchrone Zahlung storniert", async () => {
    const { order } = await pendingOrder();
    await deliver(
      "checkout.session.async_payment_failed",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    expect(
      (
        await sql<{ status: string; cancel_reason: string }>(
          "select status, cancel_reason from public.orders where id = $1",
          [order.order_id],
        )
      )[0],
    ).toEqual({ status: "cancelled", cancel_reason: "payment_failed" });
  });

  it("Rückerstattung wird übernommen", async () => {
    const { order } = await pendingOrder();
    const s = session(order.order_id);
    await deliver("checkout.session.completed", s);
    await deliver("charge.refunded", {
      id: "ch_1",
      object: "charge",
      payment_intent: s.payment_intent,
      amount_refunded: 10000,
    });
    expect(
      (
        await sql<{ status: string; refunded_cents: number }>(
          "select status, refunded_cents from public.orders where id = $1",
          [order.order_id],
        )
      )[0],
    ).toEqual({ status: "refunded", refunded_cents: 10000 });
  });

  it("Bestellung ohne Zahlbetrag (Gutschein deckt alles): bezahlt, mit Lieferadresse, Zahlungsart Gutschein", async () => {
    const p = await makeProduct({ priceCents: 8000, stocks: [1] });
    const card = await makeGiftCard(20000);
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      email: "frei@example.ch",
      giftCard: card,
    });
    expect(r.total_cents).toBe(0);
    const res = await deliver(
      "checkout.session.completed",
      session(r.order_id, {
        payment_status: "no_payment_required",
        payment_intent: null,
        amount_total: 0,
        customer_details: { email: "frei@example.ch", name: "Frei", phone: null },
      }),
    );
    expect(res.status).toBe(200);
    const o = (
      await sql<{ status: string; payment_method: string; shipping_address: { city: string } }>(
        "select status, payment_method, shipping_address from public.orders where id = $1",
        [r.order_id],
      )
    )[0]!;
    expect(o).toMatchObject({ status: "paid", payment_method: "gift_card" });
    expect(o.shipping_address.city).toBe("Zürich");
  });

  it("Ereignis noch in Bearbeitung: 409, damit Stripe wiederholt; hängengeblieben wird neu verarbeitet", async () => {
    const { order } = await pendingOrder();
    const s = session(order.order_id);
    const id = uniq("evt");
    await sql(
      "insert into public.stripe_events (id, type) values ($1, 'checkout.session.completed')",
      [id],
    );
    const busy = await deliver("checkout.session.completed", s, id);
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ error: "IN_PROGRESS" });
    await sql(
      "update public.stripe_events set received_at = now() - interval '6 minutes' where id = $1",
      [id],
    );
    expect((await deliver("checkout.session.completed", s, id)).status).toBe(200);
    const paid = await sql<{ status: string }>("select status from public.orders where id = $1", [
      order.order_id,
    ]);
    expect(paid[0]!.status).toBe("paid");
    const again = await deliver("checkout.session.completed", s, id);
    expect(await again.json()).toEqual({ received: true, duplicate: true });
  });

  it("Gutscheinkauf zurückerstattet: unbenutzter Gutschein gesperrt, benutzter zusätzlich zur Prüfung markiert", async () => {
    const issue = async (amount: number) => {
      const r = await rpc<{ order_id: string }>("reserve_gift_card_purchase", [
        amount,
        "kaeuferin@example.ch",
        "de",
        JSON.stringify({}),
        null,
      ]);
      const s = session(r.order_id, { amount_total: amount, collected_information: null });
      await deliver("checkout.session.completed", s);
      return { orderId: r.order_id, pi: s.payment_intent };
    };
    const card = (orderId: string) =>
      sql<{ status: string; balance_cents: number }>(
        "select g.status, g.balance_cents from public.gift_cards g join public.orders o on o.issued_gift_card_id = g.id where o.id = $1",
        [orderId],
      ).then((rows: { status: string; balance_cents: number }[]) => rows[0]!);
    const unused = await issue(5000);
    await deliver("charge.refunded", {
      id: uniq("ch"),
      object: "charge",
      payment_intent: unused.pi,
      amount_refunded: 5000,
    });
    expect(await card(unused.orderId)).toEqual({ status: "disabled", balance_cents: 0 });

    const used = await issue(5000);
    await sql(
      "update public.gift_cards set balance_cents = 1000 where id = (select issued_gift_card_id from public.orders where id = $1)",
      [used.orderId],
    );
    await deliver("charge.refunded", {
      id: uniq("ch"),
      object: "charge",
      payment_intent: used.pi,
      amount_refunded: 5000,
    });
    expect(await card(used.orderId)).toEqual({ status: "disabled", balance_cents: 0 });
    const flagged = await sql<{ needs_attention: boolean; admin_note: string }>(
      "select needs_attention, admin_note from public.orders where id = $1",
      [used.orderId],
    );
    expect(flagged[0]!.needs_attention).toBe(true);
    expect(flagged[0]!.admin_note).toMatch(/schon benutzt: 4000 Rappen nicht mehr gedeckt/);
  });

  it("Gutscheinkauf: Code geht an die beschenkte Person, Bestätigung an die Käuferin", async () => {
    const r = await rpc<{ order_id: string }>("reserve_gift_card_purchase", [
      7500,
      "kaeuferin@example.ch",
      "en",
      JSON.stringify({
        recipient_name: "Leo",
        recipient_email: "leo@example.ch",
        sender_name: "Mia",
        message: "<b>Viel Spass</b>",
      }),
      null,
    ]);
    const before = resend.sent.length;
    await deliver(
      "checkout.session.completed",
      session(r.order_id, {
        amount_total: 7500,
        customer_details: { email: "kaeuferin@example.ch", name: "Mia" },
        collected_information: null,
      }),
    );
    const mails = resend.sent.slice(before);
    expect(mails.map((m: { to: string[] }) => m.to[0])).toEqual([
      "kaeuferin@example.ch",
      "leo@example.ch",
      "shop@shop.test",
    ]);
    const gift = mails[1]!;
    // Intl setzt ein geschütztes Leerzeichen (U+00A0) zwischen CHF und Betrag, wie im Shop.
    expect(gift.subject).toBe("Your Axion gift card worth CHF 75.00");
    expect(gift.text).toMatch(/AXN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/);
    expect(gift.html).toContain("&lt;b&gt;Viel Spass&lt;/b&gt;");
    expect(gift.html).not.toContain("<b>Viel Spass</b>");
  });

  it("E-Mail-Fehler: 500, Ereignis wird vergessen, beim nächsten Versuch keine doppelte Bestätigung", async () => {
    const { order } = await pendingOrder();
    const before = resend.sent.length;
    const evtId = uniq("evt");
    const s = session(order.order_id);
    resend.failNext();
    const first = await deliver("checkout.session.completed", s, evtId);
    expect(first.status).toBe(500);
    const retry = await deliver("checkout.session.completed", s, evtId);
    expect(retry.status).toBe(200);
    const mails = resend.sent.slice(before);
    expect(mails.filter((m: { to: string[] }) => m.to[0] === "kundin@example.ch")).toHaveLength(1);
    expect(mails.filter((m: { to: string[] }) => m.to[0] === "shop@shop.test")).toHaveLength(1);
  });
});

describe("stripe-webhook: Warenkorb-Erinnerung", () => {
  const reminders = (to: string, from: number) =>
    resend.sent.slice(from).filter((m: { to: string[]; subject: string }) => m.to[0] === to);
  const sentAt = async (id: string) =>
    (
      await sql<{ reminder_sent_at: string | null }>(
        "select reminder_sent_at from public.orders where id = $1",
        [id],
      )
    )[0]!.reminder_sent_at;

  it("abgelaufene Kasse mit Einwilligung: genau eine Erinnerung mit Artikeln und Wiederherstellungs-Link, ohne Rabatt", async () => {
    const to = `${uniq("erinnerung")}@example.ch`;
    const { order } = await pendingOrder(10000, { email: to, remind: true });
    const before = resend.sent.length;
    const evt = session(order.order_id, { payment_status: "unpaid" });
    expect((await deliver("checkout.session.expired", evt)).status).toBe(200);
    const mails = reminders(to, before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe("Dein Warenkorb wartet auf dich");
    expect(mails[0]!.text).toContain(
      `https://shop.test/warenkorb/wiederherstellen/${order.status_token}`,
    );
    expect(mails[0]!.text).toMatch(/Test test-/);
    expect(mails[0]!.html).toContain("Zum Warenkorb");
    expect(mails[0]!.text).not.toMatch(/Rabatt|Gutschein|%/);
    expect(mails[0]!.idempotencyKey).toBe(`order-${order.order_id}-reminder`);
    expect(await sentAt(order.order_id)).not.toBeNull();

    // Zweites Ereignis (neue Ereignis-ID) für dieselbe Bestellung: keine zweite E-Mail
    await deliver("checkout.session.expired", evt);
    expect(reminders(to, before)).toHaveLength(1);
  });

  it("englische Bestellung: englische Erinnerung mit /en-Link", async () => {
    const to = `${uniq("reminder")}@example.ch`;
    const { order } = await pendingOrder(10000, { email: to, locale: "en", remind: true });
    const before = resend.sent.length;
    await deliver(
      "checkout.session.expired",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    const mails = reminders(to, before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe("Your cart is waiting for you");
    expect(mails[0]!.text).toContain(
      `https://shop.test/en/warenkorb/wiederherstellen/${order.status_token}`,
    );
  });

  it("ohne Einwilligung: Stornierung ja, E-Mail nein", async () => {
    const to = `${uniq("keine")}@example.ch`;
    const { product, order } = await pendingOrder(10000, { email: to });
    const before = resend.sent.length;
    await deliver(
      "checkout.session.expired",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    expect(reminders(to, before)).toHaveLength(0);
    expect(await stockOf(product.variants[0]!.id)).toBe(10);
    expect(await sentAt(order.order_id)).toBeNull();
  });

  it("selbst zurückgekehrt (customer_cancelled) oder Zahlung fehlgeschlagen: keine Erinnerung", async () => {
    const to = `${uniq("zurueck")}@example.ch`;
    const a = await pendingOrder(10000, { email: to, remind: true });
    await rpc("cancel_checkout_by_token", [a.order.status_token]);
    const b = await pendingOrder(10000, { email: to, remind: true });
    const before = resend.sent.length;
    await deliver(
      "checkout.session.expired",
      session(a.order.order_id, { payment_status: "unpaid" }),
    );
    await deliver(
      "checkout.session.async_payment_failed",
      session(b.order.order_id, { payment_status: "unpaid" }),
    );
    expect(reminders(to, before)).toHaveLength(0);
  });

  it("nicht, wenn die Person danach bestellt hat", async () => {
    const to = `${uniq("danach")}@example.ch`;
    const first = await pendingOrder(10000, { email: to, remind: true });
    const second = await pendingOrder(10000, { email: to });
    await deliver(
      "checkout.session.completed",
      session(second.order.order_id, { customer_details: { email: to, name: "A" } }),
    );
    const before = resend.sent.length;
    await deliver(
      "checkout.session.expired",
      session(first.order.order_id, { payment_status: "unpaid" }),
    );
    expect(reminders(to, before)).toHaveLength(0);
  });

  it("E-Mail-Fehler bricht die Stornierung nicht ab; ein späteres Ereignis holt die Erinnerung nach, ohne Doppelversand", async () => {
    const to = `${uniq("fehler")}@example.ch`;
    const { product, order } = await pendingOrder(10000, { email: to, remind: true });
    const before = resend.sent.length;
    const evt = session(order.order_id, { payment_status: "unpaid" });
    resend.failNext();
    expect((await deliver("checkout.session.expired", evt)).status).toBe(200);
    expect(await stockOf(product.variants[0]!.id)).toBe(10);
    expect(await sentAt(order.order_id)).toBeNull();
    expect(reminders(to, before)).toHaveLength(0);
    await deliver("checkout.session.expired", evt);
    expect(reminders(to, before)).toHaveLength(1);
    await deliver("checkout.session.expired", evt);
    expect(reminders(to, before)).toHaveLength(1);
  });
});

describe("stripe-webhook: Rückerstattungs-E-Mail", () => {
  const charge = (pi: unknown, amount: number) => ({
    id: uniq("ch"),
    object: "charge",
    payment_intent: pi,
    amount_refunded: amount,
  });
  const refundMails = (to: string, from: number) =>
    resend.sent
      .slice(from)
      .filter(
        (m: { to: string[]; subject: string }) =>
          m.to[0] === to && /Rückerstattung|refund/i.test(m.subject),
      );

  async function paid(email: string, locale?: "de" | "en") {
    const { order } = await pendingOrder(10000, { email, ...(locale ? { locale } : {}) });
    const s = session(order.order_id, { customer_details: { email, name: "A" } });
    await deliver("checkout.session.completed", s);
    return { order, pi: s.payment_intent as string };
  }

  it("Teilrückerstattung, dann Rest: je eine E-Mail mit dem jeweiligen Betrag; Wiederholungen senden nichts", async () => {
    const to = `${uniq("teil")}@example.ch`;
    const { order, pi } = await paid(to);
    const before = resend.sent.length;
    const partial = charge(pi, 4000);
    const evtId = uniq("evt");
    expect((await deliver("charge.refunded", partial, evtId)).status).toBe(200);
    let mails = refundMails(to, before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe(`Deine Rückerstattung zur Bestellung AX-${order.order_number}`);
    expect(mails[0]!.text).toMatch(/einen Teil/);
    expect(mails[0]!.text).toMatch(/CHF.40\.00/);
    expect(mails[0]!.text).toMatch(/ein paar Tage/);
    expect(mails[0]!.idempotencyKey).toBe(`order-${order.order_id}-refund-4000`);

    // Stripe wiederholt dasselbe Ereignis, und ein anderes Ereignis meldet denselben Stand
    await deliver("charge.refunded", partial, evtId);
    await deliver("charge.refunded", charge(pi, 4000));
    expect(refundMails(to, before)).toHaveLength(1);

    await deliver("charge.refunded", charge(pi, 10000));
    mails = refundMails(to, before);
    expect(mails).toHaveLength(2);
    expect(mails[1]!.text).toMatch(/vollständig/);
    expect(mails[1]!.text).toMatch(/CHF.60\.00/);
    expect(mails[1]!.text).toMatch(/Insgesamt zurückerstattet: CHF.100\.00/);
    expect(mails[1]!.text).toMatch(/storniert/);
    expect(mails[1]!.idempotencyKey).toBe(`order-${order.order_id}-refund-10000`);
  });

  it("Vollrückerstattung auf Englisch", async () => {
    const to = `${uniq("full")}@example.ch`;
    const { order, pi } = await paid(to, "en");
    const before = resend.sent.length;
    await deliver("charge.refunded", charge(pi, 10000));
    const mails = refundMails(to, before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe(`Your refund for order AX-${order.order_number}`);
    expect(mails[0]!.text).toMatch(/in full/);
    expect(mails[0]!.text).toMatch(/few days/);
  });

  it("E-Mail-Fehler: 500, Stripe wiederholt, dann genau eine E-Mail", async () => {
    const to = `${uniq("rfehler")}@example.ch`;
    const { pi } = await paid(to);
    const before = resend.sent.length;
    const evt = charge(pi, 2500);
    const evtId = uniq("evt");
    resend.failNext();
    expect((await deliver("charge.refunded", evt, evtId)).status).toBe(500);
    expect((await deliver("charge.refunded", evt, evtId)).status).toBe(200);
    expect(refundMails(to, before)).toHaveLength(1);
    await deliver("charge.refunded", evt, evtId);
    expect(refundMails(to, before)).toHaveLength(1);
  });

  it("unbekannte Zahlung: 500, damit Stripe wiederholt, und nichts zu senden", async () => {
    const before = resend.sent.length;
    expect((await deliver("charge.refunded", charge("pi_unbekannt", 100))).status).toBe(500);
    expect(resend.sent.length).toBe(before);
  });
});

describe("stripe-webhook: Bestandsmeldung an den Shop", () => {
  // Der Bestand wird schon beim Reservieren abgebucht; gemeldet wird bei Zahlungseingang, wenn die Bestellung die
  // Schwelle (Standard 2) erreicht hat: Bestand jetzt <= Schwelle, Bestand + bestellte Menge > Schwelle.
  const alerts = (orderId: string, from: number) =>
    resend.sent
      .slice(from)
      .filter((m: { idempotencyKey?: string }) => m.idempotencyKey === `order-${orderId}-lowstock`);

  async function orderWith(stocks: number[], quantity = 1) {
    const p = await makeProduct({ priceCents: 10000, stocks });
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity }],
      email: "kundin@example.ch",
    });
    return { product: p, order: r };
  }

  it("meldet eine Grösse, die mit dieser Bestellung auf die Schwelle fällt (Produkt, Grösse, Restbestand, Admin-Link)", async () => {
    const { product, order } = await orderWith([3]);
    const before = resend.sent.length;
    expect((await deliver("checkout.session.completed", session(order.order_id))).status).toBe(200);
    const [mail] = alerts(order.order_id, before) as {
      to: string[];
      subject: string;
      text: string;
    }[];
    expect(mail).toBeDefined();
    expect(mail!.to).toEqual(["shop@shop.test"]);
    expect(mail!.subject).toBe(`Bestand knapp: Test ${product.handle}`);
    expect(mail!.text).toContain(`Test ${product.handle}, Blau, Grösse 46: noch 2`);
    expect(mail!.text).toContain("https://shop.test/admin/produkte");
  });

  it("zeigt Bestand null als ausverkauft", async () => {
    const { product, order } = await orderWith([3], 3);
    const before = resend.sent.length;
    await deliver("checkout.session.completed", session(order.order_id));
    const [mail] = alerts(order.order_id, before) as { subject: string; text: string }[];
    expect(mail!.subject).toBe(`Ausverkauft: Test ${product.handle}`);
    expect(mail!.text).toContain("ausverkauft");
  });

  it("meldet nicht, wenn die Schwelle schon vorher erreicht war oder nicht erreicht wird", async () => {
    for (const stocks of [[2], [1], [4]]) {
      const { order } = await orderWith(stocks);
      const before = resend.sent.length;
      await deliver("checkout.session.completed", session(order.order_id));
      expect(alerts(order.order_id, before), `Bestand ${stocks[0]}`).toHaveLength(0);
    }
  });

  it("zählt die bestellte Menge: 4 auf Lager, 2 bestellt, Rest 2: gemeldet", async () => {
    const { order } = await orderWith([4], 2);
    const before = resend.sent.length;
    await deliver("checkout.session.completed", session(order.order_id));
    expect(alerts(order.order_id, before)).toHaveLength(1);
  });

  it("schickt pro Bestellung nur eine Meldung, auch bei wiederholtem Ereignis", async () => {
    const { order } = await orderWith([3]);
    const before = resend.sent.length;
    const s = session(order.order_id);
    await deliver("checkout.session.completed", s);
    await deliver("checkout.session.completed", s);
    await deliver("checkout.session.async_payment_succeeded", s);
    expect(alerts(order.order_id, before)).toHaveLength(1);
  });

  it("abgelaufene Kasse löst keine Meldung aus", async () => {
    const { order } = await orderWith([3]);
    const before = resend.sent.length;
    await deliver(
      "checkout.session.expired",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    expect(alerts(order.order_id, before)).toHaveLength(0);
  });

  it("ein Fehler beim Versand der Meldung kippt die Verbuchung nicht", async () => {
    const { order } = await orderWith([3]);
    const before = resend.sent.length;
    resend.failNext((key) => key === `order-${order.order_id}-lowstock`);
    expect((await deliver("checkout.session.completed", session(order.order_id))).status).toBe(200);
    expect(alerts(order.order_id, before)).toHaveLength(0);
    const status = await sql<{ status: string }>("select status from public.orders where id = $1", [
      order.order_id,
    ]);
    expect(status[0]!.status).toBe("paid");
    const to = resend.sent.slice(before).map((m: { to: string[] }) => m.to[0]);
    expect(to).toEqual(["kundin@example.ch", "shop@shop.test"]);
  });

  it("LOW_STOCK_THRESHOLD=0 meldet nur ausverkaufte Grössen", async () => {
    const strict = createStripeWebhookHandler(
      createDeps(
        readEnv(
          (k) =>
            ({
              SUPABASE_URL: supa.url,
              SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
              SUPABASE_ANON_KEY: ANON_KEY,
              SITE_URL: "https://shop.test",
              STRIPE_SECRET_KEY: "sk_test_fake",
              STRIPE_WEBHOOK_SECRET: SECRET,
              STRIPE_API_BASE: stripe.url,
              RESEND_API_KEY: "re_test",
              RESEND_API_BASE: resend.url,
              SHOP_NOTIFY_EMAIL: "shop@shop.test",
              LOW_STOCK_THRESHOLD: "0",
            })[k],
        ),
      ),
    );
    const send = async (orderId: string) => {
      const payload = JSON.stringify({
        id: uniq("evt"),
        object: "event",
        type: "checkout.session.completed",
        api_version: "2026-08-26.dahlia",
        created: Math.floor(Date.now() / 1000),
        data: { object: session(orderId) },
      });
      const header = await signer.webhooks.generateTestHeaderStringAsync({
        payload,
        secret: SECRET,
      });
      return strict(
        new Request("https://fn.test/stripe-webhook", {
          method: "POST",
          headers: { "stripe-signature": header },
          body: payload,
        }),
      );
    };
    const low = await orderWith([3]);
    const gone = await orderWith([1]);
    const before = resend.sent.length;
    expect((await send(low.order.order_id)).status).toBe(200);
    expect((await send(gone.order.order_id)).status).toBe(200);
    expect(alerts(low.order.order_id, before)).toHaveLength(0);
    expect(alerts(gone.order.order_id, before)).toHaveLength(1);
  });
});

describe("stripe-webhook: Streitfall und Betrugswarnung", () => {
  async function paidOrder() {
    const { order } = await pendingOrder();
    const s = session(order.order_id);
    expect((await deliver("checkout.session.completed", s)).status).toBe(200);
    return { orderId: order.order_id, pi: s.payment_intent };
  }
  const flags = (orderId: string) =>
    sql<{ needs_attention: boolean; admin_note: string | null }>(
      "select needs_attention, admin_note from public.orders where id = $1",
      [orderId],
    ).then((rows: { needs_attention: boolean; admin_note: string | null }[]) => rows[0]!);

  it("charge.dispute.created markiert die Bestellung, die Notiz steht nur einmal da", async () => {
    const { orderId, pi } = await paidOrder();
    const dispute = { id: uniq("dp"), object: "dispute", payment_intent: pi, charge: "ch_x" };
    expect((await deliver("charge.dispute.created", dispute)).status).toBe(200);
    // Eine zweite Zustellung mit neuer Ereignis-Id hängt die Notiz nicht nochmals an
    expect((await deliver("charge.dispute.created", dispute)).status).toBe(200);
    const row = await flags(orderId);
    expect(row.needs_attention).toBe(true);
    expect(row.admin_note).toBe("Stripe: Zahlung angefochten (Dispute)");
  });

  it("radar.early_fraud_warning.created: PaymentIntent direkt oder über die Charge", async () => {
    const direct = await paidOrder();
    expect(
      (
        await deliver("radar.early_fraud_warning.created", {
          id: uniq("issfr"),
          object: "radar.early_fraud_warning",
          payment_intent: direct.pi,
          charge: "ch_direct",
        })
      ).status,
    ).toBe(200);
    expect((await flags(direct.orderId)).admin_note).toBe("Stripe: Betrugswarnung (Radar)");

    const viaCharge = await paidOrder();
    const chargeId = uniq("ch");
    stripe.setCharge(chargeId, viaCharge.pi);
    expect(
      (
        await deliver("radar.early_fraud_warning.created", {
          id: uniq("issfr"),
          object: "radar.early_fraud_warning",
          payment_intent: null,
          charge: chargeId,
        })
      ).status,
    ).toBe(200);
    expect(await flags(viaCharge.orderId)).toEqual({
      needs_attention: true,
      admin_note: "Stripe: Betrugswarnung (Radar)",
    });
  });

  it("Streitfall zu einem Gutscheinkauf sperrt den Gutschein", async () => {
    const r = await rpc<{ order_id: string }>("reserve_gift_card_purchase", [
      5000,
      "kaeuferin@example.ch",
      "de",
      JSON.stringify({}),
      null,
    ]);
    const s = session(r.order_id, { amount_total: 5000, collected_information: null });
    await deliver("checkout.session.completed", s);
    expect(
      (
        await deliver("charge.dispute.created", {
          id: uniq("dp"),
          object: "dispute",
          payment_intent: { id: s.payment_intent, object: "payment_intent" },
        })
      ).status,
    ).toBe(200);
    const card = await sql<{ status: string }>(
      "select g.status from public.gift_cards g join public.orders o on o.issued_gift_card_id = g.id where o.id = $1",
      [r.order_id],
    );
    expect(card[0]!.status).toBe("disabled");
  });

  it("unbekannter PaymentIntent: 200 ohne Änderung (keine endlosen Wiederholungen)", async () => {
    const res = await deliver("charge.dispute.created", {
      id: uniq("dp"),
      object: "dispute",
      payment_intent: uniq("pi_fremd"),
    });
    expect(res.status).toBe(200);
  });
});
