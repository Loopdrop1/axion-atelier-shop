// Beträge im Admin: Eingabe in Franken (CHF), Speicherung in Rappen.

/** «489», «489.50», «489,50», «CHF 1'299.00» → Rappen; null bei ungültiger Eingabe. */
export function parseChf(input: string): number | null {
  const clean = input
    .replace(/CHF/i, "")
    .replace(/['’\s]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [francs, rappen = ""] = clean.split(".");
  return Number(francs) * 100 + Number(rappen.padEnd(2, "0"));
}

/** Rappen → Text fürs Eingabefeld («489.00»). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
