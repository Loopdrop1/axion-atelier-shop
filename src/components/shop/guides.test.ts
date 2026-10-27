import { describe, expect, it } from "vitest";
import { guideTargetExists } from "./guides";

describe("guideTargetExists", () => {
  const active = new Set(["anzuege", "hemden"]);

  it("blendet Links auf ausgeschaltete Kategorien aus", () => {
    expect(guideTargetExists("/kollektion/anzuege", active)).toBe(true);
    expect(guideTargetExists("/kollektion/schuhe", active)).toBe(false);
  });

  it("behält Anlässe, feste Kollektionen, Ratgeber und Hilfeseiten", () => {
    for (const path of [
      "/kollektion/alle?anlass=hochzeit",
      "/kollektion/neu",
      "/kollektion/sale",
      "/ratgeber/anzug-pflegen",
      "/groessenberatung",
      "/",
    ])
      expect(guideTargetExists(path, active), path).toBe(true);
  });

  it("zeigt alles, solange die Kategorien nicht geladen sind", () => {
    expect(guideTargetExists("/kollektion/schuhe", undefined)).toBe(true);
  });
});
