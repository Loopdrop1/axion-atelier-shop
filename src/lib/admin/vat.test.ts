import { describe, expect, it } from "vitest";
import { vatIncluded } from "./vat";

describe("vatIncluded", () => {
  it("rechnet den MWST-Anteil aus dem Bruttobetrag (8.1 %)", () => {
    expect(vatIncluded(10810, 8.1)).toBe(810);
    expect(vatIncluded(49900, 8.1)).toBe(3739); // netto 461.61 + 37.39
    expect(vatIncluded(0, 8.1)).toBe(0);
  });
});
