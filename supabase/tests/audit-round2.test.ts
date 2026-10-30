// Audit, zweite Runde (Migration 20261030002200): Kassen-Bremse pro Adresse, Retouren-Zähler nach Treffer und Frist,
// Streitfälle, Stripe-Minimum beim Rabatt, Retoure einbuchen nur für bezahlte Bestellungen, Aufräumen abgebrochener
// Bestellungen und unbestätigter Newsletter-Anmeldungen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq, type TestUser } from "./helpers";
import { makeDiscount, makeGiftCard, makeProduct, reserve, rpc } from "./fixtures";

let admin: TestUser;
const created: string[] = [];

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
});

afterAll(async () => {
  await sql("delete from public.orders where id = any($1::uuid[])", [created]);
  await pool.end();
});

const randomIp = () =>
  `100.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

describe("checkout_guard: keine Sperre über die Adresse einer Kundin", () => {
  it("offene Kassen unter derselben Adresse sperren nicht; pro Adresse 30 in 30 Minuten", async () => {
    const email = `${uniq("opfer")}@example.ch`;
    const p = await makeProduct({ priceCents: 1000, stocks: [10] });
    for (let i = 0; i < 4; i++)
      await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }], email });
    const guard = () => rpc<string>("checkout_guard", [email, randomIp()]);
    const answers: string[] = [];
    for (let i = 0; i < 31; i++) answers.push(await guard());
    expect(answers.slice(0, 30).every((a) => a === "ok")).toBe(true);
    expect(answers[30]).toBe("rate_limited");
  });
});

async function returnOrder(opts: { email?: string; shippedDaysAgo: number }) {
  const email = opts.email ?? `${uniq("rt2")}@example.ch`;
  const rows = await sql<{ id: string; number: string }>(
    `insert into public.orders (email, status, kind, subtotal_cents, total_cents, paid_at, shipped_at)
     values ($1, 'shipped', 'cart', 10000, 10000, now() - make_interval(days => $2 + 1),
       now() - make_interval(days => $2)) returning id, number`,
    [email, opts.shippedDaysAgo],
  );
  created.push(rows[0]!.id);
  await sql(
    `insert into public.order_items (order_id, title, size, unit_price_cents, quantity, line_total_cents)
     values ($1, 'Anzug', '50', 10000, 1, 10000)`,
    [rows[0]!.id],
  );
  return { id: rows[0]!.id, number: Number(rows[0]!.number), email };
}

const lookup = (number: number, email: string, ip = randomIp()) =>
  rpc<{ status: string }>("return_lookup", [number, email, ip, 14]).then((r) => r.status);

describe("Retouren: Zähler pro Adresse erst nach Treffer, Frist ab Versand plus 7 Tage", () => {
  it("falsche Bestellnummern mit der Adresse einer Kundin zählen nicht gegen ihre Adresse", async () => {
    await sql("delete from private.rate_limits");
    const o = await returnOrder({ shippedDaysAgo: 1 });
    for (let i = 1; i <= 20; i++)
      expect(await lookup(o.number + 100000 + i, o.email)).toBe("not_found");
    expect(await lookup(o.number, o.email)).toBe("ok");
    // Treffer zählen: höchstens 15 pro Stunde und Adresse
    const answers: string[] = [];
    for (let i = 0; i < 15; i++) answers.push(await lookup(o.number, o.email));
    expect(answers.slice(0, 14).every((s) => s === "ok")).toBe(true);
    expect(answers[14]).toBe("rate_limited");
  });

  it("submit: Fremde ohne passende Bestellung lösen die Bremse der Adresse nicht aus", async () => {
    await sql("delete from private.rate_limits");
    const o = await returnOrder({ shippedDaysAgo: 1 });
    for (let i = 1; i <= 6; i++) {
      const r = await rpc<{ status: string }>("return_submit", [
        o.number + 200000 + i,
        o.email,
        "[]",
        null,
        "de",
        randomIp(),
        14,
        null,
      ]);
      expect(r.status).toBe("not_found");
    }
    const item = await sql<{ id: string }>(
      "select id from public.order_items where order_id = $1",
      [o.id],
    );
    const ok = await rpc<{ status: string }>("return_submit", [
      o.number,
      o.email,
      JSON.stringify([{ order_item_id: item[0]!.id, quantity: 1, reason: "style" }]),
      null,
      "de",
      randomIp(),
      14,
      null,
    ]);
    expect(ok.status).toBe("ok");
  });

  it("Frist: Versand vor 20 Tagen ist bei 14 Tagen noch offen (7 Tage Zustellung), vor 22 Tagen nicht", async () => {
    await sql("delete from private.rate_limits");
    expect(await lookup(...numberAndEmail(await returnOrder({ shippedDaysAgo: 20 })))).toBe("ok");
    expect(await lookup(...numberAndEmail(await returnOrder({ shippedDaysAgo: 22 })))).toBe(
      "expired",
    );
  });
});

function numberAndEmail(o: { number: number; email: string }): [number, string] {
  return [o.number, o.email];
}

describe("record_dispute", () => {
  async function paidWithIntent() {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const pi = uniq("pi");
    await rpc("complete_order", [r.order_id, JSON.stringify({ payment_intent_id: pi })]);
    await sql(
      "update public.orders set stripe_payment_intent_id = $2, admin_note = 'Alte Notiz' where id = $1",
      [r.order_id, pi],
    );
    return { orderId: r.order_id, pi };
  }

  it("markiert die Bestellung und hängt die Notiz einmal an", async () => {
    const { orderId, pi } = await paidWithIntent();
    const res = await rpc<{ found: boolean; gift_card_disabled: boolean }>("record_dispute", [
      pi,
      "Stripe: Zahlung angefochten (Dispute)",
    ]);
    expect(res).toMatchObject({ found: true, gift_card_disabled: false });
    await rpc("record_dispute", [pi, "Stripe: Zahlung angefochten (Dispute)"]);
    await rpc("record_dispute", [pi, "Stripe: Betrugswarnung (Radar)"]);
    const row = await sql<{ needs_attention: boolean; admin_note: string }>(
      "select needs_attention, admin_note from public.orders where id = $1",
      [orderId],
    );
    expect(row[0]).toEqual({
      needs_attention: true,
      admin_note:
        "Alte Notiz\nStripe: Zahlung angefochten (Dispute)\nStripe: Betrugswarnung (Radar)",
    });
  });

  it("unbekannter PaymentIntent: ORDER_NOT_FOUND (P0002); nur service_role", async () => {
    const err = await expectPgError(rpc("record_dispute", [uniq("pi_unbekannt"), "x"]));
    expect(err).toMatchObject({ message: "ORDER_NOT_FOUND", code: "P0002" });
    const denied = await expectPgError(
      rpc("record_dispute", ["pi_x", "x"], "authenticated", admin.claims),
    );
    expect(denied.code).toBe("42501");
  });

  it("Gutscheinkauf: der ausgegebene Gutschein wird gesperrt", async () => {
    const r = await rpc<{ order_id: string }>("reserve_gift_card_purchase", [
      5000,
      "kaeuferin@example.ch",
      "de",
      JSON.stringify({}),
      null,
    ]);
    const pi = uniq("pi");
    await rpc("complete_order", [r.order_id, JSON.stringify({ payment_intent_id: pi })]);
    await sql("update public.orders set stripe_payment_intent_id = $2 where id = $1", [
      r.order_id,
      pi,
    ]);
    const res = await rpc<{ gift_card_disabled: boolean }>("record_dispute", [pi, "Dispute"]);
    expect(res.gift_card_disabled).toBe(true);
    const card = await sql<{ status: string }>(
      "select g.status from public.gift_cards g join public.orders o on o.issued_gift_card_id = g.id where o.id = $1",
      [r.order_id],
    );
    expect(card[0]!.status).toBe("disabled");
  });
});

describe("reserve_checkout: Rabatt lässt mindestens CHF 0.50 übrig", () => {
  it("Betragsrabatt fast so hoch wie der Warenwert: gekürzt auf 50 Rappen Rest", async () => {
    const code = uniq("FAST")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    await makeDiscount(code, "amount", 9980);
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      discount: code,
    });
    expect(r).toMatchObject({ discount_cents: 9950, shipping_cents: 0, total_cents: 50 });
  });

  it("100 % Rabatt ohne Versand bleibt 0; mit kleiner Pauschale 50 Rappen", async () => {
    const code = uniq("GRATIS")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    await makeDiscount(code, "percent", 100);
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const free = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      discount: code,
    });
    expect(free).toMatchObject({ discount_cents: 10000, total_cents: 0 });
    await sql(
      "update public.shop_settings set shipping_cents = 30, free_shipping_from_cents = null",
    );
    try {
      const flat = await reserve({
        lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
        discount: code,
      });
      expect(flat).toMatchObject({ discount_cents: 9980, shipping_cents: 30, total_cents: 50 });
      // Weniger Rabatt erreicht die Gratisversand-Schwelle: ohne Versand nochmals auf 50 Rappen
      await sql("update public.shop_settings set free_shipping_from_cents = 15");
      const crossed = await reserve({
        lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
        discount: code,
      });
      expect(crossed).toMatchObject({ discount_cents: 9950, shipping_cents: 0, total_cents: 50 });
    } finally {
      await sql(
        "update public.shop_settings set shipping_cents = 0, free_shipping_from_cents = null",
      );
    }
  });
});

describe("admin_restock_order: nur bezahlte Warenkorb-Bestellungen", () => {
  const restock = (orderId: string, items: unknown[]) =>
    rpc("admin_restock_order", [orderId, JSON.stringify(items)], "authenticated", admin.claims);

  it("unbekannt: ORDER_NOT_FOUND; offen: ORDER_NOT_PAID; bezahlt und erstattet: geht", async () => {
    const missing = await expectPgError(restock("00000000-0000-4000-8000-000000000000", []));
    expect(missing).toMatchObject({ message: "ORDER_NOT_FOUND", code: "P0002" });

    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 2 }] });
    const items = await sql<{ id: string }>(
      "select id from public.order_items where order_id = $1",
      [r.order_id],
    );
    const one = [{ order_item_id: items[0]!.id, quantity: 1 }];
    const pending = await expectPgError(restock(r.order_id, one));
    expect(pending).toMatchObject({ message: "ORDER_NOT_PAID", code: "P0001" });

    await rpc("complete_order", [r.order_id, "{}"]);
    expect(await restock(r.order_id, one)).toMatchObject({ restocked: 1 });
    await sql("update public.orders set status = 'refunded' where id = $1", [r.order_id]);
    expect(await restock(r.order_id, one)).toMatchObject({ restocked: 1 });
  });

  it("Gutscheinkauf: ORDER_NOT_PAID", async () => {
    const r = await rpc<{ order_id: string }>("reserve_gift_card_purchase", [
      5000,
      "kaeuferin@example.ch",
      "de",
      JSON.stringify({}),
      null,
    ]);
    await rpc("complete_order", [r.order_id, "{}"]);
    const err = await expectPgError(restock(r.order_id, []));
    expect(err.message).toBe("ORDER_NOT_PAID");
  });
});

describe("prune_abandoned_orders", () => {
  async function abandoned(opts: { daysAgo: number; status?: string; paid?: boolean }) {
    const rows = await sql<{ id: string }>(
      `insert into public.orders (email, status, kind, subtotal_cents, total_cents, created_at, paid_at)
       values ($1, $2, 'cart', 1000, 1000, now() - make_interval(days => $3), $4) returning id`,
      [
        `${uniq("weg")}@example.ch`,
        opts.status ?? "cancelled",
        opts.daysAgo,
        opts.paid ? new Date(Date.now() - opts.daysAgo * 86400000).toISOString() : null,
      ],
    );
    const id = rows[0]!.id;
    created.push(id);
    await sql(
      `insert into public.order_items (order_id, title, unit_price_cents, quantity, line_total_cents)
       values ($1, 'Hemd', 1000, 1, 1000)`,
      [id],
    );
    return id;
  }
  const exists = async (id: string) =>
    (await sql("select 1 from public.orders where id = $1", [id])).length === 1;

  it("löscht nur alte, nie bezahlte, abgebrochene Bestellungen ohne Buchhaltungsbezug", async () => {
    const p = await makeProduct({ priceCents: 1000, stocks: [5] });
    const old = await abandoned({ daysAgo: 31 });
    await sql(
      "insert into public.stock_movements (variant_id, delta, reason, order_id) values ($1, -1, 'reservation', $2), ($1, 1, 'release', $2)",
      [p.variants[0]!.id, old],
    );
    const recent = await abandoned({ daysAgo: 29 });
    const paidLater = await abandoned({ daysAgo: 31, paid: true });
    const stillPending = await abandoned({ daysAgo: 31, status: "pending" });
    const flagged = await abandoned({ daysAgo: 31 });
    await sql("update public.orders set needs_attention = true where id = $1", [flagged]);
    const withGift = await abandoned({ daysAgo: 31 });
    const code = await makeGiftCard(5000);
    await sql(
      `insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind)
       select id, $2::uuid, -500, 'redeem'::public.gift_card_tx_kind from public.gift_cards where code = $1
       union all select id, $2::uuid, 500, 'release'::public.gift_card_tx_kind from public.gift_cards where code = $1`,
      [code, withGift],
    );

    expect(await rpc<number>("prune_abandoned_orders", [])).toBeGreaterThanOrEqual(1);
    expect(await exists(old)).toBe(false);
    expect(await sql("select 1 from public.order_items where order_id = $1", [old])).toHaveLength(
      0,
    );
    // Lagerbewegungen bleiben (ohne Bestellbezug), das Lagerjournal stimmt weiter
    const moves = await sql<{ order_id: string | null }>(
      "select order_id from public.stock_movements where variant_id = $1",
      [p.variants[0]!.id],
    );
    expect(moves).toEqual([{ order_id: null }, { order_id: null }]);
    for (const kept of [recent, paidLater, stillPending, flagged, withGift])
      expect(await exists(kept)).toBe(true);
  });

  it("läuft über prune_rate_limits mit; nur service_role", async () => {
    const old = await abandoned({ daysAgo: 40 });
    await rpc("prune_rate_limits", []);
    expect(await exists(old)).toBe(false);
    const denied = await expectPgError(
      q("authenticated", admin.claims, "select public.prune_abandoned_orders()"),
    );
    expect(denied.code).toBe("42501");
  });
});

describe("newsletter_subscribe: unbestätigte Anmeldungen nach 30 Tagen weg", () => {
  it("löscht alte unbestätigte, behält junge und bestätigte", async () => {
    const insert = (status: string, daysAgo: number) =>
      sql<{ id: string }>(
        `insert into public.newsletter_subscribers (email, status, consent_text, consent_at)
         values ($1, $2::public.newsletter_status, 'Ja', now() - make_interval(days => $3)) returning id`,
        [`${uniq("nl")}@example.ch`, status, daysAgo],
      ).then((rows: { id: string }[]) => rows[0]!.id);
    const stale = await insert("pending", 31);
    const fresh = await insert("pending", 5);
    const confirmed = await insert("confirmed", 400);
    const res = await rpc<{ status: string }>("newsletter_subscribe", [
      `${uniq("neu")}@example.ch`,
      "de",
      "Ja, ich will",
      "footer",
      randomIp(),
    ]);
    expect(res.status).toBe("pending");
    const left = await sql<{ id: string }>(
      "select id from public.newsletter_subscribers where id = any($1::uuid[])",
      [[stale, fresh, confirmed]],
    );
    expect(left.map((r) => r.id).sort()).toEqual([fresh, confirmed].sort());
  });
});
