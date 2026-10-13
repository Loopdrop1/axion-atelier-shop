import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq, type TestUser } from "./helpers";

let admin: TestUser;
let customer: TestUser;
let other: TestUser;
let draftHandle: string;
const SEED = [
  "anzug-limmat-marine",
  "anzug-aare-anthrazit",
  "weste-limmat-marine",
  "weste-limmat-salbeigruen",
  "derby-lino-braun",
  "oxford-nero-schwarz",
];

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
  customer = await createUser(undefined, { locale: "en" });
  other = await createUser();
  draftHandle = uniq("entwurf");
  await sql(
    `insert into public.products (handle, category_id, model, status, title_de, color_name_de, color_hex, price_cents)
     select $1, id, 'entwurf', 'draft', 'Entwurf', 'Grau', '#777777', 10000 from public.categories where slug = 'anzuege'`,
    [draftHandle],
  );
  await sql(
    `insert into public.product_variants (product_id, size, stock)
     select id, '50', 5 from public.products where handle = $1`,
    [draftHandle],
  );
});

afterAll(async () => {
  await pool.end();
});

describe("Katalog lesen", () => {
  it("anon sieht die sechs aktiven Beispielprodukte, aber keinen Entwurf", async () => {
    const rows = await q<{ handle: string }>(
      "anon",
      null,
      "select handle from public.products where handle = any($1) order by handle",
      [[...SEED, draftHandle]],
    );
    const handles = rows.map((r) => r.handle);
    expect(handles).toContain("anzug-limmat-marine");
    expect(handles).toHaveLength(6);
    expect(handles).not.toContain(draftHandle);
  });

  it("anon sieht Varianten und Bilder nur von aktiven Produkten", async () => {
    const variants = await q<{ n: string }>(
      "anon",
      null,
      "select count(*)::text as n from public.product_variants v join public.products p on p.id = v.product_id where p.handle = $1",
      [draftHandle],
    );
    expect(variants[0]?.n).toBe("0");
    const images = await q<{ path: string }>(
      "anon",
      null,
      "select i.path from public.product_images i join public.products p on p.id = i.product_id where p.handle = any($1)",
      [SEED],
    );
    // Muster-Sortiment: je Produkt Vorder- und Rückansicht
    expect(images.length).toBe(SEED.length * 2);
    expect(images.every((i) => i.path.startsWith("asset:muster/"))).toBe(true);
  });

  it("Admin sieht auch Entwürfe", async () => {
    const rows = await q<{ handle: string }>(
      "authenticated",
      admin.claims,
      "select handle from public.products where handle = $1",
      [draftHandle],
    );
    expect(rows).toHaveLength(1);
  });

  it("die Seed-Bestände entsprechen den Beispieldaten (Limmat Grösse 56 ausverkauft)", async () => {
    const rows = await q<{ size: string; stock: number }>(
      "anon",
      null,
      `select v.size, v.stock from public.product_variants v join public.products p on p.id = v.product_id
       where p.handle = 'anzug-limmat-marine' order by v.sort`,
    );
    expect(rows.map((r) => r.stock)).toEqual([3, 3, 3, 0, 3, 0]);
  });
});

