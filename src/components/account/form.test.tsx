import { describe, expect, it } from "vitest";
import { safeNext } from "./form";

describe("Rücksprung nach Anmeldung und Bestätigung", () => {
  it("lässt interne Pfade zu und entfernt das Sprachpräfix", () => {
    expect(safeNext("/konto")).toBe("/konto");
    expect(safeNext("/konto/bestellungen/1042")).toBe("/konto/bestellungen/1042");
    expect(safeNext("/en/konto/daten")).toBe("/konto/daten");
    expect(safeNext("/en")).toBe("/");
    expect(safeNext("/warenkorb?abgebrochen=1")).toBe("/warenkorb?abgebrochen=1");
    expect(safeNext("/english-page")).toBe("/english-page");
  });

  it("weist fremde und verdächtige Ziele ab", () => {
    for (const bad of [
      "https://evil.example/konto",
      "//evil.example",
      "/en//evil.example",
      "/en/\\evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "konto",
      "/konto\n/evil",
      "",
      undefined,
      42,
    ])
      expect(safeNext(bad)).toBe("/konto");
    expect(safeNext("//evil.example", "/")).toBe("/");
  });
});
