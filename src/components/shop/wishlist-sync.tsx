import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useT } from "@/i18n";
import { useWishlistSync } from "@/lib/account/wishlist-sync";

type Sonner = {
  Toaster: ComponentType<{ position?: "bottom-center" }>;
  toast: { error: (message: string) => unknown };
};

/** Gleicht die Merkliste mit dem Konto ab; meldet nur, wenn das Speichern fehlschlug (dann wurde die Änderung zurückgenommen). */
export function WishlistSync() {
  const t = useT();
  const [sonner, setSonner] = useState<Sonner | null>(null);
  // Zähler der Fehler: jede zurückgenommene Änderung bekommt ihre eigene Meldung
  const [errors, setErrors] = useState(0);
  const shown = useRef(0);
  const message = t.wishlist.syncFailed;
  const onError = useCallback(() => {
    // sonner erst bei Bedarf laden: Die Meldung ist ein Ausnahmefall. Toaster und toast zusammen laden,
    // damit der Toaster steht, bevor die Meldung kommt (sonner zeigt frühere Meldungen nicht nachträglich).
    void Promise.all([import("@/components/ui/sonner"), import("sonner")])
      .then(([ui, m]) => {
        setSonner((prev) => prev ?? { Toaster: ui.Toaster, toast: m.toast });
        setErrors((n) => n + 1);
      })
      .catch(() => undefined);
  }, []);
  useWishlistSync(onError);
  // Läuft nach den Effekten des Toasters (Kinder zuerst): sonner hört dann schon zu
  useEffect(() => {
    if (!sonner || errors <= shown.current) return;
    shown.current = errors;
    sonner.toast.error(message);
  }, [sonner, errors, message]);
  return sonner ? <sonner.Toaster position="bottom-center" /> : null;
}