describe("Katalog schreiben", () => {
  it("eingeloggte Kundschaft ohne Admin-Rolle kann keine Produkte anlegen", async () => {
    const err = await expectPgError(
      q(
        "authenticated",
        customer.claims,
        `insert into public.products (handle, category_id, model, title_de, color_name_de, color_hex, price_cents)
         select 'boese', id, 'boese', 'Böse', 'Rot', '#ff0000', 1 from public.categories limit 1`,
      ),
    );
    expect(err.message).toMatch(/row-level security/);
  });

  it("eingeloggte Kundschaft ändert keine Preise (0 Zeilen)", async () => {
    const rows = await q(
      "authenticated",
      customer.claims,
      "update public.products set price_cents = 100 where handle = 'anzug-limmat-marine' returning id",
    );
    expect(rows).toHaveLength(0);
    const check = await sql<{ price_cents: number }>(
      "select price_cents from public.products where handle = 'anzug-limmat-marine'",
    );
    expect(check[0]?.price_cents).toBe(48900);
  });

  it("Admin legt ein Produkt mit Variante an; Anfangsbestand nur über admin_adjust_stock", async () => {
    const handle = uniq("neu");
    await q(
      "authenticated",
      admin.claims,
      `insert into public.products (handle, category_id, model, title_de, color_name_de, color_hex, price_cents)
       select $1, id, 'test-modell', 'Test', 'Blau', '#0000ff', 9900 from public.categories where slug = 'westen'`,
      [handle],
    );
    const rows = await q<{ id: string; stock: number }>(
      "authenticated",
      admin.claims,
      `insert into public.product_variants (product_id, size, sku) select id, '48', $2 from public.products where handle = $1
       returning id, stock`,
      [handle, uniq("SKU")],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stock).toBe(0);
    const variantId = rows[0]!.id;
    const stock = await q<{ stock: number }>(
      "authenticated",
      admin.claims,
      "select public.admin_adjust_stock($1, 2, 'correction', 'Anfangsbestand') as stock",
      [variantId],
    );
    expect(stock[0]?.stock).toBe(2);
    const moves = await sql<{ delta: number; reason: string; note: string }>(
      "select delta, reason::text, note from public.stock_movements where variant_id = $1",
      [variantId],
    );
    expect(moves).toEqual([{ delta: 2, reason: "correction", note: "Anfangsbestand" }]);
  });

  it("Bestand lässt sich auch als Admin nicht direkt setzen (immer mit Lagerbewegung)", async () => {
    const insert = await expectPgError(
      q(
        "authenticated",
        admin.claims,
        `insert into public.product_variants (product_id, size, stock) select id, '99', 5 from public.products where handle = $1`,
        [draftHandle],
      ),
    );
    expect(insert.message).toMatch(/permission denied/);
    const update = await expectPgError(
      q(
        "authenticated",
        admin.claims,
        `update public.product_variants set stock = 50 where product_id = (select id from public.products where handle = $1)`,
        [draftHandle],
      ),
    );
    expect(update.message).toMatch(/permission denied/);
    // Andere Felder bleiben änderbar
    const ok = await q(
      "authenticated",
      admin.claims,
      `update public.product_variants set active = active, price_cents = null
       where product_id = (select id from public.products where handle = $1) returning id`,
      [draftHandle],
    );
    expect(ok).toHaveLength(1);
  });

  it("Bestand kann nicht negativ werden", async () => {
    const err = await expectPgError(
      sql(
        "update public.product_variants set stock = -1 where size = '48' and product_id = (select id from public.products where handle = 'anzug-limmat-marine')",
      ),
    );
    expect(err.message).toMatch(/check constraint/);
  });

  it("Herkunft und Ausstattung haben Längengrenzen", async () => {
    const origin = await expectPgError(
      sql("update public.products set origin_de = repeat('x', 121) where handle = $1", [
        draftHandle,
      ]),
    );
    expect(origin.message).toMatch(/check constraint/);
    const features = await expectPgError(
      sql("update public.products set features_en = repeat('x', 1501) where handle = $1", [
        draftHandle,
      ]),
    );
    expect(features.message).toMatch(/check constraint/);
    const ok = await sql(
      "update public.products set origin_de = 'Gefertigt in Italien', features_de = $2 where handle = $1 returning id",
      [draftHandle, "Zweiknopf-Sakko\nHose ohne Bundfalte"],
    );
    expect(ok).toHaveLength(1);
  });

  it("anon kann keine Inhalte ändern, Admin schon", async () => {
    const err = await expectPgError(
      q("anon", null, "update public.site_content set value = '{}' where key = 'home.hero'"),
    );
    expect(err.message).toMatch(/permission denied/);
    const rows = await q(
      "authenticated",
      admin.claims,
      "update public.site_content set value = value where key = 'home.hero' returning key",
    );
    expect(rows).toHaveLength(1);
  });
});

describe("Profile und Rollen", () => {
  it("ein neuer Benutzer bekommt ein Profil mit seiner Sprache", async () => {
    const rows = await sql<{ locale: string }>("select locale from public.profiles where id = $1", [
      customer.id,
    ]);
    expect(rows[0]?.locale).toBe("en");
  });

  it("Vor- und Nachname aus der Registrierung landen gekürzt im Profil", async () => {
    const id = (
      await sql<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
        [
          `${uniq("name")}@example.ch`,
          JSON.stringify({ locale: "de", first_name: "  Anna ", last_name: "M".repeat(150) }),
        ],
      )
    )[0]!.id;
    const rows = await sql<{ first_name: string; last_name: string }>(
      "select first_name, last_name from public.profiles where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ first_name: "Anna", last_name: "M".repeat(100) });
  });

  it("Kundschaft liest und ändert nur das eigene Profil", async () => {
    const own = await q<{ id: string }>(
      "authenticated",
      customer.claims,
      "select id from public.profiles",
    );
    expect(own.map((r) => r.id)).toEqual([customer.id]);
    const updated = await q(
      "authenticated",
      customer.claims,
      "update public.profiles set first_name = 'Max' where id = $1 returning id",
      [other.id],
    );
    expect(updated).toHaveLength(0);
    const mine = await q(
      "authenticated",
      customer.claims,
      "update public.profiles set first_name = 'Max' where id = $1 returning id",
      [customer.id],
    );
    expect(mine).toHaveLength(1);
  });

  it("Kundschaft darf geschützte Profilspalten nicht ändern", async () => {
    const err = await expectPgError(
      q(
        "authenticated",
        customer.claims,
        "update public.profiles set created_at = now() where id = $1",
        [customer.id],
      ),
    );
    expect(err.message).toMatch(/permission denied/);
  });

  it("niemand ausser dem Server vergibt sich selbst Admin-Rechte", async () => {
    const err = await expectPgError(
      q(
        "authenticated",
        customer.claims,
        "insert into public.user_roles (user_id, role) values ($1, 'admin')",
        [customer.id],
      ),
    );
    expect(err.message).toMatch(/permission denied/);
  });

  it("Kundschaft sieht nur die eigenen Rollen, Admin alle", async () => {
    const mine = await q("authenticated", customer.claims, "select * from public.user_roles");
    expect(mine).toHaveLength(0);
    const all = await q<{ user_id: string }>(
      "authenticated",
      admin.claims,
      "select user_id from public.user_roles",
    );
    expect(all.map((r) => r.user_id)).toContain(admin.id);
  });
});
