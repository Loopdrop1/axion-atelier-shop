import { describe, expect, it } from "vitest";
import { readEnv } from "./env.ts";
import { isAllowedOrigin } from "./http.ts";

const env = (values: Record<string, string>) => readEnv((k) => values[k]);

describe("readEnv: Liefergebiet", () => {
  it("liefert ohne Einstellung nur in die Schweiz", () => {
    expect(env({}).shippingCountries).toEqual(["CH"]);
  });

  it("nimmt Liechtenstein nur, wenn es eingestellt ist", () => {
    expect(env({ SHIPPING_COUNTRIES: "ch, li" }).shippingCountries).toEqual(["CH", "LI"]);
  });

  it("ignoriert Länder, für die Shop und Rechtstexte nicht vorbereitet sind", () => {
    expect(env({ SHIPPING_COUNTRIES: "DE,LI,LI" }).shippingCountries).toEqual(["LI"]);
    expect(env({ SHIPPING_COUNTRIES: "DE" }).shippingCountries).toEqual(["CH"]);
    expect(env({ SHIPPING_COUNTRIES: "" }).shippingCountries).toEqual(["CH"]);
  });
});

describe("readEnv: erlaubte Domains", () => {
  it("Vorschau und localhost nur mit ALLOW_PREVIEW_ORIGINS=1", () => {
    const strict = env({ SITE_URL: "https://shop.test" }).allowedOrigins;
    expect(isAllowedOrigin("https://shop.test", strict)).toBe(true);
    expect(isAllowedOrigin("https://boese.lovable.app", strict)).toBe(false);
    expect(isAllowedOrigin("http://localhost:5173", strict)).toBe(false);
    const preview = env({
      SITE_URL: "https://shop.test",
      ALLOW_PREVIEW_ORIGINS: "1",
    }).allowedOrigins;
    expect(isAllowedOrigin("https://id-preview--abc.lovable.app", preview)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", preview)).toBe(true);
    expect(isAllowedOrigin("https://boese.example", preview)).toBe(false);
  });
});

describe("readEnv: Übersetzung", () => {
  it("nimmt ohne Einstellung das Lovable AI Gateway mit dem Projektschlüssel", () => {
    expect(env({ LOVABLE_API_KEY: "lov_key" }).translate).toEqual({
      apiBase: "https://ai.gateway.lovable.dev/v1",
      apiKey: "lov_key",
      model: "google/gemini-2.5-flash",
    });
  });

  it("eigener Dienst und eigenes Modell gehen vor", () => {
    expect(
      env({
        LOVABLE_API_KEY: "lov_key",
        TRANSLATE_API_BASE: "https://api.example.com/v1",
        TRANSLATE_API_KEY: "own_key",
        TRANSLATE_MODEL: "own-model",
      }).translate,
    ).toEqual({ apiBase: "https://api.example.com/v1", apiKey: "own_key", model: "own-model" });
  });

  it("ohne Schlüssel bleibt er leer (Übersetzung meldet dann «nicht verfügbar»)", () => {
    expect(env({}).translate.apiKey).toBe("");
  });
});
