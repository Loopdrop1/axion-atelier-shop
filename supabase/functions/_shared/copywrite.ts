// Textvorschlag für Produkte im Admin: Beschreibung und Ausstattung auf Deutsch aus den Eckdaten.
// Gleiches Gateway und gleiche Konfiguration wie die Übersetzung (translate.ts); das Admin prüft und speichert selbst.
import { TranslateError, type TranslateConfig } from "./translate.ts";

export interface CopyInput {
  title: string;
  category: string;
  color: string;
  material?: string | undefined;
  fit?: string | undefined;
  /** Stichworte des Admins (Schnitt, Details, Anlass) */
  notes?: string | undefined;
}

export interface CopyDraft {
  description: string;
  features: string[];
}

export const COPY_LIMITS = { maxFieldChars: 300, maxNotesChars: 1500 } as const;

const TOOL = "return_copy";

const SYSTEM = [
  "Du schreibst Produkttexte für AXION, einen Schweizer Online-Shop für Herrenmode (Anzüge, Sakkos, Westen, Mäntel, Schuhe).",
  "AXION verkauft fertige Konfektion im Luxussegment: nie Massanfertigung, Änderungen, Anpassungen oder Termine erwähnen.",
  "Schreibe Schweizer Hochdeutsch (immer ss statt ß), sprich die Kundschaft mit du an, ruhig, präzise und ohne Superlative oder Ausrufezeichen.",
  "Verwende nur Angaben aus der Eingabe. Erfinde keine Materialien, Herkunft, Masse, Pflegehinweise, Preise oder Zertifikate;",
  "fehlt eine Angabe, lass sie weg.",
  "description: 2 bis 3 Sätze, höchstens 400 Zeichen. features: 2 bis 5 kurze Merkmale ohne Punkt am Ende, je höchstens 80 Zeichen.",
  `Antworte ausschliesslich mit dem Aufruf von ${TOOL}.`,
].join(" ");

function extract(data: unknown): unknown {
  const message = (data as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]
    ?.message;
  if (!message) return undefined;
  const calls = message["tool_calls"] as { function?: { arguments?: string } }[] | undefined;
  const raw =
    calls?.[0]?.function?.arguments ??
    (typeof message["content"] === "string" ? message["content"] : undefined);
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
  } catch {
    return undefined;
  }
}

/** ß gehört nicht ins Schweizer Hochdeutsch; Modelle rutschen trotz Anweisung gelegentlich hinein. */
const swiss = (text: string) => text.replace(/ß/g, "ss").trim();

/** Fehler wie bei der Übersetzung: UNAVAILABLE, RATE_LIMITED, FAILED. */
export async function draftProductCopy(
  input: CopyInput,
  config: TranslateConfig,
): Promise<CopyDraft> {
  if (!config.apiKey) throw new TranslateError("UNAVAILABLE");
  const facts = Object.fromEntries(
    Object.entries({
      Titel: input.title,
      Kategorie: input.category,
      Farbe: input.color,
      Material: input.material,
      Passform: input.fit,
      Stichworte: input.notes,
    }).filter(([, v]) => typeof v === "string" && v.trim()),
  );
  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(
      `${config.apiBase.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: JSON.stringify(facts) },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: TOOL,
                description: "Return the German product copy.",
                parameters: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    features: { type: "array", items: { type: "string" } },
                  },
                  required: ["description", "features"],
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
    console.error("Textvorschlag: keine Verbindung", error);
    throw new TranslateError("FAILED");
  }
  if (response.status === 402) throw new TranslateError("UNAVAILABLE");
  if (response.status === 429) throw new TranslateError("RATE_LIMITED");
  if (!response.ok) {
    console.error("Textvorschlag fehlgeschlagen", response.status);
    throw new TranslateError("FAILED");
  }
  const draft = extract(await response.json().catch(() => undefined)) as
    { description?: unknown; features?: unknown } | undefined;
  if (
    typeof draft?.description !== "string" ||
    !draft.description.trim() ||
    !Array.isArray(draft.features)
  ) {
    console.error("Textvorschlag: unerwartete Antwort");
    throw new TranslateError("FAILED");
  }
  return {
    description: swiss(draft.description).slice(0, 4000),
    features: draft.features
      .filter((f): f is string => typeof f === "string" && f.trim() !== "")
      .map((f) => swiss(f).replace(/\.$/, "").slice(0, 200))
      .slice(0, 8),
  };
}
