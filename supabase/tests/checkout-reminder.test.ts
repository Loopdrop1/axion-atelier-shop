// Erinnerung an abgebrochene Kassen und Rückerstattungs-E-Mail: Datenbank-Teil (Migration 20261028001600).
import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq } from "./helpers";
import { makeProduct, reserve, rpc } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

async function cartOrder(opts: { email?: string; quantity?: number } = {}) {
  const p = await makeProduct({ priceCents: 1000, stocks: [5, 5] });
  const r = await reserve({
    lines: [
      { variant_id: p.variants[0]!.id, quantity: opts.quantity ?? 2 },
      { variant_id: p.variants[1]!.id, quantity: 1 },
    ],
    email: opts.email ?? `${uniq("kunde")}@example.ch`,
  });
  return { p, r };
}

type Line = { variant_id: string; quantity: number };
const restore = (token: string, role: "anon" | "authenticated" | "service_role" = "anon") =>
  rpc<Line[]>("restore_cart_by_token", [token], role);

describe("restore_cart_by_token", () => {
  it("anon bekommt nur Variante und Menge einer abgebrochenen Warenkorb-Bestellung", async () => {
    const { p, r } = await cartOrder();
    await rpc("cancel_order", [r.order_id, "expired"]);
    const lines = await restore(r.status_token);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => Object.keys(l).sort())).toEqual([
      ["quantity", "variant_id"],
      ["quantity", "variant_id"],
    ]);
    expect(lines).toEqual(
      expect.arrayContaining([
        { variant_id: p.variants[0]!.id, quantity: 2 },
        { variant_id: p.variants[1]!.id, quantity: 1 },
      ]),
    );
    // auch eingeloggte Kundschaft darf
    expect(await restore(r.status_token, "authenticated")).toHaveLength(2);
  });

  it("nichts für offene, bezahlte, erstattete, fremde, alte oder unbekannte Bestellungen", async () => {
    const pending = await cartOrder();
    expect(await restore(pending.r.status_token)).toEqual([]);

    const paid = await cartOrder();
    await rpc("complete_order", [paid.r.order_id, JSON.stringify({ email: "a@example.ch" })]);
    expect(await restore(paid.r.status_token)).toEqual([]);

    const refunded = await cartOrder();
    await rpc("complete_order", [
      refunded.r.order_id,
      JSON.stringify({ email: "a@example.ch", payment_intent_id: uniq("pi") }),
    ]);
    await sql("update public.orders set status = 'refunded' where id = $1", [refunded.r.order_id]);
    expect(await restore(refunded.r.status_token)).toEqual([]);

    const old = await cartOrder();
    await rpc("cancel_order", [old.r.order_id, "expired"]);
    await sql("update public.orders set created_at = now() - interval '8 days' where id = $1", [
      old.r.order_id,
    ]);
    expect(await restore(old.r.status_token)).toEqual([]);
    await sql("update public.orders set created_at = now() - interval '6 days' where id = $1", [
      old.r.order_id,
    ]);
    expect(await restore(old.r.status_token)).toHaveLength(2);

    expect(await restore("00000000-0000-4000-8000-000000000000")).toEqual([]);
    // Bestell-ID statt Token liefert nichts
    expect(await restore(old.r.order_id)).toEqual([]);
  });

  it("Gutscheinkauf liefert nichts", async () => {
    const r = await rpc<{ order_id: string; status_token: string }>("reserve_gift_card_purchase", [
      5000,
      "k@example.ch",
      "de",
      JSON.stringify({}),
      null,
    ]);
    await rpc("cancel_order", [r.order_id, "expired"]);
    expect(await restore(r.status_token)).toEqual([]);
  });

  it("gelöschte Variante (variant_id null) wird ausgelassen", async () => {
    const { r } = await cartOrder();
    await rpc("cancel_order", [r.order_id, "expired"]);
    await sql(
      "update public.order_items set variant_id = null where order_id = $1 and quantity = 1",
      [r.order_id],
    );
    expect(await restore(r.status_token)).toEqual([
      { variant_id: expect.any(String), quantity: 2 },
    ]);
  });
});

describe("Erinnerung: Rechte", () => {
  it("nur service_role ruft die internen Funktionen auf; anon und Kundschaft nicht", async () => {
    const { r } = await cartOrder();
    const user = await createUser(`${uniq("u")}@example.ch`);
    const calls: [string, unknown[]][] = [
      ["set_order_reminder", [r.order_id, true]],
      ["get_cart_reminder", [r.order_id]],
      ["get_refund_notice", ["pi_x"]],
      ["mark_refund_notified", [r.order_id, 100]],
      ["mark_order_email_sent", [r.order_id, "reminder"]],
    ];
    for (const [fn, args] of calls) {
      const params = args.map((_, i) => `$${i + 1}`).join(", ");
      for (const [role, claims] of [
        ["anon", null],
        ["authenticated", user.claims],
      ] as const) {
        const err = await expectPgError(q(role, claims, `select public.${fn}(${params})`, args));
        expect(err.message, `${fn} als ${role}`).toMatch(/permission denied/);
      }
    }
  });

  it("anon sieht die Bestellung selbst weiterhin nicht", async () => {
    const err = await expectPgError(
      q(
        "anon",
        null,
        "select reminder_opt_in, reminder_sent_at, refund_notified_cents from public.orders",
      ),
    );
    expect(err.message).toMatch(/permission denied|row-level security/);
  });
});

