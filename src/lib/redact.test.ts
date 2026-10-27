import { describe, expect, it } from "vitest";
// Gleiche Regeln in der Edge Function «client-error»; läuft hier mit, damit beide gleich bleiben
import * as fn from "../../supabase/functions/_shared/redact";
import { REDACTIONS, redact, URL_IN_TEXT } from "./redact";

const TOKEN = "3f2b8c1e-9d4a-4b7e-a1c2-5e6f7a8b9c0d";

describe("redact", () => {
  it("ersetzt den Bestell-Token im Pfad, auch mit Sprachpräfix und in Adressen", () => {
    expect(redact(`/bestellung/${TOKEN}`)).toBe("/bestellung/:token");
    expect(redact("/en/bestellung/abc123")).toBe("/en/bestellung/:token");
    expect(redact(`at render (https://shop.ch/bestellung/${TOKEN}?x=1#y:10:5)`)).toBe(
      "at render (https://shop.ch/bestellung/:token)",
    );
    expect(redact(`Fehler auf bestellung/${TOKEN}/details`)).toBe(
      "Fehler auf bestellung/:token/details",
    );
  });

  it("ersetzt Bestellnummern im Konto", () => {
    expect(redact("/konto/bestellungen/10042")).toBe("/konto/bestellungen/:nr");
    expect(redact("/en/konto/bestellungen/10042")).toBe("/en/konto/bestellungen/:nr");
  });

  it("ersetzt UUIDs, lange Hex-Folgen und lange Zufallsfolgen", () => {
    expect(redact(`order ${TOKEN} failed`)).toBe("order :id failed");
    expect(redact(`key ${"a1b2c3d4".repeat(4)} x`)).toBe("key :hex x");
    expect(redact("jwt Ab3dEf6hIj9lMn2pQr5tUv8xYz1Bc4De7Fg0 end")).toBe("jwt :tok end");
    expect(redact("token=Ab3dEf6hIj9lMn2pQr5tUv8xYz1Bc4De7Fg0")).toBe("token=:tok");
  });

  it("lässt gewöhnliche Texte, Dateinamen und kurze Kennungen stehen", () => {
    const keep = [
      "TypeError: Cannot read properties of undefined (reading 'map')",
      "at https://shop.ch/assets/index-Ab3dEf6h.js:10:5",
      "/produkt/anzug-limmat",
      "/kollektion/maentel-jacken",
      "someVeryLongFunctionNameWithoutAnyDigitsAtAll",
      "deadbeef",
    ];
    for (const text of keep) expect(redact(text), text).toBe(text);
  });

  it("entfernt Query-String und Fragment aus Adressen im Text", () => {
    expect(redact("Failed https://x.ch/api?token=abc#f now")).toBe("Failed https://x.ch/api now");
  });

  it("ist idempotent", () => {
    const once = redact(`/en/bestellung/${TOKEN} ${TOKEN} /konto/bestellungen/7`);
    expect(redact(once)).toBe(once);
  });

  it("Browser und Edge Function verwenden dieselben Regeln", () => {
    expect(fn.URL_IN_TEXT.source).toBe(URL_IN_TEXT.source);
    expect(fn.REDACTIONS.map(([re, r]) => [re.source, re.flags, r])).toEqual(
      REDACTIONS.map(([re, r]) => [re.source, re.flags, r]),
    );
    for (const sample of [
      `/bestellung/${TOKEN}`,
      "/en/konto/bestellungen/99",
      `x ${"f0".repeat(16)} y https://a.ch/p?q=1`,
      "Ab3dEf6hIj9lMn2pQr5tUv8xYz1Bc4De7Fg0",
    ])
      expect(fn.redact(sample)).toBe(redact(sample));
  });
});
