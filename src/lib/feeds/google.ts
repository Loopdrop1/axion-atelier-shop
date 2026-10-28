// Produktfeed für Google Merchant Center (kostenlose Einträge und Shopping) und Meta/Instagram-Katalog:
// RSS 2.0 mit dem Namensraum g:, ein Eintrag pro Grösse (Variante), gruppiert über g:item_group_id.
// Reine Funktionen ohne Zugriff auf die Datenbank, damit ein Test sie prüfen kann (src/lib/feeds/google.test.ts).
import { shopConfig } from "@/config/shop";
import { pageUrl } from "@/lib/commerce/seo";
import { isOneSizeTitle } from "@/lib/commerce/one-size";
import type { Product, Variant } from "@/lib/commerce/types";

const ROOT = "Apparel & Accessories";

/** Google-Produktkategorie je Kategorie des Shops (Textpfade der offiziellen Google-Taxonomie; Google nimmt Pfad oder ID).
 *  Bewusst grob und konservativ: lieber die sichere Oberkategorie als eine falsche Unterkategorie.
 *  Neue Kategorien im Admin ohne Eintrag fallen auf «Clothing» zurück. Vom Kunden zu bestätigen. */
export const GOOGLE_CATEGORIES: Record<string, string> = {
  anzuege: `${ROOT} > Clothing > Suits`,
  sakkos: `${ROOT} > Clothing > Outerwear > Coats & Jackets`,
  hosen: `${ROOT} > Clothing > Pants`,
  hemden: `${ROOT} > Clothing > Shirts & Tops`,
  westen: `${ROOT} > Clothing > Outerwear > Vests`,
  "maentel-jacken": `${ROOT} > Clothing > Outerwear > Coats & Jackets`,
  strick: `${ROOT} > Clothing > Shirts & Tops`,
  schuhe: `${ROOT} > Shoes`,
  accessoires: `${ROOT} > Clothing Accessories`,
};
const FALLBACK_CATEGORY = `${ROOT} > Clothing`;

export const googleCategory = (slug: string) => GOOGLE_CATEGORIES[slug] ?? FALLBACK_CATEGORY;

/** Gültige GTIN (8, 12, 13 oder 14 Ziffern mit korrekter Prüfziffer), sonst false. */
export function isValidGtin(value: string | undefined): boolean {
  if (!value || !/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop() ?? 0;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Preis im Feed-Format: «123.00 CHF». */
export const feedPrice = (amount: number) => `${amount.toFixed(2)} CHF`;

/** Nur echte Ware: das Muster-Sortiment (Kennzeichen «muster») gehört nicht in Google und Meta. */
export const isFeedProduct = (p: Pick<Product, "tags">) => !p.tags.includes("muster");

const xml = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Fliesstext ohne Markdown, HTML und Zeilenumbrüche. */
export const plainText = (s: string, max = 5000) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const tag = (name: string, value: string | number | undefined) =>
  value === undefined || value === "" ? "" : `      <g:${name}>${xml(String(value))}</g:${name}>\n`;

const absolute = (url: string) => new URL(url, shopConfig.siteUrl).href;

export interface FeedSettings {
  shippingCents: number;
  freeShippingFromCents: number | null;
}

function shippingCents(variant: Variant, settings: FeedSettings): number {
  const priceCents = Math.round(variant.price.amount * 100);
  return settings.freeShippingFromCents !== null && priceCents >= settings.freeShippingFromCents
    ? 0
    : settings.shippingCents;
}

function item(p: Product, v: Variant, settings: FeedSettings): string {
  const oneSize = isOneSizeTitle(v.title);
  const title = [p.title, p.color.name, oneSize ? "" : `Grösse ${v.title}`]
    .filter(Boolean)
    .join(", ")
    .slice(0, 150);
  const description =
    plainText(p.description) ||
    plainText([p.title, p.color.name, p.details.material].filter(Boolean).join(", "));
  const [image, ...more] = p.images.map((i) => absolute(i.url));
  const onSale = v.compareAtPrice !== undefined && v.compareAtPrice.amount > v.price.amount;
  const gtin = isValidGtin(v.barcode) ? v.barcode : undefined;
  const id = v.sku ?? v.id;
  const highlights = p.details.features
    .slice(0, 10)
    .map((f) => plainText(f, 150))
    .filter(Boolean);
  return (
    "    <item>\n" +
    tag("id", id) +
    tag("title", title) +
    tag("description", description) +
    tag("link", pageUrl(`/produkt/${encodeURIComponent(p.handle)}`, "de")) +
    tag("image_link", image) +
    more
      .slice(0, 10)
      .map((url) => tag("additional_image_link", url))
      .join("") +
    tag("availability", v.availableForSale ? "in_stock" : "out_of_stock") +
    tag("price", feedPrice(onSale && v.compareAtPrice ? v.compareAtPrice.amount : v.price.amount)) +
    (onSale ? tag("sale_price", feedPrice(v.price.amount)) : "") +
    tag("brand", shopConfig.brand) +
    (gtin ? tag("gtin", gtin) : tag("identifier_exists", "no") + tag("mpn", v.sku)) +
    tag("condition", "new") +
    tag("google_product_category", googleCategory(p.category)) +
    tag("product_type", p.categoryTitle) +
    tag("item_group_id", p.model || p.handle) +
    tag("color", p.color.name) +
    tag("size", oneSize ? "One Size" : v.title) +
    tag("material", p.details.material) +
    tag("gender", "male") +
    tag("age_group", "adult") +
    highlights.map((h) => tag("product_highlight", h)).join("") +
    "      <g:shipping>\n" +
    "        <g:country>CH</g:country>\n" +
    "        <g:service>Standard</g:service>\n" +
    `        <g:price>${feedPrice(shippingCents(v, settings) / 100)}</g:price>\n` +
    "      </g:shipping>\n" +
    "    </item>\n"
  );
}

/** RSS-2.0-Feed mit einem Eintrag pro Grösse. Produkte ohne Bild werden ausgelassen
 *  (Google lehnt Einträge ohne image_link ab). */
export function buildGoogleFeed(products: Product[], settings: FeedSettings): string {
  const items = products
    .filter(isFeedProduct)
    .filter((p) => p.images.length > 0)
    .flatMap((p) => p.variants.map((v) => item(p, v, settings)));
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
    "  <channel>\n" +
    `    <title>${xml(shopConfig.brand)}</title>\n` +
    `    <link>${xml(pageUrl("/", "de"))}</link>\n` +
    `    <description>${xml(`Produktfeed ${shopConfig.brand}`)}</description>\n` +
    items.join("") +
    "  </channel>\n" +
    "</rss>\n"
  );
}

/** Antwort der Route: vor dem Livegang 404 (wie Sitemap und llms.txt), danach der Feed mit einer Stunde Zwischenspeicher. */
export async function googleFeedResponse(
  launched: boolean,
  load: () => Promise<{ products: Product[]; settings: FeedSettings }>,
): Promise<Response> {
  if (!launched) return new Response("Not found", { status: 404 });
  const { products, settings } = await load();
  return new Response(buildGoogleFeed(products, settings), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
