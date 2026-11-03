// Kundenbewertungen im Admin: Liste, Freigeben/Ablehnen, Notiz, Löschen (auf Wunsch der Person).
// Rechte prüft die Datenbank (RLS: nur Admins lesen, ändern Status und Notiz, löschen). Migration 20261104002700/Cloud 0026.
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { AdminError } from "@/lib/admin/api";

export type ReviewStatus = "pending" | "approved" | "rejected";

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: "warn" | "ok" | "muted" }> =
  {
    pending: { label: "Zu prüfen", tone: "warn" },
    approved: { label: "Freigegeben", tone: "ok" },
    rejected: { label: "Abgelehnt", tone: "muted" },
  };

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  locale: string;
  status: ReviewStatus;
  admin_note: string | null;
  created_at: string;
  approved_at: string | null;
  products: { handle: string; title_de: string } | null;
  orders: { id: string; number: number } | null;
}

const COLUMNS =
  "id, rating, title, body, display_name, locale, status, admin_note, created_at, approved_at, products(handle, title_de), orders(id, number)";

function db() {
  if (!backendConfigured) throw new AdminError("NOT_CONFIGURED");
  return supabase;
}

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  throw new AdminError(/^[A-Z_]+$/.test(error.message) ? error.message : (error.code ?? "UNKNOWN"));
}

export const REVIEWS_PAGE_SIZE = 50;

export async function listReviews(
  status: ReviewStatus | "all",
  page: number,
): Promise<{ rows: AdminReview[]; count: number }> {
  let query = db()
    .from("reviews")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * REVIEWS_PAGE_SIZE, page * REVIEWS_PAGE_SIZE + REVIEWS_PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  const { data, error, count } = await query;
  fail(error);
  return { rows: (data ?? []) as unknown as AdminReview[], count: count ?? 0 };
}

export async function updateReview(
  id: string,
  values: { status?: ReviewStatus; admin_note?: string | null },
): Promise<void> {
  const { error } = await db().from("reviews").update(values).eq("id", id);
  fail(error);
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await db().from("reviews").delete().eq("id", id);
  fail(error);
}
