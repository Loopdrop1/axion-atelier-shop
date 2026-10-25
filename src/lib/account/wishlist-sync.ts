// Gleicht die Merkliste im Browser mit dem Konto ab: Gäste bleiben lokal; nach der Anmeldung wird vereinigt,
// danach spiegelt der Speicher den Server und Änderungen werden hineingeschrieben. Beim Abmelden bleibt die lokale Kopie
// (wie beim Warenkorb).
import { useEffect, useRef } from "react";
import { backendConfigured } from "@/lib/backend";
import { useSession } from "@/lib/account/session";
import { setWishlistRemote, useWishlist } from "@/lib/commerce/stores";
import {
  addWishlistItems,
  fetchWishlist,
  mergeWishlist,
  removeWishlistItem,
} from "@/lib/account/wishlist";

function whenHydrated(): Promise<void> {
  const persist = useWishlist.persist;
  if (persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

/** Vereinigt Server und lokale Liste, schreibt Fehlendes auf den Server und setzt den Speicher auf das Ergebnis. */
export async function syncWishlist(userId: string): Promise<void> {
  let server = await fetchWishlist(userId);
  // Zwischenzeitlich lokal Hinzugefügtes mitnehmen (höchstens ein paar Runden)
  for (let round = 0; round < 3; round++) {
    const { merged, toUpload } = mergeWishlist(server, useWishlist.getState().handles);
    if (!toUpload.length) {
      useWishlist.getState().replace(merged);
      return;
    }
    await addWishlistItems(userId, toUpload);
    server = [...server, ...toUpload];
  }
  useWishlist.getState().replace(mergeWishlist(server, useWishlist.getState().handles).merged);
}

/** Einmal in der Seitenhülle einbinden. `onError` meldet fehlgeschlagene Schreibzugriffe (Anzeige übernimmt die Seite). */
export function useWishlistSync(onError: (kind: "add" | "remove") => void) {
  const { ready, user } = useSession();
  const userId = user?.id ?? null;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    if (!backendConfigured || !ready) return;
    if (!userId) {
      setWishlistRemote(null);
      return;
    }
    let live = true;
    void (async () => {
      try {
        await whenHydrated();
        await syncWishlist(userId);
        if (!live) return;
        setWishlistRemote({
          add: (handle) => addWishlistItems(userId, [handle]),
          remove: (handle) => removeWishlistItem(userId, handle),
          onError: (kind) => errorRef.current(kind),
        });
      } catch {
        // Ohne Abgleich bleibt die lokale Liste unverändert; beim nächsten Laden wird es erneut versucht.
        if (live) setWishlistRemote(null);
      }
    })();
    return () => {
      live = false;
      setWishlistRemote(null);
    };
  }, [ready, userId]);
}
