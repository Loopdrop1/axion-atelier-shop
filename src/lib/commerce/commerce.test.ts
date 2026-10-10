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
    expect(await listProducts({ collection: "anzuege" })).toHaveLength(2);
    expect(await listProducts({ collection: "neu" })).toHaveLength(4);
    expect(await listProducts({ collection: "sale" })).toHaveLength(1);
  });
  it("filtert Anlass, Farbe, Grösse, Passform und Preis", async () => {
    expect(
      (await listProducts({ occasion: "gala" })).every((p) => p.occasions.includes("gala")),
    ).toBe(true);
    expect(await listProducts({ colors: ["Marine"] })).toHaveLength(2);
    expect(await listProducts({ fits: ["Slim Fit"] })).toHaveLength(1);
    expect(await listProducts({ priceMax: 200 })).toHaveLength(2);
    const products = await listProducts({ sizes: ["56"] });
    expect(
      products.every((p) => p.variants.some((v) => v.title === "56" && v.availableForSale)),
    ).toBe(true);
  });
  it("sortiert Preise und Neuheiten", async () => {
    const asc = await listProducts({ sort: "price-asc" });
    expect(asc.map((p) => p.priceRange.min.amount)).toEqual([129, 129, 219, 239, 459, 489]);
    const desc = await listProducts({ sort: "price-desc" });
    expect(desc.map((p) => p.priceRange.min.amount)).toEqual([489, 459, 239, 219, 129, 129]);
    expect((await listProducts())[0]?.handle).toBe("anzug-limmat-marine");
  });
});
