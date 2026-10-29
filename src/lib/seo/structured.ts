// Strukturierte Daten (schema.org) für Suchmaschinen und KI-Antworten: Organisation, Website-Suche,
// Breadcrumbs und FAQ. Werte mit Platzhaltern ([...]) aus der Konfiguration bleiben weg, bis der Kunde sie liefert.
import { shopConfig } from "@/config/shop";
import type { WrittenPage } from "@/content/pages";
import { htmlLang, type Locale } from "@/i18n/locale";
import { pageUrl } from "@/lib/commerce/seo";

const filled = (value: string) => Boolean(value.trim()) && !/\[[^\]]+\]/.test(value);

/** Gesetzte Social-Kanäle (nur gültige https-URLs), für Footer und sameAs. */
export function socialChannels(): { channel: string; url: string }[] {
  return Object.entries(shopConfig.social as Record<string, string>)
    .map(([channel, url]) => ({ channel, url: url.trim() }))
    .filter(({ url }) => /^https:\/\/\S+$/.test(url) && filled(url));
}

function socialUrls() {
  return socialChannels().map((c) => c.url);
}

export function organizationLd(locale: Locale) {
  const { contact } = shopConfig;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: shopConfig.brand,
      url: pageUrl("/", "de"),
      logo: new URL("/favicon.svg", shopConfig.siteUrl).href,
      ...(filled(contact.company) ? { legalName: contact.company } : {}),
      ...(filled(contact.email) ? { email: contact.email } : {}),
      ...(filled(contact.phone) ? { telephone: contact.phone } : {}),
      ...(socialUrls().length ? { sameAs: socialUrls() } : {}),
      areaServed: "CH",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: shopConfig.brand,
      url: pageUrl("/", locale),
      inLanguage: locale === "en" ? "en" : "de-CH",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${pageUrl("/suche", locale)}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export function breadcrumbLd(items: { name: string; path: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: pageUrl(item.path, locale),
    })),
  };
}

/** FAQPage aus Frage-Antwort-Paaren; Einträge mit offenen Platzhaltern werden ausgelassen. */
export function faqFromItems(items: { q: string; a: string }[]) {
  const entities = items
    .filter((item) => filled(item.q) && filled(item.a) && !/\{\{/.test(item.q + item.a))
    .map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }));
  return entities.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: entities }
    : null;
}

/** FAQ aus der Inhaltsseite; Fragen mit offenen Platzhaltern werden ausgelassen. */
export function faqLd(page: WrittenPage, resolve: (text: string) => string) {
  const items = page.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.type === "questions" ? block.items : [])),
  );
  return faqFromItems(
    items.map((item) => ({
      q: resolve(item.question),
      a: resolve(item.answer).replace(/\*\*/g, ""),
    })),
  );
}

/** Artikel (Ratgeber): Autor und Herausgeber ist die Organisation Axion. */
export function articleLd(
  article: {
    headline: string;
    description: string;
    path: string;
    datePublished: string;
    dateModified: string;
  },
  locale: Locale,
) {
  const organization = {
    "@type": "Organization",
    name: shopConfig.brand,
    url: pageUrl("/", "de"),
    logo: { "@type": "ImageObject", url: new URL("/favicon.svg", shopConfig.siteUrl).href },
  };
  const url = pageUrl(article.path, locale);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.headline,
    description: article.description,
    inLanguage: htmlLang(locale),
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: new URL("/og.jpg", shopConfig.siteUrl).href,
    author: organization,
    publisher: organization,
  };
}
