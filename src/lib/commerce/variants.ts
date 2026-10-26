// Verkleinerte Bildfassungen (WebP, 640 und 1200 px Breite), die der Admin beim Hochladen neben dem Original ablegt.
// Der Shop bietet sie dem Browser als srcset an; ohne Fassungen bleibt es beim einen Bild.
import type { Json } from "@/integrations/supabase/types";

/** Breiten der erzeugten Fassungen */
export const VARIANT_WIDTHS = [640, 1200] as const;

/** Gespeicherte Fassung: Breite in px und Pfad im selben Bucket wie das Original */
export type ImageVariant = {
  w: number;
  path: string;
};

/** Fassung für die Anzeige: Breite und fertige URL */
export interface ImageSource {
  url: string;
  width: number;
}

/** Pfad der Fassung: «ordner/abc.webp» → «ordner/abc-640.webp» */
export function variantPath(path: string, width: number): string {
  return `${path.replace(/\.[^./]+$/, "")}-${width}.webp`;
}

/** Welche Breiten erzeugt werden: nur solche, die kleiner sind als das Original (sonst bringt die Fassung nichts). */
export function variantWidths(
  originalWidth: number,
  widths: readonly number[] = VARIANT_WIDTHS,
): number[] {
  return widths.filter((w) => w < originalWidth);
}

/** Fassungen aus der Datenbank (jsonb) lesen; Ungültiges fällt weg, Ergebnis nach Breite sortiert. */
export function parseVariants(value: Json | null | undefined): ImageVariant[] {
  if (!Array.isArray(value)) return [];
  const out: ImageVariant[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { w, path } = item as Record<string, Json | undefined>;
    if (typeof w === "number" && Number.isFinite(w) && w > 0 && typeof path === "string" && path)
      out.push({ w: Math.round(w), path });
  }
  return out.sort((a, b) => a.w - b.w);
}

/** Alle Pfade eines Bildes im Speicher: Original plus Fassungen (eingebaute «asset:»-Bilder haben keine). */
export function storagePaths(path: string, variants: Json | null | undefined): string[] {
  if (path.startsWith("asset:")) return [];
  return [path, ...parseVariants(variants).map((v) => v.path)];
}

/** srcset-Wert: Fassungen und Original mit Breitenangabe; ohne Fassungen undefined. */
export function buildSrcSet(
  main: ImageSource,
  variants: readonly ImageSource[] | undefined,
): string | undefined {
  if (!variants?.length) return undefined;
  const all = new Map<number, string>();
  for (const v of variants) if (v.width < main.width) all.set(v.width, v.url);
  all.set(main.width, main.url);
  if (all.size < 2) return undefined;
  return [...all.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, url]) => `${url} ${w}w`)
    .join(", ");
}

/** sizes-Werte je Verwendung (Breite der Anzeige im Verhältnis zum Fenster) */
export const SIZES = {
  /** Einstieg über die volle Breite */
  hero: "100vw",
  /** Produktraster: 2 Spalten am Handy, 3 auf Tablets, 4 am Computer */
  card: "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw",
  /** Bildergalerie der Produktseite: Mitte von drei Spalten am Computer */
  gallery: "(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw",
  /** Kategorie-Kacheln und Slider */
  tile: "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 70vw",
  /** Kleine Vorschau (Warenkorb, Suche) */
  thumb: "160px",
  /** Halbe Seitenbreite (Look, Geschichte) */
  half: "(min-width: 768px) 50vw, 100vw",
} as const;
