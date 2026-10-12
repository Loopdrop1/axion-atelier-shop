// Englisch folgt dem Deutschen: Beim Speichern im Admin werden fehlende oder veraltete englische Texte automatisch
// übersetzt. Was jemand auf Englisch selbst geschrieben oder geändert hat, bleibt stehen.

export interface TextPair {
  de: string;
  en: string;
}

/** Textpaare eines Formulars, z. B. { title: { de, en }, care: { de, en } } */
export type Pairs = Record<string, TextPair>;

export interface AutoTranslateResult {
  pairs: Pairs;
  /** Anzahl automatisch übersetzter Texte */
  translated: number;
  /** Übersetzung nicht möglich: betroffene englische Felder sind leer, der Shop zeigt dort Deutsch. */
  failed: boolean;
}

const EMPTY: TextPair = { de: "", en: "" };

/**
 * Welche englischen Felder beim Speichern neu entstehen (translate) oder wegfallen (clear).
 * before: Stand beim Öffnen des Formulars, after: Stand beim Speichern.
 */
export function planTranslation(
  before: Pairs,
  after: Pairs,
): { translate: string[]; clear: string[] } {
  const translate: string[] = [];
  const clear: string[] = [];
  for (const [key, now] of Object.entries(after)) {
    const was = before[key] ?? EMPTY;
    const enTouched = now.en !== was.en;
    if (enTouched) continue; // Englisch von Hand geschrieben oder geändert: so lassen
    const de = now.de.trim();
    if (!de) {
      if (was.de.trim() && now.en.trim()) clear.push(key);
      continue;
    }
    if (!now.en.trim() || de !== was.de.trim()) translate.push(key);
  }
  return { translate, clear };
}

/**
 * Ergänzt die englischen Texte. translate bekommt die deutschen Texte und liefert die englischen in gleicher
 * Reihenfolge. Scheitert sie, bleiben die betroffenen englischen Felder leer (lieber Deutsch als veraltet).
 */
export async function autoTranslate(
  before: Pairs,
  after: Pairs,
  translate: (texts: string[]) => Promise<string[]>,
  maxLength: Record<string, number> = {},
): Promise<AutoTranslateResult> {
  const plan = planTranslation(before, after);
  const pairs: Pairs = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, { ...v }]));
  for (const key of plan.clear) pairs[key]!.en = "";
  if (plan.translate.length === 0) return { pairs, translated: 0, failed: false };
  try {
    const texts = await translate(plan.translate.map((key) => pairs[key]!.de.trim()));
    plan.translate.forEach((key, i) => {
      const max = maxLength[key];
      const text = (texts[i] ?? "").trim();
      pairs[key]!.en = max ? text.slice(0, max).trim() : text;
    });
    return { pairs, translated: plan.translate.length, failed: false };
  } catch {
    for (const key of plan.translate) pairs[key]!.en = "";
    return { pairs, translated: 0, failed: true };
  }
}

/** Satz für die Meldung nach dem Speichern. */
export function translationNote(result: AutoTranslateResult): string {
  if (result.failed)
    return " Englisch konnte gerade nicht übersetzt werden; im Shop steht dort vorerst der deutsche Text. Beim nächsten Speichern versucht das Admin es erneut.";
  if (result.translated > 0)
    return result.translated === 1
      ? " Ein Text wurde automatisch ins Englische übersetzt, bitte kurz prüfen."
      : ` ${result.translated} Texte wurden automatisch ins Englische übersetzt, bitte kurz prüfen.`;
  return "";
}
