// Inhalt von /llms.txt: kurze Übersicht des Shops für KI-Assistenten und KI-Suchen (GEO), nach llmstxt.org.
import { shopConfig } from "@/config/shop";
import { messages } from "@/i18n";
import { guideMeta, guideSlugs } from "@/content/guides-meta";
import { pageUrl } from "@/lib/commerce/seo";

export function buildLlmsTxt(
  collections: { handle: string; title: string; description: string }[],
  shipping: string,
): string {
  const t = messages.de;
  const link = (title: string, path: string, note?: string) =>
    `- [${title}](${pageUrl(path, "de")})${note ? `: ${note}` : ""}`;
  return [
    `# ${shopConfig.brand}`,
    "",
    `> ${t.seo.homeDescription}`,
    "",
    `${shopConfig.brand} ist ein Schweizer Online-Shop für Herrenmode: fertige Konfektion (keine Massanfertigung), ` +
      `Lieferung in der Schweiz. ${shipping}. Rückgabe innert ${shopConfig.returnDays} Tagen. ` +
      `Zahlung: ${shopConfig.paymentMethods.join(", ")}. Die Seiten gibt es auf Deutsch und Englisch (/en).`,
    "",
    "## Kollektionen",
    ...collections.map((c) => link(c.title, `/kollektion/${c.handle}`, c.description)),
    "",
    "## Hilfe",
    link(t.pages.groessenberatung.title, "/groessenberatung", "Grössentabellen und Messanleitung"),
    link(t.pages["versand-und-rueckgabe"].title, "/versand-und-rueckgabe"),
    link(t.pages["haeufige-fragen"].title, "/haeufige-fragen"),
    link(t.pages.kontakt.title, "/kontakt"),
    "",
    "## Ratgeber",
    link(
      t.guides.navLabel,
      "/ratgeber",
      "Praktische Ratgeber zu Anzug, Passform, Dresscode und Pflege",
    ),
    ...guideSlugs.map((slug) =>
      link(guideMeta.de[slug].title, `/ratgeber/${slug}`, guideMeta.de[slug].description),
    ),
    "",
    "## Optional",
    link(t.pages["ueber-uns"].title, "/ueber-uns"),
    link(t.pages.agb.title, "/agb"),
    link(t.pages.datenschutz.title, "/datenschutz"),
    link("Sitemap", "/sitemap.xml"),
    "",
  ].join("\n");
}
