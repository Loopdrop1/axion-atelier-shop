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
  shopNotifyEmail: string;
  sendEmailHookSecret: string;
  allowedOrigins: string[];
  /** Liefergebiet in der Kasse. SHIPPING_COUNTRIES, z. B. "CH,LI"; Standard nur CH. */
  shippingCountries: ShippingCountry[];
}

/** Länder, für die Versand, Preise und Rechtstexte vorbereitet sind. Liechtenstein bringt eigenes
 *  Konsumentenrecht mit (Rücktrittsrecht im Fernabsatz) und kommt nur nach Entscheid des Kunden dazu. */
export const SHIPPING_COUNTRIES = ["CH", "LI"] as const;
export type ShippingCountry = (typeof SHIPPING_COUNTRIES)[number];

function shippingCountries(value: string | undefined): ShippingCountry[] {
  const wanted = (value ?? "").split(",").map((s) => s.trim().toUpperCase());
  const list = SHIPPING_COUNTRIES.filter((c) => wanted.includes(c));
  return list.length ? [...list] : ["CH"];
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
  };
}

/** In Deno: readEnv((k) => Deno.env.get(k)) */
