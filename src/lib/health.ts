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
