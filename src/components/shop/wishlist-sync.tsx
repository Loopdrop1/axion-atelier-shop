import { lazy, Suspense, useCallback, useState } from "react";
import { useT } from "@/i18n";
import { useWishlistSync } from "@/lib/account/wishlist-sync";

const Toaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

/** Gleicht die Merkliste mit dem Konto ab; meldet nur, wenn das Speichern fehlschlug (dann wurde die Änderung zurückgenommen). */
export function WishlistSync() {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const message = t.wishlist.syncFailed;
  const onError = useCallback(() => {
    setFailed(true);
    // sonner erst bei Bedarf laden: Die Meldung ist ein Ausnahmefall
    void import("sonner").then((m) => m.toast.error(message));
  }, [message]);
  useWishlistSync(onError);
  return failed ? (
    <Suspense fallback={null}>
      <Toaster position="bottom-center" />
    </Suspense>
  ) : null;
}
