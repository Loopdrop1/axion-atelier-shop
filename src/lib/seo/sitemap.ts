// Sitemap für Suchmaschinen: jede Seite auf Deutsch (ohne Präfix) und Englisch (/en), mit hreflang-Verweisen.

import { shopConfig } from "@/config/shop";
import { guideSlugs } from "@/content/guides-meta";

/** Öffentliche Seiten ohne Daten aus dem Katalog. Nicht enthalten: Warenkorb, Merkliste, Suche, Konto,
 *  Bestellstatus, Newsletter-Bestätigung und Admin (privat oder ohne eigenen Inhalt). */
export const STATIC_PATHS = [
  "/",
  "/geschenkgutschein",
  "/ueber-uns",
  "/kontakt",
  "/groessenberatung",
  "/haeufige-fragen",
  "/ratgeber",
  ...guideSlugs.map((slug) => `/ratgeber/${slug}` as const),
  "/versand-und-rueckgabe",
  "/impressum",
  "/datenschutz",
  "/agb",
] as const;

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Deutsche Adresse (Pfad ohne Sprachpräfix) → englische Adresse. */
export function englishPath(path: string): string {
  return path === "/" ? "/en" : `/en${path}`;
}

/** Pfade aus Katalog und festen Seiten, ohne Duplikate, in stabiler Reihenfolge. */
export function sitemapPaths(
  collections: string[],
  products: string[],
  giftCards: boolean = shopConfig.features.giftCards,
): string[] {
  const paths = [
    // Der Gutschein-Pfad antwortet mit 404, wenn die Funktion ausgeschaltet ist.
    ...STATIC_PATHS.filter((p) => giftCards || p !== "/geschenkgutschein"),
    ...collections.map((h) => `/kollektion/${encodeURIComponent(h)}`),
    ...products.map((h) => `/produkt/${encodeURIComponent(h)}`),
  ];
  return [...new Set(paths)];
}

export function buildSitemap(siteUrl: string, paths: string[]): string {
  const base = siteUrl.replace(/\/+$/, "");
  const entries = paths.flatMap((path) => {
    const de = `${base}${path === "/" ? "/" : path}`;
    const en = `${base}${englishPath(path)}`;
    const alternates = [
      `    <xhtml:link rel="alternate" hreflang="de-CH" href="${escapeXml(de)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(en)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(de)}"/>`,
    ].join("\n");
    return [de, en].map(
      (loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${alternates}\n  </url>`,
    );
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
