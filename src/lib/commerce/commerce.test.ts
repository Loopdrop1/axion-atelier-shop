import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";
import { getRecommendations, listProducts } from "./index";
import { rankRecommendations } from "./recommendations";
import { isOnSale } from "./sale";
describe("Preisformatierung", () => {
  it("formatiert Franken nach de-CH", () => {
    expect(formatPrice(489).replace(/\s/g, " ")).toBe("CHF 489.00");
    expect(formatPrice({ amount: 129, currencyCode: "CHF" }).replace(/\s/g, " ")).toBe(
      "CHF 129.00",
    );
  });
});
describe("Beispielkollektion", () => {
  it("filtert Kategorien und Markierungen", async () => {
    // Muster-Sortiment: 52 Stücke in neun Kategorien
    expect(await listProducts()).toHaveLength(52);
    expect(await listProducts({ collection: "anzuege" })).toHaveLength(10);
    expect(await listProducts({ collection: "westen" })).toHaveLength(7);
    expect(await listProducts({ collection: "schuhe" })).toHaveLength(7);
    expect(await listProducts({ collection: "accessoires" })).toHaveLength(8);
    expect(await listProducts({ collection: "neu" })).toHaveLength(19);
    expect(await listProducts({ collection: "sale" })).toHaveLength(5);
    expect((await listProducts()).every((p) => p.tags.includes("muster"))).toBe(true);
  });
  it("filtert Anlass, Farbe, Grösse, Passform und Preis", async () => {
    expect(
      (await listProducts({ occasion: "gala" })).every((p) => p.occasions.includes("gala")),
    ).toBe(true);
    expect(await listProducts({ colors: ["Marine"] })).toHaveLength(10);
    expect(await listProducts({ fits: ["Slim Fit"] })).toHaveLength(14);
    const cheap = await listProducts({ priceMax: 200 });
    expect(cheap).toHaveLength(24);
    expect(cheap.every((p) => p.priceRange.min.amount <= 200)).toBe(true);
    const products = await listProducts({ sizes: ["56"] });
    expect(
      products.every((p) => p.variants.some((v) => v.title === "56" && v.availableForSale)),
    ).toBe(true);
  });
  it("sortiert Preise und Neuheiten", async () => {
    const asc = (await listProducts({ sort: "price-asc" })).map((p) => p.priceRange.min.amount);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect([asc[0], asc.at(-1)]).toEqual([29, 799]);
    const desc = (await listProducts({ sort: "price-desc" })).map((p) => p.priceRange.min.amount);
    expect(desc).toEqual([...asc].reverse());
    // Neueste zuerst; gleich alte Stücke bleiben in der Reihenfolge aus der Datenbank (sort, handle)
    const all = await listProducts();
    expect(all[0]?.handle).toBe("mantel-gotthard-kamel");
    expect(all.filter((p) => p.createdAt === "2026-10-08T07:00:00Z").map((p) => p.handle)).toEqual([
      "anzug-reuss-sand",
      "weste-reuss-sand",
      "loafer-lugano-cognac",
    ]);
  });
});

describe("Sale-Regel", () => {
  it("Sale = Tag «sale» oder durchgestrichener Preis über dem Preis", async () => {
    const all = await listProducts();
    const sale = await listProducts({ collection: "sale" });
    expect(sale.every(isOnSale)).toBe(true);
    expect(sale.map((p) => p.handle).sort()).toEqual(
      all
        .filter(isOnSale)
        .map((p) => p.handle)
        .sort(),
    );
    const base = all[0]!;
    expect(isOnSale({ ...base, tags: [], compareAtPrice: undefined })).toBe(false);
    expect(
      isOnSale({
        ...base,
        tags: [],
        compareAtPrice: { amount: base.priceRange.min.amount + 50, currencyCode: "CHF" },
      }),
    ).toBe(true);
    expect(isOnSale({ ...base, tags: ["sale"], compareAtPrice: undefined })).toBe(true);
  });
});

describe("Empfehlungen", () => {
  it("Outfit-Partner und passende Kategorien zuerst, nie das Stück selbst, nur lieferbare", async () => {
    const all = await listProducts();
    const suit = all.find((p) => p.category === "anzuege" && p.outfitHandles.length)!;
    const picks = await getRecommendations(suit, 4);
    expect(picks).toHaveLength(4);
    expect(picks.some((p) => p.handle === suit.handle)).toBe(false);
    expect(picks.every((p) => p.variants.some((v) => v.availableForSale))).toBe(true);
    expect(picks.some((p) => suit.outfitHandles.includes(p.handle))).toBe(true);
    // Nicht mehr einfach die ersten vier des Katalogs
    expect(picks.map((p) => p.handle)).not.toEqual(
      all
        .filter((p) => p.handle !== suit.handle)
        .slice(0, 4)
        .map((p) => p.handle),
    );
  });

  it("rankRecommendations: Outfit-Partner vor Kategorie vor Rest", async () => {
    const all = await listProducts();
    const suit = all.find((p) => p.category === "anzuege" && p.outfitHandles.length)!;
    const ranked = rankRecommendations(suit, all, all.length);
    const first = ranked[0]!;
    expect(suit.outfitHandles).toContain(first.handle);
  });
});
