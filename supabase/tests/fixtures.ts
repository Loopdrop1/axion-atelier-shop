import { q, sql, uniq } from "./helpers";

export interface TestVariant {
  id: string;
  size: string;
}

export interface TestProduct {
  id: string;
  handle: string;
  variants: TestVariant[];
}

/** Legt ein aktives Testprodukt mit Grössen und Beständen an (unabhängig vom Seed). */
export async function makeProduct(opts: {
  priceCents: number;
  stocks: number[];
  status?: "draft" | "active" | "archived";
  category?: string;
}): Promise<TestProduct> {
  const handle = uniq("test");
  const rows = await sql<{ id: string }>(
    `insert into public.products (handle, category_id, model, status, title_de, title_en, color_name_de, color_name_en, color_hex, price_cents)
     select $1, c.id, $1, $2, 'Test ' || $1, 'Test EN ' || $1, 'Blau', 'Blue', '#123456', $3
     from public.categories c where c.slug = $4 returning id`,
    [handle, opts.status ?? "active", opts.priceCents, opts.category ?? "anzuege"],
  );
  const id = rows[0]!.id;
  const variants: TestVariant[] = [];
  for (const [i, stock] of opts.stocks.entries()) {
    const size = String(46 + i * 2);
    const v = await sql<{ id: string }>(
      "insert into public.product_variants (product_id, size, stock, sort) values ($1, $2, $3, $4) returning id",
      [id, size, stock, i],
    );
    variants.push({ id: v[0]!.id, size });
  }
  await sql(
    "insert into public.product_images (product_id, path, alt_de) values ($1, 'asset:suit', 'Bild')",
    [id],
  );
  return { id, handle, variants };
}

export async function stockOf(variantId: string): Promise<number> {
  const rows = await sql<{ stock: number }>(
    "select stock from public.product_variants where id = $1",
    [variantId],
  );
  return rows[0]!.stock;
}

export async function makeDiscount(
  code: string,
  kind: "percent" | "amount",
  value: number,
  extra: Record<string, unknown> = {},
) {
  const cols = ["code", "kind", "value", ...Object.keys(extra)];
  const vals = [code, kind, value, ...Object.values(extra)];
  const params = vals.map((_, i) => `$${i + 1}`).join(", ");
  await sql(`insert into public.discount_codes (${cols.join(", ")}) values (${params})`, vals);
}

export async function makeGiftCard(
  balanceCents: number,
  extra: { status?: string; expiresAt?: string } = {},
): Promise<string> {
  const rows = await sql<{ code: string }>(
    `insert into public.gift_cards (code, initial_cents, balance_cents, status, expires_at)
     values (private.gift_card_code(), $1, $1, $2, $3) returning code`,
    [
      balanceCents,
      extra.status ?? "active",
      extra.expiresAt ?? new Date(Date.now() + 365 * 86400000).toISOString(),
    ],
  );
  return rows[0]!.code;
}

export interface Reservation {
  order_id: string;
  order_number: number;
  status_token: string;
  subtotal_cents: number;
  discount_cents: number;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  discount_code: string | null;
  lines: {
    variant_id: string;
    title: string;
    size: string;
    unit_price_cents: number;
    quantity: number;
  }[];
}

export async function reserve(args: {
  lines: { variant_id: string; quantity: number }[];
  email?: string;
  locale?: "de" | "en";
  discount?: string | null;
  giftCard?: string | null;
  userId?: string | null;
}): Promise<Reservation> {
  const rows = await q<{ r: Reservation }>(
    "service_role",
    null,
    "select public.reserve_checkout($1::jsonb, $2, $3, $4, $5, $6) as r",
    [
      JSON.stringify(args.lines),
      args.email ?? `${uniq("kunde")}@example.ch`,
      args.locale ?? "de",
      args.discount ?? null,
      args.giftCard ?? null,
      args.userId ?? null,
    ],
  );
  return rows[0]!.r;
}

export async function rpc<T = unknown>(
  fn: string,
  args: unknown[],
  role: "service_role" | "anon" | "authenticated" = "service_role",
  claims: { sub?: string; email?: string } | null = null,
): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await q<{ r: T }>(role, claims, `select public.${fn}(${params}) as r`, args);
  return rows[0]!.r;
}
