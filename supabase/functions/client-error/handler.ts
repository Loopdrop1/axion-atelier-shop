// Fehlerberichte aus dem Browser: prüft und kürzt die Angaben, entfernt Query-Strings und E-Mail-Adressen und
// verbucht den Bericht über die RPC client_error_report (Zähler pro Fingerprint, Ratenlimit pro IP und gesamt,
// Löschung nach 30 Tagen). Gespeichert wird nichts, was eine Person erkennen lässt: keine IP, keine E-Mail, keine Konto-ID.
import type { Deps } from "../_shared/deps.ts";
import { clientIp, HttpError, json, readJson, str, withHttp } from "../_shared/http.ts";
import { pruneRateLimitsSometimes } from "../_shared/rate-limits.ts";

export const LIMITS = {
  message: 500,
  stack: 2000,
  userAgent: 300,
  release: 64,
  path: 200,
} as const;

const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/gi;
const EMAIL_IN_TEXT = /[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}/gi;

/** Entfernt Query-String und Fragment aus Adressen im Text und ersetzt E-Mail-Adressen (Tokens, Namen, Suchbegriffe). */
export function scrub(text: string): string {
  return text.replace(URL_IN_TEXT, (u) => u.split(/[?#]/)[0]!).replace(EMAIL_IN_TEXT, "[email]");
}

/** Pfad der Seite ohne Host, Query-String und Fragment. */
export function cleanPath(value: unknown): string {
  const raw = str(value, 1000) ?? "/";
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      path = "/";
    }
  }
  path = path.split(/[?#]/)[0] ?? "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return scrub(path).slice(0, LIMITS.path);
}

/** Zahlen und lange Kennungen weg, damit gleiche Fehler zusammenfallen. */
function normalise(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Erste Stack-Zeile mit einer Fundstelle (ohne Zeile und Spalte, die sich mit jedem Build ändern). */
function firstFrame(stack: string): string {
  const line = stack.split("\n").find((l) => /\bat\b|@|https?:\/\//.test(l)) ?? "";
  return normalise(line.replace(/:\d+:\d+\)?$/, ""));
}

export async function fingerprint(message: string, stack: string): Promise<string> {
  const data = new TextEncoder().encode(`${normalise(message)}|${firstFrame(stack)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createClientErrorHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req, 12_000);
    const rawMessage = typeof body["message"] === "string" ? body["message"].trim() : "";
    if (!rawMessage) throw new HttpError(400, "BAD_REQUEST");
    const message = scrub(rawMessage).slice(0, LIMITS.message);
    const stack = scrub(typeof body["stack"] === "string" ? body["stack"] : "").slice(
      0,
      LIMITS.stack,
    );
    const path = cleanPath(body["path"] ?? body["url"]);
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, LIMITS.userAgent);
    const release = (str(body["release"], LIMITS.release) ?? "").replace(/[^\w.:+-]/g, "");
    const result = await deps.rpc<string>("client_error_report", {
      p_ip: clientIp(req),
      p_fingerprint: await fingerprint(message, stack),
      p_message: message,
      p_path: path,
      p_stack: stack,
      p_user_agent: userAgent,
      p_release: release,
    });
    await pruneRateLimitsSometimes(deps);
    if (result !== "ok") throw new HttpError(429, "RATE_LIMITED");
    return json(200, { ok: true });
  });
}
