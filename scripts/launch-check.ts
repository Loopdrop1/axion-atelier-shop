// Prüft vor dem Livegang die Cloud-Datenbank (nur lesend, mit dem öffentlichen Schlüssel):
//   bun run launch:check
// 1. keine aktiven Muster-Produkte (Tag «muster»), 2. keine aktiven Kategorien ohne Bild,
// 3. keine Look- oder Outfit-Handles ohne aktives Produkt.
// Adresse und Schlüssel: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY oder VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
// (Bun liest .env automatisch). Beendet mit Exit-Code 1, sobald etwas nicht stimmt.
export {};

const url = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").replace(
  /\/+$/,
  "",
);
const key =
  process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "";
if (!url || !key) {
  console.error("SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY (oder die VITE_-Varianten) fehlen.");
  process.exit(2);
}

async function get<T>(path: string): Promise<T[]> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

const problems: string[] = [];

const products = await get<{ handle: string; tags: string[]; outfit_handles: string[] }>(
  "products?status=eq.active&select=handle,tags,outfit_handles&limit=1000",
);
const active = new Set(products.map((p) => p.handle));

const muster = products.filter((p) => p.tags.includes("muster")).map((p) => p.handle);
if (muster.length)
  problems.push(
    `${muster.length} aktive Muster-Produkte (supabase/demo/muster-entfernen.sql): ${muster.slice(0, 5).join(", ")}${muster.length > 5 ? " …" : ""}`,
  );

const noImage = await get<{ slug: string }>(
  "categories?active=eq.true&image_path=is.null&select=slug",
);
if (noImage.length)
  problems.push(`Aktive Kategorien ohne Bild: ${noImage.map((c) => c.slug).join(", ")}`);

const dangling = new Set<string>();
for (const p of products)
  for (const h of p.outfit_handles ?? []) if (!active.has(h)) dangling.add(`${p.handle} → ${h}`);
const content = await get<{ key: string; value: { hotspots?: { handle?: string }[] } }>(
  "site_content?key=eq.home.look&select=key,value",
);
for (const h of content[0]?.value.hotspots ?? [])
  if (h.handle && !active.has(h.handle)) dangling.add(`Look → ${h.handle}`);
if (dangling.size)
  problems.push(`Outfit- oder Look-Handles ohne aktives Produkt: ${[...dangling].join("; ")}`);

if (problems.length) {
  console.error("Livegang-Prüfung: NICHT bereit\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Livegang-Prüfung: in Ordnung (${products.length} aktive Produkte).`);
