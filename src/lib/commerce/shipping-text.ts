// Versandzeile für Produktseite, Startseite und Warenkorb, passend zu den Einstellungen im Admin
// (Versandkosten und «Gratisversand ab»).
import type { Locale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { formatCents } from "./format";
import type { ShopSettings } from "./source";

export function shippingLabel(
  settings: Pick<ShopSettings, "shippingCents" | "freeShippingFromCents">,
  locale: Locale,
): string {
  const en = locale === "en";
  if (settings.shippingCents === 0)
    return en ? "Free shipping in Switzerland" : "Gratisversand in der Schweiz";
  if (settings.freeShippingFromCents !== null)
    return en
      ? `Free shipping in Switzerland from ${formatCents(settings.freeShippingFromCents, "en")}`
      : `Gratisversand in der Schweiz ab ${formatCents(settings.freeShippingFromCents, "de")}`;
  return en
    ? `Shipping in Switzerland ${formatCents(settings.shippingCents, "en")}`
    : `Versand in der Schweiz ${formatCents(settings.shippingCents, "de")}`;
}

/** Laufband, solange im Admin keine eigenen Texte stehen: Versandzeile aus den Einstellungen, dann die festen Hinweise. */
export function defaultAnnouncements(
  settings: Pick<ShopSettings, "shippingCents" | "freeShippingFromCents">,
  locale: Locale,
): string[] {
  return [shippingLabel(settings, locale), ...messages[locale].announcements];
}

/** Fortschritt bis «Gratisversand ab». Rechnet wie die Kasse (reserve_checkout): Zwischenbetrag minus Rabatt.
 *  Ohne Versandkosten oder ohne Schwelle gibt es nichts anzuzeigen (null). */
export function freeShippingProgress(
  subtotalCents: number,
  discountCents: number,
  settings: Pick<ShopSettings, "shippingCents" | "freeShippingFromCents">,
): { leftCents: number; ratio: number } | null {
  const from = settings.freeShippingFromCents;
  if (!settings.shippingCents || from === null || from <= 0) return null;
  const amount = Math.max(0, subtotalCents - Math.max(0, discountCents));
  return { leftCents: Math.max(0, from - amount), ratio: Math.min(1, amount / from) };
}
