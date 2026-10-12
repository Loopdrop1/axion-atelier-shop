// Erzeugt src/lib/commerce/sample-catalog.ts aus der lokalen Datenbank (nach supabase/seed.sql).
// So zeigt der Shop ohne Backend genau dieselben Beispieldaten wie eine frisch eingerichtete Datenbank.
// Aufruf: bun scripts/db/gen-sample-catalog.ts   (vorher: bun run db:reset)
// --check: schreibt nichts, meldet nur, ob die Datei aktuell ist (Exit-Code 1 bei Abweichung).
import pg from "pg";
import * as prettier from "prettier";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DB_URL = process.env["AXION_DB_URL"] ?? "postgres://postgres@127.0.0.1:54329/axion";
const OUT = path.resolve(import.meta.dirname, "../../src/lib/commerce/sample-catalog.ts");

export async function renderSampleCatalog(client: pg.Client | pg.PoolClient): Promise<string> {
  const categories = (
    await client.query(
      `select slug, name_de, name_en, description_de, description_en, image_path, sort
       from public.categories where active order by sort, slug`,
    )
  ).rows;
  const products = (
    await client.query(
      `select p.handle as id, p.handle, p.model, p.title_de, p.title_en, p.description_de, p.description_en,
         p.material_de, p.material_en, p.care_de, p.care_en, p.fit_note_de, p.fit_note_en, p.fit,
         p.color_name_de, p.color_name_en, p.color_hex, p.tags, p.occasions, p.outfit_handles,
         p.price_cents, p.compare_at_cents, p.sort,
         to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
         json_build_object('slug', c.slug) as category,
         coalesce((select json_agg(json_build_object('id', p.handle || '-' || v.size, 'size', v.size,
           'price_cents', v.price_cents, 'compare_at_cents', v.compare_at_cents, 'stock', v.stock,
           'sort', v.sort, 'active', v.active) order by v.sort, v.size)
           from public.product_variants v where v.product_id = p.id), '[]') as product_variants,
         coalesce((select json_agg(json_build_object('path', i.path, 'alt_de', i.alt_de, 'alt_en', i.alt_en,
           'width', i.width, 'height', i.height, 'sort', i.sort) order by i.sort, i.path)
           from public.product_images i where i.product_id = p.id), '[]') as product_images
       from public.products p join public.categories c on c.id = p.category_id
       where p.status = 'active' order by p.sort, p.handle`,
    )
  ).rows;
  const content = Object.fromEntries(
    (await client.query("select key, value from public.site_content order by key")).rows.map((r) => [
      r.key,
      r.value,
    ]),
  );
  const data = JSON.stringify({ categories, products, content }, null, 2);
  const raw = `// Automatisch erzeugt aus supabase/seed.sql mit scripts/db/gen-sample-catalog.ts – nicht von Hand ändern.
// Beispieldaten für den Shop ohne Backend (Produkte, Verfügbarkeit, Preise und Zeitstempel sind Platzhalter).
import type { CatalogData } from "./rows";

export const sampleCatalog: CatalogData = ${data};
`;
  return prettier.format(raw, { ...(await prettier.resolveConfig(OUT)), parser: "typescript" });
}

if (import.meta.main) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  const text = await renderSampleCatalog(client);
  await client.end();
  if (process.argv.includes("--check")) {
    const current = readFileSync(OUT, "utf8");
    if (current !== text) {
      console.error("sample-catalog.ts ist veraltet: bun scripts/db/gen-sample-catalog.ts ausführen.");
      process.exit(1);
    }
    console.log("sample-catalog.ts ist aktuell.");
  } else {
    writeFileSync(OUT, text);
    console.log(`Geschrieben: ${OUT}`);
  }
}
