// Sprachneutraler Farbschlüssel für den Farbfilter (?farbe=marine): gleich auf Deutsch und Englisch,
// damit der Filter beim Sprachwechsel und in geteilten Links erhalten bleibt.
import type { Product } from "./types";

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** «Hellgrau meliert» → «hellgrau-meliert», «Weiß» → «weiss», «Grün» → «gruen», «Écru» → «ecru». */
export function colorKey(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Schlüssel und Ausweichschlüssel (deutscher und englischer Name) einer Produktfarbe. */
export function colorKeys(de: string, en: string | null | undefined) {
  const key = colorKey(de) || colorKey(en);
  const aliases = [colorKey(en)].filter((a) => a && a !== key);
  return { key, aliases };
}

/**
 * Passt ein Wert aus der Adresse zur Farbe? Neu ist es der Schlüssel; ältere Links tragen den
 * deutschen oder englischen Namen («Marine», «Navy»), die über ihren Schlüssel ebenfalls passen.
 */
export function colorMatchesValue(color: Product["color"], value: string): boolean {
  if (value === color.key) return true;
  const k = colorKey(value);
  return (
    Boolean(k) &&
    (k === color.key || k === colorKey(color.name) || Boolean(color.aliases?.includes(k)))
  );
}

/** Farbfilter-Optionen: je Schlüssel einmal, beschriftet mit dem Namen in der Seitensprache. */
export function colorFacets(products: Product[]): { key: string; label: string }[] {
  const facets = new Map<string, string>();
  for (const p of products) if (!facets.has(p.color.key)) facets.set(p.color.key, p.color.name);
  return [...facets].map(([key, label]) => ({ key, label }));
}

/**
 * Gewählte Farben aus der Adresse als Schlüssel: alte Links mit Namen werden auf den Schlüssel der
 * passenden Farbe(n) abgebildet; Unbekanntes bleibt unverändert (passt dann zu nichts).
 */
export function selectedColorKeys(value: string | undefined, products: Product[]): string[] {
  if (!value) return [];
  const colors = [...new Map(products.map((p) => [p.color.key, p.color])).values()];
  return [
    ...new Set(
      value
        .split(",")
        .filter(Boolean)
        .flatMap((v) => {
          // Ein alter englischer Name kann mehrere deutsche Farben abdecken («Navy»)
          const keys = colors.filter((c) => colorMatchesValue(c, v)).map((c) => c.key);
          return keys.length ? keys : [v];
        }),
    ),
  ];
}
