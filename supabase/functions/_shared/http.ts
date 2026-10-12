// Kleine HTTP-Helfer: JSON-Antworten, CORS, sicheres Einlesen.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.(lovable\.app|lovableproject\.com)$/;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin !== null && (allowed.includes(origin) || PREVIEW_ORIGIN.test(origin) || LOCAL_ORIGIN.test(origin));
  return {
    ...(ok ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/** Liest JSON mit Grössenlimit (Standard 20 KB). */
export async function readJson(req: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE");
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("kein Objekt");
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "BAD_REQUEST");
  }
}

export function str(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v ? v.slice(0, max) : undefined;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gemeinsamer Rahmen: CORS, OPTIONS, Fehler in JSON übersetzen. */
export function withHttp(
  allowedOrigins: string[],
  handler: (req: Request) => Promise<Response>,
  opts: { cors?: boolean } = {},
): (req: Request) => Promise<Response> {
  return async (req) => {
    const cors = opts.cors === false ? {} : corsHeaders(req.headers.get("origin"), allowedOrigins);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, cors);
    try {
      const res = await handler(req);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.code, ...error.extra }, cors);
      console.error(error);
      return json(500, { error: "INTERNAL" }, cors);
    }
  };
}
