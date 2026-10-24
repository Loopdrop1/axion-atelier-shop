import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq, withRole } from "./helpers";
import {
  makeDiscount,
  makeGiftCard,
  makeProduct,
  reserve,
  rpc,
  stockOf,
  type Reservation,
} from "./fixtures";

afterAll(async () => {
  await pool.end();
});

type Completion = {
  status: string;
  newly_paid: boolean;
  order_number: number;
  needs_attention: boolean;
};

describe("reserve_checkout: Beträge", () => {
  it("rechnet Rabatt und Gutschein exakt (549.00 + 189.00, 10 %, Gutschein 100.00)", async () => {
    const suit = await makeProduct({ priceCents: 54900, stocks: [3] });
    const vest = await makeProduct({ priceCents: 18900, stocks: [3], category: "westen" });
    const code = uniq("LAUNCH").toUpperCase().replace(/-/g, "");
    await makeDiscount(code, "percent", 10);
    const card = await makeGiftCard(10000);
    const r = await reserve({
      lines: [
        { variant_id: suit.variants[0]!.id, quantity: 1 },
        { variant_id: vest.variants[0]!.id, quantity: 1 },
      ],
      discount: code.toLowerCase(),
      giftCard: card.toLowerCase(),
    });
    expect(r.subtotal_cents).toBe(73800);
    expect(r.discount_cents).toBe(7380);
    expect(r.gift_card_cents).toBe(10000);
    expect(r.shipping_cents).toBe(0);
    expect(r.total_cents).toBe(56420);
    expect(r.discount_code).toBe(code);
    expect(await stockOf(suit.variants[0]!.id)).toBe(2);
    const balance = await sql<{ balance_cents: number }>(
      "select balance_cents from public.gift_cards where code = $1",
      [card],
    );
    expect(balance[0]?.balance_cents).toBe(0);
  });

  it("nimmt Preise nur aus der Datenbank und fasst doppelte Zeilen zusammen", async () => {
    const p = await makeProduct({ priceCents: 12900, stocks: [5] });
    const r = await reserve({
      lines: [
        { variant_id: p.variants[0]!.id, quantity: 1, unit_price_cents: 1 } as never,
        { variant_id: p.variants[0]!.id, quantity: 2 },
      ],
    });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]?.quantity).toBe(3);
    expect(r.subtotal_cents).toBe(38700);
  });

  it("liefert englische Titel bei locale en", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      locale: "en",
    });
    expect(r.lines[0]?.title).toMatch(/^Test EN /);
  });

  it("Gutschein deckt alles: Total 0", async () => {
    const p = await makeProduct({ priceCents: 5000, stocks: [2] });
    const card = await makeGiftCard(20000);
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      giftCard: card,
    });
    expect(r.gift_card_cents).toBe(5000);
    expect(r.total_cents).toBe(0);
    const left = await sql<{ balance_cents: number }>(
      "select balance_cents from public.gift_cards where code = $1",
      [card],
    );
    expect(left[0]?.balance_cents).toBe(15000);
  });

  it("Versandkosten aus den Einstellungen, gratis ab Schwelle", async () => {
    await sql(
      "update public.shop_settings set shipping_cents = 900, free_shipping_from_cents = 20000",
    );
    try {
      const p = await makeProduct({ priceCents: 10000, stocks: [5] });
      const small = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
      expect(small.shipping_cents).toBe(900);
      expect(small.total_cents).toBe(10900);
      const big = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 2 }] });
      expect(big.shipping_cents).toBe(0);
    } finally {
      await sql(
        "update public.shop_settings set shipping_cents = 0, free_shipping_from_cents = null",
      );
    }
  });
});

