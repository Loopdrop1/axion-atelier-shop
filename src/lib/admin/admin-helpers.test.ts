import { describe, expect, it } from "vitest";
import { centsToInput, parseChf } from "./money";
import { csvCell, toCsv } from "./csv";
import { targetSize } from "./image";
import { slugify } from "./slug";

describe("Admin: Beträge eingeben", () => {
  it("liest Franken mit Punkt, Komma, Apostroph und «CHF»", () => {
    expect(parseChf("489")).toBe(48900);
    expect(parseChf("489.5")).toBe(48950);
    expect(parseChf("489,50")).toBe(48950);
    expect(parseChf("CHF 1'299.00")).toBe(129900);
    expect(parseChf(" 1’299.95 ")).toBe(129995);
    expect(parseChf("0")).toBe(0);
  });
  it("weist Unsinn und mehr als zwei Nachkommastellen ab", () => {
    expect(parseChf("")).toBeNull();
    expect(parseChf("abc")).toBeNull();
    expect(parseChf("-5")).toBeNull();
    expect(parseChf("1.234")).toBeNull();
    expect(parseChf("1.2.3")).toBeNull();
  });
  it("zeigt Rappen als Eingabetext", () => {
    expect(centsToInput(48900)).toBe("489.00");
    expect(centsToInput(5)).toBe("0.05");
    expect(centsToInput(null)).toBe("");
  });
});

describe("Admin: CSV für Excel (Schweiz)", () => {
  it("trennt mit Semikolon, beginnt mit BOM und nutzt CRLF", () => {
    const csv = toCsv([
      ["Nr", "Name"],
      ["1", "Müller"],
    ]);
    expect(csv).toBe("﻿Nr;Name\r\n1;Müller\r\n");
  });
  it("setzt Anführungszeichen, wo nötig, und entschärft Formeln", () => {
    expect(csvCell('Sagt "Hallo"')).toBe('"Sagt ""Hallo"""');
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("Zeile 1\nZeile 2")).toBe('"Zeile 1\nZeile 2"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+41 79")).toBe("'+41 79");
    expect(csvCell("@mail")).toBe("'@mail");
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });
});

describe("Admin: Bilder verkleinern", () => {
  it("begrenzt die längere Seite auf 2000 px und behält das Seitenverhältnis", () => {
    expect(targetSize(4000, 5000)).toEqual({ width: 1600, height: 2000 });
    expect(targetSize(6000, 3000)).toEqual({ width: 2000, height: 1000 });
    expect(targetSize(1200, 1500)).toEqual({ width: 1200, height: 1500 });
    expect(targetSize(3001, 1, 2000)).toEqual({ width: 2000, height: 1 });
  });
});

describe("Admin: Adressen (Handles) aus Titeln", () => {
  it("macht aus Titeln gültige Handles", () => {
    expect(slugify("Anzug «Limmat» Marine")).toBe("anzug-limmat-marine");
    expect(slugify("Weste Grösse Ü")).toBe("weste-groesse-ue");
    expect(slugify("  Derby  Lino -- Braun ")).toBe("derby-lino-braun");
    expect(slugify("Ça va?")).toBe("ca-va");
  });
});

describe("Admin: Tage in Zürcher Zeit", () => {
  it("kennt Sommer- und Winterzeit", async () => {
    const { zurichOffsetMinutes } = await import("./dates");
    expect(zurichOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(120);
    expect(zurichOffsetMinutes(new Date("2026-12-01T12:00:00Z"))).toBe(60);
  });
  it("findet Mitternacht in Zürich", async () => {
    const { zurichMidnight, zurichDate } = await import("./dates");
    // 12. Oktober 2026, 00:30 in Zürich = 11. Oktober 22:30 UTC
    const now = new Date("2026-10-11T22:30:00Z");
    expect(zurichMidnight(0, now).toISOString()).toBe("2026-10-11T22:00:00.000Z");
    expect(zurichMidnight(1, now).toISOString()).toBe("2026-10-10T22:00:00.000Z");
    // Über die Umstellung auf Winterzeit (25. Oktober 2026) hinweg
    expect(zurichMidnight(0, new Date("2026-10-26T10:00:00Z")).toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
    expect(zurichMidnight(1, new Date("2026-10-26T10:00:00Z")).toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(zurichDate("2026-03-29")?.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(zurichDate("2026-03-30")?.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(zurichDate("29.03.2026")).toBeNull();
  });
});
