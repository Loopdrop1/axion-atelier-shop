import { describe, expect, it, vi } from "vitest";
import {
  autoList,
  autoTranslate,
  needsReview,
  planTranslation,
  translationNote,
  type AutoTranslateResult,
  type Pairs,
} from "./auto-translate";

const fake = () => vi.fn(async (texts: string[]) => texts.map((t) => `EN: ${t}`));
const failing = (code: string) =>
  vi.fn(async (): Promise<string[]> => {
    throw Object.assign(new Error(code), { code });
  });

describe("planTranslation", () => {
  it("Englisch leer → übersetzen (neues Feld oder bewusst geleert)", () => {
    expect(planTranslation({}, { title: { de: "Anzug", en: "" } }).translate).toEqual(["title"]);
    const before = { title: { de: "Anzug", en: "Tailored suit" } };
    expect(planTranslation(before, { title: { de: "Anzug", en: " " } }).translate).toEqual([
      "title",
    ]);
  });

  it("Deutsch geändert, Englisch maschinell → neu übersetzen", () => {
    const before = { title: { de: "Anzug", en: "Suit", auto: true } };
    expect(
      planTranslation(before, { title: { de: "Anzug Limmat", en: "Suit" } }).translate,
    ).toEqual(["title"]);
  });

  it("Deutsch geändert, Englisch von Hand (gespeichert) → bleibt, Hinweis zum Prüfen", () => {
    const before = { description: { de: "Reine Wolle", en: "Pure new wool, hand-finished" } };
    const plan = planTranslation(before, {
      description: { de: "Reine Schurwolle", en: "Pure new wool, hand-finished" },
    });
    expect(plan.translate).toEqual([]);
    expect(plan.stale).toEqual(["description"]);
  });

  it("Englisch in dieser Sitzung von Hand geändert → eigenes Englisch, auch wenn Deutsch mitgeändert", () => {
    const before = { title: { de: "Anzug", en: "Suit", auto: true } };
    expect(planTranslation(before, { title: { de: "Anzug Limmat", en: "Limmat suit" } })).toEqual({
      translate: [],
      clear: [],
      stale: [],
      manual: ["title"],
    });
  });

  it("nichts geändert → nichts tun; nur Leerzeichen zählen nicht als Änderung", () => {
    const before = { title: { de: "Anzug", en: "Suit", auto: true } };
    expect(planTranslation(before, { title: { de: "Anzug ", en: "Suit " } })).toEqual({
      translate: [],
      clear: [],
      stale: [],
      manual: [],
    });
  });

  it("Deutsch gelöscht: maschinelles Englisch fällt weg, eigenes bleibt mit Hinweis", () => {
    expect(
      planTranslation(
        { care: { de: "Chemisch reinigen", en: "Dry clean", auto: true } },
        { care: { de: "", en: "Dry clean" } },
      ).clear,
    ).toEqual(["care"]);
    const own = planTranslation(
      { care: { de: "Chemisch reinigen", en: "Dry clean only" } },
      { care: { de: "", en: "Dry clean only" } },
    );
    expect(own.clear).toEqual([]);
    expect(own.stale).toEqual(["care"]);
  });

  it("nur Englisch ohne Deutsch (schon so gespeichert) bleibt still stehen", () => {
    const pairs = { care: { de: "", en: "Dry clean" } };
    expect(planTranslation(pairs, pairs)).toEqual({
      translate: [],
      clear: [],
      stale: [],
      manual: [],
    });
  });
});

