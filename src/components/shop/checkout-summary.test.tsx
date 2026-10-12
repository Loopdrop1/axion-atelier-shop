import { describe, expect, it } from "vitest";
import { normalizeGiftCode } from "./checkout-summary";

describe("Gutscheincode eingeben", () => {
  it("bringt Codes mit Leerzeichen, Kleinbuchstaben oder ohne Striche in die Form AXN-XXXX-XXXX-XXXX", () => {
    expect(normalizeGiftCode("axn-ab12-cd34-ef56")).toBe("AXN-AB12-CD34-EF56");
    expect(normalizeGiftCode(" AXN AB12 CD34 EF56 ")).toBe("AXN-AB12-CD34-EF56");
    expect(normalizeGiftCode("axnab12cd34ef56")).toBe("AXN-AB12-CD34-EF56");
  });

  it("lässt andere Eingaben fast unverändert (Prüfung macht der Server)", () => {
    expect(normalizeGiftCode(" sommer10 ")).toBe("SOMMER10");
    expect(normalizeGiftCode("AXN-123")).toBe("AXN-123");
  });
});
