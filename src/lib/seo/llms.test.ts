import { describe, expect, it } from "vitest";
import { shopConfig } from "@/config/shop";
import { buildLlmsTxt } from "./llms";

describe("buildLlmsTxt", () => {
  it("beschreibt Shop, Kollektionen und Hilfeseiten mit absoluten Links", () => {
    const txt = buildLlmsTxt(
      [{ handle: "anzuege", title: "Anzüge", description: "Zweiteiler und Dreiteiler." }],
      "Gratisversand in der Schweiz",
    );
    expect(txt.startsWith(`# ${shopConfig.brand}\n`)).toBe(true);
    expect(txt).toContain(
      `- [Anzüge](${shopConfig.siteUrl}/kollektion/anzuege): Zweiteiler und Dreiteiler.`,
    );
    expect(txt).toContain(`${shopConfig.siteUrl}/haeufige-fragen`);
    expect(txt).toContain("Gratisversand in der Schweiz");
    expect(txt).toContain("keine Massanfertigung");
  });
});
