import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as string[][],
  failWith: null as string | null,
}));

vi.mock("@/integrations/supabase/functions", () => ({
  callFunction: vi.fn(async (_name: string, body: { texts: string[] }) => {
    state.calls.push(body.texts);
    if (state.failWith)
      return { ok: false, status: 503, error: state.failWith, body: { error: state.failWith } };
    return { ok: true, data: { translations: body.texts.map((t) => `EN:${t}`) } };
  }),
}));

import { AdminError, translateTexts, translationBatches } from "./api";

beforeEach(() => {
  state.calls = [];
  state.failWith = null;
});

describe("translationBatches", () => {
  it("teilt nach Anzahl und Zeichen, ein einzelner langer Text bekommt ein eigenes Paket", () => {
    const texts = Array.from({ length: 63 }, (_, i) => `T${i}`);
    expect(translationBatches(texts).map((b) => [b.start, b.texts.length])).toEqual([
      [0, 40],
      [40, 23],
    ]);
    const long = ["a".repeat(7000), "b".repeat(7000), "c"];
    expect(translationBatches(long).map((b) => [b.start, b.texts.length])).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(translationBatches([])).toEqual([]);
  });
});

describe("translateTexts", () => {
  it("Grössentabellen mit 63 Texten: zwei Anfragen, Reihenfolge bleibt, leere Texte gehen nicht mit", async () => {
    const texts = Array.from({ length: 64 }, (_, i) => (i === 5 ? " " : `T${i}`));
    const out = await translateTexts(texts);
    expect(state.calls.map((c) => c.length)).toEqual([40, 23]);
    expect(out[0]).toBe("EN:T0");
    expect(out[5]).toBe("");
    expect(out[63]).toBe("EN:T63");
  });

  it("nur leere Texte: keine Anfrage", async () => {
    expect(await translateTexts(["", "  "])).toEqual(["", ""]);
    expect(state.calls).toEqual([]);
  });

  it("Fehler kommen mit Code", async () => {
    state.failWith = "TRANSLATION_UNAVAILABLE";
    const error = await translateTexts(["Anzug"]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdminError);
    expect((error as AdminError).code).toBe("TRANSLATION_UNAVAILABLE");
  });
});
