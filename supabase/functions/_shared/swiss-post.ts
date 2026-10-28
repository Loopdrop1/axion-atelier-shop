// Etiketten der Schweizerischen Post (Digital Commerce API «Barcode», Endpunkt generateAddressLabel).
//
// ACHTUNG, NOCH NICHT GEGEN DIE ECHTE API GETESTET: Axion hat noch kein Post-Geschäftskundenkonto. Aufbau der
// Anfrage und der Antwort folgen der Dokumentation (https://developer.post.ch, API «Barcode»), die Fehlercodes
// ausser E9993/E9994/E9997/E9999 (vorübergehend) sind Annahmen. Vor dem ersten echten Einsatz mit einem
// Testkonto der Post prüfen (docs/BETRIEB.md, «Post-Etiketten»).
//
// Ohne die Secrets POST_CLIENT_ID, POST_CLIENT_SECRET und POST_FRANKING_LICENSE ist die Funktion aus
// (POST_NOT_CONFIGURED). Keine Secrets, Adressen oder Etiketten ins Log: nur Fehlercodes.
import type { Address } from "./email/templates.ts";

export const POST_OAUTH_URL = "https://api.post.ch/OAuth/token";
export const POST_LABEL_URL = "https://dcapi.apis.post.ch/barcode/v1/generateAddressLabel";
export const POST_SCOPE = "DCAPI_BARCODE_READ";
/** Vorübergehende Fehler der Post: einmal wiederholen. */
export const POST_TRANSIENT_CODES = ["E9993", "E9994", "E9997", "E9999"];

export type PostProduct = "ECO" | "PRI";

export interface SwissPostConfig {
  clientId: string;
  clientSecret: string;
  /** Frankierlizenz (Vertragsnummer der Post) */
  frankingLicense: string;
  /** B-Post (ECO) oder A-Post (PRI) */
  product: PostProduct;
  /** Telefon und E-Mail der Kundschaft auf dem Etikett (nur wenn die Datenschutzerklärung die Post nennt) */
  sendRecipientContact: boolean;
  /** Nur für Tests */
  oauthUrl?: string | undefined;
  labelUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  now?: (() => number) | undefined;
}

export type PostErrorCode =
  | "POST_NOT_CONFIGURED"
  | "POST_SENDER_INVALID"
  | "POST_ADDRESS_INVALID"
  | "POST_AUTH_FAILED"
  | "POST_LICENSE_INVALID"
  | "POST_RATE_LIMITED"
  | "POST_UNAVAILABLE"
  | "POST_REJECTED"
  | "POST_BAD_RESPONSE";

export class PostError extends Error {
  constructor(
    readonly code: PostErrorCode,
    /** Fehlercodes der Post (nie Adressen), nur fürs Log */
    readonly detail: string[] = [],
  ) {
    super(code);
  }
}

export function isPostConfigured(cfg: SwissPostConfig): boolean {
  return Boolean(cfg.clientId.trim() && cfg.clientSecret.trim() && cfg.frankingLicense.trim());
}

// Anfrage ----------------------------------------------------------------------------------------------

export interface PostSender {
  name1: string;
  street: string;
  zip: string;
  city: string;
  country: "CH";
}

/** Absender aus Shopname und SHOP_ADDRESS im Format «Strasse Nr, PLZ Ort» (Beispiel: «Musterstrasse 1, 8000 Zürich»). */
export function parseSender(shopName: string, address: string): PostSender {
  const parts = address.split(/[,\n]/).map((s) => s.trim());
  const place = parts.at(-1) ?? "";
  const m = /^(?:CH[- ]?)?(\d{4})\s+(.+)$/.exec(place);
  const street = parts.slice(0, -1).join(", ");
  if (!m || !street || !shopName.trim()) throw new PostError("POST_SENDER_INVALID");
  return { name1: shopName.trim(), street, zip: m[1]!, city: m[2]!.trim(), country: "CH" };
}

export interface PostOrder {
  number: number;
  email: string;
  phone?: string | null | undefined;
  shipping_name: string | null;
  shipping_address: Address | null;
}

