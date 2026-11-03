// Migration 20261104002600 (Cloud 0025): Versandwahl in reserve_checkout, Spaltenrechte, on_sale an Positionen und
// Sale-Stücke bei Retouren.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { expectPgError, pool, q, sql, uniq } from "./helpers";
import { makeDiscount, makeGiftCard, makeProduct, reserve, rpc } from "./fixtures";
import { SHIPPING_CASES } from "./shipping-cases";

const created: string[] = [];

afterAll(async () => {
  await sql(
    "update public.shop_settings set shipping_cents = 0, free_shipping_from_cents = null, priority_shipping_cents = null",
  );
  await sql("delete from public.orders where id = any($1::uuid[])", [created]);
  await pool.end();
});

beforeEach(async () => {
  await sql("delete from private.rate_limits");
});

async function setShipping(s: {
  shippingCents: number;
  freeShippingFromCents: number | null;
  priorityShippingCents: number | null;
}) {
  await sql(
    "update public.shop_settings set shipping_cents = $1, free_shipping_from_cents = $2, priority_shipping_cents = $3",
    [s.shippingCents, s.freeShippingFromCents, s.priorityShippingCents],
  );
}

describe("reserve_checkout: Versandart (gleiche Fälle wie estimateTotals im Shop)", () => {
  it.each(SHIPPING_CASES.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    await setShipping(c.settings);
    try {
      const p = await makeProduct({ priceCents: c.subtotalCents, stocks: [3] });
      let code: string | null = null;
      if (c.discountCents > 0) {
        code = uniq("SHIP").toUpperCase().replace(/-/g, "");
        await makeDiscount(code, "amount", c.discountCents);
      }
      const card = c.giftCents > 0 ? await makeGiftCard(c.giftCents) : null;
      const r = await reserve({
        lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
        discount: code,
        giftCard: card,
        shippingMethod: c.method,
      });
      created.push(r.order_id);
      expect({
        shippingMethod: r.shipping_method,
        shippingCents: r.shipping_cents,
        discountCents: r.discount_cents,
        giftCardCents: r.gift_card_cents,
        totalCents: r.total_cents,
      }).toEqual(c.expected);
      const row = await sql<{ shipping_method: string; shipping_cents: number }>(
        "select shipping_method, shipping_cents from public.orders where id = $1",
        [r.order_id],
      );
      expect(row[0]).toEqual({
        shipping_method: c.expected.shippingMethod,
        shipping_cents: c.expected.shippingCents,
      });
    } finally {
      await setShipping({
        shippingCents: 0,
        freeShippingFromCents: null,
        priorityShippingCents: null,
      });
    }
  });

  it("ohne Angabe (alte Aufrufe mit sechs Parametern): Economy wie bisher", async () => {
    await setShipping({
      shippingCents: 900,
      freeShippingFromCents: null,
      priorityShippingCents: 1500,
    });
    try {
      const p = await makeProduct({ priceCents: 10000, stocks: [2] });
      const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
      created.push(r.order_id);
      expect(r).toMatchObject({
        shipping_method: "economy",
        shipping_cents: 900,
        total_cents: 10900,
      });
    } finally {
      await setShipping({
        shippingCents: 0,
        freeShippingFromCents: null,
        priorityShippingCents: null,
      });
    }
  });

  it("order_json (Mails, Admin) liefert die Versandart", async () => {
    await setShipping({
      shippingCents: 0,
      freeShippingFromCents: null,
      priorityShippingCents: 1200,
    });
    try {
      const p = await makeProduct({ priceCents: 10000, stocks: [2] });
      const r = await reserve({
        lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
        shippingMethod: "priority",
      });
      created.push(r.order_id);
      const order = await rpc<{ shipping_method: string; shipping_cents: number }>(
        "get_order_for_email",
        [r.order_id],
      );
      expect(order).toMatchObject({ shipping_method: "priority", shipping_cents: 1200 });
    } finally {
      await setShipping({
        shippingCents: 0,
        freeShippingFromCents: null,
        priorityShippingCents: null,
      });
    }
  });

  it("die alte Signatur mit sechs Parametern gibt es nur noch über den Standardwert", async () => {
    const rows = await sql<{ args: string }>(
      "select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'reserve_checkout'",
    );
    expect(rows.map((r) => r.args)).toEqual([
      "p_lines jsonb, p_email text, p_locale text, p_discount_code text, p_gift_card_code text, p_user_id uuid, p_shipping_method text",
    ]);
    const err = await expectPgError(
      q("anon", null, "select public.reserve_checkout('[]'::jsonb, 'a@b.ch')"),
    );
    expect(err.code).toBe("42501");
  });
});

