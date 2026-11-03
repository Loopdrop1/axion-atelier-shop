// Kundenbewertungen: gemeinsame Regeln für die Edge Function «review» und den Link in der Versandmeldung.
// Dieselben Grenzen stehen in src/lib/reviews.ts (Formular) und in der Tabelle public.reviews; src/lib/reviews.test.ts
// hält Formular und Funktion gleich. Reine Funktionen, ohne Importe.

export const REVIEW_LIMITS = {
  title: 80,
  bodyMin: 10,
  body: 2000,
  displayName: 40,
} as const;

/** Gültigkeit des Links in Tagen (ab dem Schritt «Versendet»). */
export const REVIEW_LINK_DAYS = 90;

/** Schlüssel aus dem Link: 48 Hex-Zeichen (private.random_token). */
export const REVIEW_TOKEN = /^[0-9a-f]{48}$/;

export interface ReviewInput {
  rating: number;
  title: string | null;
  body: string;
  displayName: string;
}

/** Prüft die Eingaben des Formulars; null = ungültig. Leerraum am Rand zählt nicht. */
export function parseReview(value: Record<string, unknown>): ReviewInput | null {
  const rating = value["rating"];
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5)
    return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = text(value["title"]);
  const body = text(value["body"]);
  const displayName = text(value["displayName"]).replace(/\s+/g, " ");
  if (title.length > REVIEW_LIMITS.title) return null;
  if (body.length < REVIEW_LIMITS.bodyMin || body.length > REVIEW_LIMITS.body) return null;
  if (!displayName || displayName.length > REVIEW_LIMITS.displayName) return null;
  return { rating, title: title || null, body, displayName };
}

/** Adresse der Bewertungsseite (Deutsch ohne Präfix, Englisch unter /en). */
export function reviewUrl(siteUrl: string, locale: "de" | "en", token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${locale === "en" ? "/en" : ""}/bewertung/${token}`;
}
