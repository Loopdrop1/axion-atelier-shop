import type { Product } from "./types";

/** Ergänzende Kategorien je Kategorie, die wichtigste zuerst (Anzug → Hemd, Schuhe, Accessoires …). */
export const COMPLEMENTS: Record<string, string[]> = {
  anzuege: ["hemden", "schuhe", "accessoires", "westen", "maentel-jacken"],
  sakkos: ["hosen", "hemden", "schuhe", "accessoires"],
  hosen: ["hemden", "sakkos", "schuhe", "accessoires"],
  hemden: ["anzuege", "hosen", "accessoires", "schuhe"],
  westen: ["hemden", "hosen", "accessoires", "schuhe"],
  strick: ["hosen", "sakkos", "schuhe", "accessoires"],
  "maentel-jacken": ["anzuege", "strick", "schuhe", "accessoires"],
  schuhe: ["anzuege", "hosen", "accessoires"],
  accessoires: ["anzuege", "hemden", "sakkos", "schuhe"],
};

/** Punkte eines Stücks als Empfehlung zu `product`: Outfit-Partner vor gleichem Anlass vor ergänzender
 *  Kategorie vor Farbe und ähnlichem Preis. Nicht lieferbare Stücke und das Stück selbst zählen nicht (null). */
export function recommendationScore(product: Product, candidate: Product): number | null {
  if (candidate.handle === product.handle) return null;
  if (!candidate.variants.some((v) => v.availableForSale)) return null;
  let score = 0;
  if (product.outfitHandles.includes(candidate.handle)) score += 100;
  if (candidate.outfitHandles.includes(product.handle)) score += 40;
  const shared = candidate.occasions.filter((o) => product.occasions.includes(o)).length;
  score += shared * 12;
  const complements = COMPLEMENTS[product.category] ?? [];
  const rank = complements.indexOf(candidate.category);
  if (rank >= 0) score += 30 - rank * 3;
  else if (candidate.category === product.category) score += 4;
  if (candidate.color.name === product.color.name) score += 6;
  // Ähnlicher Preis: bis +8 bei gleichem Preis, nichts ab dem Doppelten bzw. der Hälfte
  const a = product.priceRange.min.amount;
  const b = candidate.priceRange.min.amount;
  if (a > 0 && b > 0) score += Math.max(0, 8 * (1 - Math.abs(Math.log2(b / a))));
  return score;
}

/** Die besten `count` Empfehlungen, bei gleicher Punktzahl neuere Stücke zuerst. */
export function rankRecommendations(product: Product, all: Product[], count: number): Product[] {
  return all
    .flatMap((p) => {
      const score = recommendationScore(product, p);
      return score === null ? [] : [{ p, score }];
    })
    .sort((x, y) => y.score - x.score || y.p.createdAt.localeCompare(x.p.createdAt))
    .slice(0, count)
    .map((x) => x.p);
}
