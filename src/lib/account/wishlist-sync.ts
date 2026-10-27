// Gleicht die Merkliste im Browser mit dem Konto ab: Gäste bleiben lokal; nach der Anmeldung wird vereinigt,
// danach spiegelt der Speicher den Server und Änderungen werden hineingeschrieben. Der Speicher merkt sich, zu welchem
// Konto die Liste gehört; beim Abmelden wird eine Kontoliste geleert (gemeinsam genutzte Browser).
import { useEffect, useRef, useState } from "react";
import { backendConfigured } from "@/lib/backend";
import { mayHaveStoredSession, startSessionSync, useSessionStore } from "@/lib/account/session";
import { setWishlistRemote, trackWishlistIntents, useWishlist } from "@/lib/commerce/stores";
import {
  addWishlistItems,
  fetchWishlist,
  mergeWishlist,
  normalizeHandles,
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

/**
 * Gleicht die lokale Liste mit dem Konto ab und setzt den Speicher auf das Ergebnis.
 * - Besitzer `null` (echte Gästeliste, erste Anmeldung): vereinigen und Fehlendes hochladen.
 * - Besitzer = diese Person: der Server gilt, die lokale Kopie wird nur ersetzt (sonst käme ein auf einem anderen Gerät
 *   entfernter Eintrag zurück).
 * - Anderer Besitzer (gemeinsam genutzter Browser): lokale Liste verwerfen, nichts hochladen.
 * Änderungen, die während des Abgleichs lokal vorgenommen werden, gewinnen gegen den Serverstand.
 */
export async function syncWishlist(
  userId: string,
  isLive: () => boolean = () => true,
): Promise<void> {
  const { intents, stop } = trackWishlistIntents();
  try {
    let server = normalizeHandles(await fetchWishlist(userId));
    for (let round = 0; round < 4; round++) {
      const { owner, handles } = useWishlist.getState();
      const removed = new Set([...intents].filter(([, add]) => !add).map(([h]) => h));
      const added = [...intents].filter(([, add]) => add).map(([h]) => h);
      const candidates = owner === null ? handles : added;
      const { toUpload: upload } = mergeWishlist(server, candidates);
      const toUpload = upload.filter((h) => !removed.has(h));
      const toDelete = server.filter((h) => removed.has(h));
      if (toUpload.length || toDelete.length) {
        if (toUpload.length) await addWishlistItems(userId, toUpload);
        for (const h of toDelete) await removeWishlistItem(userId, h);
        server = [...server.filter((h) => !removed.has(h)), ...toUpload];
        continue;
      }
      if (isLive()) useWishlist.getState().replace(server, userId);
      return;
    }
    if (isLive()) useWishlist.getState().replace(server, userId);
  } finally {
    stop();
  }
}

/** Einmal in der Seitenhülle einbinden. `onError` meldet fehlgeschlagene Schreibzugriffe (Anzeige übernimmt die Seite). */
export function useWishlistSync(onError: (kind: "add" | "remove") => void) {
  // Nur den Speicher lesen: Der Supabase-Client wird für Gäste ohne gespeicherte Anmeldung nicht geladen.
  const { ready, user } = useSessionStore();
  const userId = user?.id ?? null;
  // null = noch nicht geprüft, false = sicher keine gespeicherte Anmeldung
  const [possible, setPossible] = useState<boolean | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    if (!backendConfigured) return;
    const check = () => {
      const p = mayHaveStoredSession();
      setPossible(p);
      if (p) startSessionSync();
    };
    check();
    // Anmeldung in einem anderen Tab
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);
  const resolved = possible === false || (possible === true && ready);
  useEffect(() => {
    if (!backendConfigured || !resolved) return;
    if (!userId) {
      setWishlistRemote(null);
      // Abgemeldet: eine Kontoliste nicht der nächsten Person zeigen (Gästelisten bleiben)
      void whenHydrated().then(() => useWishlist.getState().clearOwned());
      return;
    }
    let live = true;
    void (async () => {
      try {
        await whenHydrated();
        await syncWishlist(userId, () => live);
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
  }, [resolved, userId]);
}
