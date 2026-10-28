// Retouren im Admin (Seite «Retouren»): Status, Gründe und Positionen aus der Datenbank, ohne Netzwerk, damit testbar.
// Gründe: gleiche Liste wie im Formular (src/lib/returns.ts) und in der Edge Function «return-request».
import { RETURN_REASONS } from "@/lib/returns";

export const RETURN_STATUSES = ["requested", "received", "refunded", "rejected"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_STATUS: Record<
  ReturnStatus,
  { label: string; tone: "warn" | "neutral" | "ok" | "muted"; hint: string }
> = {
  requested: {
    label: "Angemeldet",
    tone: "warn",
    hint: "Die Kundschaft hat die Retoure angemeldet; die Stücke sind noch unterwegs.",
  },
  received: {
    label: "Eingegangen",
    tone: "neutral",
    hint: "Die Rücksendung ist da. Jetzt prüfen, in der Bestellung einbuchen und erstatten.",
  },
  refunded: {
    label: "Erstattet",
    tone: "ok",
    hint: "Der Betrag ist zurückerstattet.",
  },
  rejected: {
    label: "Abgelehnt",
    tone: "muted",
    hint: "Die Retoure wird nicht angenommen. Die Menge ist für eine neue Anmeldung wieder frei.",
  },
};

export function returnStatusLabel(status: string): string {
  return RETURN_STATUS[status as ReturnStatus]?.label ?? status;
}

export const RETURN_REASON_LABELS: Record<(typeof RETURN_REASONS)[number], string> = {
  too_small: "Zu klein",
  too_large: "Zu gross",
  style: "Gefällt nicht",
  quality: "Qualität",
  wrong_item: "Falsches Stück erhalten",
  other: "Anderer Grund",
};

export function returnReasonLabel(reason: string): string {
  return (RETURN_REASON_LABELS as Record<string, string>)[reason] ?? reason;
}

export interface ReturnLine {
  orderItemId: string;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  quantity: number;
  reason: string;
}

/** Positionen der Retoure (jsonb) in eine feste Form bringen; Unbrauchbares wird übersprungen. */
export function parseReturnLines(items: unknown): ReturnLine[] {
  if (!Array.isArray(items)) return [];
  const out: ReturnLine[] = [];
  for (const raw of items as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === "string" && v ? v : null);
    out.push({
      orderItemId: text(e["order_item_id"]) ?? "",
      title: text(e["title"]) ?? "–",
      size: text(e["size"]),
      color: text(e["color"]),
      image: text(e["image"]),
      quantity: typeof e["quantity"] === "number" ? e["quantity"] : 0,
      reason: text(e["reason"]) ?? "other",
    });
  }
  return out;
}

/** Stückzahl einer Retoure. */
export function returnPieces(items: unknown): number {
  return parseReturnLines(items).reduce((sum, l) => sum + l.quantity, 0);
}

/** Retourennummer wie in den E-Mails (R-1001). */
export const returnRef = (number: number) => `R-${number}`;
