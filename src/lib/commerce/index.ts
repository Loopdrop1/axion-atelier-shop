// Öffentliche Daten-Schnittstelle des Shops. Alle Funktionen nehmen zuletzt die Sprache (Standard Deutsch).
// Quelle ist Supabase (wenn eingerichtet) oder der Beispielkatalog, siehe source.ts.
import type { Locale } from "@/i18n/locale";
import {
  searchWithIntent,
  smartSearch,
  type SearchIntent,
  type SearchResult,
} from "./smart-search";
import {
  mapAnnouncements,
  mapCategory,
  mapHomeContent,
  mapProduct,
  mapSizeGuides,
  virtualCollections,
  type SizeGuideTable,
} from "./mapping";
import type { CategoryRow } from "./rows";
import { rankRecommendations } from "./recommendations";
import { isOnSale } from "./sale";
import { loadCatalog, loadSettings } from "./source";
import type { Cart, Collection, Editorial, HomeContent, Product, ProductFilters } from "./types";

export type * from "./types";
export type { RelaxedCheck, SearchIntent, SearchResult } from "./smart-search";
export type { SizeGuideTable } from "./mapping";
export { backendConfigured } from "@/lib/backend";

interface Catalog {
  products: Product[];
  categories: CategoryRow[];
  content: Awaited<ReturnType<typeof loadCatalog>>["content"];
}

async function catalog(locale: Locale): Promise<Catalog> {
  const data = await loadCatalog();
  const categories = [...data.categories].sort(
    (a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug),
  );
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const products = data.products.flatMap((row) => {
    const product = mapProduct(row, locale, bySlug);
    return product ? [product] : [];
  });
  return { products, categories, content: data.content };
}

const byNewest = (a: Product, b: Product) => b.createdAt.localeCompare(a.createdAt);

export async function listCollections(locale: Locale = "de"): Promise<Collection[]> {
  const { categories } = await catalog(locale);
  const virtual = virtualCollections(locale);
  return [
    virtual.alle,
    virtual.neu,
    ...categories.map((c) => mapCategory(c, locale)),
    virtual.sale,
  ];
}

export async function getCollection(
  handle: string,
  locale: Locale = "de",
): Promise<Collection | undefined> {
  return (await listCollections(locale)).find((c) => c.handle === handle);
}

export function filterProducts(all: Product[], filters: ProductFilters = {}): Product[] {
  const products = all.filter((p) => {
    if (
      filters.collection &&
      filters.collection !== "alle" &&
      !(filters.collection === "sale"
        ? isOnSale(p)
        : p.category === filters.collection || p.tags.includes(filters.collection))
    )
      return false;
    if (filters.occasion && !p.occasions.some((o) => o === filters.occasion)) return false;
    if (
      filters.sizes?.length &&
      !p.variants.some((v) => v.availableForSale && filters.sizes?.includes(v.title))
    )
      return false;
    if (filters.colors?.length && !filters.colors.includes(p.color.name)) return false;
    if (filters.fits?.length && (!p.fit || !filters.fits.includes(p.fit))) return false;
    if (filters.priceMax !== undefined && p.priceRange.min.amount > filters.priceMax) return false;
    return true;
  });
  return [...products].sort((a, b) =>
    filters.sort === "price-asc"
      ? a.priceRange.min.amount - b.priceRange.min.amount
      : filters.sort === "price-desc"
        ? b.priceRange.min.amount - a.priceRange.min.amount
        : byNewest(a, b),
  );
}

export async function listProducts(
  filters: ProductFilters = {},
  locale: Locale = "de",
): Promise<Product[]> {
  return filterProducts((await catalog(locale)).products, filters);
}

export async function getProduct(
  handle: string,
  locale: Locale = "de",
): Promise<Product | undefined> {
  return (await catalog(locale)).products.find((p) => p.handle === handle);
}

export async function getProductsByHandles(
  handles: string[],
  locale: Locale = "de",
): Promise<Product[]> {
  const { products } = await catalog(locale);
  return handles.flatMap((h) => {
    const p = products.find((p) => p.handle === h);
    return p ? [p] : [];
  });
}

export async function searchProducts(query: string, locale: Locale = "de"): Promise<Product[]> {
  return (await searchCatalog(query, locale)).products;
}

/** Kluge Suche mit erkannter Absicht (Filter), Lockerung und «Meintest du» (smart-search.ts). */
export async function searchCatalog(
  query: string,
  locale: Locale = "de",
  extra?: Partial<SearchIntent>,
): Promise<SearchResult> {
  const { products } = await catalog(locale);
  return smartSearch(products, query, extra);
}

export async function searchCatalogWith(
  intent: SearchIntent,
  locale: Locale = "de",
): Promise<SearchResult> {
  const { products } = await catalog(locale);
  return searchWithIntent(products, intent);
}

/** Empfehlungen zu einem Stück: Outfit-Partner, gleiche Anlässe, ergänzende Kategorien, Farbe und Preis. */
export async function getRecommendations(
  product: Product,
  count: number,
  locale: Locale = "de",
): Promise<Product[]> {
  return rankRecommendations(product, (await catalog(locale)).products, count);
}

export async function getSiblings(product: Product, locale: Locale = "de"): Promise<Product[]> {
  return (await catalog(locale)).products.filter((p) => p.model === product.model);
}

export async function getHomeContent(locale: Locale = "de"): Promise<HomeContent> {
  return mapHomeContent((await loadCatalog()).content, locale);
}

export async function getEditorial(locale: Locale = "de"): Promise<Editorial> {
  const home = await getHomeContent(locale);
  return {
    look: { image: home.look.image, hotspots: home.look.hotspots },
    fabric: home.story.image,
  };
}

export async function getSizeGuides(locale: Locale = "de"): Promise<SizeGuideTable[]> {
  return mapSizeGuides((await loadCatalog()).content, locale);
}

export async function getAnnouncements(locale: Locale = "de"): Promise<string[]> {
  const [{ content }, settings] = await Promise.all([loadCatalog(), loadSettings()]);
  return mapAnnouncements(content, locale, settings);
}

export async function resolveCart(
  lines: { variantId: string; quantity: number }[],
  locale: Locale = "de",
): Promise<Cart> {
  const { products } = await catalog(locale);
  const resolved = lines.flatMap((line) => {
    const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
    const variant = product?.variants.find((v) => v.id === line.variantId);
    return product && variant ? [{ ...line, product, variant }] : [];
  });
  return {
    lines: resolved,
    subtotal: {
      amount:
        Math.round(resolved.reduce((s, l) => s + l.variant.price.amount * 100 * l.quantity, 0)) /
        100,
      currencyCode: "CHF",
    },
    checkoutUrl: null,
  };
}
