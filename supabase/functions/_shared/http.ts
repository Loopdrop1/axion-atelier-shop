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

/** Eintrag in der Liste der erlaubten Domains: Lovable-Vorschau und localhost zulassen (ALLOW_PREVIEW_ORIGINS=1).
 *  Nur für die Testphase: Sonst könnte jede *.lovable.app-Seite Konto-Links und die Kasse benutzen. */
export const PREVIEW_ORIGINS = "*preview*";

/** Shop-Domain und weitere erlaubte Domains; Vorschau und localhost nur mit PREVIEW_ORIGINS in der Liste. */
export function isAllowedOrigin(origin: string | null, allowed: string[]): origin is string {
  if (origin === null) return false;
  if (allowed.includes(origin)) return true;
  return (
    allowed.includes(PREVIEW_ORIGINS) && (PREVIEW_ORIGIN.test(origin) || LOCAL_ORIGIN.test(origin))
  );
}

/** Netz der Kundschaft, nur für Rate-Limits: Cloudflare-Header zuerst (setzt Cloudflare selbst), sonst der erste
 *  gültige Eintrag von X-Forwarded-For. Leere oder ungültige Einträge zählen nicht. */
export function clientIp(req: Request): string | null {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    ...(req.headers.get("x-forwarded-for")?.split(",") ?? []),
  ];
  for (const raw of candidates) {
    const bucket = ipBucket(raw);
    if (bucket) return bucket;
  }
  return null;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** IPv4 einzeln, IPv6 als /64-Netz (ein Anschluss bekommt meist ein ganzes /64, sonst zählt jede Adresse
 *  einzeln). IPv4 in IPv6 (`::ffff:1.2.3.4`) gilt als IPv4. Keine gültige IP: null. */
export function ipBucket(raw: string | null | undefined): string | null {
  let ip = (raw ?? "").trim().toLowerCase();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1]!;
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(ip);
  if (withPort) ip = withPort[1]!;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) ip = mapped[1]!;
  const v4 = IPV4.exec(ip);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    return parts.every((n) => n <= 255) ? parts.join(".") : null;
  }
  return ipv6Net64(ip);
}

function ipv6Net64(ip: string): string | null {
  // Zonen-ID weg, eingebettete IPv4 am Ende zählt als zwei Gruppen
  const addr = (ip.split("%")[0] ?? "").replace(/\d{1,3}(?:\.\d{1,3}){3}$/, "0:0");
  if (!addr.includes(":") || !/^[0-9a-f:]+$/.test(addr)) return null;
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups = head;
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  }
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":")}::/64`;
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = isAllowedOrigin(origin, allowed);
  return {
    ...(ok ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

/** Liest JSON mit Grössenlimit (Standard 20 KB). Verlangt `Content-Type: application/json`: Damit braucht jede
 *  Anfrage aus dem Browser eine CORS-Freigabe (Preflight), und fremde Webseiten können ihre Besuchenden keine
 *  Anfragen mit `text/plain` an die Funktionen schicken lassen. */
export async function readJson(req: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  if (!/^application\/json\s*(;|$)/i.test(req.headers.get("content-type") ?? ""))
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE");
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
      if (error instanceof HttpError)
        return json(error.status, { error: error.code, ...error.extra }, cors);
      console.error(error);
      return json(500, { error: "INTERNAL" }, cors);
    }
  };
}
