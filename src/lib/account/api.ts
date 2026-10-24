// Kundenkonto: Anmeldung, Registrierung, Passwort, Bestellungen und Daten über Supabase Auth und RLS.
import type { AuthError, EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { callFunction } from "@/integrations/supabase/functions";
import { localePrefix, type Locale } from "@/i18n/locale";

export type AuthProblem =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "weak_password"
  | "rate_limited"
  | "same_password"
  | "email_exists"
  | "invalid_email"
  | "reauth_needed"
  | "not_configured"
  | "network"
  | "unknown";

/** Supabase-Fehler → verständlicher Grund (für die Texte in useT().account). */
export function authProblem(error: AuthError | Error | null | undefined): AuthProblem {
  if (!error) return "unknown";
  const code = "code" in error ? String(error.code ?? "") : "";
  const status = "status" in error ? Number(error.status) : 0;
  const message = error.message.toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials"))
    return "invalid_credentials";
  if (code === "email_not_confirmed" || message.includes("email not confirmed"))
    return "email_not_confirmed";
  if (code === "same_password" || message.includes("different from the old password"))
    return "same_password";
  if (code === "weak_password" || message.includes("password should")) return "weak_password";
  if (code === "email_exists" || code === "user_already_exists") return "email_exists";
  if (
    code === "email_address_invalid" ||
    (code === "validation_failed" && message.includes("email"))
  )
    return "invalid_email";
  if (code.startsWith("reauthentication")) return "reauth_needed";
  if (status === 429 || code.includes("rate_limit") || message.includes("rate limit"))
    return "rate_limited";
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "unknown";
}

type Result = { ok: true } | { ok: false; problem: AuthProblem };

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
const url = (locale: Locale, path: string) => `${origin()}${localePrefix(locale)}${path}`;

export const MIN_PASSWORD = 10;

export async function signIn(email: string, password: string): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, problem: authProblem(error) } : { ok: true };
}

/** signedIn = true, wenn Supabase ohne E-Mail-Bestätigung sofort eine Sitzung liefert (Bestätigung ausgeschaltet). */
export async function signUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: Locale;
}): Promise<{ ok: true; signedIn: boolean } | { ok: false; problem: AuthProblem }> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: url(input.locale, "/konto"),
      data: {
        locale: input.locale,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      },
    },
  });
  // Existiert die Adresse schon, meldet Supabase (bei aktiver E-Mail-Bestätigung) keinen Fehler.
  // So verrät die Registrierung nicht, wer schon ein Konto hat.
  return error
    ? { ok: false, problem: authProblem(error) }
    : { ok: true, signedIn: Boolean(data.session) };
}

/** Bestätigungslink erneut senden (nach «E-Mail nicht bestätigt» bei der Anmeldung). */
export async function resendConfirmation(email: string, locale: Locale): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: url(locale, "/konto") },
  });
  return error ? { ok: false, problem: authProblem(error) } : { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function requestPasswordReset(email: string, locale: Locale): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: url(locale, "/konto/passwort-neu"),
  });
  // Unbekannte Adressen melden wir gleich wie bekannte (kein Rückschluss auf Konten).
  if (error && authProblem(error) === "rate_limited") return { ok: false, problem: "rate_limited" };
  return { ok: true };
}

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export function isOtpType(value: unknown): value is EmailOtpType {
  return typeof value === "string" && (OTP_TYPES as string[]).includes(value);
}

/** Link aus einer Konto-E-Mail bestätigen (token_hash aus dem Send Email Hook). */
export async function verifyEmailLink(tokenHash: string, type: EmailOtpType): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  return error ? { ok: false, problem: authProblem(error) } : { ok: true };
}

export async function updatePassword(password: string): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, problem: authProblem(error) } : { ok: true };
}

export async function changeEmail(email: string, locale: Locale): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: url(locale, "/konto/daten") },
  );
  return error ? { ok: false, problem: authProblem(error) } : { ok: true };
}

/** Gastbestellungen mit derselben bestätigten E-Mail dem Konto zuordnen. Gibt die Anzahl zurück. */
export async function claimGuestOrders(): Promise<number> {
  if (!backendConfigured) return 0;
  const { data, error } = await supabase.rpc("claim_guest_orders");
  if (error) return 0;
  return Number(data) || 0;
}

export interface OrderSummary {
  id: string;
  number: number;
  status: string;
  kind: string;
  total_cents: number;
  created_at: string;
}

export async function listMyOrders(): Promise<OrderSummary[]> {
  if (!backendConfigured) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, status, kind, total_cents, created_at")
    .neq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

const ORDER_DETAIL =
  "id, number, status, kind, created_at, paid_at, shipped_at, email, subtotal_cents, discount_cents, discount_code, gift_card_cents, shipping_cents, total_cents, refunded_cents, shipping_name, shipping_address, payment_method, tracking_number, gift_card_purchase, order_items(id, title, size, color, image, handle, unit_price_cents, quantity, line_total_cents)";

export async function getMyOrder(number: number) {
  if (!backendConfigured) return null;
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL)
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getMyOrder>>>;

export interface ProfileAddress {
  line1?: string;
  line2?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

export interface Profile {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: ProfileAddress | null;
  locale: string;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!backendConfigured) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, address, locale")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, address: (data.address as ProfileAddress | null) ?? null } : null;
}

export async function updateProfile(userId: string, profile: Profile): Promise<Result> {
  if (!backendConfigured) return { ok: false, problem: "not_configured" };
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: profile.first_name?.trim() || null,
      last_name: profile.last_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      address: profile.address ? { ...profile.address } : null,
      locale: profile.locale === "en" ? "en" : "de",
    })
    .eq("id", userId);
  return error ? { ok: false, problem: "unknown" } : { ok: true };
}

export type DeleteResult =
  { ok: true } | { ok: false; error: "LAST_ADMIN" | "NETWORK" | "UNKNOWN" };

/** Löscht das eigene Konto. Danach muss die Seite abmelden (useSignOut), erst nachdem sie die Bestätigung zeigt. */
export async function deleteMyAccount(): Promise<DeleteResult> {
  const result = await callFunction<{ deleted: boolean }>("account-delete", { confirm: true });
  if (result.ok) return { ok: true };
  if (result.error === "LAST_ADMIN") return { ok: false, error: "LAST_ADMIN" };
  return { ok: false, error: result.error === "NETWORK" ? "NETWORK" : "UNKNOWN" };
}

/** Sendungsverfolgung der Post (gleich wie in der Versandmeldung, supabase/functions/_shared/email/templates.ts). */
export function trackingUrl(tracking: string): string {
  return `https://www.post.ch/swisspost-tracking?formattedParcelCodes=${encodeURIComponent(tracking)}`;
}
