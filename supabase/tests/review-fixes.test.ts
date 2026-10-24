// Korrekturen aus dem Review: Rate-Limit-IP, MWST-Satz, Gutschein-Gutschrift, Inventur, Wieder-da bei Retoure, Sendungsnummer.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq, type TestUser } from "./helpers";
import { makeGiftCard, makeProduct, reserve, rpc, stockOf } from "./fixtures";

let admin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
  customer = await createUser();
});

afterAll(async () => {
  await pool.end();
});

const asAdmin = <T>(fn: string, args: unknown[]) => rpc<T>(fn, args, "authenticated", admin.claims);

async function paid(opts: { giftCard?: string | null; stocks?: number[]; qty?: number } = {}) {
  const p = await makeProduct({ priceCents: 10000, stocks: opts.stocks ?? [5] });
  const r = await reserve({
    lines: [{ variant_id: p.variants[0]!.id, quantity: opts.qty ?? 1 }],
    giftCard: opts.giftCard ?? null,
  });
  await rpc("complete_order", [r.order_id, "{}"]);
  return { p, r };
}

describe("F06: Rate-Limit-IP", () => {
  it("cf-connecting-ip hat Vorrang vor einem (fälschbaren) X-Forwarded-For", async () => {
    const forged = uniq("forged");
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
    await q("anon", null, "select public.check_gift_card('AXN-AAAA-AAAA-AAAA')", [], {
      headers: { "x-forwarded-for": forged, "cf-connecting-ip": ip },
    });
    const count = (key: string) =>
      sql("select 1 from private.rate_limits where key = private.hash_token($1)", [key]);
    expect(await count(`giftcard:${forged}`)).toHaveLength(0);
    expect(await count(`giftcard:${ip}`)).toHaveLength(1);
  });

  it("check_discount: globales Limit «discount-global» greift", async () => {
    await sql("delete from private.rate_limits where key = private.hash_token('discount-global')");
    const call = (ip: string) =>
      q<{ r: { reason?: string } }>(
        "anon",
        null,
        "select public.check_discount('X', 1000) as r",
        [],
        { headers: { "cf-connecting-ip": ip } },
      ).then((rows) => rows[0]!.r);
    expect((await call("198.51.100.1")).reason).toBe("not_found");
    await sql(
      "update private.rate_limits set hits = 300, window_start = now() where key = private.hash_token('discount-global')",
    );
    expect((await call("198.51.100.2")).reason).toBe("rate_limited");
    await sql("delete from private.rate_limits where key = private.hash_token('discount-global')");
  });
});

describe("F15: MWST-Satz pro Bestellung", () => {
  it("set_order_vat_rate speichert den Satz einmal; order_json liefert ihn; nur service_role", async () => {
    const { r } = await paid();
    await rpc("set_order_vat_rate", [r.order_id, 8.1]);
    await rpc("set_order_vat_rate", [r.order_id, 2.6]); // überschreibt nicht
    const order = await asAdmin<{ vat_rate: number }>("admin_get_order", [r.order_id]);
    expect(Number(order.vat_rate)).toBe(8.1);
    const bad = await expectPgError(rpc("set_order_vat_rate", [r.order_id, 150]));
    expect(bad.message).toBe("INVALID_VAT_RATE");
    const denied = await expectPgError(
      rpc("set_order_vat_rate", [r.order_id, 8.1], "authenticated", admin.claims),
    );
    expect(denied.code).toBe("42501");
  });

  it("Altbestellungen ohne Satz: vat_rate ist null", async () => {
    const { r } = await paid();
    const order = await asAdmin<{ vat_rate: number | null }>("admin_get_order", [r.order_id]);
    expect(order.vat_rate).toBeNull();
  });
});

