// Retoure anmelden (Seite /retoure): Gründe, Bestellnummer und Aufruf der Edge Function «return-request».
// Gründe und Bestellnummer-Regel sind dieselben wie in supabase/functions/_shared/returns.ts; returns.test.ts prüft das.
import { callFunction } from "@/integrations/supabase/functions";

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
export function parseOrderNumber(value: string): number | null {
  const match = /^\s*(?:ax-?|#)?\s*(\d{1,12})\s*$/i.exec(value);
  return match ? Number(match[1]) : null;
}

export interface ReturnItem {
  orderItemId: string;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  /** noch zurückgebbare Menge */
  quantity: number;
}

export interface ReturnLookup {
  orderNumber: number;
  /** ISO-Zeitpunkt, bis zu dem die Rückgabe möglich ist */
  deadline: string;
  items: ReturnItem[];
}

export type ReturnProblem =
  | "notFound"
  | "windowClosed"
  | "nothingReturnable"
  | "itemsNotReturnable"
  | "rateLimited"
  | "commentTooLong"
  | "notConfigured"
  | "network"
  | "other";

export interface ReturnFailure {
  problem: ReturnProblem;
  /** nur bei windowClosed: Länge der Frist in Tagen */
  returnDays?: number | undefined;
}

/** Fehlercode der Edge Function → Problemart für die Anzeige. */
export function returnProblem(code: string, status: number): ReturnProblem {
  if (status === 429) return "rateLimited";
  switch (code) {
    case "NOT_FOUND":
      return "notFound";
    case "RETURN_WINDOW_CLOSED":
      return "windowClosed";
    case "NOTHING_RETURNABLE":
      return "nothingReturnable";
    case "ITEMS_NOT_RETURNABLE":
      return "itemsNotReturnable";
    case "COMMENT_TOO_LONG":
      return "commentTooLong";
    case "NOT_CONFIGURED":
      return "notConfigured";
    case "NETWORK":
      return "network";
    default:
      return "other";
  }
}

type Outcome<T> = { ok: true; data: T } | ({ ok: false } & ReturnFailure);

async function call<T>(body: Record<string, unknown>): Promise<Outcome<T>> {
  const result = await callFunction<T>("return-request", body);
  if (result.ok) return { ok: true, data: result.data };
  const days = result.body["returnDays"];
  return {
    ok: false,
    problem: returnProblem(result.error, result.status),
    returnDays: typeof days === "number" ? days : undefined,
  };
}

export function lookupReturn(orderNumber: string, email: string): Promise<Outcome<ReturnLookup>> {
  return call<ReturnLookup>({ action: "lookup", orderNumber, email: email.trim() });
}

export interface ReturnSelection {
  orderItemId: string;
  quantity: number;
  reason: ReturnReason;
}

export interface ReturnReceipt {
  returnNumber: string;
  orderNumber: number;
  emailed: boolean;
}

export function submitReturn(args: {
  orderNumber: string;
  email: string;
  items: ReturnSelection[];
  comment: string;
  locale: string;
  requestId: string;
  website: string;
}): Promise<Outcome<ReturnReceipt>> {
  return call<ReturnReceipt>({ action: "submit", ...args, email: args.email.trim() });
}

/** Auswahl im Formular: je Position gewählt, Menge, Grund (leer = noch keiner). */
export interface Draft {
  checked: boolean;
  quantity: number;
  reason: ReturnReason | "";
}

export type DraftError = "noItem" | "noReason" | null;

/** Prüft die Auswahl und liefert die Positionen für die Anmeldung. */
export function selectionFrom(
  items: ReturnItem[],
  drafts: Record<string, Draft | undefined>,
): { error: DraftError; selection: ReturnSelection[] } {
  const selection: ReturnSelection[] = [];
  let missingReason = false;
  for (const item of items) {
    const d = drafts[item.orderItemId];
    if (!d?.checked) continue;
    if (!d.reason) {
      missingReason = true;
      continue;
    }
    selection.push({
      orderItemId: item.orderItemId,
      quantity: Math.min(Math.max(Math.trunc(d.quantity) || 1, 1), item.quantity),
      reason: d.reason,
    });
  }
  if (missingReason) return { error: "noReason", selection: [] };
  if (!selection.length) return { error: "noItem", selection: [] };
  return { error: null, selection };
}
