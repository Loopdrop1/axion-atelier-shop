// Model-Angaben pro Produkt (Migration 20261103002400): lesen wie die übrigen Produktspalten, schreiben nur
// das Admin, Prüfungen auf Körpergrösse (120–230 cm) und Länge der Grösse (höchstens 20 Zeichen).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, type TestUser } from "./helpers";
import { makeProduct } from "./fixtures";

let admin: TestUser;
let customer: TestUser;
let handle: string;

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
  customer = await createUser();
  handle = (await makeProduct({ priceCents: 48900, stocks: [2, 2] })).handle;
});

afterAll(async () => {
  await pool.end();
});

const update = (who: TestUser, height: number | null, size: string | null) =>
  q<{ handle: string }>(
    "authenticated",
    who.claims,
    "update public.products set model_height_cm = $2, model_size = $3 where handle = $1 returning handle",
    [handle, height, size],
  );

describe("products.model_height_cm / model_size", () => {
  it("Admin setzt die Angaben; anon liest sie bei aktiven Produkten", async () => {
    expect(await update(admin, 186, "50")).toHaveLength(1);
    const rows = await q<{ model_height_cm: number; model_size: string }>(
      "anon",
      null,
      "select model_height_cm, model_size from public.products where handle = $1",
      [handle],
    );
    expect(rows).toEqual([{ model_height_cm: 186, model_size: "50" }]);
  });

  it("Kundschaft kann nichts ändern (RLS: keine Zeile betroffen)", async () => {
    expect(await update(customer, 150, "46")).toHaveLength(0);
    const [row] = await sql<{ model_height_cm: number }>(
      "select model_height_cm from public.products where handle = $1",
      [handle],
    );
    expect(row?.model_height_cm).toBe(186);
  });

  it("anon kann nichts ändern", async () => {
    const err = await expectPgError(
      q("anon", null, "update public.products set model_size = 'XL' where handle = $1", [handle]),
    );
    expect(err.code).toBe("42501");
  });

  it("prüft Körpergrösse und Länge der Grösse; leer ist erlaubt", async () => {
    for (const height of [119, 231])
      expect((await expectPgError(update(admin, height, "50"))).code).toBe("23514");
    expect((await expectPgError(update(admin, 180, "x".repeat(21)))).code).toBe("23514");
    expect(await update(admin, 120, "x".repeat(20))).toHaveLength(1);
    expect(await update(admin, null, null)).toHaveLength(1);
  });

  it("Seed: drei Muster-Anzüge mit Model-Angaben", async () => {
    const rows = await sql<{ handle: string; model_height_cm: number; model_size: string }>(
      `select handle, model_height_cm, model_size from public.products
       where model_height_cm is not null and handle not like 'test-%' order by handle`,
    );
    expect(rows).toEqual([
      { handle: "anzug-aare-anthrazit", model_height_cm: 182, model_size: "48" },
      { handle: "anzug-limmat-marine", model_height_cm: 186, model_size: "50" },
      { handle: "smoking-thur-schwarz", model_height_cm: 189, model_size: "52" },
    ]);
  });
});
