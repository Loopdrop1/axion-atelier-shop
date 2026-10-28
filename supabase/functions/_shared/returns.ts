// Retoure anmelden: gemeinsame Regeln für die Edge Function «return-request» (Gründe, Bestellnummer, Positionen).
// Dieselben Gründe und dieselbe Bestellnummer-Regel stehen in src/lib/returns.ts; src/lib/returns.test.ts prüft die Gleichheit.
import { UUID } from "./http.ts";

export const RETURN_REASONS = [
  "too_small",
  "too_large",
  "style",
  "quality",
  "wrong_item",
  "other",
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const MAX_RETURN_COMMENT = 1000;

/** «AX-10001», «#10001» oder «10001» → 10001; sonst null. */
export function parseOrderNumber(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const match = /^\s*(?:ax-?|#)?\s*(\d{1,12})\s*$/i.exec(text);
  return match ? Number(match[1]) : null;
}

/** Kennung einer Retoure in Mails und im Admin. */
export const returnRef = (number: number) => `R-${number}`;

export interface ReturnItemInput {
  orderItemId: string;
  quantity: number;
  reason: ReturnReason;
}

/** Prüft die Positionen aus dem Formular: 1 bis 20 verschiedene Positionen, Menge 1 bis 10, bekannter Grund. */
export function parseReturnItems(value: unknown): ReturnItemInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const seen = new Set<string>();
  const out: ReturnItemInput[] = [];
  for (const entry of value as unknown[]) {
    if (!entry || typeof entry !== "object") return null;
    const e = entry as Record<string, unknown>;
    const id = typeof e["orderItemId"] === "string" ? e["orderItemId"].toLowerCase() : "";
    const quantity = e["quantity"];
    const reason = e["reason"];
    if (!UUID.test(id) || seen.has(id)) return null;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    )
      return null;
    if (typeof reason !== "string" || !(RETURN_REASONS as readonly string[]).includes(reason))
      return null;
    seen.add(id);
    out.push({ orderItemId: id, quantity, reason: reason as ReturnReason });
  }
  return out;
}

export const REASON_LABELS = {
  de: {
    too_small: "Zu klein",
    too_large: "Zu gross",
    style: "Gefällt mir nicht",
    quality: "Qualität",
    wrong_item: "Falsches Stück erhalten",
    other: "Anderer Grund",
  },
  en: {
    too_small: "Too small",
    too_large: "Too large",
    style: "Not to my taste",
    quality: "Quality",
    wrong_item: "Wrong item received",
    other: "Other reason",
  },
} as const satisfies Record<"de" | "en", Record<ReturnReason, string>>;

export function reasonLabel(reason: string, locale: "de" | "en"): string {
  return (REASON_LABELS[locale] as Record<string, string>)[reason] ?? reason;
}
