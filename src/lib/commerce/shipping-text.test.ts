import { describe, expect, it } from "vitest";
import { shippingLabel } from "./shipping-text";

describe("shippingLabel", () => {
  it("folgt den Einstellungen: gratis, gratis ab Betrag, Pauschale", () => {
    expect(shippingLabel({ shippingCents: 0, freeShippingFromCents: null }, "de")).toBe(
      "Gratisversand in der Schweiz",
    );
    expect(shippingLabel({ shippingCents: 900, freeShippingFromCents: 15000 }, "de")).toMatch(
      /^Gratisversand in der Schweiz ab CHF\s150\.00$/,
    );
    expect(shippingLabel({ shippingCents: 900, freeShippingFromCents: null }, "en")).toMatch(
      /^Shipping in Switzerland CHF\s9\.00$/,
    );
    expect(shippingLabel({ shippingCents: 0, freeShippingFromCents: 15000 }, "en")).toBe(
      "Free shipping in Switzerland",
    );
  });
});
