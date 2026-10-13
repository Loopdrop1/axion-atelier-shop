import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";
import { listProducts } from "./index";
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
    // Muster-Sortiment: 10 Anzüge, 7 Westen, 7 Paar Schuhe
    expect(await listProducts({ collection: "anzuege" })).toHaveLength(10);
    expect(await listProducts({ collection: "westen" })).toHaveLength(7);
    expect(await listProducts({ collection: "schuhe" })).toHaveLength(7);
    expect(await listProducts({ collection: "neu" })).toHaveLength(10);
    expect(await listProducts({ collection: "sale" })).toHaveLength(3);
    expect((await listProducts()).every((p) => p.tags.includes("muster"))).toBe(true);
  });
  it("filtert Anlass, Farbe, Grösse, Passform und Preis", async () => {
    expect(
      (await listProducts({ occasion: "gala" })).every((p) => p.occasions.includes("gala")),
    ).toBe(true);
    expect(await listProducts({ colors: ["Marine"] })).toHaveLength(3);
    expect(await listProducts({ fits: ["Slim Fit"] })).toHaveLength(6);
    const cheap = await listProducts({ priceMax: 200 });
    expect(cheap).toHaveLength(7);
    expect(cheap.every((p) => p.priceRange.min.amount <= 200)).toBe(true);
    const products = await listProducts({ sizes: ["56"] });
    expect(
      products.every((p) => p.variants.some((v) => v.title === "56" && v.availableForSale)),
    ).toBe(true);
  });
  it("sortiert Preise und Neuheiten", async () => {
    const asc = (await listProducts({ sort: "price-asc" })).map((p) => p.priceRange.min.amount);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect([asc[0], asc.at(-1)]).toEqual([119, 649]);
    const desc = (await listProducts({ sort: "price-desc" })).map((p) => p.priceRange.min.amount);
    expect(desc).toEqual([...asc].reverse());
    // Gleich alte Stücke bleiben in der Reihenfolge aus der Datenbank (sort, handle)
    expect((await listProducts())[0]?.handle).toBe("anzug-ticino-salbei");
  });
});
