// Entfernt aus Text und Pfaden alles, was als Zugangsschlüssel taugt (Bestell-Token, Bestellnummern, UUIDs, lange
// Zufallsfolgen) und den Query-String von Adressen. Gleiche Regeln wie supabase/functions/_shared/redact.ts (der Browser
// redigiert vor dem Senden, die Funktion nochmals); redact.test.ts hält beide gleich. Reine Funktion, ohne Importe.

/** Adressen im Text (für das Entfernen von Query-String und Fragment). */
export const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/gi;

/** Reihenfolge ist Teil der Regel: erst Pfadschlüssel, dann allgemeine Kennungen. */
export const REDACTIONS: readonly (readonly [RegExp, string])[] = [
  // Bestellstatus-Seite: /bestellung/<status_token> (auch /en/bestellung/…)
  [/(^|[/\s"'(])bestellung\/[^/?#\s"')]+/g, "$1bestellung/:token"],
  // Konto: /konto/bestellungen/<nummer>
  [/(^|[/\s"'(])konto\/bestellungen\/[^/?#\s"')]+/g, "$1konto/bestellungen/:nr"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ":id"],
  [/\b[0-9a-f]{24,}\b/gi, ":hex"],
  // lange base64url-artige Folgen mit Buchstaben und Ziffern (kein Wort, kein Dateiname); ohne Lookbehind (ältere Safari)
  [/(^|[^\w-])(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{32,}(?![\w-])/g, "$1:tok"],
];

/** Query-String und Fragment aus Adressen im Text entfernen, dann alle Kennungen ersetzen. */
export function redact(text: string): string {
  let out = text.replace(URL_IN_TEXT, (u) => u.split(/[?#]/)[0]!);
  for (const [re, replacement] of REDACTIONS) out = out.replace(re, replacement);
  return out;
}
