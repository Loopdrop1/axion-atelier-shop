export type Locale = "de" | "en";

const formatters: Record<Locale, Intl.NumberFormat> = {
  de: new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }),
  en: new Intl.NumberFormat("en-CH", { style: "currency", currency: "CHF" }),
};

/** CHF-Betrag aus Rappen, gleich formatiert wie im Shop (CHF 1’299.00). */
export function formatChf(cents: number, locale: Locale = "de"): string {
  return formatters[locale].format(cents / 100);
}

export function toLocale(value: unknown): Locale {
  return value === "en" ? "en" : "de";
}
