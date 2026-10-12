/** MWST-Anteil (Rappen) in einem Bruttobetrag, z. B. 8.1 % Normalsatz. */
export function vatIncluded(grossCents: number, rate: number): number {
  return Math.round((grossCents * rate) / (100 + rate));
}
