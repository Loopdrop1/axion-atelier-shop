import { describe, expect, it } from "vitest";
import { draftProductCopy } from "./copywrite.ts";
import { TranslateError, type TranslateConfig } from "./translate.ts";

const config = (fetchFn: typeof fetch): TranslateConfig => ({
  apiBase: "https://gateway.test/v1/",
  apiKey: "key",
  model: "m",
  fetch: fetchFn,
});
const reply = (args: unknown, status = 200) =>
  (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }],
      }),
      { status },
    )) as unknown as typeof fetch;

describe("draftProductCopy", () => {
  it("schickt nur vorhandene Angaben und gibt Schweizer Schreibweise zurück", async () => {
    let sent: { url: string; facts: Record<string, string> } | undefined;
    const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
      sent = { url: String(url), facts: JSON.parse(body.messages[1]!.content) };
      return reply({
        description: "Ein Anzug für grosse Anlässe, der Gruß der Saison.",
        features: ["Zweiknopf-Sakko.", " ", "Hose ohne Bundfalte"],
      })(url, init);
    }) as typeof fetch;
    const draft = await draftProductCopy(
      { title: "Anzug «Limmat»", category: "Anzüge", color: "Marine", material: " " },
      config(fetchFn),
    );
    expect(sent!.url).toBe("https://gateway.test/v1/chat/completions");
    expect(sent!.facts).toEqual({ Titel: "Anzug «Limmat»", Kategorie: "Anzüge", Farbe: "Marine" });
    expect(draft.description).toBe("Ein Anzug für grosse Anlässe, der Gruss der Saison.");
    expect(draft.features).toEqual(["Zweiknopf-Sakko", "Hose ohne Bundfalte"]);
  });

  it("meldet fehlenden Schlüssel, Guthaben, Ratenlimit und kaputte Antworten", async () => {
    const input = { title: "T", category: "K", color: "F" };
    const code = (p: Promise<unknown>) =>
      p.then(
        () => "ok",
        (e: unknown) => (e instanceof TranslateError ? e.code : "other"),
      );
    expect(await code(draftProductCopy(input, { ...config(reply({})), apiKey: "" }))).toBe(
      "UNAVAILABLE",
    );
    expect(await code(draftProductCopy(input, config(reply({}, 402))))).toBe("UNAVAILABLE");
    expect(await code(draftProductCopy(input, config(reply({}, 429))))).toBe("RATE_LIMITED");
    expect(await code(draftProductCopy(input, config(reply({ description: "" }))))).toBe("FAILED");
  });
});
