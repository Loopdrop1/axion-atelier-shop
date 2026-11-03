// Grössenfinder (size-finder.ts): Tabelle, Norm, übliche Grösse, Passform, nur angebotene Grössen, Schuhe.
import { describe, expect, it } from "vitest";
import {
  findSize,
  finderKind,
  placeInRanges,
  productFinder,
  profileInput,
  tableFor,
  type FinderContext,
} from "./size-finder";
import { DEFAULT_LETTERS } from "./sizes";

// Eine mögliche, im Admin gespeicherte Zuordnung; Standard ist keine (nur Zahlen, Entscheid Axion 3.11.2026)
const MAP = { "44": "XS", "46": "S", "48": "M", "50": "L", "52": "XL", "54": "XXL", "56": "3XL" };
import type { SizeGuideTable } from "./mapping";
import { testProduct, testVariant } from "@/test/products";

const sizes = (titles: string[], soldOut: string[] = []) =>
  titles.map((title) => ({ title, available: !soldOut.includes(title) }));

// Wie die Beispieltabelle in seed.sql: Einzelwerte Brust, Bereiche Körpergrösse (überlappend)
const suitTable = {
  columns: ["Grösse", "Brust (cm)", "Taille (cm)", "Körpergrösse (cm)"],
  rows: [
    ["46", "92", "80", "170–176"],
    ["48", "96", "84", "173–179"],
    ["50", "100", "88", "176–182"],
    ["52", "104", "92", "179–185"],
    ["54", "108", "96", "182–188"],
    ["56", "112", "100", "185–191"],
  ],
};
const suit = (extra: Partial<FinderContext> = {}): FinderContext => ({
  kind: "clothing",
  sizes: sizes(["46", "48", "50", "52", "54", "56"]),
  table: suitTable,
  letters: DEFAULT_LETTERS,
  ...extra,
});

describe("placeInRanges", () => {
  const ranges: [number, number][] = [
    [92, 96],
    [97, 100],
    [104, 108],
  ];
  it("innerhalb eines Bereichs gilt er; am Rand verschiebt nur der passende Wunsch", () => {
    expect(placeInRanges(94, ranges, "regular")).toEqual({ index: 0, shift: 0, notes: [] });
    expect(placeInRanges(96, ranges, "relaxed")).toEqual({
      index: 1,
      shift: 1,
      notes: ["between"],
    });
    expect(placeInRanges(96, ranges, "slim").index).toBe(0);
    expect(placeInRanges(97, ranges, "slim")).toEqual({ index: 0, shift: -1, notes: ["between"] });
  });
  it("in der Lücke: nahe Seite klar, Mitte nach Wunsch (normal: ab der Mitte die grössere)", () => {
    expect(placeInRanges(101, ranges, "relaxed")).toEqual({ index: 1, shift: 0, notes: [] });
    expect(placeInRanges(102, ranges, "regular")).toEqual({
      index: 2,
      shift: 0,
      notes: ["between"],
    });
    expect(placeInRanges(102, ranges, "slim")).toEqual({
      index: 1,
      shift: -1,
      notes: ["between"],
    });
  });
  it("ausserhalb: kleinste bzw. grösste mit Hinweis", () => {
    expect(placeInRanges(80, ranges, "regular")).toEqual({
      index: 0,
      shift: 0,
      notes: ["below-range"],
    });
    expect(placeInRanges(120, ranges, "regular").notes).toEqual(["above-range"]);
  });
});

