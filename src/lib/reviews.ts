// Bewertung schreiben (Seite /bewertung/<schlüssel>): Grenzen, Prüfung und Aufruf der Edge Function «review».
// Dieselben Grenzen wie supabase/functions/_shared/reviews.ts (reviews.test.ts hält beide gleich).
import { callFunction } from "@/integrations/supabase/functions";
import type { Locale } from "@/i18n/locale";

export const REVIEW_LIMITS = {
  title: 80,
  bodyMin: 10,
  body: 2000,
  displayName: 40,
} as const;

/** Schlüssel aus dem Link (48 Hex-Zeichen). */
export const REVIEW_TOKEN = /^[0-9a-f]{48}$/;

export interface ReviewItem {
  orderItemId: string;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  handle: string | null;
  reviewed: boolean;
}

export interface ReviewLookup {
  orderNumber: number;
  locale: Locale;
  items: ReviewItem[];
}

export type ReviewProblem =
  | "invalid"
  | "disabled"
  | "duplicate"
  | "itemNotReviewable"
  | "invalidReview"
  | "rateLimited"
  | "notConfigured"
  | "network"
  | "other";

export interface ReviewDraft {
  rating: number;
  title: string;
  body: string;
  displayName: string;
}

export type ReviewFieldError = "rating" | "body" | "displayName" | "title";

/** Prüft das Formular wie die Funktion; leer = alles in Ordnung. */
export function reviewErrors(draft: ReviewDraft): ReviewFieldError[] {
  const errors: ReviewFieldError[] = [];
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5)
    errors.push("rating");
  if (draft.title.trim().length > REVIEW_LIMITS.title) errors.push("title");
  const body = draft.body.trim().length;
  if (body < REVIEW_LIMITS.bodyMin || body > REVIEW_LIMITS.body) errors.push("body");
  const name = draft.displayName.trim().replace(/\s+/g, " ").length;
  if (!name || name > REVIEW_LIMITS.displayName) errors.push("displayName");
  return errors;
}

/** Fehlercode der Edge Function → Problemart für die Anzeige. */
export function reviewProblem(code: string, status: number): ReviewProblem {
  if (status === 429) return "rateLimited";
  switch (code) {
    case "NOT_FOUND":
      return "invalid";
    case "REVIEWS_DISABLED":
      return "disabled";
    case "ALREADY_REVIEWED":
      return "duplicate";
    case "ITEM_NOT_REVIEWABLE":
      return "itemNotReviewable";
    case "INVALID_REVIEW":
      return "invalidReview";
    case "NOT_CONFIGURED":
      return "notConfigured";
    case "NETWORK":
      return "network";
    default:
      return "other";
  }
}

type Outcome<T> = { ok: true; data: T } | { ok: false; problem: ReviewProblem };

async function call<T>(body: Record<string, unknown>): Promise<Outcome<T>> {
  const result = await callFunction<T>("review", body);
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, problem: reviewProblem(result.error, result.status) };
}

export function lookupReview(token: string): Promise<Outcome<ReviewLookup>> {
  return call<ReviewLookup>({ action: "lookup", token });
}

export function submitReview(
  token: string,
  orderItemId: string,
  draft: ReviewDraft,
  locale: Locale,
): Promise<Outcome<{ items: ReviewItem[] }>> {
  return call<{ items: ReviewItem[] }>({
    action: "submit",
    token,
    orderItemId,
    rating: draft.rating,
    title: draft.title.trim(),
    body: draft.body.trim(),
    displayName: draft.displayName.trim(),
    locale,
  });
}
