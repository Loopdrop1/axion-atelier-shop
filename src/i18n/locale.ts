// Sprachen des Shops: Deutsch ohne URL-Präfix, Englisch unter /en.
export type Locale = "de" | "en";

export const LOCALES: readonly Locale[] = ["de", "en"];
export const DEFAULT_LOCALE: Locale = "de";

export function toLocale(value: unknown): Locale {
  return value === "en" ? "en" : "de";
}

/** Wert für den optionalen Routen-Parameter {-$locale}: Deutsch lässt ihn weg. */
export function localeParam(locale: Locale): "en" | undefined {
  return locale === "en" ? "en" : undefined;
}

/** Sprach-Präfix für Pfade: "" oder "/en". */
export function localePrefix(locale: Locale): "" | "/en" {
  return locale === "en" ? "/en" : "";
}

/** BCP-47-Code für <html lang>, Intl und hreflang. */
export function htmlLang(locale: Locale): "de-CH" | "en" {
  return locale === "en" ? "en" : "de-CH";
}

/** Gleicher Pfad in der anderen Sprache: /en/kollektion/x ↔ /kollektion/x (Suche und Anker bleiben). */
export function switchLocalePath(path: string, target: Locale): string {
  const match = path.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] || "/";
  const rest = match?.[2] ?? "";
  const bare = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (target === "de") return bare + rest;
  return (bare === "/" ? "/en" : `/en${bare}`) + rest;
}