export interface LabelRequest {
  language: "DE";
  frankingLicense: string;
  ppFranking: false;
  customer: PostSender;
  customerSystem: "AXION";
  labelDefinition: {
    labelLayout: "A6";
    printAddresses: "RECIPIENT_AND_CUSTOMER";
    imageFileType: "PDF";
    imageResolution: 300;
    printPreview: false;
  };
  sendingID?: string;
  item: {
    itemID: string;
    recipient: {
      name1: string;
      street: string;
      zip: string;
      city: string;
      country?: string;
      phone?: string;
      email?: string;
    };
    attributes: { przl: PostProduct[] };
  };
}

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

/** Lieferadresse der Bestellung (orders.shipping_address) als Empfänger. Nur Schweiz und Liechtenstein. */
export function buildLabelRequest(
  cfg: SwissPostConfig,
  order: PostOrder,
  sender: PostSender,
  opts: { sendingId?: string } = {},
): LabelRequest {
  const a = order.shipping_address;
  const name = clean(order.shipping_name);
  const street = [clean(a?.line1), clean(a?.line2)].filter(Boolean).join(", ");
  const zip = clean(a?.postal_code);
  const city = clean(a?.city);
  const country = clean(a?.country).toUpperCase();
  if (!name || !street || !zip || !city || !/^[A-Z]{2}$/.test(country))
    throw new PostError("POST_ADDRESS_INVALID");
  const phone = clean(order.phone);
  const email = clean(order.email);
  return {
    language: "DE",
    frankingLicense: cfg.frankingLicense,
    ppFranking: false,
    customer: sender,
    customerSystem: "AXION",
    labelDefinition: {
      labelLayout: "A6",
      printAddresses: "RECIPIENT_AND_CUSTOMER",
      imageFileType: "PDF",
      imageResolution: 300,
      printPreview: false,
    },
    ...(opts.sendingId ? { sendingID: opts.sendingId } : {}),
    item: {
      itemID: `AX-${order.number}`,
      recipient: {
        name1: name,
        street,
        zip,
        city,
        // Inland ohne Länderangabe, Liechtenstein ausdrücklich
        ...(country !== "CH" ? { country } : {}),
        ...(cfg.sendRecipientContact && phone ? { phone } : {}),
        ...(cfg.sendRecipientContact && email ? { email } : {}),
      },
      attributes: { przl: [cfg.product] },
    },
  };
}

// Antwort ----------------------------------------------------------------------------------------------

export interface PostLabel {
  identCode: string;
  /** PDF, Base64 */
  labelPdfBase64: string;
  warnings: string[];
}

interface PostMessage {
  code?: string;
  message?: string;
}

function messages(value: unknown): PostMessage[] {
  return Array.isArray(value)
    ? value.filter((m): m is PostMessage => typeof m === "object" && m !== null)
    : [];
}

/** Fehler der Post (Antwortkörper) in unseren Code übersetzen. Reine Funktion. */
export function mapPostErrors(errors: PostMessage[]): PostError {
  const codes = errors.map((e) => String(e.code ?? "")).filter(Boolean);
  const text = errors.map((e) => `${e.code ?? ""} ${e.message ?? ""}`).join(" ");
  if (codes.some((c) => POST_TRANSIENT_CODES.includes(c)))
    return new PostError("POST_UNAVAILABLE", codes);
  if (/franking|frankier|licen[cs]e|lizenz/i.test(text))
    return new PostError("POST_LICENSE_INVALID", codes);
  if (/recipient|zip|postal|street|city|country|address|adresse|plz/i.test(text))
    return new PostError("POST_ADDRESS_INVALID", codes);
  return new PostError("POST_REJECTED", codes);
}

/** Antwort von generateAddressLabel lesen. Wirft PostError bei Fehlern oder fehlendem Etikett. Reine Funktion. */
export function parseLabelResponse(body: unknown): PostLabel {
  const root = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const item = (
    typeof root["item"] === "object" && root["item"] !== null ? root["item"] : {}
  ) as Record<string, unknown>;
  const errors = [...messages(root["errors"]), ...messages(item["errors"])];
  if (errors.length) throw mapPostErrors(errors);
  const label = Array.isArray(item["label"]) ? item["label"][0] : undefined;
  const identCode = typeof item["identCode"] === "string" ? item["identCode"].trim() : "";
  if (!identCode || typeof label !== "string" || !label) throw new PostError("POST_BAD_RESPONSE");
  const warnings = [...messages(root["warnings"]), ...messages(item["warnings"])].map((w) =>
    String(w.code ?? w.message ?? "warning"),
  );
  return { identCode, labelPdfBase64: label, warnings };
}

