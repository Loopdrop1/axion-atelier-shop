// Einheitsgrösse (z. B. Krawatte, Einstecktuch): Es gibt genau eine Grösse, und sie heisst so. Dann ist sie
// gesetzt und es gibt nichts zu wählen (Produktseite, Karte, Outfit).
// Bewusst am Namen erkannt, nicht an der Anzahl: Ein Schuh, der nur noch in 42 geführt wird, bleibt eine echte
// Grösse, die die Kundschaft selbst wählt, damit niemand aus Versehen die falsche Grösse kauft.
import type { Product, Variant } from "./types";

const ONE_SIZE = /^(one[\s-]?size|einheitsgr(ö|oe)(ss|ß)e|o\/?s)$/i;

/** Name einer Grösse, die «Einheitsgrösse» bedeutet: «One Size», «Einheitsgrösse», «OS». */
export function isOneSizeTitle(title: string): boolean {
  return ONE_SIZE.test(title.trim());
}

/** «Grösse 48»; bei Einheitsgrösse das Wort dafür in der Sprache der Seite («Einheitsgrösse» statt
 *  «Grösse One Size», auch wenn die Grösse im Admin «OS» heisst). */
export function sizeText(size: string, word: string, oneSize: string): string {
  return isOneSizeTitle(size) ? oneSize : `${word} ${size}`;
}

/** Die einzige Grösse eines Stücks in Einheitsgrösse, sonst undefined. */
export function oneSizeVariant(product: Pick<Product, "variants">): Variant | undefined {
  const [only, ...rest] = product.variants;
  return only && rest.length === 0 && isOneSizeTitle(only.title) ? only : undefined;
}
