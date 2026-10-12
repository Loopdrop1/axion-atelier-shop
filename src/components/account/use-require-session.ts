// Seiten im Konto: ohne Anmeldung zur Anmeldeseite (mit Rücksprung).
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { backendConfigured } from "@/integrations/supabase/client";
import { useLocaleParam } from "@/i18n";
import { useSession } from "@/lib/account/session";

/** redirect = false: nicht zur Anmeldung umleiten (z. B. direkt nach dem Löschen des Kontos). */
export function useRequireSession({ redirect = true }: { redirect?: boolean } = {}) {
  const session = useSession();
  const navigate = useNavigate();
  const lp = useLocaleParam();
  const path = useRouterState({
    select: (s) => s.location.pathname.replace(/^\/en(?=\/|$)/, "") || "/",
  });
  useEffect(() => {
    if (!backendConfigured || !redirect) return;
    if (session.ready && !session.user) {
      void navigate({
        to: "/{-$locale}/konto/anmelden",
        params: { locale: lp },
        search: { weiter: path },
        replace: true,
      });
    }
  }, [session.ready, session.user, navigate, lp, path, redirect]);
  return session;
}