describe("findSize: Kleidung", () => {
  it("(a) Brustumfang mit der Tabellenspalte «Brust»", () => {
    expect(findSize({ height: 180, chest: 100 }, suit())).toEqual({
      status: "ok",
      size: "50",
      soldOut: false,
      basis: "chest-table",
      shift: 0,
      notes: [],
    });
    // 97 cm: nahe an 96 → 48, auch mit «bequem» (kein Grenzfall)
    expect(findSize({ height: 180, chest: 97, fit: "relaxed" }, suit())).toMatchObject({
      size: "48",
      shift: 0,
    });
  });

  it("Grenzfall zwischen zwei Grössen: Passformwunsch verschiebt", () => {
    const at98 = (fit: "slim" | "regular" | "relaxed") =>
      findSize({ height: 180, chest: 98, fit }, suit());
    expect(at98("slim")).toMatchObject({ size: "48", notes: ["between"] });
    expect(at98("regular")).toMatchObject({ size: "50", shift: 0, notes: ["between"] });
    expect(at98("relaxed")).toMatchObject({ size: "50", notes: ["between"] });
  });

  it("Bereiche in der Tabelle («96–100»): oberes Viertel + bequem = eine grösser", () => {
    const table = {
      columns: ["Grösse", "Brustumfang"],
      rows: [
        ["48", "94–97"],
        ["50", "98–101"],
        ["52", "102–105"],
      ],
    };
    const ctx = suit({ table, sizes: sizes(["48", "50", "52"]) });
    expect(findSize({ height: 180, chest: 99 }, ctx)).toMatchObject({ size: "50", shift: 0 });
    expect(findSize({ height: 180, chest: 101, fit: "relaxed" }, ctx)).toMatchObject({
      size: "52",
      shift: 1,
    });
    expect(findSize({ height: 180, chest: 98, fit: "slim" }, ctx)).toMatchObject({
      size: "48",
      shift: -1,
    });
  });

  it("nur angebotene Grössen: fehlende Tabellenzeilen werden übersprungen", () => {
    const ctx = suit({ sizes: sizes(["48", "52", "54"]) });
    // 100 cm entspräche 50; das Stück führt 48 und 52 → in der Mitte, normal: die grössere
    expect(findSize({ height: 180, chest: 100 }, ctx)).toMatchObject({ size: "52" });
    expect(findSize({ height: 180, chest: 100, fit: "slim" }, ctx)).toMatchObject({ size: "48" });
  });

  it("ausverkaufte Empfehlung wird gemeldet, nicht ersetzt", () => {
    const ctx = suit({ sizes: sizes(["46", "48", "50", "52"], ["50"]) });
    expect(findSize({ height: 180, chest: 100 }, ctx)).toMatchObject({
      size: "50",
      soldOut: true,
    });
  });

  it("Tabelle mit Buchstaben (Strick, T-Shirts) passt direkt; zu Zahlengrössen nur mit Zuordnung", () => {
    const knit = {
      columns: ["Grösse", "Brust (cm)"],
      rows: [
        ["S", "96"],
        ["M", "102"],
        ["L", "108"],
      ],
    };
    expect(
      findSize({ height: 180, chest: 102 }, suit({ table: knit, sizes: sizes(["S", "M", "L"]) })),
    ).toMatchObject({ size: "M", basis: "chest-table" });
    // Ohne Zuordnung keine Umrechnung: die Strick-Tabelle hilft einem Anzug nicht, die Norm schon
    expect(
      findSize(
        { height: 180, chest: 108 },
        suit({ table: knit, sizes: sizes(["46", "48", "50"]) }),
      ),
    ).toMatchObject({ size: "50", basis: "chest-norm" });
    // Mit gespeicherter Zuordnung passt die Buchstaben-Tabelle auch zu Zahlengrössen
    expect(
      findSize(
        { height: 180, chest: 108 },
        suit({ table: knit, sizes: sizes(["46", "48", "50"]), letters: MAP }),
      ),
    ).toMatchObject({ size: "50", basis: "chest-table" });
  });

  it("(b) ohne Brust-Spalte: Norm Grösse ≈ halber Brustumfang (Buchstaben nur mit Zuordnung)", () => {
    const trousers = { columns: ["Grösse", "Bundweite (cm)"], rows: [["48", "84"]] };
    expect(findSize({ height: 180, chest: 104 }, suit({ table: trousers }))).toMatchObject({
      size: "52",
      basis: "chest-norm",
    });
    // Buchstabengrössen ohne Tabelle: Norm nur mit gespeicherter Zuordnung
    expect(
      findSize(
        { height: 180, chest: 98 },
        suit({ table: undefined, sizes: sizes(["S", "M", "L"]) }),
      ),
    ).toEqual({ status: "none", reason: "missing-input", notes: [] });
    expect(
      findSize(
        { height: 180, chest: 98 },
        suit({ table: undefined, sizes: sizes(["S", "M", "L"]), letters: MAP }),
      ),
    ).toMatchObject({ size: "L", basis: "chest-norm", notes: ["between"] });
    // Hemden mit Kragenweite: keine Norm → übliche Grösse oder nichts
    expect(
      findSize(
        { height: 180, chest: 100 },
        suit({ table: undefined, norm: false, sizes: sizes(["39", "40", "41"]) }),
      ),
    ).toEqual({ status: "none", reason: "missing-input", notes: [] });
  });

  it("(c) übliche Grösse: Zahl, Buchstabe (umgerechnet nur mit Zuordnung) oder nicht im Angebot", () => {
    expect(findSize({ height: 180, usual: "50" }, suit())).toMatchObject({
      size: "50",
      basis: "usual",
    });
    // Ohne Zuordnung: Buchstabe passt nur zu Buchstabengrössen (T-Shirts), nie zu 46–56
    expect(findSize({ height: 180, usual: "l" }, suit())).toMatchObject({
      status: "none",
      reason: "not-offered",
    });
    expect(
      findSize(
        { height: 180, usual: "m" },
        suit({ table: undefined, sizes: sizes(["S", "M", "L"]) }),
      ),
    ).toMatchObject({ size: "M", basis: "usual" });
    expect(
      findSize({ height: 180, usual: "50" }, suit({ table: undefined, sizes: sizes(["M", "L"]) })),
    ).toMatchObject({ status: "none", reason: "not-offered" });
    // Mit gespeicherter Zuordnung wird umgerechnet, in beide Richtungen
    expect(findSize({ height: 180, usual: "l" }, suit({ letters: MAP }))).toMatchObject({
      size: "50",
    });
    expect(
      findSize(
        { height: 180, usual: "50" },
        suit({ table: undefined, sizes: sizes(["M", "L"]), letters: MAP }),
      ),
    ).toMatchObject({ size: "L" });
    expect(findSize({ height: 180, usual: "60" }, suit())).toEqual({
      status: "none",
      reason: "not-offered",
      notes: [],
    });
  });

  it("Brustumfang geht der üblichen Grösse vor", () => {
    expect(findSize({ height: 180, chest: 104, usual: "48" }, suit())).toMatchObject({
      size: "52",
      basis: "chest-table",
    });
  });

  it("(d) nur Körpergrösse: Schätzung über die Spalte «Körpergrösse» (nächste Mitte)", () => {
    expect(findSize({ height: 183 }, suit())).toMatchObject({
      size: "52",
      basis: "height-table",
      notes: ["estimate"],
    });
    expect(findSize({ height: 183 }, suit({ table: undefined }))).toEqual({
      status: "none",
      reason: "missing-input",
      notes: [],
    });
  });

  it("sehr gross oder klein: ehrlicher Hinweis zu Ärmel- und Beinlänge", () => {
    expect(findSize({ height: 199, chest: 100 }, suit()).notes).toContain("proportions");
    expect(findSize({ height: 160, chest: 100 }, suit()).notes).toContain("proportions");
    expect(findSize({ height: 195, chest: 100 }, suit()).notes).not.toContain("proportions");
    expect(findSize({ height: 150, chest: 80 }, suit()).notes).toEqual([
      "below-range",
      "proportions",
    ]);
  });

  it("Unsinn wird ignoriert, Einheitsgrösse ist nie Teil der Auswahl", () => {
    expect(findSize({ height: 180, chest: 5 }, suit())).toMatchObject({ basis: "height-table" });
    expect(findSize({ height: 180 }, suit({ sizes: sizes(["One Size"]) }))).toEqual({
      status: "none",
      reason: "no-data",
      notes: [],
    });
  });
});

