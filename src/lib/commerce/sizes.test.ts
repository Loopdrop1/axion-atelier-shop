// Zuordnung Zahl ↔ Buchstabe und Lesen der Tabellenwerte (sizes.ts).
import { describe, expect, it } from "vitest";
import {
  cleanLetter,
  columnRole,
  DEFAULT_LETTERS,
  letterFor,
  measureRows,
  numberForLetter,
  parseMeasure,
  readSizeLetters,
  sizeWithLetter,
  tableLetters,
} from "./sizes";

// Eine mögliche, im Admin gespeicherte Zuordnung (übliche Zuordnung deutscher Konfektionsgrössen)
const MAP = { "44": "XS", "46": "S", "48": "M", "50": "L", "52": "XL", "54": "XXL", "56": "3XL" };

describe("Zuordnung Zahl ↔ Buchstabe", () => {
  it("ohne gespeichertes Feld: keine Zuordnung, nur Zahlen (Entscheid Axion 3.11.2026)", () => {
    expect(DEFAULT_LETTERS).toEqual({});
    expect(readSizeLetters({})).toEqual({});
    expect(readSizeLetters({ size_guides: { tables: [] } })).toEqual({});
    expect(letterFor("48", "anzuege", readSizeLetters({}))).toBeUndefined();
    expect(numberForLetter("M", readSizeLetters({}))).toBeUndefined();
  });

  it("gespeicherte Zuordnung gilt wie sie ist, aufgeräumt; Unsinn fällt weg; leer = keine Buchstaben", () => {
    expect(
      readSizeLetters({
        size_guides: {
          tables: [],
          letters: { "48": " m ", "50": "L", abc: "S", "52": 7, "54": "zu lang!", "58": "4xl" },
        },
      }),
    ).toEqual({ "48": "M", "50": "L", "58": "4XL" });
    expect(readSizeLetters({ size_guides: { letters: {} } })).toEqual({});
  });

  it("Buchstabe nur für Zahlengrössen ausserhalb von Schuhen, Hemden und Accessoires", () => {
    expect(letterFor("48", "anzuege", MAP)).toBe("M");
    expect(letterFor(" 50 ", "hosen", MAP)).toBe("L");
    expect(letterFor("44", "schuhe", MAP)).toBeUndefined();
    expect(letterFor("44", "hemden", MAP)).toBeUndefined();
    expect(letterFor("100", "accessoires", MAP)).toBeUndefined();
    expect(letterFor("One Size", "anzuege", MAP)).toBeUndefined();
    expect(letterFor("M", "strick", MAP)).toBeUndefined();
    expect(letterFor("58", "anzuege", MAP)).toBeUndefined();
  });

  it("Umkehrung und Anzeige", () => {
    expect(numberForLetter("l", MAP)).toBe("50");
    expect(numberForLetter("3xl", MAP)).toBe("56");
    expect(numberForLetter("XXXXL", MAP)).toBeUndefined();
    expect(sizeWithLetter("48", "M")).toBe("48 (M)");
    expect(sizeWithLetter("43")).toBe("43");
    expect(cleanLetter(" xl ")).toBe("XL");
    expect(cleanLetter("4-XL")).toBe("");
  });
});

describe("Werte der Grössentabellen", () => {
  it("liest Bereiche, Einzelwerte und Dezimalkomma", () => {
    expect(parseMeasure("96–100")).toEqual([96, 100]);
    expect(parseMeasure("96 - 100 cm")).toEqual([96, 100]);
    expect(parseMeasure("96 bis 100")).toEqual([96, 100]);
    expect(parseMeasure("98")).toEqual([98, 98]);
    expect(parseMeasure("25,3")).toEqual([25.3, 25.3]);
    expect(parseMeasure("ca. 26.7 cm")).toEqual([26.7, 26.7]);
    expect(parseMeasure("100–96")).toEqual([96, 100]);
    expect(parseMeasure("")).toBeNull();
    expect(parseMeasure("auf Anfrage")).toBeNull();
    expect(parseMeasure("1 2 3")).toBeNull();
  });

  it("erkennt Spalten auf Deutsch und Englisch", () => {
    expect(columnRole("Brust (cm)")).toBe("chest");
    expect(columnRole("Brustumfang")).toBe("chest");
    expect(columnRole("Chest (cm)")).toBe("chest");
    expect(columnRole("Fusslänge (cm)")).toBe("foot");
    expect(columnRole("Foot length (cm)")).toBe("foot");
    expect(columnRole("Körpergrösse (cm)")).toBe("height");
    expect(columnRole("Height (cm)")).toBe("height");
    expect(columnRole("Taille (cm)")).toBeUndefined();
  });

  it("Zeilen mit lesbarem Wert; die erste Spalte ist nie das Mass", () => {
    const table = {
      columns: ["Grösse", "Taille", "Brust (cm)"],
      rows: [
        ["46", "80", "92"],
        ["48", "84", ""],
        ["50", "88", "98–102"],
      ],
    };
    expect(measureRows(table, "chest")).toEqual([
      { size: "46", range: [92, 92] },
      { size: "50", range: [98, 102] },
    ]);
    expect(measureRows(table, "foot")).toEqual([]);
  });

  it("Spalte «Int.» nur für Konfektionsgrössen mit vollständiger Zuordnung", () => {
    const suits = { categories: ["anzuege"], columns: ["Grösse", "Brust"], rows: [["46"], ["48"]] };
    expect(tableLetters(suits, MAP)).toEqual(["S", "M"]);
    expect(tableLetters({ ...suits, rows: [["46"], ["58"]] }, MAP)).toBeNull();
    expect(tableLetters({ ...suits, rows: [["S"], ["M"]] }, MAP)).toBeNull();
    expect(tableLetters({ ...suits, categories: ["schuhe"] }, MAP)).toBeNull();
    expect(tableLetters({ ...suits, categories: [], columns: ["EU-Grösse"] }, MAP)).toBeNull();
    expect(tableLetters({ ...suits, columns: ["Kragenweite (cm)"] }, MAP)).toBeNull();
    expect(tableLetters(suits, {})).toBeNull();
  });
});
