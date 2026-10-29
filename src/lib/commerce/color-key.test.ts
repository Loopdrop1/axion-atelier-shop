// Farbfilter mit sprachneutralem Schlüssel: Sprachwechsel und ältere Links mit Farbnamen.
import { describe, expect, it } from "vitest";
import { testProduct, testVariant } from "@/test/products";
import {
  colorFacets,
  colorKey,
  colorKeys,
  colorMatchesValue,
  selectedColorKeys,
} from "./color-key";
import { filterProducts } from "./index";
import { filtersFromSearch } from "./queries";
import type { Product } from "./types";

const colored = (handle: string, de: string, en: string, locale: "de" | "en"): Product =>
  testProduct(handle, 100, [testVariant(`${handle}-m`)], {
    color: { ...colorKeys(de, en), name: locale === "de" ? de : en, hex: "#000000" },
  });
const catalogue = (locale: "de" | "en") => [
  colored("anzug", "Marine", "Navy", locale),
  colored("hemd", "Hellblau", "Light blue", locale),
  colored("sakko", "Marine", "Navy", locale),
  colored("schal", "Weiß", "White", locale),
];
const handles = (locale: "de" | "en", farbe: string) =>
  filterProducts(catalogue(locale), filtersFromSearch("alle", { farbe }))
    .map((p) => p.handle)
    .sort();

describe("colorKey", () => {
  it("bildet Umlaute, ß, Akzente und Leerzeichen ab", () => {
    expect(colorKey("Marine")).toBe("marine");
    expect(colorKey("Salbeigrün")).toBe("salbeigruen");
    expect(colorKey("Weiß")).toBe("weiss");
    expect(colorKey("Öl Ähre")).toBe("oel-aehre");
    expect(colorKey("  Silber mit Onyx ")).toBe("silber-mit-onyx");
    expect(colorKey("Écru / Natur")).toBe("ecru-natur");
    expect(colorKey("")).toBe("");
    expect(colorKey(null)).toBe("");
  });
  it("nimmt den deutschen Namen, sonst den englischen; Englisch als Ausweichschlüssel", () => {
    expect(colorKeys("Marine", "Navy")).toEqual({ key: "marine", aliases: ["navy"] });
    expect(colorKeys("Oliv", "oliv")).toEqual({ key: "oliv", aliases: [] });
    expect(colorKeys("", "Navy")).toEqual({ key: "navy", aliases: [] });
  });
});

describe("colorFacets", () => {
  it("einmal je Schlüssel, beschriftet in der Seitensprache, gleiche Schlüssel in beiden", () => {
    expect(colorFacets(catalogue("de"))).toEqual([
      { key: "marine", label: "Marine" },
      { key: "hellblau", label: "Hellblau" },
      { key: "weiss", label: "Weiß" },
    ]);
    expect(colorFacets(catalogue("en"))).toEqual([
      { key: "marine", label: "Navy" },
      { key: "hellblau", label: "Light blue" },
      { key: "weiss", label: "White" },
    ]);
  });
});

describe("Farbfilter aus der Adresse", () => {
  it("filtert mit dem Schlüssel in beiden Sprachen gleich", () => {
    expect(handles("de", "marine")).toEqual(["anzug", "sakko"]);
    expect(handles("en", "marine")).toEqual(["anzug", "sakko"]);
    expect(handles("en", "marine,weiss")).toEqual(["anzug", "sakko", "schal"]);
  });
  it("versteht ältere Links mit deutschem oder englischem Namen in jeder Sprache", () => {
    for (const locale of ["de", "en"] as const) {
      expect(handles(locale, "Marine")).toEqual(["anzug", "sakko"]);
      expect(handles(locale, "Navy")).toEqual(["anzug", "sakko"]);
      expect(handles(locale, "Light blue")).toEqual(["hemd"]);
      expect(handles(locale, "Weiß")).toEqual(["schal"]);
    }
  });
  it("findet für unbekannte Farben nichts", () => {
    expect(handles("de", "pink")).toEqual([]);
  });
  it("deutet gewählte Werte als Schlüssel (für Häkchen und Umschalten)", () => {
    expect(selectedColorKeys("Navy,hellblau", catalogue("de"))).toEqual(["marine", "hellblau"]);
    expect(selectedColorKeys("White,unbekannt", catalogue("en"))).toEqual(["weiss", "unbekannt"]);
    expect(selectedColorKeys(undefined, catalogue("de"))).toEqual([]);
  });
  it("vergleicht den Schlüssel direkt und Namen über ihren Schlüssel", () => {
    const color = catalogue("en")[0]!.color;
    expect(colorMatchesValue(color, "marine")).toBe(true);
    expect(colorMatchesValue(color, "NAVY")).toBe(true);
    expect(colorMatchesValue(color, "")).toBe(false);
    expect(colorMatchesValue(color, "hellblau")).toBe(false);
  });
});
