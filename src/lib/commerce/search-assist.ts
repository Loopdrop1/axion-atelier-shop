// KI-Hilfe für die Suche: übersetzt längere Sätze in Filter (Edge Function «search-assist»).
// Nur wenn die lokale Suche den Satz nicht sicher versteht; Antworten bleiben pro Sitzung im Browser,
// damit dieselbe Frage kein zweites Mal KI-Guthaben kostet.
import { backendConfigured } from "@/lib/backend";
import { callFunction } from "@/integrations/supabase/functions";
import type { Locale } from "@/i18n/locale";
import { normalize, type SearchIntent, type SearchResult } from "./smart-search";

const CACHE_KEY = "axion-search-assist";

/** Ab drei Wörtern und nur, wenn lokal nichts Exaktes gefunden wurde oder Wörter unverstanden blieben. */
export function wantsAssist(query: string, result: SearchResult): boolean {
  if (!backendConfigured) return false;
  const words = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  if (words.length < 3 || query.length > 300) return false;
  return result.relaxed || !result.products.length || result.intent.terms.length >= 2;
}

function cached(): Record<string, Partial<SearchIntent> | null> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "{}") as Record<
      string,
      Partial<SearchIntent> | null
    >;
  } catch {
    return {};
  }
}

export async function askSearchAssist(
  query: string,
  locale: Locale,
): Promise<Partial<SearchIntent> | null> {
  const key = `${locale}:${normalize(query).trim()}`;
  const memory = cached();
  if (key in memory) return memory[key] ?? null;
  const result = await callFunction<{ intent: Partial<SearchIntent> | null }>("search-assist", {
    q: query,
    locale,
  });
  // Bei Ratenlimit oder Fehler: lokale Ergebnisse bleiben, nichts merken (später erneut möglich)
  if (!result.ok) return null;
  const intent = result.data.intent;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...memory, [key]: intent }));
  } catch {
    // Speicher nicht verfügbar: nur ohne Zwischenspeicher
  }
  return intent;
}
