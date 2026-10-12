import { describe, expect, it } from "vitest";
import { switchLocalePath } from "./locale";
import { messages } from "./messages";

/** Struktur eines Wörterbuchs: Schlüsselpfade mit Typ (Text, Liste, Funktion mit Anzahl Parametern). */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}:fn${value.length}`];
  if (Array.isArray(value)) return [`${path}:list${value.length}`];
  if (value && typeof value === "object")
    return Object.entries(value)
      .flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k))
      .sort();
  return [`${path}:${typeof value}`];
}

describe("Übersetzungen", () => {
  it("Deutsch und Englisch haben dieselben Schlüssel, Listen und Funktionen", () => {
    expect(shape(messages.en)).toEqual(shape(messages.de));
  });

  it("keine leeren Texte und kein ß im Deutschen", () => {
    const texts = (v: unknown): string[] =>
      typeof v === "string"
        ? [v]
        : v && typeof v === "object"
          ? Object.values(v).flatMap(texts)
          : [];
    for (const locale of ["de", "en"] as const) {
      for (const t of texts(messages[locale]))
        expect(t.trim(), `leerer Text in ${locale}`).not.toBe("");
    }
    expect(texts(messages.de).filter((t) => t.includes("ß"))).toEqual([]);
  });

  it("Funktionen liefern Text in beiden Sprachen", () => {
    expect(messages.de.common.pieces(1)).toBe("1 Stück");
    expect(messages.en.common.pieces(2)).toBe("2 pieces");
    expect(messages.en.checkout.giftCardBalance("CHF 50.00")).toBe("Balance: CHF 50.00");
  });
});

describe("Sprachwechsel-Pfade", () => {
  it.each([
    ["/en/kollektion/anzuege", "de", "/kollektion/anzuege"],
    ["/kollektion/anzuege", "en", "/en/kollektion/anzuege"],
    ["/", "en", "/en"],
    ["/en", "de", "/"],
    ["/en/", "de", "/"],
    ["/suche?q=anzug#oben", "en", "/en/suche?q=anzug#oben"],
    ["/en/suche?q=suit", "de", "/suche?q=suit"],
    ["/entdecken", "de", "/entdecken"],
  ] as const)("%s → %s: %s", (from, target, expected) => {
    expect(switchLocalePath(from, target)).toBe(expected);
  });
});

describe("Sprachwechsel ohne Sprung auf fremde Domains", () => {
  it("fasst führende Schrägstriche zusammen", () => {
    expect(switchLocalePath("/en//boese.example/x", "de")).toBe("/boese.example/x");
    expect(switchLocalePath("/en/\\boese.example", "de")).toBe("/boese.example");
    expect(switchLocalePath("//boese.example", "en")).toBe("/en/boese.example");
    expect(switchLocalePath("/en", "de")).toBe("/");
  });
});
