// Fehlerberichte nach Fingerprint gruppieren (Admin → Fehler). Reine Funktion, damit sie testbar bleibt.
import type { ClientErrorRow } from "./api";

export interface ErrorGroup {
  fingerprint: string;
  /** Summe der Zähler aller Einträge dieses Fehlers */
  count: number;
  firstSeen: string;
  lastSeen: string;
  /** Angaben des jüngsten Eintrags */
  message: string;
  path: string;
  stack: string | null;
  release: string | null;
  userAgent: string | null;
}

/** Neueste zuerst. */
export function groupClientErrors(rows: ClientErrorRow[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const row of rows) {
    const existing = groups.get(row.fingerprint);
    if (!existing) {
      groups.set(row.fingerprint, {
        fingerprint: row.fingerprint,
        count: row.count,
        firstSeen: row.created_at,
        lastSeen: row.last_seen_at,
        message: row.message,
        path: row.path,
        stack: row.stack,
        release: row.release,
        userAgent: row.user_agent,
      });
      continue;
    }
    existing.count += row.count;
    if (row.created_at < existing.firstSeen) existing.firstSeen = row.created_at;
    if (row.last_seen_at > existing.lastSeen) {
      existing.lastSeen = row.last_seen_at;
      existing.message = row.message;
      existing.path = row.path;
      existing.stack = row.stack;
      existing.release = row.release;
      existing.userAgent = row.user_agent;
    }
  }
  return [...groups.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
