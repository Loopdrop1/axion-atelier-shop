// Merkliste auf dem Server (Tabelle wishlist_items, RLS: nur eigene Zeilen). Gäste bleiben beim lokalen Speicher.
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";

/** Höchstzahl pro Konto (gleich wie der Trigger in der Datenbank) und Länge eines Handles. */
export const WISHLIST_MAX = 200;
export const WISHLIST_HANDLE_MAX = 200;

/** Nur gültige, einmalige Handles in der ursprünglichen Reihenfolge. */
export function normalizeHandles(list: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const h of list)
    if (typeof h === "string" && h.length >= 1 && h.length <= WISHLIST_HANDLE_MAX) seen.add(h);
  return [...seen];
}

/**
 * Führt Server- und lokale Merkliste zusammen (Vereinigung, Server zuerst, höchstens WISHLIST_MAX).
 * `toUpload` sind die Handles, die der Server noch nicht kennt.
 */
export function mergeWishlist(
  remote: readonly string[],
  local: readonly string[],
): { merged: string[]; toUpload: string[] } {
  const server = normalizeHandles(remote);
  const known = new Set(server);
  const extra = normalizeHandles(local).filter((h) => !known.has(h));
  const toUpload = extra.slice(0, Math.max(0, WISHLIST_MAX - server.length));
  return { merged: [...server, ...toUpload], toUpload };
}

interface Result<T = unknown> extends PromiseLike<{ data: T | null; error: Error | null }> {
  eq(column: string, value: string): Result<T>;
  order(column: string, opts: { ascending: boolean }): Result<T>;
}
interface Table {
  select(columns: string): Result<{ handle: string }[]>;
  upsert(
    rows: { user_id: string; handle: string }[],
    opts: { onConflict: string; ignoreDuplicates: boolean },
  ): Result;
  delete(): Result;
}
// Die generierte Typdatei kennt die Tabelle nicht: ungetypt ansprechen.
const table = (): Table =>
  (supabase as unknown as { from(name: string): Table }).from("wishlist_items");

/** Handles der angemeldeten Person, älteste zuerst. */
export async function fetchWishlist(userId: string): Promise<string[]> {
  if (!backendConfigured) return [];
  const { data, error } = await table()
    .select("handle")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.handle);
}

/** Legt Handles an; bereits vorhandene bleiben unberührt. */
export async function addWishlistItems(userId: string, handles: string[]): Promise<void> {
  if (!backendConfigured || !handles.length) return;
  const { error } = await table().upsert(
    handles.map((handle) => ({ user_id: userId, handle })),
    { onConflict: "user_id,handle", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function removeWishlistItem(userId: string, handle: string): Promise<void> {
  if (!backendConfigured) return;
  const { error } = await table().delete().eq("user_id", userId).eq("handle", handle);
  if (error) throw error;
}
