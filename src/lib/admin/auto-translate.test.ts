import { describe, expect, it, vi } from "vitest";
import { autoTranslate, planTranslation, translationNote, type Pairs } from "./auto-translate";

const fake = vi.fn(async (texts: string[]) => texts.map((t) => `EN: ${t}`));

describe("planTranslation", () => {
  it("neues Feld: Deutsch da, Englisch leer → übersetzen", () => {
    expect(planTranslation({}, { title: { de: "Anzug", en: "" } })).toEqual({
      translate: ["title"],
      clear: [],
    });
  });

  it("Deutsch geändert, Englisch nicht angefasst → neu übersetzen (Englisch folgt dem Deutschen)", () => {
    const before = { title: { de: "Anzug", en: "Suit" } };
    expect(
      planTranslation(before, { title: { de: "Anzug Limmat", en: "Suit" } }).translate,
    ).toEqual(["title"]);
  });

  it("Englisch von Hand geändert → bleibt, auch wenn Deutsch mitgeändert wurde", () => {
    const before = { title: { de: "Anzug", en: "Suit" } };
    expect(
      planTranslation(before, { title: { de: "Anzug Limmat", en: "Limmat suit" } }).translate,
    ).toEqual([]);
    expect(planTranslation(before, { title: { de: "Anzug", en: "The suit" } }).translate).toEqual(
      [],
    );
  });

  it("nichts geändert und Englisch vorhanden → nichts tun; nur Leerzeichen zählen nicht als Änderung", () => {
    const before = { title: { de: "Anzug", en: "Suit" } };
    expect(planTranslation(before, { title: { de: "Anzug ", en: "Suit" } })).toEqual({
      translate: [],
      clear: [],
    });
  });

  it("Deutsch gelöscht, Englisch nicht angefasst → Englisch auch löschen", () => {
    const before = { care: { de: "Chemisch reinigen", en: "Dry clean" } };
    expect(planTranslation(before, { care: { de: "", en: "Dry clean" } })).toEqual({
      translate: [],
      clear: ["care"],
    });
  });

  it("nur Englisch ohne Deutsch (von Hand) bleibt stehen", () => {
    expect(planTranslation({}, { care: { de: "", en: "Dry clean" } })).toEqual({
      translate: [],
      clear: [],
    });
  });
});

describe("autoTranslate", () => {
  it("füllt die Übersetzungen ein und zählt sie", async () => {
    const before: Pairs = { title: { de: "Anzug", en: "Suit" }, care: { de: "", en: "" } };
    const after: Pairs = {
      title: { de: "Anzug", en: "Suit" },
      care: { de: "Nicht waschen", en: "" },
    };
    const result = await autoTranslate(before, after, fake);
    expect(result).toEqual({
      pairs: {
        title: { de: "Anzug", en: "Suit" },
        care: { de: "Nicht waschen", en: "EN: Nicht waschen" },
      },
      translated: 1,
      failed: false,
    });
  });

  it("ohne Bedarf keine Anfrage", async () => {
    const translate = vi.fn(async (texts: string[]) => texts);
    const pairs = { title: { de: "Anzug", en: "Suit" } };
    expect(await autoTranslate(pairs, pairs, translate)).toEqual({
      pairs,
      translated: 0,
      failed: false,
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it("kürzt auf die erlaubte Länge", async () => {
    const result = await autoTranslate(
      {},
      { color: { de: "Blau", en: "" } },
      async () => ["Dark navy blue"],
      {
        color: 9,
      },
    );
    expect(result.pairs["color"]!.en).toBe("Dark navy");
  });

  it("Übersetzung scheitert: veraltetes Englisch wird geleert (Shop zeigt Deutsch), leeres bleibt leer", async () => {
    const before: Pairs = { title: { de: "Anzug", en: "Suit" }, care: { de: "", en: "" } };
    const after: Pairs = {
      title: { de: "Weste", en: "Suit" },
      care: { de: "Nicht waschen", en: "" },
    };
    const result = await autoTranslate(before, after, async () => {
      throw new Error("TRANSLATION_UNAVAILABLE");
    });
    expect(result).toEqual({
      pairs: { title: { de: "Weste", en: "" }, care: { de: "Nicht waschen", en: "" } },
      translated: 0,
      failed: true,
    });
  });

  it("löscht Englisch, wenn Deutsch gelöscht wurde", async () => {
    const result = await autoTranslate(
      { care: { de: "Nicht waschen", en: "Do not wash" } },
      { care: { de: "", en: "Do not wash" } },
      fake,
    );
    expect(result.pairs["care"]).toEqual({ de: "", en: "" });
  });
});

describe("translationNote", () => {
  it("sagt, was passiert ist", () => {
    expect(translationNote({ pairs: {}, translated: 0, failed: false })).toBe("");
    expect(translationNote({ pairs: {}, translated: 1, failed: false })).toContain(
      "automatisch ins Englische übersetzt",
    );
    expect(translationNote({ pairs: {}, translated: 0, failed: true })).toContain("deutsche Text");
  });
});