describe("autoTranslate", () => {
  it("füllt Übersetzungen ein, markiert sie als maschinell und zählt sie", async () => {
    const before: Pairs = { title: { de: "Anzug", en: "Suit" }, care: { de: "", en: "" } };
    const after: Pairs = {
      title: { de: "Anzug", en: "Suit" },
      care: { de: "Nicht waschen", en: "" },
    };
    expect(await autoTranslate(before, after, fake())).toEqual({
      pairs: {
        title: { de: "Anzug", en: "Suit", auto: false },
        care: { de: "Nicht waschen", en: "EN: Nicht waschen", auto: true },
      },
      translated: 1,
      error: null,
      stale: [],
    });
  });

  it("Ben korrigiert Englisch von Hand, Wochen später ändert Axion das Deutsch: Bens Text bleibt", async () => {
    const translate = fake();
    // 1. Speichern: Englisch wird maschinell übersetzt
    const first = await autoTranslate({}, { d: { de: "Reine Wolle", en: "" } }, translate);
    expect(first.pairs["d"]).toEqual({ de: "Reine Wolle", en: "EN: Reine Wolle", auto: true });
    // 2. Speichern: Ben schreibt das Englisch neu
    const second = await autoTranslate(
      first.pairs,
      { d: { de: "Reine Wolle", en: "Pure new wool" } },
      translate,
    );
    expect(second.pairs["d"]).toEqual({ de: "Reine Wolle", en: "Pure new wool", auto: false });
    // 3. Speichern: Axion korrigiert das Deutsch
    const third = await autoTranslate(
      second.pairs,
      { d: { de: "Reine Schurwolle", en: "Pure new wool" } },
      translate,
    );
    expect(third.pairs["d"]!.en).toBe("Pure new wool");
    expect(third.stale).toEqual(["d"]);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("Übersetzung fällt aus: eigenes Englisch bleibt, veraltetes maschinelles fällt weg", async () => {
    const before: Pairs = {
      own: { de: "Reine Wolle", en: "Pure new wool" },
      machine: { de: "Anzug", en: "Suit", auto: true },
      fresh: { de: "", en: "" },
    };
    const after: Pairs = {
      own: { de: "Reine Schurwolle", en: "Pure new wool" },
      machine: { de: "Weste", en: "Suit" },
      fresh: { de: "Nicht waschen", en: "" },
    };
    const result = await autoTranslate(before, after, failing("TRANSLATION_UNAVAILABLE"));
    expect(result).toEqual({
      pairs: {
        own: { de: "Reine Schurwolle", en: "Pure new wool", auto: false },
        machine: { de: "Weste", en: "", auto: false },
        fresh: { de: "Nicht waschen", en: "", auto: false },
      },
      translated: 0,
      error: "TRANSLATION_UNAVAILABLE",
      stale: ["own"],
    });
  });

  it("Fehler ohne Code: TRANSLATION_FAILED", async () => {
    const result = await autoTranslate({}, { t: { de: "Anzug", en: "" } }, async () => {
      throw new Error("kaputt");
    });
    expect(result.error).toBe("TRANSLATION_FAILED");
  });

  it("ohne Bedarf keine Anfrage", async () => {
    const translate = fake();
    const pairs = { title: { de: "Anzug", en: "Suit", auto: true } };
    expect(await autoTranslate(pairs, pairs, translate)).toEqual({
      pairs,
      translated: 0,
      error: null,
      stale: [],
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it("kürzt auf die erlaubte Länge; leere Übersetzung bleibt leer und gilt nicht als maschinell", async () => {
    const result = await autoTranslate(
      {},
      { color: { de: "Blau", en: "" }, x: { de: "–", en: "" } },
      async () => ["Dark navy blue", ""],
      { color: 9 },
    );
    expect(result.pairs["color"]).toEqual({ de: "Blau", en: "Dark navy", auto: true });
    expect(result.pairs["x"]).toEqual({ de: "–", en: "", auto: false });
    expect(result.translated).toBe(1);
  });

  it("löscht maschinelles Englisch, wenn das Deutsch gelöscht wurde", async () => {
    const result = await autoTranslate(
      { care: { de: "Nicht waschen", en: "Do not wash", auto: true } },
      { care: { de: "", en: "Do not wash" } },
      fake(),
    );
    expect(result.pairs["care"]).toEqual({ de: "", en: "", auto: false });
  });
});

describe("autoList, needsReview, translationNote", () => {
  const result = (r: Partial<AutoTranslateResult>): AutoTranslateResult => ({
    pairs: {},
    translated: 0,
    error: null,
    stale: [],
    ...r,
  });

  it("autoList: nur Felder mit maschinellem Englisch", () => {
    expect(
      autoList({
        b: { de: "x", en: "X", auto: true },
        a: { de: "y", en: "Y", auto: true },
        c: { de: "z", en: "Z" },
        d: { de: "w", en: "", auto: true },
      }),
    ).toEqual(["a", "b"]);
  });

  it("sagt, was passiert ist", () => {
    expect(translationNote(result({}))).toBe("");
    expect(needsReview(result({ translated: 2 }))).toBe(false);
    expect(translationNote(result({ translated: 1 }))).toContain(
      "automatisch ins Englische übersetzt",
    );
    const failed = translationNote(result({ error: "DAILY_LIMIT" }), () => "Tageslimit erreicht.");
    expect(failed).toContain("(Tageslimit erreicht)");
    expect(failed).toContain("deutsche Text");
    const stale = translationNote(
      result({ stale: ["description"], labels: { description: "Beschreibung" } }),
    );
    expect(stale).toContain("Ein deutscher Text hat sich geändert (Beschreibung)");
    expect(needsReview(result({ stale: ["description"] }))).toBe(true);
  });
});
