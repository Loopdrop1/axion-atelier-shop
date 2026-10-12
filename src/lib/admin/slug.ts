// Adresse (Handle) für Produkte und Kategorien aus dem Titel: nur a–z, 0–9 und Bindestriche.
const REPLACE: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => REPLACE[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
