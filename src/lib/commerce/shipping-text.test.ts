import { describe, expect, it } from "vitest";
import { defaultAnnouncements, freeShippingProgress, shippingLabel } from "./shipping-text";

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
  it("Schwelle 0 heisst immer gratis, nie «ab CHF 0.00»", () => {
    expect(shippingLabel({ shippingCents: 900, freeShippingFromCents: 0 }, "de")).toBe(
      "Gratisversand in der Schweiz",
    );
    expect(shippingLabel({ shippingCents: 900, freeShippingFromCents: 0 }, "en")).toBe(
      "Free shipping in Switzerland",
    );
  });
});

describe("freeShippingProgress", () => {
  const settings = { shippingCents: 900, freeShippingFromCents: 15000 };
  it("rechnet wie die Kasse: Zwischenbetrag minus Rabatt", () => {
    expect(freeShippingProgress(16000, 0, settings)).toEqual({ leftCents: 0, ratio: 1 });
    expect(freeShippingProgress(16000, 2000, settings)).toEqual({
      leftCents: 1000,
      ratio: 14000 / 15000,
    });
  });
  it("zeigt nichts ohne Versandkosten oder Schwelle", () => {
    expect(freeShippingProgress(100, 0, { shippingCents: 0, freeShippingFromCents: 15000 })).toBe(
      null,
    );
    expect(freeShippingProgress(100, 0, { shippingCents: 900, freeShippingFromCents: null })).toBe(
      null,
    );
  });
});

describe("defaultAnnouncements", () => {
  it("beginnt mit der Versandzeile aus den Einstellungen", () => {
    expect(
      defaultAnnouncements({ shippingCents: 900, freeShippingFromCents: null }, "de")[0],
    ).toMatch(/^Versand in der Schweiz CHF\s9\.00$/);
  });
});
