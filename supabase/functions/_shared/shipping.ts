// Versandarten (Post Economy, Post Priority): Namen, Lieferzeiten und Texte für Kasse, Mails und Post-Etikett.
// Dieselben Werte stehen im Shop (src/config/shop.ts → delivery, src/lib/commerce/shipping-method.ts);
// src/lib/commerce/shipping-method.test.ts prüft die Gleichheit. Preise kommen aus shop_settings (reserve_checkout).
import type { Locale } from "./money.ts";

export const SHIPPING_METHODS = ["economy", "priority"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

/** Unbekannte oder fehlende Werte → «economy» (wie reserve_checkout in der Datenbank). */
export function parseShippingMethod(value: unknown): ShippingMethod {
  return value === "priority" ? "priority" : "economy";
}

/** Name in Stripe, Mails, Admin und Beleg (in beiden Sprachen gleich). */
export const SHIPPING_METHOD_NAMES: Record<ShippingMethod, string> = {
  economy: "Post Economy",
  priority: "Post Priority",
};

/** Arbeitstage vom Versand bis zur Zustellung. Economy wie AGB und FAQ; Priority: Post Priority, von Axion zu bestätigen. */
export const TRANSIT_DAYS: Record<ShippingMethod, { min: number; max: number }> = {
  economy: { min: 2, max: 5 },
  priority: { min: 1, max: 1 },
};

/** «2 bis 5 Arbeitstage» / «am nächsten Arbeitstag» (für Sätze in Mails). */
export function transitPhrase(method: ShippingMethod, locale: Locale): string {
  const { min, max } = TRANSIT_DAYS[method];
  if (min === 1 && max === 1)
    return locale === "en" ? "on the next working day" : "am nächsten Arbeitstag";
  if (min === max) return locale === "en" ? `within ${min} working days` : `in ${min} Arbeitstagen`;
  return locale === "en"
    ? `within ${min} to ${max} working days`
    : `in ${min} bis ${max} Arbeitstagen`;
}

/** Produkt auf dem Post-Etikett: aus der Bestellung; ohne Angabe der Rückfallwert (Secret POST_PRODUCT). */
export function postProductFor(
  method: string | null | undefined,
  fallback: "ECO" | "PRI",
): "ECO" | "PRI" {
  if (method === "priority") return "PRI";
  if (method === "economy") return "ECO";
  return fallback;
}