describe("Erinnerung: Einwilligung und Merker", () => {
  const reminder = (id: string) =>
    rpc<{ id: string; status_token: string } | null>("get_cart_reminder", [id]);

  it("Standard ist keine Einwilligung; ohne sie liefert get_cart_reminder nichts", async () => {
    const { r } = await cartOrder();
    const row = await sql<{ reminder_opt_in: boolean | null }>(
      "select reminder_opt_in from public.orders where id = $1",
      [r.order_id],
    );
    expect(row[0]!.reminder_opt_in).toBe(false);
    await rpc("cancel_order", [r.order_id, "expired"]);
    expect(await reminder(r.order_id)).toBeNull();
  });

  it("mit Einwilligung und Ablauf: Bestellung mit Artikeln; nach mark_order_email_sent nicht mehr", async () => {
    const { r } = await cartOrder();
    await rpc("set_order_reminder", [r.order_id, true]);
    // noch offen: nichts
    expect(await reminder(r.order_id)).toBeNull();
    await rpc("cancel_order", [r.order_id, "expired"]);
    const order = await reminder(r.order_id);
    expect(order?.status_token).toBe(r.status_token);
    expect((order as unknown as { items: unknown[] }).items).toHaveLength(2);
    await rpc("mark_order_email_sent", [r.order_id, "reminder"]);
    expect(await reminder(r.order_id)).toBeNull();
    const row = await sql<{ reminder_sent_at: string | null }>(
      "select reminder_sent_at from public.orders where id = $1",
      [r.order_id],
    );
    expect(row[0]!.reminder_sent_at).not.toBeNull();
  });

  it("nur nach Ablauf: customer_cancelled und payment_failed bekommen keine Erinnerung", async () => {
    for (const reason of ["customer_cancelled", "payment_failed", "stripe_error"]) {
      const { r } = await cartOrder();
      await rpc("set_order_reminder", [r.order_id, true]);
      await rpc("cancel_order", [r.order_id, reason]);
      expect(await reminder(r.order_id), reason).toBeNull();
    }
  });

  it("nicht, wenn dieselbe Adresse danach bezahlt hat", async () => {
    const email = `${uniq("gleich")}@example.ch`;
    const first = await cartOrder({ email });
    await rpc("set_order_reminder", [first.r.order_id, true]);
    const second = await cartOrder({ email: email.toUpperCase() });
    await rpc("complete_order", [second.r.order_id, JSON.stringify({ email })]);
    await rpc("cancel_order", [first.r.order_id, "expired"]);
    expect(await reminder(first.r.order_id)).toBeNull();
  });

  it("set_order_reminder wirkt nur auf offene Warenkorb-Bestellungen", async () => {
    const { r } = await cartOrder();
    await rpc("cancel_order", [r.order_id, "expired"]);
    await rpc("set_order_reminder", [r.order_id, true]);
    const row = await sql<{ reminder_opt_in: boolean | null }>(
      "select reminder_opt_in from public.orders where id = $1",
      [r.order_id],
    );
    expect(row[0]!.reminder_opt_in).toBe(false);
  });

  it("mark_order_email_sent kennt die bisherigen Arten weiter und lehnt andere ab", async () => {
    const { r } = await cartOrder();
    for (const kind of ["confirmation", "notification", "gift_card", "shipping", "reminder"])
      await rpc("mark_order_email_sent", [r.order_id, kind]);
    const err = await expectPgError(rpc("mark_order_email_sent", [r.order_id, "unbekannt"]));
    expect(err.message).toMatch(/INVALID_KIND/);
  });
});

describe("Rückerstattungs-Merker", () => {
  it("get_refund_notice liefert nur Neues; mark_refund_notified merkt den höchsten Betrag", async () => {
    const { r } = await cartOrder();
    const pi = uniq("pi");
    await rpc("complete_order", [
      r.order_id,
      JSON.stringify({ email: "x@example.ch", payment_intent_id: pi }),
    ]);
    const notice = () =>
      rpc<{ refunded_cents: number; refund_notified_cents: number } | null>("get_refund_notice", [
        pi,
      ]);
    expect(await notice()).toBeNull();
    await rpc("record_refund", [pi, 5000]);
    expect(await notice()).toMatchObject({ refunded_cents: 5000, refund_notified_cents: 0 });
    await rpc("mark_refund_notified", [r.order_id, 5000]);
    expect(await notice()).toBeNull();
    // niedrigerer Wert überschreibt nicht
    await rpc("mark_refund_notified", [r.order_id, 100]);
    await rpc("record_refund", [pi, 8000]);
    expect(await notice()).toMatchObject({ refunded_cents: 8000, refund_notified_cents: 5000 });
    expect(await rpc("get_refund_notice", ["pi_unbekannt"])).toBeNull();
  });
});
