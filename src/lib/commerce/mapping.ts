// Wandelt Datenbankzeilen in die Typen des Shops um, in der gewünschten Sprache.
// Fehlt eine englische Angabe, gilt die deutsche.
import type { Json } from "@/integrations/supabase/types";
import { supabaseUrl } from "@/integrations/supabase/client";
import type { Locale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { media, type MediaKey } from "./media";
import type { CategoryRow, ProductRow } from "./rows";
import type {
  Collection,
  HomeContent,
  Hotspot,
  Money,
  Occasion,
  Product,
  ShopImage,
} from "./types";

export type Bucket = "product-images" | "site-media";

const OCCASIONS: readonly Occasion[] = ["hochzeit", "business", "abschlussfeier", "gala"];

export const money = (cents: number): Money => ({ amount: cents / 100, currencyCode: "CHF" });

/** Text in der gewünschten Sprache; leeres Englisch fällt auf Deutsch zurück. */
export function pick(de: string, en: string | null | undefined, locale: Locale): string;
export function pick(
  de: string | null | undefined,
  en: string | null | undefined,
  locale: Locale,
): string | undefined;
export function pick(de: string | null | undefined, en: string | null | undefined, locale: Locale) {
  if (locale === "en" && en && en.trim()) return en;
  return de ?? undefined;
}

/** Bildpfad aus der Datenbank → URL: «asset:…» = eingebautes Bild, sonst Supabase Storage oder volle URL. */
export function imageUrl(path: string | null | undefined, bucket: Bucket): string | null {
  if (!path) return null;
  if (path.startsWith("asset:")) return media[path.slice(6) as MediaKey]?.url ?? null;
  if (/^https:\/\//.test(path)) return path;
  if (!supabaseUrl) return null;
  const clean = path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`;
}

export function toImage(
  path: string | null | undefined,
  alt: string,
  bucket: Bucket,
  size?: { width?: number | null; height?: number | null },
): ShopImage | undefined {
  const url = imageUrl(path, bucket);
  if (!url) return undefined;
  const builtIn = path?.startsWith("asset:") ? media[path.slice(6) as MediaKey] : undefined;
  return {
    url,
    altText: alt,
    width: size?.width || builtIn?.width || 1024,
    height: size?.height || builtIn?.height || 1280,
  };
}

const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;

export function mapCategory(row: CategoryRow, locale: Locale): Collection {
  const image = toImage(row.image_path, pick(row.name_de, row.name_en, locale), "site-media");
  return {
    handle: row.slug,
    title: pick(row.name_de, row.name_en, locale),
    description: pick(row.description_de, row.description_en, locale) ?? "",
    ...(image ? { image } : {}),
  };
}

/** Sammlungen ohne eigene Kategorie: alle Stücke, Neuheiten, Sale. */
export function virtualCollections(locale: Locale): Record<"alle" | "neu" | "sale", Collection> {
  const t = messages[locale].collections;
  return {
    alle: { handle: "alle", title: t.all.title, description: t.all.description },
    neu: { handle: "neu", title: t.new.title, description: t.new.description },
    sale: { handle: "sale", title: t.sale.title, description: t.sale.description },
  };
}

/** Produktzeile → Produkt. Ohne (aktive) Kategorie gibt es kein Produkt im Shop. */
export function mapProduct(
  row: ProductRow,
  locale: Locale,
  categories: Map<string, CategoryRow>,
): Product | null {
  const slug = row.category?.slug;
  const category = slug ? categories.get(slug) : undefined;
  if (!slug || !category) return null;
  const color = pick(row.color_name_de, row.color_name_en, locale);
  const variants = row.product_variants.filter((v) => v.active).sort(bySort);
  const prices = variants.map((v) => v.price_cents ?? row.price_cents);
  const min = prices.length ? Math.min(...prices) : row.price_cents;
  const max = prices.length ? Math.max(...prices) : row.price_cents;
  const images = [...row.product_images].sort(bySort).flatMap((i) => {
    const image = toImage(i.path, pick(i.alt_de, i.alt_en, locale), "product-images", i);
    return image ? [image] : [];
  });
  const sizeName = messages[locale].product.size;
  const colorName = messages[locale].product.color;
  return {
    id: row.id,
    handle: row.handle,
    title: pick(row.title_de, row.title_en, locale),
    category: slug,
    categoryTitle: pick(category.name_de, category.name_en, locale),
    model: row.model,
    color: { name: color, hex: row.color_hex },
    fit: row.fit ?? undefined,
    tags: row.tags,
    occasions: row.occasions.filter((o): o is Occasion =>
      (OCCASIONS as readonly string[]).includes(o),
    ),
    description: pick(row.description_de, row.description_en, locale),
    details: {
      material: pick(row.material_de, row.material_en, locale),
      care: pick(row.care_de, row.care_en, locale),
      fit: pick(row.fit_note_de, row.fit_note_en, locale),
    },
    images,
    options: [
      { name: "size", values: variants.map((v) => v.size) },
      { name: "color", values: [color] },
    ],
    variants: variants.map((v) => {
      const compare = v.compare_at_cents ?? row.compare_at_cents;
      return {
        id: v.id,
        title: v.size,
        availableForSale: v.stock > 0,
        price: money(v.price_cents ?? row.price_cents),
        compareAtPrice: compare ? money(compare) : undefined,
        selectedOptions: [
          { name: sizeName, value: v.size },
          { name: colorName, value: color },
        ],
      };
    }),
    priceRange: { min: money(min), max: money(max) },
    compareAtPrice: row.compare_at_cents ? money(row.compare_at_cents) : undefined,
    outfitHandles: row.outfit_handles,
    createdAt: row.created_at,
  };
}

// --- Inhalte der Startseite (site_content) ----------------------------------------------------------

type Obj = Record<string, Json | undefined>;
const isObj = (v: Json | undefined): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: Json | undefined): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: Json | undefined): number | undefined => (typeof v === "number" ? v : undefined);

/** Text aus { de: {...}, en: {...} } oder { de: "...", en: "..." } mit Rückfall auf Deutsch und den Standardtext. */
function localized(
  block: Json | undefined,
  locale: Locale,
  field: string | null,
  fallback: string,
): string {
  if (!isObj(block)) return fallback;
  const read = (lang: Locale) => {
    const part = block[lang];
    if (field === null) return str(part);
    return isObj(part) ? str(part[field]) : undefined;
  };
  const value = (locale === "en" ? read("en") : undefined) ?? read("de");
  return value && value.trim() ? value : fallback;
}

function contentImage(block: Json | undefined, locale: Locale, fallback: ShopImage): ShopImage {
  if (!isObj(block)) return fallback;
  const path = str(block["image"]);
  if (!path) return fallback;
  const image = toImage(
    path,
    localized(block["image_alt"], locale, null, fallback.altText),
    "site-media",
    {
      width: num(block["image_width"]) ?? null,
      height: num(block["image_height"]) ?? null,
    },
  );
  return image ?? fallback;
}

/** Startseite: Werte aus site_content, fehlende Felder aus den Übersetzungen. */
export function mapHomeContent(content: Record<string, Json>, locale: Locale): HomeContent {
  const d = messages[locale].home;
  const hero = content["home.hero"];
  const collections = content["home.collections"];
  const fresh = content["home.new"];
  const look = content["home.look"];
  const occasions = content["home.occasions"];
  const story = content["home.story"];
  const f = (block: Json | undefined, field: string, fallback: string) =>
    localized(block, locale, field, fallback);
  const hotspots: Hotspot[] =
    isObj(look) && Array.isArray(look["hotspots"])
      ? look["hotspots"].flatMap((h, i) => {
          if (!isObj(h)) return [];
          const handle = str(h["handle"]);
          const x = num(h["x"]);
          const y = num(h["y"]);
          if (!handle || x === undefined || y === undefined) return [];
          const label = localized(h["label"], locale, null, `${i + 1}`);
          return [{ handle, key: str(h["key"]) ?? `punkt-${i + 1}`, label, x, y }];
        })
      : [];
  return {
    hero: {
      eyebrow: f(hero, "eyebrow", d.hero.eyebrow),
      title: f(hero, "title", d.hero.title),
      text: f(hero, "text", d.hero.text),
      primary: f(hero, "primary", d.hero.primary),
      secondary: f(hero, "secondary", d.hero.secondary),
    },
    collections: {
      eyebrow: f(collections, "eyebrow", d.collections.eyebrow),
      title: f(collections, "title", d.collections.title),
    },
    newArrivals: {
      eyebrow: f(fresh, "eyebrow", d.newArrivals.eyebrow),
      title: f(fresh, "title", d.newArrivals.title),
      link: f(fresh, "link", d.newArrivals.link),
    },
    look: {
      image: contentImage(look, locale, { ...media.look, altText: d.look.imageAlt }),
      hotspots,
      ctaHandle: (isObj(look) && str(look["cta_handle"])) || hotspots[0]?.handle || "",
      eyebrow: f(look, "eyebrow", d.look.eyebrow),
      title: f(look, "title", d.look.title),
      text: f(look, "text", d.look.text),
      total: f(look, "total", d.look.total),
      cta: f(look, "cta", d.look.cta),
    },
    occasions: {
      eyebrow: f(occasions, "eyebrow", d.occasions.eyebrow),
      title: f(occasions, "title", d.occasions.title),
      texts: Object.fromEntries(
        OCCASIONS.map((o) => [o, f(occasions, o, d.occasions.texts[o] ?? "")]),
      ),
    },
    story: {
      image: contentImage(story, locale, { ...media.fabric, altText: d.story.imageAlt }),
      eyebrow: f(story, "eyebrow", d.story.eyebrow),
      title: f(story, "title", d.story.title),
      text: f(story, "text", d.story.text),
      link: f(story, "link", d.story.link),
    },
  };
}

/** Laufband oben auf jeder Seite. */
export function mapAnnouncements(content: Record<string, Json>, locale: Locale): string[] {
  const block = content["announcements"];
  const items = isObj(block) && Array.isArray(block["items"]) ? block["items"] : [];
  const texts = items.flatMap((item) => {
    const text = localized(item, locale, null, "");
    return text ? [text] : [];
  });
  return texts.length ? texts : [...messages[locale].announcements];
}
