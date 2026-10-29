// Grössenfilter: Zahlen, dann Buchstaben in Reihenfolge, Einheitsgrösse zuletzt.
import { describe, expect, it } from "vitest";
import { bySize } from "./collection";

describe("bySize", () => {
  it("sortiert Zahlen, Bereiche, Buchstaben und Einheitsgrösse", () => {
    const input = ["One Size", "XL", "100", "M", "39–42", "S", "46", "XXL", "L", "85", "43–46"];
    expect([...input].sort(bySize)).toEqual([
      "39–42",
      "43–46",
      "46",
      "85",
      "100",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "One Size",
    ]);
  });
});
