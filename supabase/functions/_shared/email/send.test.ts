import { describe, expect, it } from "vitest";
import { EmailError, sendEmail } from "./send.ts";

const content = { subject: "s", html: "<p>h</p>", text: "t" };
const cfg = { apiKey: "k", from: "Axion <a@shop.test>" };

describe("sendEmail", () => {
  it("ruft Resend mit Abbruch-Signal auf (Timeout)", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(JSON.stringify({ id: "m1" }), { status: 200 });
    }) as typeof fetch;
    await sendEmail("kunde@example.ch", content, { ...cfg, fetchImpl });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("Abbruch oder Netzfehler wird zu EmailError 504 ohne Empfängerdaten", async () => {
    const fetchImpl = (async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }) as typeof fetch;
    const error = await sendEmail("kunde@example.ch", content, { ...cfg, fetchImpl }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(EmailError);
    expect((error as EmailError).status).toBe(504);
    expect((error as EmailError).message).not.toContain("kunde@example.ch");
  });

  it("Fehlerantwort: nur Statuscode im Fehlertext", async () => {
    const fetchImpl = (async () =>
      new Response("invalid to: kunde@example.ch", { status: 422 })) as typeof fetch;
    const error = (await sendEmail("kunde@example.ch", content, { ...cfg, fetchImpl }).catch(
      (e: unknown) => e,
    )) as EmailError;
    expect(error.status).toBe(422);
    expect(error.message).toBe("Resend 422");
  });
});
