// Konfiguration der Edge Functions. In Supabase kommen die Werte aus den Secrets,
// in Tests werden sie direkt übergeben.
import { PREVIEW_ORIGINS } from "./http.ts";

export interface FunctionEnv {
  supabaseUrl: string;
  /** Server-Schlüssel (umgeht RLS). Neu: SUPABASE_SECRET_KEYS.default, alt: SUPABASE_SERVICE_ROLE_KEY. */
  serviceKey: string;
  /** Öffentlicher Schlüssel für Auth-Abfragen. Neu: SUPABASE_PUBLISHABLE_KEYS.default, alt: SUPABASE_ANON_KEY. */
  publicKey: string;
  siteUrl: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  /** Nur für Tests: Stripe-Fake statt api.stripe.com */
  stripeApiBase?: string | undefined;
  stripeRequireTerms: boolean;
  resendApiKey: string;
  /** Nur für Tests: Resend-Fake statt api.resend.com */
  resendApiBase?: string | undefined;
  emailFrom: string;
  shopName: string;
  shopContactEmail: string;
  shopAddress: string;
  /** Rückgabefrist in Tagen für Mails (SHOP_RETURN_DAYS, Standard 14) */
  shopReturnDays: number;
  shopNotifyEmail: string;
  sendEmailHookSecret: string;
  allowedOrigins: string[];
  /** Liefergebiet in der Kasse. SHIPPING_COUNTRIES, z. B. "CH,LI"; Standard nur CH. */
  shippingCountries: ShippingCountry[];
  /** MWST-Satz in Prozent (SHOP_VAT_RATE), nur setzen, wenn der Shop MWST-pflichtig ist. Wird pro Bestellung gespeichert. */
  vatRate: number | null;
  /** Post-Etiketten (Digital Commerce API «Barcode»), noch ungetestet: POST_CLIENT_ID, POST_CLIENT_SECRET,
   *  POST_FRANKING_LICENSE, POST_PRODUCT (ECO oder PRI, Standard ECO). Leer = Funktion aus. */
  postClientId: string;
  postClientSecret: string;
  postFrankingLicense: string;
  postProduct: "ECO" | "PRI";
  /** POST_SEND_RECIPIENT_CONTACT=1: Telefon und E-Mail der Kundschaft auf dem Etikett (Standard aus) */
  postSendRecipientContact: boolean;
  /** Nur für Tests: Post-Fake statt api.post.ch / dcapi.apis.post.ch */
  postOauthUrl?: string | undefined;
  postLabelUrl?: string | undefined;
  /** Meldung an den Shop, wenn der Bestand einer Grösse mit einer Bestellung auf diesen Wert oder darunter fällt
   *  (LOW_STOCK_THRESHOLD, Standard 2; 0 = nur bei ausverkauft). */
  lowStockThreshold: number;
  /** Automatische Übersetzung (OpenAI-Schnittstelle). Standard: Lovable AI Gateway mit LOVABLE_API_KEY. */
  translate: { apiBase: string; apiKey: string; model: string };
}

export const DEFAULT_TRANSLATE_API = "https://ai.gateway.lovable.dev/v1";
export const DEFAULT_TRANSLATE_MODEL = "google/gemini-2.5-flash";

/** Länder, für die Versand, Preise und Rechtstexte vorbereitet sind. Liechtenstein bringt eigenes
 *  Konsumentenrecht mit (Rücktrittsrecht im Fernabsatz) und kommt nur nach Entscheid des Kunden dazu. */
export const SHIPPING_COUNTRIES = ["CH", "LI"] as const;
export type ShippingCountry = (typeof SHIPPING_COUNTRIES)[number];

function shippingCountries(value: string | undefined): ShippingCountry[] {
  const wanted = (value ?? "").split(",").map((s) => s.trim().toUpperCase());
  const list = SHIPPING_COUNTRIES.filter((c) => wanted.includes(c));
  return list.length ? [...list] : ["CH"];
}

function vatRate(value: string | undefined): number | null {
  const n = Number((value ?? "").replace(",", "."));
  return value?.trim() && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export type EnvSource = (key: string) => string | undefined;

function firstKey(json: string | undefined): string | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as Record<string, string>;
    return parsed["default"] ?? Object.values(parsed)[0];
  } catch {
    return undefined;
  }
}

/** Ganze Zahl über 0, sonst der Standardwert (falsch gesetzte Variable soll keine Mail unbrauchbar machen). */
function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Ganze Zahl ab 0, sonst der Standardwert. */
function nonNegativeInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readEnv(get: EnvSource): FunctionEnv {
  const siteUrl = (get("SITE_URL") ?? "http://localhost:5174").replace(/\/+$/, "");
  return {
    supabaseUrl: (get("SUPABASE_URL") ?? "").replace(/\/+$/, ""),
    serviceKey: firstKey(get("SUPABASE_SECRET_KEYS")) ?? get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    publicKey: firstKey(get("SUPABASE_PUBLISHABLE_KEYS")) ?? get("SUPABASE_ANON_KEY") ?? "",
    siteUrl,
    stripeSecretKey: get("STRIPE_SECRET_KEY") ?? "",
    stripeWebhookSecret: get("STRIPE_WEBHOOK_SECRET") ?? "",
    stripeApiBase: get("STRIPE_API_BASE"),
    stripeRequireTerms: get("STRIPE_REQUIRE_TERMS") === "1",
    resendApiKey: get("RESEND_API_KEY") ?? "",
    resendApiBase: get("RESEND_API_BASE"),
    emailFrom: get("EMAIL_FROM") ?? "Axion <onboarding@resend.dev>",
    shopName: get("SHOP_NAME") ?? "Axion",
    shopContactEmail: get("SHOP_CONTACT_EMAIL") ?? "",
    shopAddress: get("SHOP_ADDRESS") ?? "",
    shopReturnDays: positiveInt(get("SHOP_RETURN_DAYS"), 14),
    shopNotifyEmail: get("SHOP_NOTIFY_EMAIL") ?? "",
    sendEmailHookSecret: get("SEND_EMAIL_HOOK_SECRET") ?? "",
    allowedOrigins: [
      siteUrl,
      ...(get("ALLOWED_ORIGINS") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ...(get("ALLOW_PREVIEW_ORIGINS") === "1" ? [PREVIEW_ORIGINS] : []),
    ],
    shippingCountries: shippingCountries(get("SHIPPING_COUNTRIES")),
    vatRate: vatRate(get("SHOP_VAT_RATE")),
    postClientId: get("POST_CLIENT_ID") ?? "",
    postClientSecret: get("POST_CLIENT_SECRET") ?? "",
    postFrankingLicense: get("POST_FRANKING_LICENSE") ?? "",
    postProduct: get("POST_PRODUCT")?.trim().toUpperCase() === "PRI" ? "PRI" : "ECO",
    postSendRecipientContact: get("POST_SEND_RECIPIENT_CONTACT") === "1",
    postOauthUrl: get("POST_OAUTH_URL"),
    postLabelUrl: get("POST_LABEL_URL"),
    lowStockThreshold: nonNegativeInt(get("LOW_STOCK_THRESHOLD"), 2),
    translate: {
      apiBase: get("TRANSLATE_API_BASE") || DEFAULT_TRANSLATE_API,
      apiKey: get("TRANSLATE_API_KEY") || get("LOVABLE_API_KEY") || "",
      model: get("TRANSLATE_MODEL") || DEFAULT_TRANSLATE_MODEL,
    },
  };
}

/** In Deno: readEnv((k) => Deno.env.get(k)) */
