// Sprache aus der URL ({-$locale}) und die passenden Texte.
import { useParams } from "@tanstack/react-router";
import { localeParam, toLocale, type Locale } from "./locale";
import { messages, type Messages } from "./messages";

export * from "./locale";
export { messages, type Messages };

/** Aktuelle Sprache: «en» unter /en, sonst Deutsch (auch im Admin). */
export function useLocale(): Locale {
  const params = useParams({ strict: false }) as { locale?: string };
  return toLocale(params.locale);
}

export function useT(): Messages {
  return messages[useLocale()];
}

/** Für Links: params={{ locale: useLocaleParam(), ... }} behält die Sprache bei. */
export function useLocaleParam(): "en" | undefined {
  return localeParam(useLocale());
}