describe("reserve_checkout: Fehler", () => {
  it("ausverkauft liefert OUT_OF_STOCK mit verfügbarer Menge und ändert nichts", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const err = await expectPgError(
      reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 2 }] }),
    );
    expect(err.message).toBe("OUT_OF_STOCK");
    expect(JSON.parse(err.detail ?? "[]")).toEqual([
      { variant_id: p.variants[0]!.id, available: 1 },
    ]);
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
  });

  it("Entwürfe und unbekannte Varianten sind nicht kaufbar", async () => {
    const draft = await makeProduct({ priceCents: 10000, stocks: [5], status: "draft" });
    const err = await expectPgError(
      reserve({ lines: [{ variant_id: draft.variants[0]!.id, quantity: 1 }] }),
    );
    expect(err.message).toBe("OUT_OF_STOCK");
    const unknown = await expectPgError(
      reserve({ lines: [{ variant_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }] }),
    );
    expect(unknown.message).toBe("INVALID_LINES");
  });

  it("Mengen ausserhalb 1 bis 10, leere und kaputte Zeilen werden abgelehnt", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [50] });
    for (const lines of [
      [{ variant_id: p.variants[0]!.id, quantity: 11 }],
      [{ variant_id: p.variants[0]!.id, quantity: 0 }],
      [],
      [{ variant_id: "kaputt", quantity: 1 }],
    ]) {
      const err = await expectPgError(reserve({ lines }));
      expect(err.message).toBe("INVALID_LINES");
    }
  });

  it("ungültige E-Mail wird abgelehnt", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const err = await expectPgError(
      reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }], email: "keine-mail" }),
    );
    expect(err.message).toBe("INVALID_EMAIL");
  });

  it("abgelaufene, inaktive und ausgeschöpfte Rabattcodes werden abgelehnt", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [10] });
    const line = [{ variant_id: p.variants[0]!.id, quantity: 1 }];
    const expired = uniq("ALT").replace(/-/g, "");
    await makeDiscount(expired, "percent", 10, {
      ends_at: new Date(Date.now() - 1000).toISOString(),
    });
    const inactive = uniq("AUS").replace(/-/g, "");
    await makeDiscount(inactive, "amount", 1000, { active: false });
    const minimum = uniq("MIN").replace(/-/g, "");
    await makeDiscount(minimum, "amount", 1000, { min_subtotal_cents: 20000 });
    const once = uniq("EIN").replace(/-/g, "");
    await makeDiscount(once, "amount", 1000, { max_redemptions: 1 });
    for (const [code, reason] of [
      [expired, "expired"],
      [inactive, "inactive"],
      [minimum, "min_subtotal"],
      ["GIBTSNICHT", "not_found"],
    ] as const) {
      const err = await expectPgError(reserve({ lines: line, discount: code }));
      expect(err.message).toBe("DISCOUNT_INVALID");
      expect(JSON.parse(err.detail ?? "{}").reason).toBe(reason);
    }
    await reserve({ lines: line, discount: once });
    const second = await expectPgError(reserve({ lines: line, discount: once }));
    expect(JSON.parse(second.detail ?? "{}").reason).toBe("exhausted");
  });

  it("deaktivierte, abgelaufene und leere Gutscheine werden abgelehnt", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [10] });
    const line = [{ variant_id: p.variants[0]!.id, quantity: 1 }];
    const disabled = await makeGiftCard(5000, { status: "disabled" });
    const expired = await makeGiftCard(5000, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    for (const [code, reason] of [
      [disabled, "disabled"],
      [expired, "expired"],
      ["AXN-AAAA-BBBB-CCCC", "not_found"],
    ] as const) {
      const err = await expectPgError(reserve({ lines: line, giftCard: code }));
      expect(err.message).toBe("GIFT_CARD_INVALID");
      expect(JSON.parse(err.detail ?? "{}").reason).toBe(reason);
    }
  });

  it("anon und Kundschaft dürfen nicht direkt reservieren", async () => {
    const user = await createUser();
    for (const [role, claims] of [
      ["anon", null],
      ["authenticated", user.claims],
    ] as const) {
      const err = await expectPgError(
        q(role, claims, "select public.reserve_checkout('[]'::jsonb, 'a@b.ch')"),
      );
      expect(err.message).toMatch(/permission denied/);
    }
  });
});

describe("Gleichzeitige Käufe", () => {
  it("zwei Kassen um das letzte Stück: genau eine gelingt, Bestand nie negativ", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const line = [{ variant_id: p.variants[0]!.id, quantity: 1 }];
    const results = await Promise.allSettled([reserve({ lines: line }), reserve({ lines: line })]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0]!.reason as Error).message).toBe("OUT_OF_STOCK");
    expect(await stockOf(p.variants[0]!.id)).toBe(0);
  });

  it("derselbe Gutschein in zwei Kassen: Abbuchungen nie über dem Guthaben", async () => {
    const a = await makeProduct({ priceCents: 8000, stocks: [5] });
    const card = await makeGiftCard(10000);
    const line = [{ variant_id: a.variants[0]!.id, quantity: 1 }];
    const results = await Promise.all([
      reserve({ lines: line, giftCard: card }),
      reserve({ lines: line, giftCard: card }).catch((e: Error) => e),
    ]);
    const used = results
      .filter((r): r is Reservation => !(r instanceof Error))
      .reduce((s, r) => s + r.gift_card_cents, 0);
    expect(used).toBeLessThanOrEqual(10000);
    const balance = await sql<{ balance_cents: number }>(
      "select balance_cents from public.gift_cards where code = $1",
      [card],
    );
    expect(balance[0]!.balance_cents).toBe(10000 - used);
  });
});

