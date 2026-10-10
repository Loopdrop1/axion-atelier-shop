export const pieceCount = (n: number) => `${n} ${n === 1 ? "Stück" : "Stücke"}`;
export const resultCount = (n: number) => `${n} ${n === 1 ? "Ergebnis" : "Ergebnisse"}`;
export const searchString = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;
