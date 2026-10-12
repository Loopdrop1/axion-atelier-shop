import { describe, expect, it } from "vitest";
import { TranslateError, translateToEnglish, type TranslateConfig } from "./translate.ts";

interface Call {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    messages: { role: string; content: string }[];
    tool_choice?: unknown;
  };
}

/** Fetch-Ersatz: zeichnet Anfragen auf und antwortet wie das AI-Gateway (OpenAI-Format). */
function gateway(reply: (texts: string[]) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Call["body"];
    calls.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body,
    });
    const user = body.messages.find((m: { role: string }) => m.role === "user")!;
    return reply((JSON.parse(user.content) as { texts: string[] }).texts);
  }) as typeof fetch;
  return { calls, fetchFn };
}

const toolReply = (translations: unknown) =>
  Response.json({
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              type: "function",
              function: {
                name: "return_translations",
                arguments: JSON.stringify({ translations }),
              },
            },
          ],
        },
      },
    ],
  });

const config = (fetchFn: typeof fetch, extra: Partial<TranslateConfig> = {}): TranslateConfig => ({
  apiBase: "https://ai.test/v1/",
  apiKey: "key_test",
  model: "google/gemini-2.5-flash",
  fetch: fetchFn,
  ...extra,
});

describe("translateToEnglish", () => {
  it("übersetzt in der gleichen Reihenfolge und schickt Schlüssel, Modell und Tool", async () => {
    const { calls, fetchFn } = gateway((texts) => toolReply(texts.map((t) => `EN:${t}`)));
    const out = await translateToEnglish(["Anzug Limmat", "Weste aus Schurwolle"], config(fetchFn));
    expect(out).toEqual(["EN:Anzug Limmat", "EN:Weste aus Schurwolle"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://ai.test/v1/chat/completions");
    expect(calls[0]!.headers["authorization"]).toBe("Bearer key_test");
    expect(calls[0]!.body.model).toBe("google/gemini-2.5-flash");
    expect(calls[0]!.body.tool_choice).toEqual({
      type: "function",
      function: { name: "return_translations" },
    });
    expect(calls[0]!.body.messages[0]!.content).toContain("British English");
  });

  it("leere Texte bleiben leer und gehen nicht ans Gateway", async () => {
    const { calls, fetchFn } = gateway((texts) => toolReply(texts.map((t) => `EN:${t}`)));
    expect(await translateToEnglish(["", "  ", "Schuhe", ""], config(fetchFn))).toEqual([
      "",
      "",
      "EN:Schuhe",
      "",
    ]);
    expect(calls[0]!.body.messages.at(-1)!.content).toBe(JSON.stringify({ texts: ["Schuhe"] }));
    const none = gateway(() => toolReply([]));
    expect(await translateToEnglish(["", " "], config(none.fetchFn))).toEqual(["", ""]);
    expect(none.calls).toHaveLength(0);
  });

  it("nimmt auch eine Antwort als JSON-Text (ohne Tool), mit Codeblock", async () => {
    const { fetchFn } = gateway(() =>
      Response.json({
        choices: [{ message: { content: '```json\n{"translations": ["Suit"]}\n```' } }],
      }),
    );
    expect(await translateToEnglish(["Anzug"], config(fetchFn))).toEqual(["Suit"]);
  });

  it("ohne Schlüssel: UNAVAILABLE, ohne Anfrage", async () => {
    const { calls, fetchFn } = gateway(() => toolReply(["x"]));
    await expect(translateToEnglish(["Anzug"], config(fetchFn, { apiKey: "" }))).rejects.toThrow(
      new TranslateError("UNAVAILABLE"),
    );
    expect(calls).toHaveLength(0);
  });

  it("Guthaben aufgebraucht (402): UNAVAILABLE; zu viele Anfragen (429): RATE_LIMITED", async () => {
    const empty = gateway(() => new Response("payment required", { status: 402 }));
    await expect(translateToEnglish(["Anzug"], config(empty.fetchFn))).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    const busy = gateway(() => new Response("slow down", { status: 429 }));
    await expect(translateToEnglish(["Anzug"], config(busy.fetchFn))).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("eine leere Übersetzung lässt den Stapel nicht scheitern: Feld bleibt leer", async () => {
    const { fetchFn } = gateway(() => toolReply(["Suit", "   "]));
    expect(await translateToEnglish(["Anzug", "Weste"], config(fetchFn))).toEqual(["Suit", ""]);
  });

  it("falsche Anzahl oder unlesbare Antwort: FAILED", async () => {
    for (const reply of [
      () => toolReply(["Suit", "zu viel"]),
      () => toolReply([3]),
      () => toolReply("kein Array"),
      () => Response.json({ choices: [{ message: { content: "Here you go: Suit" } }] }),
      () => new Response("kaputt", { status: 500 }),
    ]) {
      const { fetchFn } = gateway(reply);
      await expect(translateToEnglish(["Anzug"], config(fetchFn))).rejects.toMatchObject({
        code: "FAILED",
      });
    }
  });

  it("Netzwerkfehler oder Zeitüberschreitung: FAILED", async () => {
    const fetchFn = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(translateToEnglish(["Anzug"], config(fetchFn))).rejects.toMatchObject({
      code: "FAILED",
    });
  });
});
