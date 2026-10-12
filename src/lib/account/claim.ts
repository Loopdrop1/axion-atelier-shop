// Gastbestellungen mit derselben bestätigten E-Mail dem Konto zuordnen: einmal pro Anmeldung und Browser-Tab.
// Konto-Seiten warten mit ihren Abfragen auf `done`, damit frisch zugeordnete Bestellungen sofort erscheinen.
import { useEffect } from "react";
import { create } from "zustand";
import { claimGuestOrders } from "./api";

interface ClaimState {
  userId: string | null;
  done: boolean;
  count: number;
}

const useClaimStore = create<ClaimState>(() => ({ userId: null, done: false, count: 0 }));

export function useGuestOrderClaim(userId: string | undefined): { done: boolean; count: number } {
  const state = useClaimStore();
  useEffect(() => {
    if (!userId || useClaimStore.getState().userId === userId) return;
    useClaimStore.setState({ userId, done: false, count: 0 });
    void claimGuestOrders().then((count) => {
      if (useClaimStore.getState().userId === userId) useClaimStore.setState({ done: true, count });
    });
  }, [userId]);
  return state.userId === userId && userId
    ? { done: state.done, count: state.count }
    : { done: false, count: 0 };
}

/** Nach dem Abmelden: beim nächsten Anmelden erneut zuordnen. */
export function resetGuestOrderClaim() {
  useClaimStore.setState({ userId: null, done: false, count: 0 });
}
