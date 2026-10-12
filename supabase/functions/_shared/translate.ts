// Automatische Übersetzung Deutsch → Englisch für Texte aus dem Admin (Produkte, Kategorien, Startseite).
// Standard ist das Lovable AI Gateway (Schlüssel LOVABLE_API_KEY legt Lovable selbst an). Jeder andere Dienst mit
// OpenAI-Schnittstelle geht über TRANSLATE_API_BASE, TRANSLATE_API_KEY und TRANSLATE_MODEL.

export interface TranslateConfig {
  /** z. B. https://ai.gateway.lovable.dev/v1 */
  apiBase: string;
  apiKey: string;
  model: string;
  /** Nur für Tests */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export type TranslateErrorCode = "UNAVAILABLE" | "RATE_LIMITED" | "FAILED";

export class TranslateError extends Error {
  constructor(public code: TranslateErrorCode) {
    super(code);
    this.name = "TranslateError";
  }
}

// Höchstens so viel Text pro Anfrage (der Body der Function ist auf 20 000 Zeichen begrenzt).
export const TRANSLATE_LIMITS = { maxTexts: 60, maxChars: 4000, maxTotalChars: 16_000 } as const;

const TOOL = "return_translations";

const SYSTEM = [
  "You translate German texts from the admin of AXION, a Swiss menswear shop (suits, waistcoats, shoes),",
  "into natural, polished British English for the shop's English pages.",
  "Rules: keep the meaning exactly; do not add, leave out or embellish anything; keep numbers, sizes,",
  "percentages, prices, measurements, product codes and brand names (for example AXION) unchanged;",
  "keep line breaks and any Markdown; use British spelling (colour, tailored);",
  "Anzug = suit, Weste = waistcoat, Sakko = jacket, Hose = trousers; both du and Sie become you.",
  `Return exactly one translation per input text, in the same order, by calling ${TOOL}.`,
].join(" ");

/** Holt die Übersetzungen aus der Antwort: zuerst aus dem Tool-Aufruf, sonst aus JSON im Text. */
function extract(data: unknown): unknown {
  const message = (data as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]
    ?.message;
  if (!message) return undefined;
  const calls = message["tool_calls"] as { function?: { arguments?: string } }[] | undefined;
  const raw =
    calls?.[0]?.function?.arguments ??
    (typeof message["content"] === "string" ? message["content"] : undefined);
  if (typeof raw !== "string") return undefined;
  const json = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return (JSON.parse(json) as { translations?: unknown }).translations;
  } catch {
    return undefined;
  }
}

/**
 * Übersetzt die Texte ins Englische. Leere Texte bleiben leer (ohne Anfrage).
 * Fehler: UNAVAILABLE (kein Schlüssel, Guthaben aufgebraucht), RATE_LIMITED, FAILED (alles andere).
 */
export async function translateToEnglish(
  texts: string[],
  config: TranslateConfig,
): Promise<string[]> {
  const indices = texts.flatMap((t, i) => (t.trim() ? [i] : []));
  const out = texts.map(() => "");
  if (indices.length === 0) return out;
  if (!config.apiKey) throw new TranslateError("UNAVAILABLE");
  const input = indices.map((i) => texts[i]!);

  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(
      `${config.apiBase.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: JSON.stringify({ texts: input }) },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: TOOL,
                description: "Return the English translations, one per input text, same order.",
                parameters: {
                  type: "object",
                  properties: { translations: { type: "array", items: { type: "string" } } },
                  required: ["translations"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: TOOL } },
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
      },
    );
  } catch (error) {
    console.error("Übersetzung: keine Verbindung", error);
    throw new TranslateError("FAILED");
  }

  if (response.status === 402) throw new TranslateError("UNAVAILABLE");
  if (response.status === 429) throw new TranslateError("RATE_LIMITED");
  if (!response.ok) {
    console.error(
      "Übersetzung fehlgeschlagen",
      response.status,
      await response.text().catch(() => ""),
    );
    throw new TranslateError("FAILED");
  }
  const translations = extract(await response.json().catch(() => undefined));
  if (
    !Array.isArray(translations) ||
    translations.length !== input.length ||
    !translations.every((t) => typeof t === "string" && t.trim())
  ) {
    console.error("Übersetzung: unerwartete Antwort");
    throw new TranslateError("FAILED");
  }
  indices.forEach((textIndex, k) => {
    out[textIndex] = (translations[k] as string).trim();
  });
  return out;
}
