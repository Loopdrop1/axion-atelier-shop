// Anmeldestatus im Browser (Kundenkonto und Admin). Auf dem Server gibt es keine Sitzung.
import { useEffect } from "react";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

export function startSessionSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!backendConfigured) {
    useSessionStore.setState({ ready: true });
    return;
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    useSessionStore.setState({ ready: true, session, user: session?.user ?? null });
  });
  supabase.auth
    .getSession()
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
