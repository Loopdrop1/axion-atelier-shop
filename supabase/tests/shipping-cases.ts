// Versandfälle, die reserve_checkout (shipping-method.test.ts im Backend) und estimateTotals im Shop
// (src/lib/commerce/shipping-method.test.ts) gleich rechnen müssen. Ein Stück zum Preis subtotalCents,
// Rabatt als Betragscode, Gutschein mit Guthaben giftCents.
export interface ShippingCase {
  name: string;
  settings: {
    shippingCents: number;
    freeShippingFromCents: number | null;
    priorityShippingCents: number | null;
  };
  subtotalCents: number;
  discountCents: number;
  giftCents: number;
  /** Wie vom Warenkorb geschickt (auch Unbekanntes) */
  method: string;
  expected: {
    shippingMethod: "economy" | "priority";
    shippingCents: number;
    discountCents: number;
    giftCardCents: number;
    totalCents: number;
  };
}

const standard = { shippingCents: 900, freeShippingFromCents: 20000, priorityShippingCents: 1500 };

export const SHIPPING_CASES: ShippingCase[] = [
  {
    name: "Economy unter der Gratis-Schwelle: Pauschale",
    settings: standard,
    subtotalCents: 10000,
    discountCents: 0,
    giftCents: 0,
    method: "economy",
    expected: {
      shippingMethod: "economy",
      shippingCents: 900,
      discountCents: 0,
      giftCardCents: 0,
      totalCents: 10900,
    },
  },
  {
    name: "Economy über der Gratis-Schwelle: gratis",
    settings: standard,
    subtotalCents: 25000,
    discountCents: 0,
    giftCents: 0,
    method: "economy",
    expected: {
      shippingMethod: "economy",
      shippingCents: 0,
      discountCents: 0,
      giftCardCents: 0,
      totalCents: 25000,
    },
  },
  {
    name: "Priority über der Gratis-Schwelle: Priority-Preis gilt immer",
    settings: standard,
    subtotalCents: 25000,
    discountCents: 0,
    giftCents: 0,
    method: "priority",
    expected: {
      shippingMethod: "priority",
      shippingCents: 1500,
      discountCents: 0,
      giftCardCents: 0,
      totalCents: 26500,
    },
  },
  {
    name: "Priority mit Rabatt unter der Schwelle",
    settings: standard,
    subtotalCents: 10000,
    discountCents: 2000,
    giftCents: 0,
    method: "priority",
    expected: {
      shippingMethod: "priority",
      shippingCents: 1500,
      discountCents: 2000,
      giftCardCents: 0,
      totalCents: 9500,
    },
  },
  {
    name: "Priority ohne Preis: Economy",
    settings: { ...standard, priorityShippingCents: null },
    subtotalCents: 25000,
    discountCents: 0,
    giftCents: 0,
    method: "priority",
    expected: {
      shippingMethod: "economy",
      shippingCents: 0,
      discountCents: 0,
      giftCardCents: 0,
      totalCents: 25000,
    },
  },
  {
    name: "Unbekannte Versandart: Economy",
    settings: standard,
    subtotalCents: 10000,
    discountCents: 0,
    giftCents: 0,
    method: "express",
    expected: {
      shippingMethod: "economy",
      shippingCents: 900,
      discountCents: 0,
      giftCardCents: 0,
      totalCents: 10900,
    },
  },
  {
    name: "Priority, Rabatt liesse unter CHF 0.50: Rabatt gekürzt, keine Gratis-Schwelle",
    settings: { shippingCents: 30, freeShippingFromCents: 15, priorityShippingCents: 30 },
    subtotalCents: 1000,
    discountCents: 995,
    giftCents: 0,
    method: "priority",
    expected: {
      shippingMethod: "priority",
      shippingCents: 30,
      discountCents: 980,
      giftCardCents: 0,
      totalCents: 50,
    },
  },
  {
    name: "Economy, gleicher Fall: weniger Rabatt erreicht die Schwelle, ohne Versand auf 50 Rappen",
    settings: { shippingCents: 30, freeShippingFromCents: 15, priorityShippingCents: 30 },
    subtotalCents: 1000,
    discountCents: 995,
    giftCents: 0,
    method: "economy",
    expected: {
      shippingMethod: "economy",
      shippingCents: 0,
      discountCents: 950,
      giftCardCents: 0,
      totalCents: 50,
    },
  },
  {
    name: "Priority, Gutschein deckt alles inklusive Versand",
    settings: standard,
    subtotalCents: 10000,
    discountCents: 0,
    giftCents: 20000,
    method: "priority",
    expected: {
      shippingMethod: "priority",
      shippingCents: 1500,
      discountCents: 0,
      giftCardCents: 11500,
      totalCents: 0,
    },
  },
];
