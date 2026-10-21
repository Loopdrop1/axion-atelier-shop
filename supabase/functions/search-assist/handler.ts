// KI-Suche ohne Anmeldung: begrenzt pro IP und gesamt (search_assist_guard), denn jede Anfrage kostet KI-Guthaben.
// Antwortet bei Limit oder Störung mit { intent: null }; der Shop zeigt dann einfach die lokalen Ergebnisse.
import type { Deps } from "../_shared/deps.ts";
import { clientIp, HttpError, json, readJson, str, withHttp } from "../_shared/http.ts";
import { pruneRateLimitsSometimes } from "../_shared/rate-limits.ts";
import { interpretSearch } from "../_shared/search-intent.ts";
import { TranslateError } from "../_shared/translate.ts";

export function createSearchAssistHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req, 2_000);
    const q = str(body["q"], 300);
    if (!q || q.length < 8) throw new HttpError(400, "BAD_REQUEST");
    const allowed = await deps.rpc<boolean>("search_assist_guard", { p_ip: clientIp(req) });
    await pruneRateLimitsSometimes(deps);
    if (!allowed) throw new HttpError(429, "RATE_LIMITED");
    try {
      return json(200, { intent: await interpretSearch(q, deps.env.translate) });
    } catch (error) {
      if (!(error instanceof TranslateError)) throw error;
      // KI nicht verfügbar: kein Fehler für die Kundschaft, nur keine Zusatzfilter
      return json(200, { intent: null });
    }
  });
}
