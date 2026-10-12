import { describe, expect, it } from "vitest";
import { outfitKey } from "./outfit-key";

describe("Produktseite: gewählte Grösse bleibt bei neu geladenen Daten", () => {
  it("ändert den Schlüssel nicht, wenn dieselben Outfit-Teile als neue Objekte kommen", () => {
    const loaded = [{ handle: "weste-limmat-marine" }, { handle: "derby-cognac" }];
    const refetched = loaded.map((p) => ({ ...p }));
    expect(refetched).not.toBe(loaded);
    expect(outfitKey(refetched)).toBe(outfitKey(loaded));
  });

  it("ändert den Schlüssel, wenn andere Outfit-Teile gezeigt werden", () => {
    expect(outfitKey([{ handle: "a" }, { handle: "b" }])).not.toBe(outfitKey([{ handle: "a" }]));
    expect(outfitKey([])).toBe("");
  });
});
