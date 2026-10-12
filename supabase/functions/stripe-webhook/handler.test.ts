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

async function pendingOrder(price = 10000) {
  const p = await makeProduct({ priceCents: price, stocks: [2] });
  const r = await reserve({
    lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
    email: "kundin@example.ch",
  });
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
    expect(await stockOf(product.variants[0]!.id)).toBe(1);
    await deliver(
      "checkout.session.expired",
      session(order.order_id, { payment_status: "unpaid" }),
    );
    expect(await stockOf(product.variants[0]!.id)).toBe(2);
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
