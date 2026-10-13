// Muster-Sortiment für Cloud (supabase/demo/*.sql) auf einer eigenen, frischen Datenbank ohne Seed:
// mehrfach ausführbar, ein echtes Produkt mit gleicher Adresse bleibt unberührt, Löschen trifft nur Musterstücke,
// Bestellungen bleiben (Positionen verlieren nur den Link), und es ist derselbe Katalog wie in seed.sql.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_URL, sql } from "./helpers";

const ROOT = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const NAME = `axion_demo_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
let db: pg.Client;

const one = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  (await db.query(text, params)).rows[0] as T;
const counts = () =>
  one<{ products: number; variants: number; images: number; muster: number }>(
    `select (select count(*)::int from public.products) as products,
            (select count(*)::int from public.product_variants) as variants,
            (select count(*)::int from public.product_images) as images,
            (select count(*)::int from public.products where 'muster' = any (tags)) as muster`,
  );

beforeAll(async () => {
  await sql(`create database ${NAME}`);
  const url = new URL(DB_URL);
  url.pathname = `/${NAME}`;
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await db.query("set client_min_messages = warning");
  await db.query(read("scripts/db/supabase-compat.sql"));
  const migrations = readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  for (const file of migrations.sort()) await db.query(read(`supabase/migrations/${file}`));
});

afterAll(async () => {
  await db?.end();
  await sql(`drop database if exists ${NAME} with (force)`);
});

describe("Muster-Sortiment (supabase/demo)", () => {
  it("spielt ein, lässt ein echtes Produkt mit gleicher Adresse in Ruhe und ist wiederholbar", async () => {
    // Echtes Produkt (ohne Kennzeichen) mit der Adresse eines Musterstücks, noch ohne Grössen und Bilder
    await db.query(
      `insert into public.categories (slug, name_de, name_en, sort) values ('anzuege', 'Anzüge (echt)', 'Suits', 1)`,
    );
    await db.query(
      `insert into public.products (handle, category_id, model, status, title_de, color_name_de, color_hex, price_cents, tags)
       select 'anzug-limmat-marine', id, 'anzug-limmat', 'draft', 'Echter Anzug', 'Marine', '#243448', 59900, '{}'
       from public.categories where slug = 'anzuege'`,
    );
    await db.query(read("supabase/demo/muster-einspielen.sql"));
    const first = await counts();
    expect(first.muster).toBe(23);
    const real = await one<{ title_de: string; tags: string[]; variants: number; images: number }>(
      `select title_de, tags,
              (select count(*)::int from public.product_variants v where v.product_id = p.id) as variants,
              (select count(*)::int from public.product_images i where i.product_id = p.id) as images
       from public.products p where handle = 'anzug-limmat-marine'`,
    );
    expect(real).toEqual({ title_de: "Echter Anzug", tags: [], variants: 0, images: 0 });
    // Bestehende Kategorie und Inhalte werden nicht überschrieben
    expect(
      (
        await one<{ name_de: string }>(
          "select name_de from public.categories where slug = 'anzuege'",
        )
      ).name_de,
    ).toBe("Anzüge (echt)");

    await db.query(read("supabase/demo/muster-einspielen.sql"));
    expect(await counts()).toEqual(first);
    expect(
      (await db.query("select key from public.site_content order by key")).rows.map((r) => r.key),
    ).toEqual(["home.look", "size_guides"]);
  });

  it("entfernt nur Musterstücke; Bestellungen bleiben, Positionen verlieren den Link", async () => {
    const variant = await one<{ id: string; product_id: string }>(
      `select v.id, v.product_id from public.product_variants v
       join public.products p on p.id = v.product_id where p.handle = 'weste-limmat-marine' limit 1`,
    );
    const order = await one<{ id: string }>(
      `insert into public.orders (email, subtotal_cents, total_cents, status)
       values ('kunde@example.ch', 12900, 12900, 'paid') returning id`,
    );
    await db.query(
      `insert into public.order_items (order_id, product_id, variant_id, handle, title, size, unit_price_cents, quantity, line_total_cents)
       values ($1, $2, $3, 'weste-limmat-marine', 'Weste «Limmat»', '48', 12900, 1, 12900)`,
      [order.id, variant.product_id, variant.id],
    );
    await db.query(read("supabase/demo/muster-entfernen.sql"));
    expect(await counts()).toEqual({ products: 1, variants: 0, images: 0, muster: 0 });
    const item = await one(
      "select product_id, variant_id, title from public.order_items where order_id = $1",
      [order.id],
    );
    expect(item).toEqual({ product_id: null, variant_id: null, title: "Weste «Limmat»" });
    expect(
      (await one<{ n: number }>("select count(*)::int as n from public.categories")).n,
    ).toBeGreaterThanOrEqual(3);
  });

  it("enthält dieselben Musterstücke wie seed.sql (Datenbank der Tests)", async () => {
    const handles = (q: string) => q.match(/select '([a-z0-9-]+)', c\.id/g)?.sort() ?? [];
    const demo = handles(read("supabase/demo/muster-einspielen.sql"));
    expect(demo).toHaveLength(24);
    expect(demo).toEqual(handles(read("supabase/seed.sql")));
    const seeded = await sql<{ handle: string }>(
      "select handle from public.products where 'muster' = any (tags) order by handle",
    );
    expect(seeded.map((r) => r.handle)).toEqual(
      demo.map((s) => s.replace(/^select '([a-z0-9-]+)'.*$/, "$1")).sort(),
    );
  });
});
