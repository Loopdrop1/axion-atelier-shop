import { describe, expect, it } from "vitest";
import { shopConfig } from "@/config/shop";
import { messages } from "@/i18n";
import { DEFAULT_SETTINGS, estimateTotals, shippingFor } from "./source";
import { deliveryConfigFor, estimateDelivery } from "./delivery";
import {
  effectiveShippingMethod,
  parseShippingMethod,
  priorityOffered,
  SHIPPING_METHOD_NAMES,
  SHIPPING_METHODS,
} from "./shipping-method";
// Gleiche Regeln in den Edge Functions und dieselben Fälle wie der Backend-Test von reserve_checkout
import {
  parseShippingMethod as serverParse,
  postProductFor,
  SHIPPING_METHOD_NAMES as SERVER_NAMES,
  SHIPPING_METHODS as SERVER_METHODS,
  TRANSIT_DAYS,
  transitPhrase,
} from "../../../supabase/functions/_shared/shipping";
import { SHIPPING_CASES } from "../../../supabase/tests/shipping-cases";

describe("Versandarten: Shop und Edge Functions gleich", () => {
  it("gleiche Arten, Namen und Lieferzeiten", () => {
    expect([...SHIPPING_METHODS]).toEqual([...SERVER_METHODS]);
    expect(SHIPPING_METHOD_NAMES).toEqual(SERVER_NAMES);
    expect(TRANSIT_DAYS.economy).toEqual(shopConfig.delivery.transitDays);
    expect(TRANSIT_DAYS.priority).toEqual(shopConfig.delivery.priorityTransitDays);
  });

  it("Unbekanntes gilt überall als Economy", () => {
    for (const value of ["priority", "economy", "Priority", "express", "", null, undefined, 1])
      expect(parseShippingMethod(value), String(value)).toBe(serverParse(value));
    expect(parseShippingMethod("express")).toBe("economy");
  });

  it("Priority nur mit Preis", () => {
    const off = { ...DEFAULT_SETTINGS };
    const on = { ...DEFAULT_SETTINGS, priorityShippingCents: 1200 };
    expect(priorityOffered(off)).toBe(false);
    expect(priorityOffered(on)).toBe(true);
    expect(priorityOffered({ priorityShippingCents: 0 })).toBe(true);
    expect(effectiveShippingMethod("priority", off)).toBe("economy");
    expect(effectiveShippingMethod("priority", on)).toBe("priority");
    expect(effectiveShippingMethod("economy", on)).toBe("economy");
  });

  it("Post-Etikett: Produkt aus der Bestellung, sonst Rückfallwert", () => {
    expect(postProductFor("priority", "ECO")).toBe("PRI");
    expect(postProductFor("economy", "PRI")).toBe("ECO");
    expect(postProductFor(null, "PRI")).toBe("PRI");
    expect(postProductFor(undefined, "ECO")).toBe("ECO");
  });

  it("Texte zur Zustellung in Mails und Warenkorb", () => {
    expect(transitPhrase("economy", "de")).toBe("in 2 bis 5 Arbeitstagen");
    expect(transitPhrase("priority", "de")).toBe("am nächsten Arbeitstag");
    expect(transitPhrase("priority", "en")).toBe("on the next working day");
    const d = shopConfig.delivery;
    expect(messages.de.checkout.transit(d.transitDays.min, d.transitDays.max)).toBe(
      "in 2 bis 5 Arbeitstagen",
    );
    expect(
      messages.de.checkout.priorityHint(
        d.dispatchCutoff,
        messages.de.checkout.transit(d.priorityTransitDays.min, d.priorityTransitDays.max),
      ),
    ).toBe(
      "Versand am selben Arbeitstag bei Bestellung bis 14 Uhr, Zustellung in der Regel am nächsten Arbeitstag",
    );
    expect(messages.en.checkout.transit(1, 1)).toBe("usually on the next working day");
  });
});

describe("estimateTotals mit Versandart (gleiche Fälle wie reserve_checkout)", () => {
  it.each(SHIPPING_CASES.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const settings = { ...DEFAULT_SETTINGS, ...c.settings };
    const t = estimateTotals(
      c.subtotalCents,
      c.discountCents,
      c.giftCents,
      settings,
      parseShippingMethod(c.method),
    );
    expect({
      shippingMethod: t.shippingMethod,
      shippingCents: t.shippingCents,
      discountCents: t.discountCents,
      giftCardCents: t.giftCardCents,
      totalCents: t.totalCents,
    }).toEqual(c.expected);
  });

  it("ohne Versandart wie bisher (Economy)", () => {
    const settings = { ...DEFAULT_SETTINGS, shippingCents: 900, priorityShippingCents: 1500 };
    expect(estimateTotals(10000, 0, 0, settings)).toMatchObject({
      shippingCents: 900,
      shippingMethod: "economy",
    });
    expect(shippingFor(10000, settings)).toBe(900);
    expect(shippingFor(10000, settings, "priority")).toBe(1500);
  });
});

describe("Lieferschätzung je Versandart", () => {
  it("Priority: gleicher Annahmeschluss, Zustellung am nächsten Arbeitstag nach dem Versand", () => {
    // Montag, 2. November 2026, 10:00 in Zürich (vor 14 Uhr): Versand heute
    const monday = new Date("2026-11-02T09:00:00Z");
    expect(estimateDelivery(monday, deliveryConfigFor("priority"))).toEqual({
      dispatch: "2026-11-02",
      min: "2026-11-03",
      max: "2026-11-03",
    });
    expect(estimateDelivery(monday, deliveryConfigFor("economy"))).toEqual(
      estimateDelivery(monday),
    );
    // Freitag nach 14 Uhr: Versand Montag, Zustellung Dienstag
    expect(
      estimateDelivery(new Date("2026-11-06T15:00:00Z"), deliveryConfigFor("priority")),
    ).toEqual({ dispatch: "2026-11-09", min: "2026-11-10", max: "2026-11-10" });
  });
});