describe("Zahlung, Storno, Ablauf", () => {
  it("complete_order ist idempotent: newly_paid nur beim ersten Mal", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const payment = {
      session_id: uniq("cs"),
      payment_intent_id: uniq("pi"),
      payment_method: "twint",
      amount_total_cents: 10000,
      email: "Kunde@Example.ch",
      name: "Max Muster",
      address: { line1: "Bahnhofstrasse 1", postal_code: "8001", city: "Zürich", country: "CH" },
    };
    const first = await rpc<Completion>("complete_order", [r.order_id, JSON.stringify(payment)]);
    expect(first.newly_paid).toBe(true);
    expect(first.needs_attention).toBe(false);
    const second = await rpc<Completion>("complete_order", [r.order_id, JSON.stringify(payment)]);
    expect(second.newly_paid).toBe(false);
    const order = await sql<{ status: string; email: string; payment_method: string }>(
      "select status, email, payment_method from public.orders where id = $1",
      [r.order_id],
    );
    expect(order[0]).toEqual({
      status: "paid",
      email: "kunde@example.ch",
      payment_method: "twint",
    });
  });

  it("cancel_order gibt Bestand und Gutschein zurück, aber nicht nach Zahlung", async () => {
    const p = await makeProduct({ priceCents: 6000, stocks: [2] });
    const card = await makeGiftCard(3000);
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 2 }],
      giftCard: card,
    });
    expect(await stockOf(p.variants[0]!.id)).toBe(0);
    expect(await rpc<boolean>("cancel_order", [r.order_id, "test"])).toBe(true);
    expect(await stockOf(p.variants[0]!.id)).toBe(2);
    const balance = await sql<{ balance_cents: number }>(
      "select balance_cents from public.gift_cards where code = $1",
      [card],
    );
    expect(balance[0]!.balance_cents).toBe(3000);
    expect(await rpc<boolean>("cancel_order", [r.order_id, "test"])).toBe(false);

    const paid = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    await rpc("complete_order", [paid.order_id, JSON.stringify({ amount_total_cents: 6000 })]);
    expect(await rpc<boolean>("cancel_order", [paid.order_id, "expired"])).toBe(false);
    const status = await sql<{ status: string }>("select status from public.orders where id = $1", [
      paid.order_id,
    ]);
    expect(status[0]!.status).toBe("paid");
  });

  it("Zahlung nach Storno mit fehlendem Bestand wird markiert statt verloren", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    await rpc("cancel_order", [r.order_id, "expired"]);
    await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] }); // jemand anderes kauft das Stück
    const late = await rpc<Completion>("complete_order", [
      r.order_id,
      JSON.stringify({ amount_total_cents: 10000 }),
    ]);
    expect(late.newly_paid).toBe(true);
    expect(late.needs_attention).toBe(true);
    expect(await stockOf(p.variants[0]!.id)).toBe(0);
  });

  it("Zahlung nach Storno mit vorhandenem Bestand reserviert neu", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    await rpc("cancel_order", [r.order_id, "expired"]);
    expect(await stockOf(p.variants[0]!.id)).toBe(2);
    const late = await rpc<Completion>("complete_order", [
      r.order_id,
      JSON.stringify({ amount_total_cents: 10000 }),
    ]);
    expect(late.needs_attention).toBe(false);
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
  });

  it("abweichender Zahlbetrag markiert die Bestellung", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const res = await rpc<Completion>("complete_order", [
      r.order_id,
      JSON.stringify({ amount_total_cents: 100 }),
    ]);
    expect(res.needs_attention).toBe(true);
  });

  it("release_expired_orders gibt abgelaufene Reservierungen frei", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    await sql("update public.orders set expires_at = now() - interval '1 hour' where id = $1", [
      r.order_id,
    ]);
    const released = await rpc<number>("release_expired_orders", []);
    expect(released).toBeGreaterThanOrEqual(1);
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
  });

  it("Rabattcode zählt Einlösungen erst bei Zahlung", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const code = uniq("ZAHL").replace(/-/g, "");
    await makeDiscount(code, "amount", 1000);
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      discount: code,
    });
    const before = await sql<{ redemptions: number }>(
      "select redemptions from public.discount_codes where code = $1",
      [code],
    );
    expect(before[0]!.redemptions).toBe(0);
    await rpc("complete_order", [r.order_id, JSON.stringify({})]);
    const after = await sql<{ redemptions: number }>(
      "select redemptions from public.discount_codes where code = $1",
      [code],
    );
    expect(after[0]!.redemptions).toBe(1);
  });

  it("record_refund setzt Teil- und Vollrückerstattung", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const pi = uniq("pi");
    await rpc("complete_order", [r.order_id, JSON.stringify({ payment_intent_id: pi })]);
    const part = await rpc<{ status: string; refunded_cents: number }>("record_refund", [pi, 4000]);
    expect(part).toMatchObject({ status: "paid", refunded_cents: 4000 });
    const full = await rpc<{ status: string }>("record_refund", [pi, 10000]);
    expect(full.status).toBe("refunded");
  });
});

