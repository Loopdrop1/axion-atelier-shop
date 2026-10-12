import { describe, expect, it } from "vitest";
import { jsonLd } from "./json-ld";

describe("JSON-LD", () => {
  it("lässt kein Script-Ende und keine Zeilentrenner durch, bleibt gültiges JSON", () => {
    const value = { description: "Edel </script><script>alert(1)</script>\u2028Zeile" };
    const out = jsonLd(value);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain("\u2028");
    expect(JSON.parse(out)).toEqual(value);
  });
});
