// Abmelden und alle Konto-Daten aus dem Zwischenspeicher der Seite entfernen.
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/account/api";
import { resetGuestOrderClaim } from "@/lib/account/claim";

/** Abfrageschlüssel mit persönlichen Daten (werden beim Abmelden gelöscht). */
export const ACCOUNT_QUERY_KEYS = ["my-orders", "my-order", "profile"];

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await signOut();
    resetGuestOrderClaim();
    queryClient.removeQueries({
      predicate: (q) => ACCOUNT_QUERY_KEYS.includes(String(q.queryKey[0])),
    });
  };
}