describe("F16: Gutscheinanteil gutschreiben", () => {
  it("bucht höchstens den bezahlten Gutscheinanteil zurück", async () => {
    const code = await makeGiftCard(4000);
    const { r } = await paid({ giftCard: code });
    expect(r.gift_card_cents).toBe(4000);
    const ok = await asAdmin<{ credited_cents: number; balance_cents: number }>(
      "admin_credit_gift_card",
      [r.order_id, 1500, null],
    );
    expect(ok).toEqual({ credited_cents: 1500, balance_cents: 1500 });
    const tooMuch = await expectPgError(
      asAdmin("admin_credit_gift_card", [r.order_id, 2501, null]),
    );
    expect(tooMuch.message).toBe("INVALID_AMOUNT");
    expect(JSON.parse(tooMuch.detail!)).toEqual({ max: 2500 });
    await asAdmin("admin_credit_gift_card", [r.order_id, 2500, "Retoure"]);
    const order = await asAdmin<{ gift_card_credited_cents: number }>("admin_get_order", [
      r.order_id,
    ]);
    expect(order.gift_card_credited_cents).toBe(4000);
    const tx = await sql<{ delta_cents: number; kind: string; created_by: string }>(
      "select delta_cents, kind, created_by from public.gift_card_transactions where order_id = $1 and kind = 'adjust' order by id",
      [r.order_id],
    );
    expect(tx).toEqual([
      { delta_cents: 1500, kind: "adjust", created_by: admin.id },
      { delta_cents: 2500, kind: "adjust", created_by: admin.id },
    ]);
  });

  it("Bestellung ohne Gutschein: NO_GIFT_CARD; ohne Admin-Rolle: FORBIDDEN", async () => {
    const { r } = await paid();
    const none = await expectPgError(asAdmin("admin_credit_gift_card", [r.order_id, 100, null]));
    expect(none.message).toBe("NO_GIFT_CARD");
    const forbidden = await expectPgError(
      rpc("admin_credit_gift_card", [r.order_id, 100, null], "authenticated", customer.claims),
    );
    expect(forbidden.message).toBe("FORBIDDEN");
    const missing = await expectPgError(
      asAdmin("admin_credit_gift_card", ["00000000-0000-4000-8000-000000000000", 100, null]),
    );
    expect(missing.message).toBe("ORDER_NOT_FOUND");
  });
});

describe("F17: Inventur serverseitig", () => {
  it("verbucht den gezählten Bestand als Korrektur mit Delta unter Sperre", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const v = p.variants[0]!.id;
    expect(await asAdmin<number>("admin_set_stock", [v, 3, 5, "Inventur"])).toBe(3);
    expect(await stockOf(v)).toBe(3);
    const moves = await sql<{ delta: number; reason: string }>(
      "select delta, reason from public.stock_movements where variant_id = $1",
      [v],
    );
    expect(moves).toEqual([{ delta: -2, reason: "correction" }]);
  });

  it("hat sich der Bestand inzwischen verändert: STOCK_CHANGED, nichts wird verbucht", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const v = p.variants[0]!.id;
    await asAdmin("admin_adjust_stock", [v, -1, "sale_store", null]); // Verkauf zwischen Öffnen und Speichern
    const err = await expectPgError(asAdmin("admin_set_stock", [v, 3, 5, "Inventur"]));
    expect(err.message).toBe("STOCK_CHANGED");
    expect(JSON.parse(err.detail!)).toEqual({ available: 4 });
    expect(await stockOf(v)).toBe(4);
  });

  it("ungültige Zahl, gleicher Bestand, fehlende Rechte", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const v = p.variants[0]!.id;
    expect((await expectPgError(asAdmin("admin_set_stock", [v, -1, 2, null]))).message).toBe(
      "INVALID_COUNT",
    );
    expect((await expectPgError(asAdmin("admin_set_stock", [v, 2, 2, null]))).message).toBe(
      "INVALID_DELTA",
    );
    const forbidden = await expectPgError(
      rpc("admin_set_stock", [v, 1, 2, null], "authenticated", customer.claims),
    );
    expect(forbidden.message).toBe("FORBIDDEN");
  });
});

describe("F18: Retoure meldet Varianten, die wieder vorrätig sind", () => {
  it("back_in_stock enthält nur Varianten, die von 0 auf mehr als 0 gingen", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1, 3] });
    const [a, b] = p.variants;
    const r = await reserve({
      lines: [
        { variant_id: a!.id, quantity: 1 },
        { variant_id: b!.id, quantity: 1 },
      ],
    });
    await rpc("complete_order", [r.order_id, "{}"]);
    expect(await stockOf(a!.id)).toBe(0);
    const items = await sql<{ id: string; variant_id: string }>(
      "select id, variant_id from public.order_items where order_id = $1",
      [r.order_id],
    );
    const result = await asAdmin<{ restocked: number; back_in_stock: string[] }>(
      "admin_restock_order",
      [r.order_id, JSON.stringify(items.map((i) => ({ order_item_id: i.id, quantity: 1 })))],
    );
    expect(result.restocked).toBe(2);
    expect(result.back_in_stock).toEqual([a!.id]);
  });
});

describe("F19: Sendungsnummer auf der Gast-Statusseite", () => {
  it("zeigt die Nummer nur, wenn die Bestellung versandt ist", async () => {
    const { r } = await paid();
    const before = await rpc<{ tracking_number: string | null }>(
      "get_order_status",
      [r.status_token],
      "anon",
    );
    expect(before.tracking_number).toBeNull();
    await rpc("mark_order_shipped", [r.order_id, "99.00.123456.12345678"]);
    const after = await rpc<{ tracking_number: string | null; status: string }>(
      "get_order_status",
      [r.status_token],
      "anon",
    );
    expect(after).toMatchObject({ status: "shipped", tracking_number: "99.00.123456.12345678" });
  });
});
