// Eigene Ereignisse für Plausible. Winzig und ohne Importe: ohne geladenes Skript (nicht aktiviert, nicht
// eingerichtet, Werbeblocker, Entwicklung) passiert nichts.
type Plausible = (event: string, options?: { props?: Record<string, string | number> }) => void;

export function trackEvent(event: string, props?: Record<string, string | number>) {
  try {
    const plausible = (window as unknown as { plausible?: Plausible }).plausible;
    if (typeof plausible === "function") plausible(event, props ? { props } : undefined);
  } catch {
    // Statistik darf nie den Einkauf stören
  }
}
