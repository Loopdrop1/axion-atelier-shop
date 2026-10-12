import { describe, expect, it } from "vitest";
import { applyBlockPairs, blockPairs, itemPairs, applyItemPairs } from "./content-translate";

describe("Startseiten-Block: Textpaare", () => {
  const value = {
    de: { title: "Präzise geschnitten.", text: "Anzüge und Westen" },
    en: { title: "Precisely cut." },
    image: "story/bild.webp",
    image_alt: { de: "Stoff in Nahaufnahme" },
    hotspots: [
      { key: "punkt-1", handle: "anzug", label: { de: "Anzug", en: "Suit" }, x: 10, y: 20 },
      { key: "punkt-2", handle: "weste", label: { de: "Weste" }, x: 30, y: 40 },
    ],
  };

  it("liest Felder, Bildbeschreibung und Punkte", () => {
    expect(blockPairs(value, ["title", "text", "eyebrow"])).toEqual({
      "f:title": { de: "Präzise geschnitten.", en: "Precisely cut." },
      "f:text": { de: "Anzüge und Westen", en: "" },
      "f:eyebrow": { de: "", en: "" },
      image_alt: { de: "Stoff in Nahaufnahme", en: "" },
      "spot:punkt-1": { de: "Anzug", en: "Suit" },
      "spot:punkt-2": { de: "Weste", en: "" },
    });
  });

  it("schreibt die englischen Texte zurück und lässt leere weg", () => {
    const pairs = blockPairs(value, ["title", "text"]);
    pairs["f:text"]!.en = "Suits and waistcoats";
    pairs["f:title"]!.en = "";
    pairs["image_alt"]!.en = "Fabric close-up";
    pairs["spot:punkt-2"]!.en = "Waistcoat";
    const out = applyBlockPairs(value, pairs);
    expect(out["en"]).toEqual({ text: "Suits and waistcoats" });
    expect(out["de"]).toEqual(value.de);
    expect(out["image_alt"]).toEqual({ de: "Stoff in Nahaufnahme", en: "Fabric close-up" });
    expect(out["hotspots"]).toEqual([
      value.hotspots[0],
      { key: "punkt-2", handle: "weste", label: { de: "Weste", en: "Waistcoat" }, x: 30, y: 40 },
    ]);
    expect(out["image"]).toBe("story/bild.webp");
  });

  it("Block ohne Bild: keine Bildbeschreibung", () => {
    expect(blockPairs({ de: { title: "Neu" } }, ["title"])).toEqual({
      "f:title": { de: "Neu", en: "" },
    });
  });
});

describe("Laufband: Textpaare pro Satz", () => {
  it("liest und schreibt nach Position", () => {
    const items = [
      { de: "Gratisversand", en: "" },
      { de: "TWINT", en: "TWINT" },
    ];
    const pairs = itemPairs(items);
    expect(pairs).toEqual({
      "item:0": { de: "Gratisversand", en: "" },
      "item:1": { de: "TWINT", en: "TWINT" },
    });
    pairs["item:0"]!.en = "Free shipping";
    expect(applyItemPairs(items, pairs)).toEqual([
      { de: "Gratisversand", en: "Free shipping" },
      { de: "TWINT", en: "TWINT" },
    ]);
  });
});
