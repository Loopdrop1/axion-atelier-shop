// Warenkorb aus dem Link der Erinnerungs-E-Mail wiederherstellen: Der Server liefert nur Variante und Menge
// (RPC restore_cart_by_token); Anzeige, Preise und Bestand kommen wie überall über den Commerce-Adapter.
import { getSupabase } from "@/lib/supabase-client";
import { backendConfigured } from "@/lib/backend";
import { lineMax } from "./stores";
import type { Cart } from "./types";

export interface RestoreLine {
  variantId: string;
  quantity: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Positionen der abgebrochenen Bestellung; leer bei ungültigem, abgelaufenem oder fremdem Token. */
export async function fetchRestoreLines(token: string): Promise<RestoreLine[]> {
  if (!backendConfigured || !UUID.test(token)) return [];
  const { data, error } = await (
    await getSupabase()
  ).rpc("restore_cart_by_token", { p_token: token });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return (data as unknown[]).flatMap((row) => {
    const r = row as { variant_id?: unknown; quantity?: unknown };
    return typeof r.variant_id === "string" &&
      typeof r.quantity === "number" &&
      Number.isInteger(r.quantity) &&
      r.quantity > 0
      ? [{ variantId: r.variant_id, quantity: r.quantity }]
      : [];
  });
}

export interface RestorePlan {
  /** Was in den Warenkorb kommt (Menge schon auf den Bestand gekürzt) */
  adds: { variantId: string; quantity: number; stock: number }[];
  /** Positionen, die nicht mehr verfügbar sind */
  unavailable: number;
  /** Mindestens eine Menge wurde wegen Bestand oder Höchstmenge gekürzt */
  reduced: boolean;
}

/** Gleicht die gewünschten Positionen mit dem aktuellen Katalog (resolveCart) und dem Bestand ab. */
export function planRestore(wanted: RestoreLine[], resolved: Cart): RestorePlan {
  const adds: RestorePlan["adds"] = [];
  let unavailable = 0;
  let reduced = false;
  for (const line of wanted) {
    const found = resolved.lines.find((l) => l.variantId === line.variantId);
    if (!found || !found.variant.availableForSale || found.variant.stock <= 0) {
      unavailable += 1;
      continue;
    }
    const quantity = Math.min(line.quantity, lineMax(found.variant.stock));
    if (quantity < line.quantity) reduced = true;
    adds.push({ variantId: line.variantId, quantity, stock: found.variant.stock });
  }
  return { adds, unavailable, reduced };
}

export type RestoreOutcome = "done" | "partial" | "none" | "invalid";

/** Legt den Plan in den Warenkorb (über dessen add, das Bestand und Höchstmenge zusätzlich prüft). */
export function applyRestore(
  wanted: RestoreLine[],
  plan: RestorePlan,
  add: (id: string, quantity: number, stock: number) => { added: number },
): RestoreOutcome {
  if (wanted.length === 0) return "invalid";
  let added = 0;
  let reduced = plan.reduced;
  for (const a of plan.adds) {
    const result = add(a.variantId, a.quantity, a.stock);
    added += result.added;
    if (result.added < a.quantity) reduced = true;
  }
  if (added === 0 && plan.adds.length === 0) return "none";
  return plan.unavailable > 0 || reduced ? "partial" : "done";
}
