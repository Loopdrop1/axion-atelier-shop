import { describe, expect, it } from "vitest";
import type { Json } from "@/integrations/supabase/types";
import { autoTranslate } from "./auto-translate";
import {
  applyBlockPairs,
  applyItemPairs,
  blockPairs,
  itemPairs,
  itemsJson,
  nextSpotKey,
  readItems,
  withUniqueSpotKeys,
} from "./content-translate";

const fake = async (texts: string[]) => texts.map((t) => `EN: ${t}`);

describe("Startseiten-Block: Textpaare", () => {
  const value = {
    de: { title: "Präzise geschnitten.", text: "Anzüge und Westen" },
    en: { title: "Precisely cut." },
    en_auto: ["f:title"],
    image: "story/bild.webp",
    image_alt: { de: "Stoff in Nahaufnahme" },
    hotspots: [
      { key: "punkt-1", handle: "anzug", label: { de: "Anzug", en: "Suit" }, x: 10, y: 20 },
      { key: "punkt-2", handle: "weste", label: { de: "Weste" }, x: 30, y: 40 },
    ],
  };

  it("liest Felder, Bildbeschreibung, Punkte und die Herkunft des Englisch", () => {
    expect(blockPairs(value, ["title", "text", "eyebrow"])).toEqual({
      "f:title": { de: "Präzise geschnitten.", en: "Precisely cut.", auto: true },
      "f:text": { de: "Anzüge und Westen", en: "", auto: false },
      "f:eyebrow": { de: "", en: "", auto: false },
      image_alt: { de: "Stoff in Nahaufnahme", en: "", auto: false },
      "spot:punkt-1": { de: "Anzug", en: "Suit", auto: false },
      "spot:punkt-2": { de: "Weste", en: "", auto: false },
    });
  });

  it("schreibt Englisch und Herkunft zurück und lässt leere Texte weg", () => {
    const pairs = blockPairs(value, ["title", "text"]);
    pairs["f:text"] = { de: "Anzüge und Westen", en: "Suits and waistcoats", auto: true };
    pairs["f:title"] = { de: "Präzise geschnitten.", en: "", auto: false };
    pairs["image_alt"] = { de: "Stoff in Nahaufnahme", en: "Fabric close-up", auto: true };
    pairs["spot:punkt-2"] = { de: "Weste", en: "Waistcoat", auto: false };
    const out = applyBlockPairs(value, pairs);
    expect(out["en"]).toEqual({ text: "Suits and waistcoats" });
    expect(out["de"]).toEqual(value.de);
    expect(out["en_auto"]).toEqual(["f:text", "image_alt"]);
    expect(out["image_alt"]).toEqual({ de: "Stoff in Nahaufnahme", en: "Fabric close-up" });
    expect(out["hotspots"]).toEqual([
      value.hotspots[0],
      { key: "punkt-2", handle: "weste", label: { de: "Weste", en: "Waistcoat" }, x: 30, y: 40 },
    ]);
    expect(out["image"]).toBe("story/bild.webp");
  });

  it("ohne maschinelles Englisch fällt en_auto weg", () => {
    const out = applyBlockPairs(value, { "f:title": { de: "Neu", en: "New", auto: false } });
    expect(out).not.toHaveProperty("en_auto");
  });

  it("Block ohne Bild: keine Bildbeschreibung", () => {
    expect(blockPairs({ de: { title: "Neu" } }, ["title"])).toEqual({
      "f:title": { de: "Neu", en: "", auto: false },
    });
  });
});

describe("Outfit-Punkte: eindeutige Schlüssel", () => {
  it("neuer Punkt nach dem Löschen bekommt keinen vorhandenen Schlüssel", () => {
    expect(nextSpotKey(["punkt-2", "punkt-3"])).toBe("punkt-4");
    expect(nextSpotKey(["sakko", "weste", "schuhe"])).toBe("punkt-4");
    expect(nextSpotKey([])).toBe("punkt-1");
  });

  it("doppelte oder fehlende Schlüssel werden beim Laden ersetzt", () => {
    const value = {
      hotspots: [
        { key: "punkt-3", label: { de: "Schuhe", en: "Shoes" } },
        { key: "punkt-3", label: { de: "Hose" } },
        { label: { de: "Gürtel" } },
      ],
    };
    const keys = (withUniqueSpotKeys(value)["hotspots"] as { key: string }[]).map((h) => h.key);
    expect(keys[0]).toBe("punkt-3");
    expect(new Set(keys).size).toBe(3);
  });

  it("Szenario aus dem Review: Schuhe behalten ihr Englisch, die neue Hose wird übersetzt", async () => {
    const saved = {
      hotspots: [
        { key: "punkt-2", label: { de: "Weste", en: "Waistcoat" } },
        { key: "punkt-3", label: { de: "Schuhe", en: "Shoes" } },
      ],
    };
    const base = withUniqueSpotKeys(saved);
    const draft = {
      hotspots: [
        ...(base["hotspots"] as Json[]),
        { key: nextSpotKey(["punkt-2", "punkt-3"]), label: { de: "Hose" } },
      ],
    };
    const result = await autoTranslate(blockPairs(base, []), blockPairs(draft, []), fake);
    const labels = (applyBlockPairs(draft, result.pairs)["hotspots"] as { label: object }[]).map(
      (h) => h.label,
    );
    expect(labels).toEqual([
      { de: "Weste", en: "Waistcoat" },
      { de: "Schuhe", en: "Shoes" },
      { de: "Hose", en: "EN: Hose" },
    ]);
  });
});

describe("Laufband: Textpaare pro Satz", () => {
  it("liest und schreibt über die ID, auch nach dem Umsortieren", async () => {
    const saved = {
      items: [
        {
          de: "Lieferung in 2 bis 5 Arbeitstagen",
          en: "Delivery in 2 to 5 working days",
          auto: true,
        },
        { de: "TWINT", en: "TWINT" },
      ],
    };
    const base = readItems(saved);
    expect(base.map((i) => i.auto)).toEqual([true, false]);
    // Satz 1 ändern und nach unten schieben
    const draft = [base[1]!, { ...base[0]!, de: "Lieferung in 1 bis 3 Arbeitstagen" }];
    const result = await autoTranslate(itemPairs(base), itemPairs(draft), fake);
    const next = applyItemPairs(draft, result.pairs);
    expect(next.map((i) => i.en)).toEqual(["TWINT", "EN: Lieferung in 1 bis 3 Arbeitstagen"]);
    expect(itemsJson(next)).toEqual({
      items: [
        { de: "TWINT", en: "TWINT" },
        {
          de: "Lieferung in 1 bis 3 Arbeitstagen",
          en: "EN: Lieferung in 1 bis 3 Arbeitstagen",
          auto: true,
        },
      ],
    });
  });

  it("Sätze ohne Deutsch fallen weg", () => {
    expect(itemsJson([{ id: "a", de: " ", en: "Free", auto: false }])).toEqual({ items: [] });
  });
});
