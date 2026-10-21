// Strukturierte Daten (schema.org) für Suchmaschinen und KI-Antworten: Organisation, Website-Suche,
// Breadcrumbs und FAQ. Werte mit Platzhaltern ([...]) aus der Konfiguration bleiben weg, bis der Kunde sie liefert.
import { shopConfig } from "@/config/shop";
import type { WrittenPage } from "@/content/pages";
import type { Locale } from "@/i18n/locale";
import { pageUrl } from "@/lib/commerce/seo";

const filled = (value: string) => Boolean(value.trim()) && !/\[[^\]]+\]/.test(value);

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
        target: `${pageUrl("/suche", locale)}?q={search_term_string}`,
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

/** FAQ aus der Inhaltsseite; Fragen mit offenen Platzhaltern werden ausgelassen. */
export function faqLd(page: WrittenPage, resolve: (text: string) => string) {
  const items = page.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.type === "questions" ? block.items : [])),
  );
  const entities = items
    .map((item) => ({ q: resolve(item.question), a: resolve(item.answer).replace(/\*\*/g, "") }))
    .filter((item) => filled(item.q) && filled(item.a))
    .map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }));
  return entities.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: entities }
    : null;
}
