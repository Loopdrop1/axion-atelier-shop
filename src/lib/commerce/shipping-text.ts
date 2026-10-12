// Versandzeile für Produktseite, Startseite und Warenkorb, passend zu den Einstellungen im Admin
// (Versandkosten und «Gratisversand ab»).
import type { Locale } from "@/i18n/locale";
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
