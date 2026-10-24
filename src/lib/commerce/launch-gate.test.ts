// Launch-Gate: `launched` ist ein Schalter mit Folgen (Indexierung, Metadaten, Rechtstexte). Diese Tests schlagen an,
// wenn robots.txt nicht zum Schalter passt oder Platzhalter beim Livegang übrig sind.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { shopConfig } from "@/config/shop";
import { robotsTxt } from "../../../scripts/robots-txt";

const root = resolve(__dirname, "../../..");

describe("Launch-Gate", () => {
  it("public/robots.txt entspricht dem Generator für shopConfig.launched (bun scripts/sync-robots.ts)", () => {
    const file = readFileSync(resolve(root, "public/robots.txt"), "utf8");
    expect(file).toBe(robotsTxt(shopConfig));
  });

  it("der Generator sperrt vor dem Livegang alles und danach nur Privates", () => {
    expect(robotsTxt({ launched: false, siteUrl: "https://x.ch" })).toBe(
      "User-agent: *\nDisallow: /\n",
    );
    const open = robotsTxt({ launched: true, siteUrl: "https://x.ch" });
    expect(open).toContain("Allow: /\n");
    expect(open).toContain("Disallow: /admin");
    expect(open).toContain("Disallow: /en/konto");
    expect(open).toContain("Sitemap: https://x.ch/sitemap.xml");
  });

  it("beim Livegang bleibt kein Platzhalter in Kontaktdaten und Adresse", () => {
    if (!shopConfig.launched) return;
    for (const [key, value] of Object.entries(shopConfig.contact)) {
      // phone und hours sind freiwillig: leer ist erlaubt, ein Platzhalter nicht
      expect(value.trim().startsWith("["), `contact.${key} ist noch ein Platzhalter`).toBe(false);
    }
    expect(shopConfig.siteUrl).not.toMatch(/\[|localhost|example\./);
  });

  it("mit MWST-Pflicht hat die UID das Format CHE-123.456.789", () => {
    if (!(shopConfig.launched && shopConfig.vatRegistered)) return;
    expect(shopConfig.contact.uid).toMatch(/^CHE-\d{3}\.\d{3}\.\d{3}$/);
  });
});
