// Bildfassungen: Spalte product_images.variants (jsonb, null oder Array).
import { afterAll, describe, expect, it } from "vitest";
import { expectPgError, pool, sql } from "./helpers";
import { makeProduct } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

describe("product_images.variants", () => {
  it("ist standardmässig null; ein Array von {w, path} wird gespeichert", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const before = await sql<{ variants: unknown }>(
      "select variants from public.product_images where product_id = $1",
      [p.id],
    );
    expect(before[0]!.variants).toBeNull();
    const variants = [
      { w: 640, path: "x/a-640.webp" },
      { w: 1200, path: "x/a-1200.webp" },
    ];
    await sql("update public.product_images set variants = $2::jsonb where product_id = $1", [
      p.id,
      JSON.stringify(variants),
    ]);
    const after = await sql<{ variants: unknown }>(
      "select variants from public.product_images where product_id = $1",
      [p.id],
    );
    expect(after[0]!.variants).toEqual(variants);
  });

  it("verweigert Werte, die kein Array sind", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const err = await expectPgError(
      sql(
        "update public.product_images set variants = '{\"w\": 640}'::jsonb where product_id = $1",
        [p.id],
      ),
    );
    expect(err.message).toMatch(/product_images_variants_check/);
  });
});
