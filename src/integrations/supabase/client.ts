// Supabase-Client für Shop, Kundenkonto und Admin.
// Ohne VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY (z. B. in der Lovable-Vorschau vor dem Einrichten)
// ist der Client null und der Shop zeigt die Beispieldaten aus src/lib/commerce/sample-catalog.ts.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();
const browser = typeof window !== "undefined";

export const supabaseUrl = url ? url.replace(/\/+$/, "") : null;
export const backendConfigured = Boolean(url && key);

/**
 * Im Browser mit gespeicherter Sitzung (Kundenkonto, Admin); auf dem Server (SSR) ohne Sitzung,
 * nur für öffentliche Daten wie Produkte.
 */
export const supabase: SupabaseClient<Database> | null =
  url && key
    ? createClient<Database>(url, key, {
        auth: {
          persistSession: browser,
          autoRefreshToken: browser,
          detectSessionInUrl: browser,
          storageKey: "axion-auth",
        },
      })
    : null;
