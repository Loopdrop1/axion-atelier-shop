// Retouren im Admin: Abfragen. Rechte prüft die Datenbank (RLS: nur Admins lesen und ändern Status und Notiz).
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { AdminError } from "@/lib/admin/api";
import type { ReturnStatus } from "@/lib/admin/returns";

export interface ReturnRow {
  id: string;
  number: number;
  order_id: string;
  email: string;
  locale: string;
  status: ReturnStatus;
  items: unknown;
  comment: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  orders: { number: number; status: string; total_cents: number; refunded_cents: number } | null;
}

const COLUMNS =
  "id, number, order_id, email, locale, status, items, comment, admin_note, created_at, updated_at, orders(number, status, total_cents, refunded_cents)";

function db() {
  if (!backendConfigured) throw new AdminError("NOT_CONFIGURED");
  return supabase;
}

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  throw new AdminError(/^[A-Z_]+$/.test(error.message) ? error.message : (error.code ?? "UNKNOWN"));
}

export const RETURNS_PAGE_SIZE = 50;

export async function listReturns(
  status: ReturnStatus | "all",
  page: number,
): Promise<{ rows: ReturnRow[]; count: number }> {
  let query = db()
    .from("return_requests")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * RETURNS_PAGE_SIZE, page * RETURNS_PAGE_SIZE + RETURNS_PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  const { data, error, count } = await query;
  fail(error);
  return { rows: (data ?? []) as unknown as ReturnRow[], count: count ?? 0 };
}

/** Anzahl offener (angemeldeter) Retouren, zum Beispiel für ein Zählzeichen. */
export async function countOpenReturns(): Promise<number> {
  const { count, error } = await db()
    .from("return_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "requested");
  fail(error);
  return count ?? 0;
}

export async function getReturn(id: string): Promise<ReturnRow | null> {
  const { data, error } = await db()
    .from("return_requests")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return (data as unknown as ReturnRow | null) ?? null;
}

export async function updateReturn(
  id: string,
  change: { status: ReturnStatus; adminNote: string },
): Promise<void> {
  const { error } = await db()
    .from("return_requests")
    .update({ status: change.status, admin_note: change.adminNote.trim() || null })
    .eq("id", id);
  fail(error);
}