describe("shop_settings.priority_shipping_cents", () => {
  it("alle lesen, Standard NULL; nicht negativ", async () => {
    const rows = await q<{ priority_shipping_cents: number | null }>(
      "anon",
      null,
      "select priority_shipping_cents from public.shop_settings where id = 1",
    );
    expect(rows[0]).toEqual({ priority_shipping_cents: null });
    const err = await expectPgError(
      sql("update public.shop_settings set priority_shipping_cents = -1"),
    );
    expect(err.code).toBe("23514");
  });
});

describe("order_items.on_sale", () => {
  async function productWith(opts: { compareAt?: number; tags?: string[] }) {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    await sql("update public.products set compare_at_cents = $2, tags = $3 where id = $1", [
      p.id,
      opts.compareAt ?? null,
      opts.tags ?? [],
    ]);
    return p;
  }

  it("Trigger setzt on_sale beim Anlegen: durchgestrichener Preis oder Tag «sale»", async () => {
    const normal = await productWith({});
    const reduced = await productWith({ compareAt: 15000 });
    const tagged = await productWith({ tags: ["sale"] });
    const r = await reserve({
      lines: [normal, reduced, tagged].map((p) => ({ variant_id: p.variants[0]!.id, quantity: 1 })),
    });
    created.push(r.order_id);
    const items = await sql<{ product_id: string; on_sale: boolean }>(
      "select product_id, on_sale from public.order_items where order_id = $1",
      [r.order_id],
    );
    const bySale = Object.fromEntries(items.map((i) => [i.product_id, i.on_sale]));
    expect(bySale).toEqual({ [normal.id]: false, [reduced.id]: true, [tagged.id]: true });
    // Spätere Preisänderungen ändern die Position nicht
    await sql("update public.products set compare_at_cents = null, tags = '{}' where id = $1", [
      reduced.id,
    ]);
    const after = await sql<{ on_sale: boolean }>(
      "select on_sale from public.order_items where order_id = $1 and product_id = $2",
      [r.order_id, reduced.id],
    );
    expect(after[0]?.on_sale).toBe(true);
    const json = await rpc<{ items: { on_sale: boolean }[] }>("get_order_for_email", [r.order_id]);
    expect(json.items.map((i) => i.on_sale).sort()).toEqual([false, true, true]);
  });

  it("Preis der Variante zählt: durchgestrichener Variantenpreis über dem Stückpreis", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    await sql("update public.product_variants set compare_at_cents = 12000 where id = $1", [
      p.variants[0]!.id,
    ]);
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    created.push(r.order_id);
    const rows = await sql<{ on_sale: boolean }>(
      "select on_sale from public.order_items where order_id = $1",
      [r.order_id],
    );
    expect(rows[0]?.on_sale).toBe(true);
  });
});

describe("Retoure: Sale-Stücke", () => {
  async function paidOrder() {
    const email = `${uniq("sale")}@example.ch`;
    const o = await sql<{ id: string; number: string }>(
      `insert into public.orders (email, status, kind, subtotal_cents, total_cents, paid_at)
       values ($1, 'paid', 'cart', 20000, 20000, now() - interval '2 days') returning id, number`,
      [email],
    );
    const order = o[0]!;
    created.push(order.id);
    const ids: string[] = [];
    // Ohne Variante (wie ältere Bestellungen): on_sale bleibt, wie angegeben
    for (const onSale of [false, true]) {
      const r = await sql<{ id: string }>(
        `insert into public.order_items (order_id, title, size, unit_price_cents, quantity, line_total_cents, on_sale)
         values ($1, $2, '50', 10000, 1, 10000, $3) returning id`,
        [order.id, onSale ? "Sale-Gilet" : "Anzug", onSale],
      );
      ids.push(r[0]!.id);
    }
    return { number: Number(order.number), email, normal: ids[0]!, sale: ids[1]! };
  }

  const submit = (o: { number: number; email: string }, id: string) =>
    rpc<{ status: string }>("return_submit", [
      o.number,
      o.email,
      JSON.stringify([{ order_item_id: id, quantity: 1, reason: "style" }]),
      null,
      "de",
      "10.8.0.1",
      14,
      null,
    ]);

  it("lookup liefert on_sale je Stück, submit lehnt Sale-Stücke ab", async () => {
    const o = await paidOrder();
    const lookup = await rpc<{
      status: string;
      items: { order_item_id: string; on_sale: boolean }[];
    }>("return_lookup", [o.number, o.email, "10.8.0.2", 14]);
    expect(lookup.status).toBe("ok");
    expect(lookup.items.map((i) => [i.order_item_id, i.on_sale])).toEqual([
      [o.normal, false],
      [o.sale, true],
    ]);
    expect(await submit(o, o.sale)).toEqual({ status: "invalid_items" });
    expect((await submit(o, o.normal)).status).toBe("ok");
  });
});
