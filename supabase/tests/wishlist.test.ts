import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql } from "./helpers";

afterAll(async () => {
  await pool.end();
});

const add = (user: { claims: { sub?: string } }, handle: string, owner = user.claims.sub) =>
  q(
    "authenticated",
    user.claims,
    "insert into public.wishlist_items (user_id, handle) values ($1, $2)",
    [owner, handle],
  );

describe("wishlist_items: RLS", () => {
  it("jede Person sieht, legt an und löscht nur die eigenen Zeilen", async () => {
    const a = await createUser();
    const b = await createUser();
    await add(a, "mantel-a");
    await add(b, "hemd-b");
    expect(await q("authenticated", a.claims, "select handle from public.wishlist_items")).toEqual([
      { handle: "mantel-a" },
    ]);
    // Fremde Zeile anlegen: verweigert
    const err = await expectPgError(add(a, "fremd", b.id));
    expect(err.message).toMatch(/row-level security/);
    // Fremde Zeile löschen: trifft nichts
    await q("authenticated", a.claims, "delete from public.wishlist_items where user_id = $1", [
      b.id,
    ]);
    expect(
      await sql("select 1 from public.wishlist_items where user_id = $1", [b.id]),
    ).toHaveLength(1);
    // Eigene löschen
    await q(
      "authenticated",
      a.claims,
      "delete from public.wishlist_items where handle = 'mantel-a'",
    );
    expect(
      await sql("select 1 from public.wishlist_items where user_id = $1", [a.id]),
    ).toHaveLength(0);
  });

  it("Aktualisieren ist nicht erlaubt", async () => {
    const a = await createUser();
    await add(a, "alt");
    const err = await expectPgError(
      q("authenticated", a.claims, "update public.wishlist_items set handle = 'neu'"),
    );
    expect(err.code).toBe("42501");
  });

  it("anonyme Anfragen sind verweigert", async () => {
    const a = await createUser();
    await add(a, "x");
    expect((await expectPgError(q("anon", null, "select * from public.wishlist_items"))).code).toBe(
      "42501",
    );
    expect(
      (
        await expectPgError(
          q("anon", null, "insert into public.wishlist_items (user_id, handle) values ($1, 'x2')", [
            a.id,
          ]),
        )
      ).code,
    ).toBe("42501");
  });

  it("Handle: 1 bis 200 Zeichen, pro Konto einmalig", async () => {
    const a = await createUser();
    expect((await expectPgError(add(a, ""))).code).toBe("23514");
    expect((await expectPgError(add(a, "x".repeat(201)))).code).toBe("23514");
    await add(a, "x".repeat(200));
    expect((await expectPgError(add(a, "x".repeat(200)))).code).toBe("23505");
    // Mehrfaches Anlegen lässt sich mit on conflict überspringen
    await q(
      "authenticated",
      a.claims,
      "insert into public.wishlist_items (user_id, handle) values ($1, $2) on conflict do nothing",
      [a.id, "x".repeat(200)],
    );
  });
});

describe("wishlist_items: Grenze und Löschen", () => {
  it("höchstens 200 Stücke pro Konto, andere Konten sind nicht betroffen", async () => {
    const a = await createUser();
    const b = await createUser();
    await sql(
      "insert into public.wishlist_items (user_id, handle) select $1, 'h' || g from generate_series(1, 200) g",
      [a.id],
    );
    const err = await expectPgError(add(a, "eins-zu-viel"));
    expect(err.message).toMatch(/wishlist_full/);
    await add(b, "ok");
    // Nach dem Löschen eines Stücks ist wieder Platz
    await q("authenticated", a.claims, "delete from public.wishlist_items where handle = 'h1'");
    await add(a, "eins-zu-viel");
  });

  it("beim Löschen des Kontos verschwinden die Zeilen", async () => {
    const a = await createUser();
    await add(a, "weg");
    await sql("delete from auth.users where id = $1", [a.id]);
    expect(
      await sql("select 1 from public.wishlist_items where user_id = $1", [a.id]),
    ).toHaveLength(0);
  });
});
