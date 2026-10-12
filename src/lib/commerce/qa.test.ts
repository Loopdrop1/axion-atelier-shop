import { describe, expect, it } from "vitest";
import { pieceCount, resultCount, searchString } from "./presentation";
import { pageHead } from "./seo";
import { getRouter } from "@/router";
import { Route as CollectionRoute } from "@/routes/kollektion.$handle";
import { Route as SearchRoute } from "@/routes/suche";
import { listProducts, resolveCart } from "./index";
describe("QA regressions", () => {
  it("uses singular counts and number-compatible search strings", () => {
    expect(pieceCount(1)).toBe("1 Stück");
    expect(pieceCount(6)).toBe("6 Stücke");
    expect(resultCount(1)).toBe("1 Ergebnis");
    expect(resultCount(3)).toBe("3 Ergebnisse");
    expect(searchString(48)).toBe("48");
    expect(searchString("48,50")).toBe("48,50");
    expect(searchString(null)).toBeUndefined();
  });
  it("keeps optional URL defaults out of clean links", () => {
    const validateCollection = CollectionRoute.options.validateSearch;
    const validateSearch = SearchRoute.options.validateSearch;
    if (typeof validateCollection !== "function" || typeof validateSearch !== "function")
      throw new Error("Validators missing");
    expect(validateCollection({})).toMatchObject({ sort: undefined });
    expect(validateCollection({ groesse: 48 })).toMatchObject({ groesse: "48" });
    expect(validateSearch({})).toMatchObject({ q: undefined });
    expect(validateSearch({ q: 48 })).toMatchObject({ q: "48" });
    const stringify = getRouter().options.stringifySearch;
    expect(stringify?.({ groesse: "48", sort: undefined })).toBe("?groesse=48");
    expect(stringify?.({ groesse: "48,50" })).toBe("?groesse=48,50");
  });
  it("provides one self-referencing canonical and summary card", () => {
    const head = pageHead("Westen", "Westen von Axion", "/kollektion/westen");
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://www.axion-shop.ch/kollektion/westen" },
    ]);
    expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary" });
  });
  it("preserves newest ordering and original sale prices in cart data", async () => {
    const newest = await listProducts({ collection: "neu" });
    expect(newest).toHaveLength(4);
    expect(newest.every((p) => p.tags.includes("neu"))).toBe(true);
    expect(newest.map((p) => p.createdAt)).toEqual(
      [...newest.map((p) => p.createdAt)].sort().reverse(),
    );
    const sale = (await listProducts({ collection: "sale" }))[0];
    const variant = sale?.variants.find((v) => v.availableForSale);
    if (!sale || !variant) throw new Error("Sale fixture missing");
    const cart = await resolveCart([{ variantId: variant.id, quantity: 1 }]);
    expect(cart.lines[0]?.product.compareAtPrice?.amount).toBe(159);
    expect(cart.checkoutUrl).toBeNull();
  });
});
