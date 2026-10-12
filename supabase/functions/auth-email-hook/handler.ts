// Supabase «Send Email Hook»: Supabase Auth ruft diese Funktion statt eigener E-Mails auf.
// So gehen Konto-Bestätigung, Passwort-Link usw. in Axion-Optik und in der Sprache der Kundschaft raus.
// Doku: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
import { Webhook } from "standardwebhooks";
import type { Deps } from "../_shared/deps.ts";
import { sendEmail } from "../_shared/email/send.ts";
import {
  authEmail,
  securityNotice,
  type AuthKind,
  type EmailContent,
} from "../_shared/email/templates.ts";
import { isAllowedOrigin, json } from "../_shared/http.ts";
import { toLocale, type Locale } from "../_shared/money.ts";

export interface HookPayload {
  user: {
    id: string;
    email: string;
    new_email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
    old_email?: string | null;
  };
}

interface Message {
  to: string;
  content: EmailContent;
}

/** Typen, die mit token_hash über supabase.auth.verifyOtp bestätigt werden. */
const LINK_TYPES = new Set<AuthKind>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function hookError(status: number, message: string): Response {
  return json(status, { error: { http_code: status, message } });
}

interface LinkContext {
  base: string;
  locale: Locale;
  next: string | null;
}

/**
 * Bestimmt Domain, Sprache und Zielseite für den Link.
 * redirect_to kommt von Supabase (nur erlaubte Redirect-URLs); wir nutzen es nur, wenn es eine unserer Domains ist.
 */
function linkContext(deps: Deps, data: HookPayload): LinkContext {
  let locale = toLocale(data.user.user_metadata?.["locale"]);
  let redirect: URL | null = null;
  try {
    redirect = data.email_data.redirect_to ? new URL(data.email_data.redirect_to) : null;
  } catch {
    redirect = null;
  }
  if (!redirect || !isAllowedOrigin(redirect.origin, deps.env.allowedOrigins)) {
    return { base: deps.env.siteUrl, locale, next: null };
  }
  const path = redirect.pathname || "/";
  const isEn = path === "/en" || path.startsWith("/en/");
  if (isEn) locale = "en";
  else if (path !== "/") locale = "de";
  const rest = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return { base: redirect.origin, locale, next: rest === "/" ? null : rest + redirect.search };
}

function confirmUrl(ctx: LinkContext, tokenHash: string, type: string): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  if (ctx.next) params.set("next", ctx.next);
  return `${ctx.base}${ctx.locale === "en" ? "/en" : ""}/konto/bestaetigen?${params.toString()}`;
}

export function buildAuthMessages(deps: Deps, data: HookPayload): Message[] {
  const type = data.email_data.email_action_type;
  const ctx = linkContext(deps, data);
  const shop = { ...deps.shop, siteUrl: ctx.base };
  const { user, email_data: e } = data;

  if (type === "email_change") {
    const newEmail = user.new_email ?? null;
    // Achtung, laut Supabase-Doku vertauscht: token_hash_new gehört zur bisherigen Adresse, token_hash zur neuen.
    if (e.token_hash && e.token_hash_new && newEmail) {
      return [
        {
          to: user.email,
          content: authEmail(
            {
              kind: "email_change",
              audience: "current",
              newEmail,
              locale: ctx.locale,
              actionUrl: confirmUrl(ctx, e.token_hash_new, "email_change"),
            },
            shop,
          ),
        },
        {
          to: newEmail,
          content: authEmail(
            {
              kind: "email_change",
              audience: "new",
              locale: ctx.locale,
              actionUrl: confirmUrl(ctx, e.token_hash, "email_change"),
            },
            shop,
          ),
        },
      ];
    }
    const hash = e.token_hash || e.token_hash_new;
    return [
      {
        to: newEmail ?? user.email,
        content: authEmail(
          {
            kind: "email_change",
            audience: "new",
            locale: ctx.locale,
            actionUrl: confirmUrl(ctx, hash, "email_change"),
          },
          shop,
        ),
      },
    ];
  }

  if (LINK_TYPES.has(type as AuthKind)) {
    return [
      {
        to: user.email,
        content: authEmail(
          {
            kind: type as AuthKind,
            locale: ctx.locale,
            actionUrl: confirmUrl(ctx, e.token_hash, type),
          },
          shop,
        ),
      },
    ];
  }

  if (type === "reauthentication") {
    return [
      {
        to: user.email,
        content: authEmail(
          { kind: "reauthentication", locale: ctx.locale, actionUrl: "", token: e.token },
          shop,
        ),
      },
    ];
  }

  if (type.endsWith("_notification")) {
    const isEmailChange = type === "email_changed_notification";
    const to = isEmailChange ? e.old_email || user.email : user.email;
    return [
      {
        to,
        content: securityNotice(
          {
            kind: type,
            locale: ctx.locale,
            oldEmail: e.old_email ?? null,
            newEmail: isEmailChange ? user.email : null,
          },
          shop,
        ),
      },
    ];
  }

  throw new Error(`Unbekannter E-Mail-Typ: ${type}`);
}

export function createAuthEmailHookHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return hookError(405, "Nur POST");
    if (!deps.env.sendEmailHookSecret) return hookError(500, "SEND_EMAIL_HOOK_SECRET fehlt");
    const payload = await req.text();
    let data: HookPayload;
    try {
      const wh = new Webhook(deps.env.sendEmailHookSecret.replace(/^v1,/, ""));
      data = wh.verify(payload, Object.fromEntries(req.headers)) as HookPayload;
    } catch {
      return hookError(401, "Ungültige Signatur");
    }
    let messages: Message[];
    try {
      messages = buildAuthMessages(deps, data);
    } catch (error) {
      console.error(error);
      return hookError(400, (error as Error).message);
    }
    // Wiederholt Supabase denselben Aufruf (gleiche webhook-id), verhindert der Schlüssel doppelte E-Mails.
    const webhookId = req.headers.get("webhook-id") ?? crypto.randomUUID();
    try {
      for (const [i, m] of messages.entries()) {
        await sendEmail(m.to, m.content, deps.mail, `auth-${webhookId}-${i}`);
      }
    } catch (error) {
      console.error("Auth-E-Mail fehlgeschlagen", error);
      return hookError(500, "E-Mail konnte nicht gesendet werden");
    }
    return json(200, {});
  };
}
