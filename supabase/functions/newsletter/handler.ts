// Newsletter mit Double Opt-in: anmelden (Bestätigungs-E-Mail), bestätigen (Willkommens-E-Mail), abmelden.
// Die Antwort auf «anmelden» verrät nie, ob eine Adresse schon eingetragen ist.
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { sendEmail } from "../_shared/email/send.ts";
import { newsletterConfirm, newsletterWelcome } from "../_shared/email/templates.ts";
import { clientIp, HttpError, json, readJson, str, withHttp } from "../_shared/http.ts";
import { toLocale, type Locale } from "../_shared/money.ts";
import { pruneRateLimitsSometimes } from "../_shared/rate-limits.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN = /^[0-9a-f]{48}$/;
const SOURCES = new Set(["footer", "account", "checkout"]);

interface SubscribeResult {
  status: "pending" | "confirmed" | "rate_limited";
  token?: string;
  email?: string;
  locale?: Locale;
}

interface ConfirmResult {
  status: "confirmed" | "unsubscribed" | "invalid";
  newly_confirmed?: boolean;
  email?: string;
  locale?: Locale;
  welcome_code?: string | null;
  welcome_percent?: number | null;
}

const prefix = (locale: Locale) => (locale === "en" ? "/en" : "");

function link(deps: Deps, locale: Locale, page: "bestaetigen" | "abmelden", token: string): string {
  return `${deps.env.siteUrl}${prefix(locale)}/newsletter/${page}?token=${token}`;
}

function token(value: unknown): string {
  const t = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!TOKEN.test(t)) throw new HttpError(400, "INVALID_TOKEN");
  return t;
}

async function subscribe(
  deps: Deps,
  req: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  // Verstecktes Feld im Formular: von Menschen leer gelassen, von Bots oft ausgefüllt.
  if (str(body["website"])) return json(200, { ok: true });
  const email = str(body["email"], 254);
  if (!email || !EMAIL.test(email)) throw new HttpError(400, "INVALID_EMAIL");
  const consent = str(body["consent"], 1000);
  if (!consent) throw new HttpError(400, "CONSENT_REQUIRED");
  const source = str(body["source"], 20);
  const result = await deps
    .rpc<SubscribeResult>("newsletter_subscribe", {
      p_email: email,
      p_locale: toLocale(body["locale"]),
      p_consent: consent,
      p_source: source && SOURCES.has(source) ? source : "footer",
      p_ip: clientIp(req),
    })
    .catch((error: unknown) => {
      if (
        error instanceof RpcError &&
        (error.code === "INVALID_EMAIL" || error.code === "CONSENT_REQUIRED")
      ) {
        throw new HttpError(400, error.code);
      }
      throw error;
    });
  await pruneRateLimitsSometimes(deps);
  if (result.status === "rate_limited") throw new HttpError(429, "RATE_LIMITED");
  if (result.status === "pending" && result.token && result.email) {
    const locale = toLocale(result.locale);
    await sendEmail(
      result.email,
      newsletterConfirm(
        { locale, confirmUrl: link(deps, locale, "bestaetigen", result.token) },
        deps.shop,
      ),
      deps.mail,
    );
  }
  return json(200, { ok: true });
}

async function confirm(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const t = token(body["token"]);
  const result = await deps.rpc<ConfirmResult>("newsletter_confirm", { p_token: t });
  if (result.status === "confirmed" && result.newly_confirmed && result.email) {
    const locale = toLocale(result.locale);
    const welcome = newsletterWelcome(
      {
        locale,
        unsubscribeUrl: link(deps, locale, "abmelden", t),
        welcomeCode: result.welcome_code ?? null,
        welcomePercent: result.welcome_percent ?? null,
      },
      deps.shop,
    );
    // Die Anmeldung ist bestätigt, auch wenn die Willkommens-E-Mail scheitert.
    await sendEmail(result.email, welcome, deps.mail, `newsletter-welcome-${t.slice(0, 16)}`).catch(
      (e) => console.error("Willkommens-E-Mail fehlgeschlagen", e),
    );
  }
  return json(200, { status: result.status });
}

async function unsubscribe(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const result = await deps.rpc<{ status: "unsubscribed" | "invalid" }>("newsletter_unsubscribe", {
    p_token: token(body["token"]),
  });
  return json(200, { status: result.status });
}

export function createNewsletterHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req, 5_000);
    switch (body["action"]) {
      case "subscribe":
        return subscribe(deps, req, body);
      case "confirm":
        return confirm(deps, body);
      case "unsubscribe":
        return unsubscribe(deps, body);
      default:
        throw new HttpError(400, "BAD_REQUEST");
    }
  });
}
