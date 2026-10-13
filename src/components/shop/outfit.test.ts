// Komplettes Outfit (Produktseite und Look auf der Startseite): Auswahl, Summe und was in den Warenkorb kommt.
import { describe, expect, it } from "vitest";
import { testProduct as outfitProduct, testVariant as variant } from "@/test/products";
import { defaultSelection, isSoldOut, planOutfit, selectionTotal, sizesFor } from "./outfit";

const suit = outfitProduct("anzug", 489, [
  variant("anzug-46", true, 489),
  variant("anzug-48", false, 489),
]);
const vest = outfitProduct("weste", 129, [variant("weste-m", true, 129)]);
const shoes = outfitProduct("schuhe", 239, [variant("schuhe-42", false, 239)]);
const look = [suit, vest, shoes];

describe("Outfit: Auswahl am Anfang", () => {
  it("wählt alle lieferbaren Stücke vor, ganz ausverkaufte nicht", () => {
    expect(isSoldOut(shoes)).toBe(true);
    expect(isSoldOut(suit)).toBe(false);
    expect(defaultSelection(look)).toEqual(["anzug", "weste"]);
  });

  it("blendet ausverkaufte Grössen nur aus, wenn das im Admin eingestellt ist", () => {
    expect(sizesFor(suit, false).map((v) => v.id)).toEqual(["anzug-46", "anzug-48"]);
    expect(sizesFor(suit, true).map((v) => v.id)).toEqual(["anzug-46"]);
  });
});

describe("Outfit: Summe", () => {
  it("zählt nur die ausgewählten Stücke", () => {
    expect(selectionTotal(look, ["anzug", "weste"], {})).toBe(618);
    expect(selectionTotal(look, ["weste"], {})).toBe(129);
    expect(selectionTotal(look, [], {})).toBe(0);
  });

  it("nimmt den Preis der gewählten Grösse, wenn er abweicht", () => {
    const special = outfitProduct("spezial", 100, [variant("spezial-xl", true, 120)]);
    expect(selectionTotal([special], ["spezial"], {})).toBe(100);
    expect(selectionTotal([special], ["spezial"], { spezial: "spezial-xl" })).toBe(120);
  });
});

describe("Outfit: in den Warenkorb", () => {
  it("legt für jedes ausgewählte Stück die gewählte Grösse hinein", () => {
    expect(planOutfit(look, ["anzug", "weste"], { anzug: "anzug-46", weste: "weste-m" })).toEqual({
      ok: true,
      variantIds: ["anzug-46", "weste-m"],
    });
  });

  it("legt nichts hinein, solange bei einem ausgewählten Stück die Grösse fehlt", () => {
    expect(planOutfit(look, ["anzug", "weste"], { anzug: "anzug-46" })).toEqual({
      ok: false,
      missing: ["weste"],
    });
  });

  it("abgewählte Stücke brauchen keine Grösse", () => {
    expect(planOutfit(look, ["weste"], { weste: "weste-m" })).toEqual({
      ok: true,
      variantIds: ["weste-m"],
    });
  });

  it("eine inzwischen ausverkaufte Grösse zählt als fehlend", () => {
    expect(planOutfit(look, ["anzug"], { anzug: "anzug-48" })).toEqual({
      ok: false,
      missing: ["anzug"],
    });
  });

  it("eine Grösse eines anderen Stücks zählt nicht", () => {
    expect(planOutfit(look, ["weste"], { weste: "anzug-46" })).toEqual({
      ok: false,
      missing: ["weste"],
    });
  });
});
