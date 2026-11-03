// Grössen: Zuordnung Zahl ↔ Buchstabe (Admin → Grössentabellen, site_content «size_guides», Feld «letters»)
// und Lesen der Werte aus den Grössentabellen (Brust, Fusslänge, Körpergrösse) für den Grössenfinder.
// Reine Funktionen ohne React und ohne Supabase, damit Shop, Admin und Tests dieselbe Regel nutzen.
import type { Json } from "@/integrations/supabase/types";
import { isOneSizeTitle } from "./one-size";

/** Zahl (Konfektionsgrösse, z. B. «48») → Buchstabe («M»). */
export type SizeLetters = Record<string, string>;

/**
 * Standard: keine Zuordnung. Entscheid Axion (3.11.2026): Anzüge, Westen und Hosen zeigen nur die Zahlen 46–56.
 * Erst eine im Admin gespeicherte Zuordnung («letters») zeigt Buchstaben und rechnet im Grössenfinder um.
 */
export const DEFAULT_LETTERS: Readonly<SizeLetters> = Object.freeze({});

/** Übliche Konfektionsgrössen (Grössenfinder auf «Grössenberatung», wenn es keine Tabelle gibt). */
export const CLOTHING_NUMBERS: readonly string[] = ["44", "46", "48", "50", "52", "54", "56"];

/**
 * Kategorien, deren Zahlen keine Konfektionsgrössen sind und deshalb nie einen Buchstaben bekommen:
 * Schuhe (EU-Grösse), Accessoires (Gürtel in cm, Socken) und Hemden (Kragenweite 38–45).
 */
export const NO_LETTER_CATEGORIES: readonly string[] = ["schuhe", "accessoires", "hemden"];

/** Kategorien mit Schuhgrössen (Grössenfinder nach Fusslänge, Filter «Schuhe»). */
export const SHOE_CATEGORIES: readonly string[] = ["schuhe"];

const NUMBER = /^\d{2,3}$/;
const LETTER = /^[0-9]?[A-Z]{1,4}$/;

/** Buchstabe aufräumen: «xl » → «XL», «xxxl» bleibt «XXXL»; Unsinn → "". */
export function cleanLetter(value: string): string {
  const v = value.trim().toUpperCase().replace(/\s+/g, "");
  return v.length <= 5 && LETTER.test(v) ? v : "";
}

/** Ist das eine Zahlengrösse (z. B. «48»), die eine Zuordnung haben kann? */
export const isNumberSize = (size: string) => NUMBER.test(size.trim());

/**
 * Zuordnung aus site_content («size_guides.letters»). Ohne Feld oder leer: keine Buchstaben (nur Zahlen).
 * Werte werden aufgeräumt («m» → «M»), Unsinn fällt weg.
 */
export function readSizeLetters(content: Record<string, Json>): SizeLetters {
  const block = content["size_guides"];
  const raw =
    block && typeof block === "object" && !Array.isArray(block) ? block["letters"] : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_LETTERS };
  const letters: SizeLetters = {};
  for (const [size, letter] of Object.entries(raw)) {
    if (!isNumberSize(size) || typeof letter !== "string") continue;
    const clean = cleanLetter(letter);
    if (clean) letters[size.trim()] = clean;
  }
  return letters;
}

/** Buchstabe zu einer Grösse eines Stücks dieser Kategorie, sonst undefined (Schuhe, Einheitsgrösse, Buchstaben). */
export function letterFor(
  size: string,
  category: string,
  letters: SizeLetters,
): string | undefined {
  if (NO_LETTER_CATEGORIES.includes(category) || isOneSizeTitle(size)) return undefined;
  const key = size.trim();
  return isNumberSize(key) ? letters[key] : undefined;
}

/** «48 (M)» oder nur «48». */
export function sizeWithLetter(size: string, letter?: string): string {
  return letter ? `${size} (${letter})` : size;
}

/** Umkehrung: Buchstabe → Zahl («M» → «48»); bei mehreren Zahlen für denselben Buchstaben die erste. */
export function numberForLetter(letter: string, letters: SizeLetters): string | undefined {
  const clean = cleanLetter(letter);
  if (!clean) return undefined;
  const hit = Object.entries(letters)
    .sort(([a], [b]) => Number(a) - Number(b))
    .find(([, l]) => l === clean);
  return hit?.[0];
}

// --- Werte aus den Grössentabellen --------------------------------------------------------------

/** «96–100», «96-100», «96 bis 100», «98», «25,3», «ca. 98 cm» → [von, bis]; sonst null. */
export function parseMeasure(cell: string): [number, number] | null {
  const numbers = cell
    .replace(/(\d),(\d)/g, "$1.$2")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((n) => Number.isFinite(n));
  if (!numbers?.length || numbers.length > 2) return null;
  const [a, b = a] = numbers as [number, number?];
  return a <= (b as number) ? [a, b as number] : [b as number, a];
}

/** Rolle einer Spalte nach ihrem Namen (Deutsch oder Englisch). */
export type ColumnRole = "chest" | "foot" | "height";
const COLUMN_ROLES: [ColumnRole, RegExp][] = [
  ["chest", /\b(brust|chest)/i],
  ["foot", /\b(fuss|fuß|foot)/i],
  ["height", /\b(körpergr(ö|oe)(ss|ß)e|height)/i],
];

export function columnRole(name: string): ColumnRole | undefined {
  return COLUMN_ROLES.find(([, re]) => re.test(name))?.[0];
}

export interface MeasureRow {
  /** Grösse aus der ersten Spalte, z. B. «48» oder «M» */
  size: string;
  range: [number, number];
}

/** Zeilen einer Tabelle mit lesbarem Wert in der Spalte dieser Rolle (erste Spalte = Grösse). */
export function measureRows(
  table: { columns: string[]; rows: string[][] },
  role: ColumnRole,
): MeasureRow[] {
  const index = table.columns.findIndex((c, i) => i > 0 && columnRole(c) === role);
  if (index < 1) return [];
  return table.rows.flatMap((row) => {
    const size = row[0]?.trim();
    const range = parseMeasure(row[index] ?? "");
    return size && range ? [{ size, range }] : [];
  });
}

/**
 * Spalte «International» für eine Grössentabelle: nur wenn die erste Spalte Konfektionsgrössen enthält (jede
 * Zeile eine Zahl mit Zuordnung) und die Tabelle nicht für Schuhe, Accessoires oder Hemden (Kragenweite) gilt.
 */
export function tableLetters(
  table: { categories: string[]; columns: string[]; rows: string[][] },
  letters: SizeLetters,
): string[] | null {
  if (table.categories.some((c) => NO_LETTER_CATEGORIES.includes(c))) return null;
  if (/\b(eu|kragen|collar|g(ü|ue)rtel|belt|fuss|foot)/i.test(table.columns[0] ?? "")) return null;
  const sizes = table.rows.map((r) => r[0]?.trim() ?? "");
  if (!sizes.length || !sizes.every((s) => isNumberSize(s) && letters[s])) return null;
  return sizes.map((s) => letters[s] as string);
}
