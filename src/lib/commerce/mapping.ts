// Wandelt Datenbankzeilen in die Typen des Shops um, in der gewünschten Sprache.
// Fehlt eine englische Angabe, gilt die deutsche.
import type { Json } from "@/integrations/supabase/types";
import { supabaseUrl } from "@/lib/backend";
import type { Locale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { media, musterMedia, type MediaKey } from "./media";
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

/** Ausstattung aus dem Admin: ein Merkmal pro Zeile; Aufzählungszeichen und leere Zeilen fallen weg. */
export function featureList(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-–•*·]\s*)?/, "").trim())
    .filter(Boolean);
}

/** Bildpfad aus der Datenbank → URL: «asset:…» = eingebautes Bild, sonst Supabase Storage oder volle URL. */
export function imageUrl(path: string | null | undefined, bucket: Bucket): string | null {
  if (!path) return null;
  if (path.startsWith("asset:")) {
    const key = path.slice(6);
    return media[key as MediaKey]?.url ?? musterMedia[key] ?? null;
  }
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
      origin: pick(row.origin_de, row.origin_en, locale),
      features: featureList(pick(row.features_de, row.features_en, locale)),
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
        stock: Math.max(0, v.stock),
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
  if (!image) return fallback;
  // Freiwillig: eigenes Bild fürs Handy (hoch), gleiche Bildbeschreibung
  const mobilePath = str(block["image_mobile"]);
  const mobile = mobilePath
    ? toImage(mobilePath, image.altText, "site-media", {
        width: num(block["image_mobile_width"]) ?? null,
        height: num(block["image_mobile_height"]) ?? null,
      })
    : null;
  return mobile
    ? { ...image, mobile: { url: mobile.url, width: mobile.width, height: mobile.height } }
    : image;
}

/** Video für den Einstieg (Speicher site-media); ohne Video oder ohne Backend: keins. */
function heroVideo(block: Json | undefined): HomeContent["hero"]["video"] {
  if (!isObj(block)) return undefined;
  const url = imageUrl(str(block["video"]), "site-media") ?? undefined;
  const mobileUrl = imageUrl(str(block["video_mobile"]), "site-media") ?? undefined;
  return url || mobileUrl ? { url, mobileUrl } : undefined;
}

/** Startseite: Werte aus site_content, fehlende Felder aus den Übersetzungen. */
export function mapHomeContent(content: Record<string, Json>, locale: Locale): HomeContent {
  const d = messages[locale].home;
  const hero = content["home.hero"];
  const brand = content["home.brand"];
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
      image: contentImage(hero, locale, { ...media.look, altText: d.hero.imageAlt }),
      video: heroVideo(hero),
    },
    brand: {
      eyebrow: f(brand, "eyebrow", d.brand.eyebrow),
      title: f(brand, "title", d.brand.title),
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
      eyebrow: f(look, "eyebrow", d.look.eyebrow),
      title: f(look, "title", d.look.title),
      text: f(look, "text", d.look.text),
      total: f(look, "total", d.look.total),
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

/** Grössentabelle aus dem Admin (site_content «size_guides»). */
export interface SizeGuideTable {
  id: string;
  title: string;
  /** Slugs der Kategorien, für die sie gilt; leer = alle */
  categories: string[];
  columns: string[];
  rows: string[][];
  note: string;
}

/** Grössentabellen: nur Tabellen mit Spalten und mindestens einer ausgefüllten Zeile. */
export function mapSizeGuides(content: Record<string, Json>, locale: Locale): SizeGuideTable[] {
  const block = content["size_guides"];
  const tables = isObj(block) && Array.isArray(block["tables"]) ? block["tables"] : [];
  return tables.flatMap((table, i) => {
    if (!isObj(table)) return [];
    const columns = (Array.isArray(table["columns"]) ? table["columns"] : []).map((c) =>
      localized(c, locale, null, ""),
    );
    if (!columns.length || columns.every((c) => !c)) return [];
    const rows = (Array.isArray(table["rows"]) ? table["rows"] : []).flatMap((row) => {
      if (!Array.isArray(row)) return [];
      const cells = columns.map((_, k) => str(row[k])?.trim() ?? "");
      return cells.some(Boolean) ? [cells] : [];
    });
    if (!rows.length) return [];
    return [
      {
        id: str(table["id"]) || `tabelle-${i + 1}`,
        title: localized(table["title"], locale, null, ""),
        categories: (Array.isArray(table["categories"]) ? table["categories"] : []).flatMap((c) =>
          typeof c === "string" ? [c] : [],
        ),
        columns,
        rows,
        note: localized(table["note"], locale, null, ""),
      },
    ];
  });
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
