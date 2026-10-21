import type { Locale } from "@/i18n/locale";
import type { Money } from "./types";

const price = {
  de: new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }),
  en: new Intl.NumberFormat("en-CH", { style: "currency", currency: "CHF" }),
};

/** Franken-Betrag (Money oder Zahl in CHF) im Schweizer Format: CHF 1’299.00 */
/** Rabatt in ganzen Prozent gegenüber dem Streichpreis (0, wenn kein echter Abschlag). */
export const discountPercent = (price: Money, compareAt: Money | undefined) =>
  compareAt && compareAt.amount > price.amount
    ? Math.round((1 - price.amount / compareAt.amount) * 100)
    : 0;

export const formatPrice = (value: Money | number, locale: Locale = "de") =>
  price[locale].format(typeof value === "number" ? value : value.amount);

const francs = {
  de: new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }),
  en: new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }),
};

/** Ganze Franken ohne Rappen (für Betragsknöpfe): CHF 100 */
export const formatFrancs = (cents: number, locale: Locale = "de") =>
  francs[locale].format(Math.round(cents / 100));

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