// Aufruf -----------------------------------------------------------------------------------------------

const tokens = new Map<string, { token: string; expiresAt: number }>();

/** Nur für Tests: gespeicherte Zugangstoken verwerfen. */
export function resetPostTokenCache(): void {
  tokens.clear();
}

const nowOf = (cfg: SwissPostConfig) => (cfg.now ?? Date.now)();
const sleepOf = (cfg: SwissPostConfig) =>
  cfg.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

async function http(cfg: SwissPostConfig, url: string, init: RequestInit): Promise<Response> {
  try {
    return await (cfg.fetchImpl ?? fetch)(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    console.error("Post nicht erreichbar", error instanceof Error ? error.name : "Error");
    // Netzfehler zählen wie ein 503: einmal wiederholen
    return new Response(null, { status: 503 });
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function cacheKey(cfg: SwissPostConfig): string {
  return `${cfg.oauthUrl ?? POST_OAUTH_URL}|${cfg.clientId}`;
}

/** OAuth2 «client credentials»; der Token wird bis kurz vor Ablauf wiederverwendet. */
async function accessToken(cfg: SwissPostConfig, force: boolean): Promise<string> {
  const key = cacheKey(cfg);
  const cached = tokens.get(key);
  if (!force && cached && cached.expiresAt > nowOf(cfg)) return cached.token;
  tokens.delete(key);
  for (let attempt = 0; ; attempt++) {
    const res = await http(cfg, cfg.oauthUrl ?? POST_OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: POST_SCOPE,
      }).toString(),
    });
    if (res.status >= 500 || res.status === 429) {
      if (attempt === 0) {
        await sleepOf(cfg)(500);
        continue;
      }
      throw new PostError(res.status === 429 ? "POST_RATE_LIMITED" : "POST_UNAVAILABLE");
    }
    const data = (await readJson(res)) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!res.ok || typeof data?.access_token !== "string" || !data.access_token)
      throw new PostError("POST_AUTH_FAILED");
    const seconds =
      typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 300;
    // 60 s Reserve, damit kein Token mitten im Aufruf abläuft
    tokens.set(key, {
      token: data.access_token,
      expiresAt: nowOf(cfg) + Math.max(0, seconds - 60) * 1000,
    });
    return data.access_token;
  }
}

/** Etikett erzeugen. 401: einmal mit neuem Token; vorübergehende Fehler (E9993/E9994/E9997/E9999, 5xx, 429):
 *  einmal nach kurzer Pause; alles andere wird in einen klaren PostError übersetzt. */
export async function createPostLabel(
  cfg: SwissPostConfig,
  order: PostOrder,
  sender: PostSender,
  opts: { sendingId?: string } = {},
): Promise<PostLabel> {
  if (!isPostConfigured(cfg)) throw new PostError("POST_NOT_CONFIGURED");
  const request = JSON.stringify(buildLabelRequest(cfg, order, sender, opts));
  let renewed = false;
  let retried = false;
  for (;;) {
    const token = await accessToken(cfg, false);
    const res = await http(cfg, cfg.labelUrl ?? POST_LABEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: request,
    });
    if (res.status === 401 && !renewed) {
      renewed = true;
      tokens.delete(cacheKey(cfg));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new PostError("POST_AUTH_FAILED");
    const transient = res.status === 429 || res.status >= 500;
    let failure: PostError;
    if (transient) {
      failure = new PostError(res.status === 429 ? "POST_RATE_LIMITED" : "POST_UNAVAILABLE");
    } else {
      const body = await readJson(res);
      try {
        if (!res.ok) {
          const root = (body ?? {}) as Record<string, unknown>;
          const errs = messages(root["errors"]);
          throw errs.length
            ? mapPostErrors(errs)
            : new PostError("POST_REJECTED", [String(res.status)]);
        }
        return parseLabelResponse(body);
      } catch (error) {
        if (!(error instanceof PostError)) throw error;
        failure = error;
      }
    }
    if (failure.code !== "POST_UNAVAILABLE" && failure.code !== "POST_RATE_LIMITED") throw failure;
    if (retried) throw failure;
    retried = true;
    await sleepOf(cfg)(750);
  }
}
