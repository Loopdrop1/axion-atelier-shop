import { describe, expect, it } from "vitest";
import { shopConfig } from "@/config/shop";
import { ANALYTICS_EXCLUDE, marketingHead, plausibleDomain } from "./marketing";

const base = {
  launched: true,
  analytics: { plausibleDomain: "www.axion-shop.ch" },
  verification: { google: "", bing: "" },
};

describe("Marketing-Kopfzeilen", () => {
  it("ist in der ausgelieferten Konfiguration aus", () => {
    expect(plausibleDomain()).toBe("");
    expect(shopConfig.verification.google).toBe("");
    expect(marketingHead()).toEqual({ scripts: [], meta: [] });
  });

  it("lädt Plausible nur mit Domain, nach dem Livegang, nicht im Admin und nicht in der Entwicklung", () => {
    expect(marketingHead({}, base).scripts).toEqual([
      {
        src: "https://plausible.io/js/script.exclusions.js",
        defer: true,
        "data-domain": "www.axion-shop.ch",
        "data-exclude": ANALYTICS_EXCLUDE,
      },
    ]);
    expect(marketingHead({}, { ...base, launched: false }).scripts).toEqual([]);
    expect(marketingHead({ admin: true }, base).scripts).toEqual([]);
    expect(marketingHead({ dev: true }, base).scripts).toEqual([]);
    expect(marketingHead({}, { ...base, analytics: { plausibleDomain: "" } }).scripts).toEqual([]);
  });

  it("schickt Seiten mit Token im Pfad und das Konto nicht an Plausible", () => {
    const excluded = ANALYTICS_EXCLUDE.split(",");
    for (const path of [
      "/bestellung/*",
      "/en/bestellung/*",
      "/warenkorb/wiederherstellen/*",
      "/en/warenkorb/wiederherstellen/*",
      "/konto/**",
      "/en/konto/**",
    ])
      expect(excluded).toContain(path);
  });

  it("verwirft ungültige Domains (kein Schema, kein Pfad)", () => {
    expect(plausibleDomain({ analytics: { plausibleDomain: " axion-shop.ch " } })).toBe(
      "axion-shop.ch",
    );
    for (const bad of ["https://axion-shop.ch", "axion-shop.ch/shop", "a b.ch", "localhost"])
      expect(plausibleDomain({ analytics: { plausibleDomain: bad } })).toBe("");
  });

  it("setzt Verifizierungs-Tags nur für gefüllte, gültige Werte", () => {
    const config = {
      ...base,
      launched: false,
      verification: { google: "abcDEF123_-xyz0987", bing: "0123456789ABCDEF0123456789ABCDEF" },
    };
    expect(marketingHead({}, config).meta).toEqual([
      { name: "google-site-verification", content: "abcDEF123_-xyz0987" },
      { name: "msvalidate.01", content: "0123456789ABCDEF0123456789ABCDEF" },
    ]);
    const bad = { ...config, verification: { google: '"><script>', bing: "" } };
    expect(marketingHead({}, bad).meta).toEqual([]);
  });
});
