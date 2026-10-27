import { describe, expect, it } from "vitest";
import { guides, type Guide } from "./guides";
import { guidesEn } from "./guides-en";
import { guideIndexMeta, guideMeta, guideSlugs, guidesFor, guidesUpdated } from "./guides-meta";
import { STATIC_PATHS } from "@/lib/seo/sitemap";
import { occasionHandles } from "@/components/shop/nav-handles";
import { articleLd, faqFromItems } from "@/lib/seo/structured";
import { buildLlmsTxt } from "@/lib/seo/llms";
import { shopConfig } from "@/config/shop";

// Kategorien aus supabase/seed.sql (Kollektions-Adressen) und feste Hilfeseiten
const COLLECTIONS = [
  "alle",
  "anzuege",
  "sakkos",
  "hosen",
  "hemden",
  "westen",
  "maentel-jacken",
  "strick",
  "schuhe",
  "accessoires",
];
const HELP_PAGES = ["/groessenberatung", "/haeufige-fragen", "/versand-und-rueckgabe"];
const FORBIDDEN_DE =
  /Massanfertigung|Änderungsschneiderei|termin|tailoring|alteration|made-to-measure|appointment|Gratisversand|ß/i;
// Englisch: «determine» enthält «termin», deshalb nur am Wortanfang
const FORBIDDEN_EN =
  /Massanfertigung|Änderungsschneiderei|\btermin|tailoring|alteration|made-to-measure|appointment|Gratisversand|ß/i;

/** Alle Textwerte eines Objekts. */
const leaves = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : value && typeof value === "object"
      ? Object.values(value).flatMap(leaves)
      : [];

const everyText = (guide: Guide) => JSON.stringify(guide);
const shape = (guide: Guide) => ({
  sections: guide.sections.map((s) =>
    s.blocks.map((b) => `${b.type}:${b.type === "bullets" ? b.items.length : 1}`).join(","),
  ),
  summary: guide.summary.length,
  faq: guide.faq.length,
  related: guide.related.map((r) => r.path),
  links: [...everyText(guide).matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1]),
});
const internalLinks = (guide: Guide) => [
  ...guide.related.map((r) => r.path),
  ...[...everyText(guide).matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1] as string),
];

describe("Ratgeber", () => {
  it("has five guides in German and English with identical structure and links", () => {
    expect(guideSlugs).toHaveLength(5);
    for (const slug of guideSlugs) {
      expect(guidesEn[slug], slug).toBeDefined();
      expect(shape(guidesEn[slug]), slug).toEqual(shape(guides[slug]));
    }
  });

  it("follows the length and FAQ requirements", () => {
    for (const slug of guideSlugs) {
      const g = guides[slug];
      const words = [
        g.intro,
        ...g.sections.flatMap((s) =>
          s.blocks.flatMap((b) => (b.type === "paragraph" ? [b.text] : b.items)),
        ),
      ]
        .join(" ")
        .split(/\s+/).length;
      expect(words, slug).toBeGreaterThanOrEqual(480);
      expect(words, slug).toBeLessThanOrEqual(900);
      expect(g.faq.length, slug).toBeGreaterThanOrEqual(3);
      expect(g.faq.length, slug).toBeLessThanOrEqual(5);
      expect(g.summary.length, slug).toBeGreaterThanOrEqual(3);
      expect(g.summary.length, slug).toBeLessThanOrEqual(5);
    }
  });

  it("keeps meta descriptions within 155 characters in both languages", () => {
    for (const locale of ["de", "en"] as const) {
      expect(guideIndexMeta[locale].description.length).toBeLessThanOrEqual(155);
      for (const slug of guideSlugs) {
        const m = guideMeta[locale][slug];
        expect(m.description.length, `${locale} ${slug}`).toBeGreaterThan(60);
        expect(m.description.length, `${locale} ${slug}`).toBeLessThanOrEqual(155);
        expect(m.title.length).toBeLessThanOrEqual(70);
      }
    }
  });

  it("avoids ß, tailoring and appointment words and hardcoded free shipping", () => {
    for (const slug of guideSlugs) {
      for (const text of [...leaves(guides[slug]), ...leaves(guideMeta.de[slug])])
        expect(text.match(FORBIDDEN_DE)?.[0], `${slug}: ${text}`).toBeUndefined();
      for (const text of [...leaves(guidesEn[slug]), ...leaves(guideMeta.en[slug])])
        expect(text.match(FORBIDDEN_EN)?.[0], `${slug}: ${text}`).toBeUndefined();
    }
    expect(leaves(guideIndexMeta.de).join(" ")).not.toMatch(FORBIDDEN_DE);
    expect(leaves(guideIndexMeta.en).join(" ")).not.toMatch(FORBIDDEN_EN);
  });

  it("uses guillemets instead of straight or German quotation marks in German", () => {
    for (const slug of guideSlugs)
      for (const text of leaves(guides[slug])) expect(text, slug).not.toMatch(/["„“]/);
  });

  it("links only to existing routes", () => {
    const known = new Set<string>([
      ...STATIC_PATHS,
      ...HELP_PAGES,
      ...COLLECTIONS.map((h) => `/kollektion/${h}`),
      ...occasionHandles.map((o) => `/kollektion/alle?anlass=${o}`),
      ...guideSlugs.map((s) => `/ratgeber/${s}`),
    ]);
    for (const slug of guideSlugs)
      for (const guide of [guides[slug], guidesEn[slug]])
        for (const link of internalLinks(guide))
          expect(known.has(link), `${slug}: ${link}`).toBe(true);
  });

  it("is listed in sitemap paths and llms.txt", () => {
    expect(STATIC_PATHS).toContain("/ratgeber");
    for (const slug of guideSlugs) expect(STATIC_PATHS).toContain(`/ratgeber/${slug}`);
    const txt = buildLlmsTxt([], "Versand");
    for (const slug of guideSlugs) expect(txt).toContain(`${shopConfig.siteUrl}/ratgeber/${slug}`);
  });

  it("builds Article and FAQPage data with the Organization as author and publisher", () => {
    const meta = guideMeta.en["anzug-pflegen"];
    const article = articleLd(
      {
        headline: meta.title,
        description: meta.description,
        path: "/ratgeber/anzug-pflegen",
        datePublished: guidesUpdated,
        dateModified: guidesUpdated,
      },
      "en",
    );
    expect(article["@type"]).toBe("Article");
    expect(article.inLanguage).toBe("en");
    expect(article.dateModified).toBe(guidesUpdated);
    expect(article.author["@type"]).toBe("Organization");
    expect(article.publisher).toEqual(article.author);
    expect(article.url).toBe(`${shopConfig.siteUrl}/en/ratgeber/anzug-pflegen`);
    const faq = faqFromItems(
      guides["anzug-pflegen"].faq.map((f) => ({ q: f.question, a: f.answer })),
    );
    expect(faq?.mainEntity).toHaveLength(guides["anzug-pflegen"].faq.length);
  });

  it("maps collections and occasions to guides that exist", () => {
    for (const handle of COLLECTIONS)
      for (const occasion of [undefined, ...occasionHandles])
        for (const slug of guidesFor(handle, occasion)) expect(guideSlugs).toContain(slug);
    expect(guidesFor("anzuege")).toContain("anzug-hochzeit");
    expect(guidesFor("alle", "hochzeit")).toContain("anzug-hochzeit");
    expect(guidesFor("strick")).toEqual([]);
  });
});
