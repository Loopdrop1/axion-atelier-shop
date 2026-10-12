import type { Product } from "@/lib/commerce/types";

/** Stabiler Schlüssel für die Outfit-Teile einer Produktseite (Handles sind Slugs, ohne Komma).
 *  Neu geladene, gleiche Daten ergeben denselben Schlüssel, damit die gewählte Grösse bleibt. */
export function outfitKey(outfit: Pick<Product, "handle">[]): string {
  return outfit.map((p) => p.handle).join(",");
}
