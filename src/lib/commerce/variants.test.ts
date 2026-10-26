import { describe, expect, it } from "vitest";
import { buildSrcSet, parseVariants, storagePaths, variantPath, variantWidths } from "./variants";

describe("Bildfassungen", () => {
  it("Pfad der Fassung ersetzt die Endung", () => {
    expect(variantPath("anzug/abc.webp", 640)).toBe("anzug/abc-640.webp");
    expect(variantPath("anzug/abc.def.jpg", 1200)).toBe("anzug/abc.def-1200.webp");
    expect(variantPath("kategorien/x", 640)).toBe("kategorien/x-640.webp");
  });

  it("erzeugt nur Breiten, die kleiner sind als das Original", () => {
    expect(variantWidths(2000)).toEqual([640, 1200]);
    expect(variantWidths(1200)).toEqual([640]);
    expect(variantWidths(900)).toEqual([640]);
    expect(variantWidths(640)).toEqual([]);
    expect(variantWidths(500)).toEqual([]);
  });

  it("liest gespeicherte Fassungen, ignoriert Ungültiges und sortiert nach Breite", () => {
    expect(parseVariants(null)).toEqual([]);
    expect(parseVariants({ w: 640 })).toEqual([]);
    expect(
      parseVariants([
        { w: 1200, path: "a-1200.webp" },
        { w: "x", path: "b" },
        { w: 640, path: "a-640.webp" },
        { w: 640 },
        null,
        [],
      ]),
    ).toEqual([
      { w: 640, path: "a-640.webp" },
      { w: 1200, path: "a-1200.webp" },
    ]);
  });

  it("Speicherpfade eines Bildes: Original und Fassungen, eingebaute Bilder keine", () => {
    expect(storagePaths("p/a.webp", [{ w: 640, path: "p/a-640.webp" }])).toEqual([
      "p/a.webp",
      "p/a-640.webp",
    ]);
    expect(storagePaths("p/a.webp", null)).toEqual(["p/a.webp"]);
    expect(storagePaths("asset:muster/x-1", null)).toEqual([]);
  });

  it("srcset aus Fassungen und Original", () => {
    const main = { url: "https://s/a.webp", width: 2000 };
    expect(buildSrcSet(main, undefined)).toBeUndefined();
    expect(buildSrcSet(main, [])).toBeUndefined();
    expect(
      buildSrcSet(main, [
        { url: "https://s/a-1200.webp", width: 1200 },
        { url: "https://s/a-640.webp", width: 640 },
      ]),
    ).toBe("https://s/a-640.webp 640w, https://s/a-1200.webp 1200w, https://s/a.webp 2000w");
  });

  it("srcset lässt Fassungen weg, die nicht kleiner sind als das Original", () => {
    const main = { url: "https://s/a.webp", width: 1000 };
    expect(buildSrcSet(main, [{ url: "https://s/a-1200.webp", width: 1200 }])).toBeUndefined();
    expect(
      buildSrcSet(main, [
        { url: "https://s/a-640.webp", width: 640 },
        { url: "https://s/a-1200.webp", width: 1200 },
      ]),
    ).toBe("https://s/a-640.webp 640w, https://s/a.webp 1000w");
  });
});
