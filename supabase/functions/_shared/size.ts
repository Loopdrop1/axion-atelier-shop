// Grösse in Mails und in der Stripe-Kasse: «Grösse 48», bei Einheitsgrösse das Wort dafür in der Sprache der
// Bestellung («Einheitsgrösse» statt «Grösse One Size»). Gleiche Regel wie im Shop (src/lib/commerce/one-size.ts); die Functions können von dort
// nicht importieren, ein Test prüft, dass beide gleich entscheiden.
const ONE_SIZE = /^(one[\s-]?size|einheitsgr(ö|oe)(ss|ß)e|o\/?s)$/i;

export function sizeText(size: string, word: string, oneSize: string): string {
  return ONE_SIZE.test(size.trim()) ? oneSize : `${word} ${size}`;
}
