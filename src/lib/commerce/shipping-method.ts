// Versandarten im Warenkorb: Post Economy (Preis bzw. gratis nach shop_settings) und Post Priority (eigener Preis,
// nur angeboten, wenn Admin → Einstellungen einen Preis hat). Gleiche Namen und Regeln wie
// supabase/functions/_shared/shipping.ts und reserve_checkout; shipping-method.test.ts prüft die Gleichheit.
import type { ShopSettings } from "./source";

export const SHIPPING_METHODS = ["economy", "priority"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

/** Unbekannte oder fehlende Werte → «economy» (wie die Edge Function und reserve_checkout). */
export function parseShippingMethod(value: unknown): ShippingMethod {
  return value === "priority" ? "priority" : "economy";
}

/** Name in Kasse, Mails, Admin und Beleg (in beiden Sprachen gleich). */
export const SHIPPING_METHOD_NAMES: Record<ShippingMethod, string> = {
  economy: "Post Economy",
  priority: "Post Priority",
};

/** Priority wird nur mit Preis angeboten (NULL = nicht angeboten). */
export function priorityOffered(settings: Pick<ShopSettings, "priorityShippingCents">): boolean {
  return settings.priorityShippingCents !== null;
}

/** Gewählte Art, wie die Kasse sie verrechnet: Priority ohne Preis gilt als Economy. */
export function effectiveShippingMethod(
  method: ShippingMethod,
  settings: Pick<ShopSettings, "priorityShippingCents">,
): ShippingMethod {
  return method === "priority" && priorityOffered(settings) ? "priority" : "economy";
}