describe("findSize: Schuhe", () => {
  const shoeTable = {
    columns: ["EU-Grösse", "Fusslänge (cm)"],
    rows: [
      ["40", "25.3"],
      ["41", "26.0"],
      ["42", "26.7"],
      ["43", "27.4"],
      ["44", "28.1"],
    ],
  };
  const shoes = (extra: Partial<FinderContext> = {}): FinderContext => ({
    kind: "shoes",
    sizes: sizes(["40", "41", "42", "43", "44"]),
    table: shoeTable,
    letters: DEFAULT_LETTERS,
    ...extra,
  });

  it("Fusslänge: kleinste Grösse, deren Fusslänge reicht (1 mm Toleranz)", () => {
    expect(findSize({ foot: 26.5 }, shoes())).toMatchObject({ size: "42", basis: "foot-table" });
    expect(findSize({ foot: 26.7 }, shoes())).toMatchObject({ size: "42" });
    expect(findSize({ foot: 26.8 }, shoes())).toMatchObject({ size: "42" });
    expect(findSize({ foot: 26.9 }, shoes())).toMatchObject({ size: "43" });
    expect(findSize({ foot: 30 }, shoes())).toMatchObject({ size: "44", notes: ["above-range"] });
    expect(findSize({ foot: 23 }, shoes())).toMatchObject({ size: "40", notes: ["below-range"] });
  });

  it("ohne Tabelle: übliche EU-Grösse, nie über Buchstaben", () => {
    expect(findSize({ foot: 27, usual: "43" }, shoes({ table: undefined }))).toMatchObject({
      size: "43",
      basis: "usual",
    });
    expect(findSize({ usual: "M" }, shoes())).toMatchObject({
      status: "none",
      reason: "not-offered",
    });
    expect(findSize({}, shoes())).toMatchObject({ status: "none", reason: "missing-input" });
  });

  it("Körpergrösse spielt bei Schuhen keine Rolle", () => {
    expect(findSize({ height: 200, foot: 26 }, shoes()).notes).toEqual([]);
  });
});

