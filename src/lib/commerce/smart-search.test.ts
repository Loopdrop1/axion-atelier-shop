import { describe, expect, it } from "vitest";
import { searchCatalog } from "./index";
import { distance, parseQuery } from "./smart-search";

const handles = async (q: string, locale: "de" | "en" = "de") =>
  (await searchCatalog(q, locale)).products.map((p) => p.handle);

describe("parseQuery", () => {
  it("erkennt Kategorie, Farbe, Anlass, Passform, Preis und Grösse in einem Satz", () => {
    const i = parseQuery("blauer Slim Anzug für eine Hochzeit unter CHF 700 in 50");
    expect(i.categories).toEqual(["anzuege"]);
    expect(i.colors).toEqual(["blau"]);
    expect(i.occasions).toEqual(["hochzeit"]);
    expect(i.fit).toBe("Slim Fit");
    expect(i.maxPrice).toBe(700);
    expect(i.size).toBe("50");
    expect(i.terms).toEqual([]);
  });
  it("zerlegt zusammengesetzte Wörter und versteht Englisch", () => {
    expect(parseQuery("Hochzeitsanzug").categories).toEqual(["anzuege"]);
    expect(parseQuery("Hochzeitsanzug").occasions).toEqual(["hochzeit"]);
    const en = parseQuery("navy blazer for the office");
    expect(en.categories).toEqual(["sakkos"]);
    expect(en.colors).toEqual(["blau"]);
    expect(en.occasions).toEqual(["business"]);
  });
  it("«fit» und «passform» sind nur Begleiter der Passform", () => {
    for (const q of ["slim fit", "schmale passform", "passform regular", "regular fit"]) {
      const i = parseQuery(q);
      expect(i.terms, q).toEqual([]);
      expect(i.fit, q).toBe(q.includes("regular") ? "Regular Fit" : "Slim Fit");
    }
  });
  it("Tippfehler-Abstand", () => {
    expect(distance("anzgu", "anzug")).toBe(1);
    expect(distance("kaschmier", "kaschmir")).toBe(1);
  });
});

describe("smartSearch auf dem Musterkatalog", () => {
  it("findet blaue Anzüge, nicht graue", async () => {
    const r = await handles("blauer Anzug");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((h) => h.startsWith("anzug-") || h.startsWith("smoking-"))).toBe(true);
    expect(r).toContain("anzug-limmat-marine");
    expect(r).not.toContain("anzug-limmat-anthrazit");
  });
  it("versteht Synonyme und Tippfehler", async () => {
    expect(await handles("blazer")).toContain("sakko-engadin-marine");
    expect(await handles("kaschmier pulli")).toContain("pullover-arosa-kamel");
    expect(await handles("krawate")).toContain("krawatte-morcote-bordeaux");
  });
  it("Preisgrenze und Sortierung «günstig»", async () => {
    const r = (await searchCatalog("schuhe unter 300")).products;
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.category === "schuhe" && p.priceRange.min.amount <= 300)).toBe(true);
    const cheap = (await searchCatalog("günstige hemden")).products.map(
      (p) => p.priceRange.min.amount,
    );
    expect(cheap).toEqual([...cheap].sort((a, b) => a - b));
  });
  it("lockert statt «keine Treffer» und schlägt Korrekturen vor", async () => {
    const r = await searchCatalog("schwarzer Anzug in Grösse 60");
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.relaxed).toBe(true);
    const typo = await searchCatalog("limmatt");
    expect(typo.products.map((p) => p.handle)).toContain("anzug-limmat-marine");
  });
  it("«slim fit» liefert Treffer", async () => {
    const r = await searchCatalog("slim fit");
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.products.every((p) => p.fit === "Slim Fit")).toBe(true);
  });
  it("nennt die gelockerten Bedingungen", async () => {
    const size = await searchCatalog("schwarzer Anzug in Grösse 60");
    expect(size.relaxed).toBe(true);
    expect(size.relaxedChecks).toContain("size");
    const price = await searchCatalog("anzug unter 10");
    expect(price.relaxed).toBe(true);
    expect(price.relaxedChecks).toContain("maxPrice");
    expect((await searchCatalog("blauer Anzug")).relaxedChecks).toBeUndefined();
  });
  it("findet auf Englisch", async () => {
    expect(await handles("black oxford shoes", "en")).toContain("oxford-nero-schwarz");
  });
});
