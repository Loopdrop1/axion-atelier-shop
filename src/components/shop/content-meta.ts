import { messages, type Locale } from "@/i18n";

export const contentHandles = [
  "ueber-uns",
  "haeufige-fragen",
  "kontakt",
  "groessenberatung",
  "versand-und-rueckgabe",
  "impressum",
  "datenschutz",
  "agb",
] as const;
export type ContentHandle = (typeof contentHandles)[number];

/**
 * Titel und Beschreibung einer Inhaltsseite in der gewünschten Sprache (für head).
 * Eigene Datei, damit die Routen (und damit jede Seite) nicht die Seitentexte mitladen.
 */
export function contentMeta(handle: ContentHandle, locale: Locale) {
  return messages[locale].pages[handle];
}