describe("Anbindung an Produkt und Tabellen", () => {
  const table = (id: string, categories: string[], columns: string[]): SizeGuideTable => ({
    id,
    title: id,
    categories,
    columns,
    rows: [["48", "96"]],
    note: "",
  });

  it("Art des Finders: Kleidung, Schuhe, keiner für Accessoires und Einheitsgrösse", () => {
    const suitProduct = testProduct("anzug", 489, [testVariant("a-48", true, 489)]);
    expect(finderKind({ ...suitProduct, category: "anzuege" })).toBe("clothing");
    expect(finderKind({ ...suitProduct, category: "schuhe" })).toBe("shoes");
    expect(finderKind({ ...suitProduct, category: "accessoires" })).toBeNull();
    const tie = testProduct("krawatte", 89, [{ ...testVariant("k", true, 89), title: "One Size" }]);
    expect(finderKind({ ...tie, category: "anzuege" })).toBeNull();
  });

  it("Tabelle: zuerst die der Kategorie mit passender Spalte", () => {
    const all = table("alle", [], ["Grösse", "Taille"]);
    const suits = table("anzug", ["anzuege"], ["Grösse", "Brust (cm)"]);
    const shoes = table("schuhe", ["schuhe"], ["EU", "Fusslänge"]);
    expect(tableFor([all, suits, shoes], "anzuege", "clothing")?.id).toBe("anzug");
    expect(tableFor([all, suits, shoes], "schuhe", "shoes")?.id).toBe("schuhe");
    expect(tableFor([all, shoes], "hosen", "clothing")?.id).toBe("alle");
    expect(tableFor([shoes], "hosen", "clothing")).toBeUndefined();
  });

  it("Kontext aus dem Produkt; Hemden ohne Norm", () => {
    const shirt = {
      ...testProduct("hemd", 129, [{ ...testVariant("h-40", false, 129), title: "40" }]),
      category: "hemden",
    };
    expect(productFinder(shirt, [], DEFAULT_LETTERS)).toEqual({
      kind: "clothing",
      sizes: [{ title: "40", available: false }],
      table: undefined,
      letters: DEFAULT_LETTERS,
      norm: false,
    });
  });

  it("gespeicherte Angaben: getrennt für Kleidung und Schuhe", () => {
    expect(profileInput({ foot: 27 }, "clothing")).toBeNull();
    expect(profileInput({ height: 180, fit: "slim" }, "clothing")).toEqual({
      height: 180,
      chest: undefined,
      usual: undefined,
      fit: "slim",
    });
    expect(profileInput({ height: 180 }, "shoes")).toBeNull();
    expect(profileInput({ shoeUsual: "43" }, "shoes")).toEqual({ foot: undefined, usual: "43" });
  });
});
