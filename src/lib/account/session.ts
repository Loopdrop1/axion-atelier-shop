// Anmeldestatus im Browser (Kundenkonto und Admin). Auf dem Server gibt es keine Sitzung.
import { useEffect } from "react";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-client";
import { backendConfigured } from "@/lib/backend";

interface SessionState {
  /** true, sobald der gespeicherte Anmeldestatus gelesen ist */
  ready: boolean;
  session: Session | null;
  user: User | null;
}

export const useSessionStore = create<SessionState>(() => ({
  ready: false,
  session: null,
  user: null,
}));

let started = false;

/**
 * Gibt es im Browser Hinweise auf eine gespeicherte Anmeldung? Der Supabase-Client legt sie unter `sb-<projekt>-auth-token`
 * ab; im Editor-Vorschaurahmen liegt sie beim Editor. Ohne Hinweis muss der Client (50 kB) nicht beim Seitenaufruf laden.
 */
export function mayHaveStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    // Speicher gesperrt: keine Anmeldung nachweisbar
  }
  return window.parent !== window;
}

export function startSessionSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!backendConfigured) {
    useSessionStore.setState({ ready: true });
    return;
  }
  getSupabase()
    .then((supabase) => {
      supabase.auth.onAuthStateChange((_event, session) => {
        useSessionStore.setState({ ready: true, session, user: session?.user ?? null });
      });
      return supabase.auth.getSession();
    })
    .then(({ data }) =>
      useSessionStore.setState({
        ready: true,
        session: data.session,
        user: data.session?.user ?? null,
      }),
    )
    .catch(() => useSessionStore.setState({ ready: true }));
}

/** Aktuelle Sitzung; startet das Mitlesen beim ersten Gebrauch. */
export function useSession(): SessionState {
  useEffect(() => startSessionSync(), []);
  return useSessionStore();
}
