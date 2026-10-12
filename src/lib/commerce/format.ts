import type { Locale } from "@/i18n/locale";
import type { Money } from "./types";

const price = {
  de: new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }),
  en: new Intl.NumberFormat("en-CH", { style: "currency", currency: "CHF" }),
};

/** Franken-Betrag (Money oder Zahl in CHF) im Schweizer Format: CHF 1’299.00 */
export const formatPrice = (value: Money | number, locale: Locale = "de") =>
  price[locale].format(typeof value === "number" ? value : value.amount);

/** Rappen → Franken-Text */
export const formatCents = (cents: number, locale: Locale = "de") =>
  price[locale].format(cents / 100);

export const formatDate = (iso: string, locale: Locale = "de") =>
  new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
