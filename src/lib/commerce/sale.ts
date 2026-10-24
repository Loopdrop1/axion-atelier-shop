import type { Product } from "./types";

/** Ein Stück ist im Sale, wenn es so getaggt ist oder ein durchgestrichener Preis über dem Preis steht.
 *  Eine Regel für die Sale-Sammlung, die Suche und das Badge auf der Karte. */
export function isOnSale(p: Pick<Product, "tags" | "compareAtPrice" | "priceRange">): boolean {
  return (
    p.tags.includes("sale") ||
    (p.compareAtPrice !== undefined && p.compareAtPrice.amount > p.priceRange.min.amount)
  );
}
