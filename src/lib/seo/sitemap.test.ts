import { describe, expect, it } from "vitest";
import { buildSitemap, englishPath, sitemapPaths, STATIC_PATHS } from "./sitemap";

describe("Sitemap", () => {
  it("führt jede Seite auf Deutsch und Englisch mit hreflang-Verweisen", () => {
    const xml = buildSitemap("https://www.axion.test/", ["/", "/produkt/weste-limmat-marine"]);
    expect(xml).toContain("<loc>https://www.axion.test/</loc>");
    expect(xml).toContain("<loc>https://www.axion.test/en</loc>");
    expect(xml).toContain("<loc>https://www.axion.test/produkt/weste-limmat-marine</loc>");
    expect(xml).toContain("<loc>https://www.axion.test/en/produkt/weste-limmat-marine</loc>");
    expect(xml).toContain(
      'hreflang="de-CH" href="https://www.axion.test/produkt/weste-limmat-marine"',
    );
    expect(xml).toContain('hreflang="x-default" href="https://www.axion.test/"');
    expect(xml.match(/<url>/g)).toHaveLength(4);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("nimmt Katalogseiten dazu, ohne Duplikate, und keine privaten Seiten", () => {
    const paths = sitemapPaths(["alle", "anzuege", "alle"], ["a b&c"]);
    expect(paths).toContain("/kollektion/anzuege");
    expect(paths.filter((p) => p === "/kollektion/alle")).toHaveLength(1);
    expect(paths).toContain("/produkt/a%20b%26c");
    expect(paths.some((p) => /warenkorb|konto|admin|suche|merkliste|bestellung/.test(p))).toBe(
      false,
    );
    expect(paths.slice(0, STATIC_PATHS.length)).toEqual([...STATIC_PATHS]);
  });

  it("maskiert Sonderzeichen im XML", () => {
    expect(buildSitemap("https://x.test", ["/produkt/a&b"])).toContain("/produkt/a&amp;b</loc>");
    expect(englishPath("/")).toBe("/en");
    expect(englishPath("/agb")).toBe("/en/agb");
  });
});
