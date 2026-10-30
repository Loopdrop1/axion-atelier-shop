// Kunden-Quittung: Kundenkonten lesen den gespeicherten MwSt-Satz nur der eigenen Bestellungen (Migration 20261030002100).
import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql } from "./helpers";
import { makeProduct, reserve } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

async function orderFor(userId: string, email: string, vat: number) {
  const p = await makeProduct({ priceCents: 10000, stocks: [3] });
  const order = await reserve({
    lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
    email,
    userId,
  });
  await sql("update public.orders set vat_rate = $2 where id = $1", [order.order_id, vat]);
  return order.order_id;
}

describe("orders.vat_rate für Kundenkonten", () => {
  it("sieht den Satz der eigenen Bestellung, nicht den fremder", async () => {
    const a = await createUser();
    const b = await createUser();
    const idA = await orderFor(a.id, a.email, 8.1);
    const idB = await orderFor(b.id, b.email, 2.6);

    const own = await q<{ id: string; vat_rate: string }>(
      "authenticated",
      a.claims,
      "select id, vat_rate from public.orders where id in ($1, $2)",
      [idA, idB],
    );
    expect(own).toHaveLength(1);
    expect(own[0]!.id).toBe(idA);
    expect(Number(own[0]!.vat_rate)).toBe(8.1);
  });

  it("anon erhält nichts", async () => {
    const err = await expectPgError(q("anon", null, "select vat_rate from public.orders"));
    expect(err.code).toBe("42501");
  });

  it("die Freigabe ist auf diese Spalte beschränkt (admin_note bleibt gesperrt)", async () => {
    const a = await createUser();
    const err = await expectPgError(
      q("authenticated", a.claims, "select admin_note from public.orders"),
    );
    expect(err.code).toBe("42501");
  });
});
