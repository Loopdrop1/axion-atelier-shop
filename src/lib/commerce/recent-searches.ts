// Zuletzt gesucht: nur im Browser, reine Bequemlichkeit (bei gesperrtem Speicher einfach leer)
const RECENT_KEY = "axion-recent-searches";
export function readRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}
export function rememberSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const next = [q, ...readRecentSearches().filter((v) => v.toLowerCase() !== q.toLowerCase())];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 5)));
  } catch {
    // Speicher nicht verfügbar: ohne Verlauf weiter
  }
}
