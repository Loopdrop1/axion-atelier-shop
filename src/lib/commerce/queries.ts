// TanStack-Query-Abfragen des Shops, je Sprache zwischengespeichert.
import { notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import type { Locale } from "@/i18n/locale";
import {
  getAnnouncements,
  getCollection,
  getHomeContent,
  getProduct,
  getProductsByHandles,
  getRecommendations,
  getSiblings,
  getSizeGuides,
  listCollections,
  listProducts,
  searchCatalog,
} from "./index";
import { loadSettings } from "./source";
import type { ProductFilters } from "./types";

export const homeQuery = (locale: Locale) =>
  queryOptions({
    queryKey: ["home", locale],
    queryFn: async () => ({
      products: await listProducts({}, locale),
      collections: await listCollections(locale),
      content: await getHomeContent(locale),
    }),
  });

export interface CollectionSearch {
  anlass?: string | undefined;
  groesse?: string | undefined;
  farbe?: string | undefined;
  passform?: string | undefined;
  preis?: number | undefined;
  sort?: "newest" | "price-asc" | "price-desc" | undefined;
}

/** Filter aus der Adresse (?groesse=48,50&farbe=Marine …) für filterProducts. */
export function filtersFromSearch(handle: string, s: CollectionSearch): ProductFilters {
  return {
    collection: handle,
    occasion: s.anlass,
    sizes: s.groesse?.split(","),
    colors: s.farbe?.split(","),
    fits: s.passform?.split(","),
    priceMax: s.preis,
    sort: s.sort,
  };
}

export const collectionQuery = (handle: string, s: CollectionSearch, locale: Locale) =>
  queryOptions({
    queryKey: ["collection", locale, handle, s],
    queryFn: async () => {
      const collection = await getCollection(handle, locale);
      if (!collection) throw notFound();
      const filters = filtersFromSearch(handle, s);
      return {
        collection,
        catalogue: await listProducts({ collection: handle }, locale),
        products: await listProducts(filters, locale),
      };
    },
  });

export const productQuery = (handle: string, locale: Locale) =>
  queryOptions({
    queryKey: ["product", locale, handle],
    queryFn: async () => {
      const product = await getProduct(handle, locale);
      if (!product) throw notFound();
      return {
        product,
        siblings: await getSiblings(product, locale),
        outfit: await getProductsByHandles(product.outfitHandles, locale),
        recommendations: await getRecommendations(handle, 4, locale),
      };
    },
  });

export const searchQuery = (q: string, locale: Locale) =>
  queryOptions({ queryKey: ["search", locale, q], queryFn: () => searchCatalog(q, locale) });

export const announcementsQuery = (locale: Locale) =>
  queryOptions({
    queryKey: ["announcements", locale],
    queryFn: () => getAnnouncements(locale),
    staleTime: 60_000,
  });

export const sizeGuideQuery = (locale: Locale) =>
  queryOptions({
    queryKey: ["size-guides", locale],
    queryFn: () => getSizeGuides(locale),
    staleTime: 60_000,
  });

const VIRTUAL = new Set(["alle", "neu", "sale"]);

/** Kategorien fürs Menü (aktive Kategorien aus dem Admin, in ihrer Reihenfolge). */
export const navQuery = (locale: Locale) =>
  queryOptions({
    queryKey: ["nav", locale],
    queryFn: async () =>
      (await listCollections(locale))
        .filter((c) => !VIRTUAL.has(c.handle))
        .map((c) => ({ handle: c.handle, title: c.title })),
    staleTime: 60_000,
  });

export const settingsQuery = () =>
  queryOptions({ queryKey: ["settings"], queryFn: loadSettings, staleTime: 60_000 });
