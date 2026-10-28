// Gemeinsamer Weg in den Warenkorb für Produktseite, Karte, Outfit und Look: respektiert den Bestand der
// Grösse und merkt sich einen Hinweis, den der Warenkorb beim Öffnen anzeigt («Nur noch 1 an Lager»).
import type { Variant } from "@/lib/commerce/types";
import { useCart, useShopUI, type AddResult } from "@/lib/commerce/stores";
import { useT } from "@/i18n";
import { trackEvent } from "@/lib/analytics";

export function useAddToCart() {
  const t = useT();
  const add = useCart((s) => s.add);
  const setNotice = useShopUI((s) => s.setCartNotice);
  /** Legt Varianten (je eine) in den Warenkorb und gibt zurück, ob etwas gekürzt wurde. */
  return (variants: Pick<Variant, "id" | "stock">[]): AddResult[] => {
    const results = variants.map((v) => add(v.id, 1, v.stock));
    if (results.some((r) => r.added > 0)) trackEvent("Add to Cart");
    const capped = results.filter((r) => r.capped);
    const [first] = capped;
    setNotice(
      !first
        ? ""
        : capped.length > 1
          ? t.cart.cappedMany
          : first.capped === "stock"
            ? t.cart.onlyLeft(first.max)
            : t.cart.maxPerLine,
    );
    return results;
  };
}