describe("Öffentliche Prüfungen und Status", () => {
  it("check_discount für anon, ohne interne ID", async () => {
    const code = uniq("ANON").replace(/-/g, "");
    await makeDiscount(code, "percent", 15);
    const res = await rpc<Record<string, unknown>>(
      "check_discount",
      [code.toLowerCase(), 10000],
      "anon",
    );
    expect(res).toMatchObject({ valid: true, discount_cents: 1500, kind: "percent", value: 15 });
    expect(res).not.toHaveProperty("id");
  });

  it("check_gift_card zeigt Guthaben, Rate-Limit nach 20 Versuchen", async () => {
    const card = await makeGiftCard(4500);
    const headers = { "cf-connecting-ip": `10.0.0.${Math.floor(Math.random() * 250)}` };
    const ok = await withRole(
      "anon",
      null,
      async (c) => (await c.query("select public.check_gift_card($1) as r", [card])).rows[0].r,
      { headers },
    );
    expect(ok).toMatchObject({ valid: true, balance_cents: 4500 });
    let last: { reason?: string } = {};
    for (let i = 0; i < 21; i++) {
      last = await withRole(
        "anon",
        null,
        async (c) =>
          (await c.query("select public.check_gift_card('AXN-AAAA-AAAA-AAAA') as r")).rows[0].r,
        { headers },
      );
    }
    expect(last.reason).toBe("rate_limited");
  });

  it("get_order_status mit Token zeigt Nummer und maskierte E-Mail", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      email: "anna.muster@example.ch",
    });
    const res = await rpc<Record<string, unknown>>("get_order_status", [r.status_token], "anon");
    expect(res).toMatchObject({
      order_number: r.order_number,
      status: "pending",
      email_hint: "a***@example.ch",
    });
  });

  it("claim_guest_orders ordnet Gastbestellungen nur bei bestätigter E-Mail zu", async () => {
    const email = `${uniq("gast")}@example.ch`;
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }], email });
    await rpc("complete_order", [r.order_id, JSON.stringify({ email })]);
    const unconfirmed = await createUser(email.replace("@", "+x@"), { confirmed: false });
    expect(await rpc<number>("claim_guest_orders", [], "authenticated", unconfirmed.claims)).toBe(
      0,
    );
    const user = await createUser(email.toUpperCase());
    expect(await rpc<number>("claim_guest_orders", [], "authenticated", user.claims)).toBe(1);
    const mine = await q<{ id: string }>(
      "authenticated",
      user.claims,
      "select id from public.orders",
    );
    expect(mine.map((o) => o.id)).toEqual([r.order_id]);
  });
});

describe("Mindestbetrag und E-Mail-Status", () => {
  it("lässt mindestens CHF 0.50 offen, wenn der Gutschein fast alles deckt", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const card = await makeGiftCard(9980);
    const r = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      giftCard: card,
    });
    expect(r.total_cents).toBe(50);
    expect(r.gift_card_cents).toBe(9950);
  });

  it("merkt sich versendete E-Mails und liefert sie im Bestell-JSON", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    await rpc("mark_order_email_sent", [r.order_id, "confirmation"]);
    const order = await rpc<{
      confirmation_sent_at: string | null;
      notification_sent_at: string | null;
    }>("get_order_for_email", [r.order_id]);
    expect(order.confirmation_sent_at).not.toBeNull();
    expect(order.notification_sent_at).toBeNull();
    const err = await expectPgError(rpc("mark_order_email_sent", [r.order_id, "falsch"]));
    expect(err.message).toBe("INVALID_KIND");
  });
});

describe("cancel_checkout_by_token", () => {
  it("gibt eine offene Reservierung über das Status-Token sofort frei, nur einmal und nur offene", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    expect(await stockOf(p.variants[0]!.id)).toBe(0);
    const first = await rpc<{ cancelled: boolean }>("cancel_checkout_by_token", [r.status_token]);
    expect(first.cancelled).toBe(true);
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
    const again = await rpc<{ cancelled: boolean }>("cancel_checkout_by_token", [r.status_token]);
    expect(again).toEqual({ cancelled: false });
    const row = await sql<{ status: string; cancel_reason: string }>(
      "select status, cancel_reason from public.orders where id = $1",
      [r.order_id],
    );
    expect(row[0]).toEqual({ status: "cancelled", cancel_reason: "customer_cancelled" });
  });

  it("bezahlte Bestellungen bleiben unberührt; nur der Server darf die Funktion aufrufen", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    await rpc("complete_order", [
      r.order_id,
      JSON.stringify({ amount_total_cents: r.total_cents }),
    ]);
    expect(await rpc("cancel_checkout_by_token", [r.status_token])).toEqual({ cancelled: false });
    const err = await expectPgError(
      q("anon", null, "select public.cancel_checkout_by_token($1)", [r.status_token]),
    );
    expect(err.code).toBe("42501");
  });
});
