// Gesundheitsprüfung für /api/health (Erreichbarkeits-Überwachung): Antwort ohne Geheimnisse und ohne Details.
export interface HealthResult {
  ok: boolean;
  catalogue: "ok" | "error";
  time: string;
}

/** Prüft mit `probe` (z. B. Kategorien laden) innerhalb von `timeoutMs`; Fehler und Zeitüberschreitung zählen als «error». */
export async function checkHealth(
  probe: () => Promise<unknown>,
  options: { timeoutMs?: number; now?: () => Date } = {},
): Promise<HealthResult> {
  const { timeoutMs = 4000, now = () => new Date() } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let catalogue: HealthResult["catalogue"] = "error";
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    catalogue = "ok";
  } catch {
    catalogue = "error";
  } finally {
    clearTimeout(timer);
  }
  return { ok: catalogue === "ok", catalogue, time: now().toISOString() };
}

/**
 * Merkt sich das Ergebnis `ttlMs` lang (pro Serverinstanz) und teilt eine laufende Prüfung: häufige Abfragen oder ein
 * Ausfall des Katalogs erzeugen so nicht ebenso viele Datenbankabfragen. `time` ist der Zeitpunkt der Prüfung.
 */
export function createHealthCache(
  check: () => Promise<HealthResult>,
  ttlMs = 10_000,
  clock: () => number = Date.now,
): () => Promise<HealthResult> {
  let cached: { at: number; result: HealthResult } | undefined;
  let running: Promise<HealthResult> | undefined;
  return async () => {
    if (cached && clock() - cached.at < ttlMs) return cached.result;
    running ??= check()
      .then((result) => {
        cached = { at: clock(), result };
        return result;
      })
      .finally(() => {
        running = undefined;
      });
    return running;
  };
}
