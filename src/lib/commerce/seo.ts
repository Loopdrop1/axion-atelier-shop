import { shopConfig } from "@/config/shop";
import { htmlLang, localePrefix, type Locale } from "@/i18n/locale";

/** Absolute URL einer Seite in der gewünschten Sprache. path ohne Sprachpräfix, z. B. "/kollektion/westen". */
export function pageUrl(path: string, locale: Locale): string {
  const prefix = localePrefix(locale);
  const clean = path === "/" ? (prefix ? "" : "/") : path;
  return new URL(`${prefix}${clean}`, shopConfig.siteUrl).href;
}

/**
 * Titel, Beschreibung, Canonical und hreflang für eine Seite.
 * noindex für Seiten, die nicht in Suchmaschinen gehören (Warenkorb, Konto, Bestellstatus).
 */
export function pageHead(
  title: string,
  description: string,
  path: string,
  locale: Locale = "de",
  options: { noindex?: boolean; image?: string | undefined } = {},
) {
  const url = pageUrl(path, locale);
  // Ohne eigenes Bild: Markenbild (public/og.jpg), damit geteilte Links immer eine Vorschau haben
  const image = options.image ?? new URL("/og.jpg", shopConfig.siteUrl).href;
  const robots = !shopConfig.launched || options.noindex;
  return {
    links: [
      { rel: "canonical", href: url },
      ...(options.noindex
        ? []
        : [
            { rel: "alternate", hrefLang: htmlLang("de"), href: pageUrl(path, "de") },
            { rel: "alternate", hrefLang: htmlLang("en"), href: pageUrl(path, "en") },
            { rel: "alternate", hrefLang: "x-default", href: pageUrl(path, "de") },
          ]),
    ],
    meta: [
      { title: `${title} · Axion` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · Axion` },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: locale === "en" ? "en_GB" : "de_CH" },
      { property: "og:image", content: image },
      { name: "twitter:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      ...(robots ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
  };
}
