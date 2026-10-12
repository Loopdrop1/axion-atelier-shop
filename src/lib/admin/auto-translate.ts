// Englisch folgt dem Deutschen: Beim Speichern im Admin übersetzt das Admin leere englische Felder automatisch und
// erneuert maschinell übersetztes Englisch, wenn sich das Deutsch ändert. Englisch, das jemand selbst geschrieben
// oder angepasst hat, bleibt immer stehen; ändert sich dazu das Deutsch, kommt ein Hinweis zum Prüfen.
// Die Herkunft («auto») wird pro Feld gespeichert (Spalte en_auto bzw. Feld «auto» im Inhalt).

export interface TextPair {
  de: string;
  en: string;
  /** Das Englisch stammt aus der automatischen Übersetzung und wurde seither nicht von Hand geändert. */
  auto?: boolean;
}

/** Textpaare eines Formulars, z. B. { title: { de, en, auto }, care: { de, en } } */
export type Pairs = Record<string, TextPair>;

export interface TranslationPlan {
  /** Englisch leer, oder maschinell und das Deutsch hat sich geändert: neu übersetzen */
  translate: string[];
  /** Maschinelles Englisch, dessen Deutsch leer ist: fällt weg */
  clear: string[];
  /** Englisch von Hand geschrieben, das Deutsch hat sich geändert: bleibt stehen, bitte prüfen */
  stale: string[];
  /** Englisch in dieser Sitzung von Hand geändert: gilt ab jetzt als eigenes Englisch */
  manual: string[];
}

export interface AutoTranslateResult {
  /** Paare mit neuem Englisch und neuer Herkunft (auto) */
  pairs: Pairs;
  /** Anzahl automatisch übersetzter Texte */
  translated: number;
  /** Übersetzung nicht möglich: Fehlercode (z. B. TRANSLATION_UNAVAILABLE). Betroffene Felder sind leer. */
  error: string | null;
  /** Schlüssel der Felder mit eigenem Englisch zu geändertem Deutsch */
  stale: string[];
  /** Bezeichnung der Felder für den Hinweis «Englisch prüfen», z. B. { title: "Titel" } */
  labels?: Record<string, string>;
}

const EMPTY: TextPair = { de: "", en: "" };

/**
 * Was beim Speichern mit dem Englisch passiert.
 * before: gespeicherter Stand (mit Herkunft), after: Stand im Formular beim Speichern.
 */
export function planTranslation(before: Pairs, after: Pairs): TranslationPlan {
  const plan: TranslationPlan = { translate: [], clear: [], stale: [], manual: [] };
  for (const [key, now] of Object.entries(after)) {
    const was = before[key] ?? EMPTY;
    const de = now.de.trim();
    const en = now.en.trim();
    const deChanged = de !== was.de.trim();
    if (en && en !== was.en.trim()) {
      plan.manual.push(key);
      continue;
    }
    if (!de) {
      if (en && was.auto) plan.clear.push(key);
      else if (en && deChanged) plan.stale.push(key);
      continue;
    }
    if (!en || (deChanged && was.auto)) plan.translate.push(key);
    else if (deChanged) plan.stale.push(key);
  }
  return plan;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code ? code : "TRANSLATION_FAILED";
}

/**
 * Ergänzt die englischen Texte. translate bekommt die deutschen Texte und liefert die englischen in gleicher
 * Reihenfolge. Scheitert sie, fällt nur veraltetes maschinelles Englisch weg (lieber Deutsch als falsch); eigenes
 * Englisch bleibt in jedem Fall.
 */
export async function autoTranslate(
  before: Pairs,
  after: Pairs,
  translate: (texts: string[]) => Promise<string[]>,
  maxLength: Record<string, number> = {},
): Promise<AutoTranslateResult> {
  const plan = planTranslation(before, after);
  const pairs: Pairs = {};
  for (const [key, now] of Object.entries(after))
    pairs[key] = {
      de: now.de,
      en: now.en,
      auto: Boolean(before[key]?.auto) && Boolean(now.en.trim()),
    };
  for (const key of plan.manual) pairs[key]!.auto = false;
  for (const key of plan.clear) pairs[key] = { ...pairs[key]!, en: "", auto: false };
  const result: AutoTranslateResult = { pairs, translated: 0, error: null, stale: plan.stale };
  if (plan.translate.length === 0) return result;
  try {
    const texts = await translate(plan.translate.map((key) => pairs[key]!.de.trim()));
    plan.translate.forEach((key, i) => {
      const max = maxLength[key];
      const raw = (texts[i] ?? "").trim();
      const text = max ? raw.slice(0, max).trim() : raw;
      pairs[key] = { ...pairs[key]!, en: text, auto: Boolean(text) };
    });
    result.translated = plan.translate.filter((key) => pairs[key]!.en).length;
  } catch (error) {
    for (const key of plan.translate)
      if (pairs[key]!.auto) pairs[key] = { ...pairs[key]!, en: "", auto: false };
    result.error = errorCode(error);
  }
  return result;
}

/** Herkunft aus einer Liste maschinell übersetzter Felder (Spalte en_auto). */
export function autoSet(list: readonly string[] | null | undefined): Set<string> {
  return new Set(list ?? []);
}

/** Felder mit maschinellem Englisch für die Spalte en_auto, sortiert. */
export function autoList(pairs: Pairs): string[] {
  return Object.entries(pairs)
    .filter(([, p]) => p.auto && p.en.trim())
    .map(([key]) => key)
    .sort();
}

/** Braucht die Meldung nach dem Speichern Aufmerksamkeit (Fehler oder Englisch prüfen)? */
export function needsReview(result: AutoTranslateResult): boolean {
  return result.error !== null || result.stale.length > 0;
}

/** Sätze für die Meldung nach dem Speichern. errorText: Text zum Fehlercode. */
export function translationNote(
  result: AutoTranslateResult,
  errorText: (code: string) => string = () => "",
): string {
  const labels = result.labels ?? {};
  const parts: string[] = [];
  if (result.translated > 0)
    parts.push(
      result.translated === 1
        ? "Ein Text wurde automatisch ins Englische übersetzt, bitte kurz prüfen."
        : `${result.translated} Texte wurden automatisch ins Englische übersetzt, bitte kurz prüfen.`,
    );
  if (result.error) {
    const reason = errorText(result.error).replace(/\.$/, "");
    parts.push(
      `Englisch konnte gerade nicht übersetzt werden${reason ? ` (${reason})` : ""}. Im Shop steht dort vorerst der deutsche Text; beim nächsten Speichern versucht das Admin es erneut.`,
    );
  }
  if (result.stale.length) {
    const names = result.stale.map((key) => labels[key]).filter(Boolean);
    const which = names.length === result.stale.length ? ` (${names.join(", ")})` : "";
    parts.push(
      `${result.stale.length === 1 ? "Ein deutscher Text hat" : `${result.stale.length} deutsche Texte haben`} sich geändert${which}, das Englisch dazu ist von Hand geschrieben und bleibt stehen. Bitte prüfen; leeres Englisch übersetzt das Admin beim Speichern neu.`,
    );
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}
