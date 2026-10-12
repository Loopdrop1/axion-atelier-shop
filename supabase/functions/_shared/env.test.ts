import { describe, expect, it } from "vitest";
import { readEnv } from "./env.ts";

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
