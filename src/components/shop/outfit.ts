// Komplettes Outfit: mehrere Stücke mit Grösse auf einmal in den Warenkorb legen.
// Gleiche Regeln auf der Produktseite («Komplettes Outfit») und auf der Startseite (Look mit Bild).
import { useState } from "react";
import type { Product, Variant } from "@/lib/commerce/types";
import { oneSizeVariant } from "@/lib/commerce/one-size";
import { useCart, useShopUI } from "@/lib/commerce/stores";

/** Grössen zur Auswahl; ausverkaufte ausblenden, wenn das im Admin so eingestellt ist. */
export function sizesFor(product: Product, hideSoldOut: boolean): Variant[] {
  return hideSoldOut ? product.variants.filter((v) => v.availableForSale) : product.variants;
}

/** Keine Grösse mehr lieferbar: das Stück wird nicht vorausgewählt und lässt sich nicht wählen. */
export function isSoldOut(product: Product): boolean {
  return !product.variants.some((v) => v.availableForSale);
}

/** Am Anfang ausgewählt: alle Stücke, die noch lieferbar sind. */
export function defaultSelection(outfit: Product[]): string[] {
  return outfit.filter((p) => !isSoldOut(p)).map((p) => p.handle);
}

/** Stücke in Einheitsgrösse (z. B. Krawatte): diese Grösse ist gleich gewählt, wenn lieferbar.
 *  Eine einzelne echte Grösse (Schuh nur noch in 42) wählt die Kundschaft selbst. */
export function defaultSizes(outfit: Product[]): Record<string, string> {
  return Object.fromEntries(
    outfit.flatMap((p) => {
      const only = oneSizeVariant(p);
      return only?.availableForSale ? [[p.handle, only.id]] : [];
    }),
  );
}

/** Summe der ausgewählten Stücke: Preis der gewählten Grösse, sonst der Preis des Stücks. */
export function selectionTotal(
  outfit: Product[],
  checked: string[],
  sizes: Record<string, string>,
): number {
  return outfit
    .filter((p) => checked.includes(p.handle))
    .reduce((sum, p) => {
      const variant = p.variants.find((v) => v.id === sizes[p.handle]);
      return sum + (variant?.price.amount ?? p.priceRange.min.amount);
    }, 0);
}

export type OutfitPlan = { ok: true; variantIds: string[] } | { ok: false; missing: string[] };

/** Was in den Warenkorb kommt: für jedes ausgewählte Stück eine lieferbare Grösse.
 *  Fehlt sie (nicht gewählt oder inzwischen ausverkauft), kommt nichts in den Warenkorb. */
export function planOutfit(
  outfit: Product[],
  checked: string[],
  sizes: Record<string, string>,
): OutfitPlan {
  const variantIds: string[] = [];
  const missing: string[] = [];
  for (const p of outfit) {
    if (!checked.includes(p.handle)) continue;
    const variant = p.variants.find((v) => v.id === sizes[p.handle] && v.availableForSale);
    if (variant) variantIds.push(variant.id);
    else missing.push(p.handle);
  }
  return missing.length ? { ok: false, missing } : { ok: true, variantIds };
}

/** Auswahl, Grössen und «in den Warenkorb» für ein Outfit.
 *  Zurücksetzen bei anderem Outfit: Komponente mit key={outfitKey(outfit)} neu aufbauen. */
export function useOutfit(outfit: Product[]) {
  const add = useCart((s) => s.add);
  const openCart = useShopUI((s) => s.setCart);
  const [picked, setPicked] = useState<string[]>(() => defaultSelection(outfit));
  const [sizes, setSizes] = useState<Record<string, string>>(() => defaultSizes(outfit));
  const [missing, setMissing] = useState<string[]>([]);
  // Ist ein ausgewähltes Stück inzwischen ganz ausverkauft (neu geladene Daten), zählt es nicht mehr mit.
  // Sonst bliebe es ausgewählt, liesse sich aber nicht mehr abwählen, und nichts käme in den Warenkorb.
  const checked = picked.filter((h) => outfit.some((p) => p.handle === h && !isSoldOut(p)));
  const forget = (handle: string) => setMissing((m) => m.filter((h) => h !== handle));
  return {
    checked,
    sizes,
    /** Ausgewählte Stücke ohne lieferbare Grösse nach einem Versuch, sie in den Warenkorb zu legen */
    missing: missing.filter((h) => checked.includes(h)),
    total: selectionTotal(outfit, checked, sizes),
    toggle(handle: string) {
      setPicked((s) => (s.includes(handle) ? s.filter((h) => h !== handle) : [...s, handle]));
      forget(handle);
    },
    choose(handle: string, variantId: string) {
      setSizes((s) => ({ ...s, [handle]: variantId }));
      if (variantId) forget(handle);
    },
    /** Legt die Auswahl in den Warenkorb und öffnet ihn. Gibt die Stücke ohne Grösse zurück (leer = erledigt). */
    addToCart(): string[] {
      const plan = planOutfit(outfit, checked, sizes);
      if (!plan.ok) {
        setMissing(plan.missing);
        return plan.missing;
      }
      plan.variantIds.forEach((id) => add(id));
      setMissing([]);
      if (plan.variantIds.length) openCart(true);
      return [];
    },
  };
}
