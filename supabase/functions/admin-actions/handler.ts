// Admin-Aktionen, die E-Mails auslösen: Versand melden (und Versandmeldung erneut senden), Bestätigung erneut senden,
// Gutschein ausstellen oder erneut senden. Dazu die automatische Übersetzung ins Englische (Dienst mit Schlüssel,
// der nicht in den Browser gehört). Alles andere erledigt das Admin direkt über RLS und RPC.
import { requireAdmin } from "../_shared/auth.ts";
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { sendEmail } from "../_shared/email/send.ts";
import {
  backInStock,
  giftCardEmail,
  orderConfirmation,
  type GiftCardInfo,
} from "../_shared/email/templates.ts";
import {
  HttpError,
  json,
  PREVIEW_ORIGINS,
  readJson,
  str,
  UUID,
  withHttp,
} from "../_shared/http.ts";
import { toLocale } from "../_shared/money.ts";
import { sendShippingEmail, type OrderRecord } from "../_shared/order-mail.ts";
import { COPY_LIMITS, draftProductCopy } from "../_shared/copywrite.ts";
import { TRANSLATE_LIMITS, TranslateError, translateToEnglish } from "../_shared/translate.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function uuid(value: unknown, code = "INVALID_ID"): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, code);
  return value;
}

function optionalEmail(value: unknown): string | null {
  const email = str(value, 254);
  if (!email) return null;
  if (!EMAIL.test(email)) throw new HttpError(400, "INVALID_EMAIL");
  return email.toLowerCase();
}

function mapRpcError(error: unknown): never {
  if (error instanceof RpcError) {
    switch (error.code) {
      case "ORDER_NOT_FOUND":
        throw new HttpError(404, error.code);
      case "ORDER_NOT_SHIPPABLE":
        throw new HttpError(409, error.code);
      case "INVALID_TRACKING":
      case "INVALID_AMOUNT":
      case "INVALID_EMAIL":
        throw new HttpError(400, error.code);
    }
  }
  throw error;
}

async function loadOrder(deps: Deps, orderId: string): Promise<OrderRecord> {
  const order = await deps.rpc<OrderRecord | null>("get_order_for_email", { p_order_id: orderId });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
  return order;
}

async function ship(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const orderId = uuid(body["orderId"]);
  const tracking = str(body["trackingNumber"], 60) ?? null;
  // Wer die Kundschaft benachrichtigt, muss auch die Sendungsnummer angeben (sonst bleibt die Mail ohne Verfolgung).
  if (body["notify"] !== false && !tracking) throw new HttpError(400, "TRACKING_REQUIRED");
  const order = await deps
    .rpc<OrderRecord>("mark_order_shipped", {
      p_order_id: orderId,
      p_tracking: tracking,
    })
    .catch(mapRpcError);
  const result = { status: order.status, trackingNumber: order.tracking_number };
  if (body["notify"] === false) return json(200, { ...result, emailed: false });
  // Der Versand ist gespeichert; scheitert die E-Mail, kann das Admin sie erneut senden.
  try {
    await sendShippingEmail(deps, order);
  } catch (error) {
    console.error("Versand-E-Mail fehlgeschlagen", error);
    return json(200, { ...result, emailed: false, emailError: true });
  }
  return json(200, { ...result, emailed: true });
}

async function resendShipping(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const order = await loadOrder(deps, uuid(body["orderId"]));
  if (order.status !== "shipped") throw new HttpError(409, "ORDER_NOT_SHIPPED");
  await sendShippingEmail(deps, order, { dedupe: false });
  return json(200, { emailed: true, to: order.email });
}

async function resendConfirmation(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const order = await loadOrder(deps, uuid(body["orderId"]));
  if (!["paid", "shipped", "refunded"].includes(order.status))
    throw new HttpError(409, "ORDER_NOT_PAID");
  const to = optionalEmail(body["to"]) ?? order.email;
  await sendEmail(to, orderConfirmation(order, deps.shop), deps.mail);
  return json(200, { emailed: true, to });
}

async function issueGiftCard(
  deps: Deps,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const amount = body["amountCents"];
  if (typeof amount !== "number" || !Number.isInteger(amount))
    throw new HttpError(400, "INVALID_AMOUNT");
  const recipientEmail = optionalEmail(body["recipientEmail"]);
  const card = await deps
    .rpc<GiftCardInfo & { id: string }>("issue_gift_card", {
      p_amount_cents: amount,
      p_locale: toLocale(body["locale"]),
      p_recipient_email: recipientEmail,
      p_recipient_name: str(body["recipientName"], 100) ?? null,
      p_sender_name: str(body["senderName"], 100) ?? null,
      p_message: str(body["message"], 500) ?? null,
      p_created_by: adminId,
      p_note: str(body["note"], 500) ?? null,
    })
    .catch(mapRpcError);
  const send = body["send"] !== false && Boolean(card.recipient_email);
  if (send) {
    // Der Gutschein ist bereits ausgestellt; scheitert die E-Mail, kann das Admin sie erneut senden.
    try {
      await sendEmail(
        card.recipient_email!,
        giftCardEmail(card, deps.shop),
        deps.mail,
        `giftcard-${card.id}`,
      );
    } catch (error) {
      console.error("Gutschein-E-Mail fehlgeschlagen", error);
      return json(200, { giftCard: card, emailed: false, emailError: true });
    }
  }
  return json(200, { giftCard: card, emailed: send });
}

async function resendGiftCard(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const card = await deps.rpc<(GiftCardInfo & { id: string }) | null>("get_gift_card_for_email", {
    p_gift_card_id: uuid(body["giftCardId"]),
  });
  if (!card) throw new HttpError(404, "GIFT_CARD_NOT_FOUND");
  const to = optionalEmail(body["to"]) ?? card.recipient_email ?? card.purchaser_email;
  if (!to) throw new HttpError(400, "INVALID_EMAIL");
  await sendEmail(to, giftCardEmail(card, deps.shop), deps.mail);
  return json(200, { emailed: true, to });
}

async function translate(
  deps: Deps,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const texts = body["texts"];
  if (!Array.isArray(texts) || texts.length === 0 || !texts.every((t) => typeof t === "string"))
    throw new HttpError(400, "BAD_REQUEST");
  if (texts.length > TRANSLATE_LIMITS.maxTexts) throw new HttpError(400, "TOO_MANY_TEXTS");
  const list = texts as string[];
  if (
    list.some((t) => t.length > TRANSLATE_LIMITS.maxChars) ||
    list.reduce((n, t) => n + t.length, 0) > TRANSLATE_LIMITS.maxTotalChars
  )
    throw new HttpError(400, "TEXT_TOO_LONG");
  // Tagesdeckel pro Admin (translate_guard): Das AI-Guthaben teilt sich Lovable Cloud mit Datenbank und Login.
  if (
    list.some((t) => t.trim()) &&
    !(await deps.rpc<boolean>("translate_guard", { p_user_id: adminId }))
  )
    throw new HttpError(429, "DAILY_LIMIT");
  try {
    return json(200, { translations: await translateToEnglish(list, deps.env.translate) });
  } catch (error) {
    if (!(error instanceof TranslateError)) throw error;
    if (error.code === "UNAVAILABLE") throw new HttpError(503, "TRANSLATION_UNAVAILABLE");
    if (error.code === "RATE_LIMITED") throw new HttpError(429, "RATE_LIMITED");
    throw new HttpError(502, "TRANSLATION_FAILED");
  }
}

/** Nach dem Aufstocken: bestätigte «Wieder da»-Wünsche der Grösse lesen, je eine E-Mail schicken und nur die
 *  verschickten abhaken (gescheiterte bleiben für das nächste Aufstocken stehen). */
async function notifyRestock(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const alerts = await deps.rpc<
    {
      id: string;
      email: string;
      locale: string;
      handle: string;
      title: string;
      color: string;
      size: string;
    }[]
  >("stock_alerts_pending", { p_variant_id: uuid(body["variantId"]) });
  const sent: string[] = [];
  let failed = 0;
  for (const a of alerts) {
    const locale = toLocale(a.locale);
    const prefix = locale === "en" ? "/en" : "";
    try {
      await sendEmail(
        a.email,
        backInStock(
          {
            locale,
            productUrl: `${deps.env.siteUrl}${prefix}/produkt/${a.handle}`,
            item: { title: a.title, color: a.color, size: a.size },
          },
          deps.shop,
        ),
        deps.mail,
        `restock-${a.id}`,
      );
      sent.push(a.id);
    } catch (error) {
      failed++;
      console.error("Wieder-da-E-Mail fehlgeschlagen", error);
    }
  }
  if (sent.length) await deps.rpc<number>("stock_alerts_done", { p_ids: sent });
  return json(200, { notified: sent.length, failed });
}

const REFUND_REASONS = ["requested_by_customer", "duplicate", "fraudulent"] as const;

/** Stripe-Fehler beim Erstatten in unsere Codes übersetzen (Stripe-Texte gehen nie ungefiltert ans Admin). */
function mapStripeRefundError(error: unknown): never {
  const e = (error ?? {}) as { type?: string; code?: string; message?: string };
  switch (e.code) {
    case "charge_already_refunded":
      throw new HttpError(409, "ALREADY_REFUNDED");
    case "charge_disputed":
      throw new HttpError(409, "CHARGE_DISPUTED");
    case "amount_too_large":
      throw new HttpError(409, "AMOUNT_TOO_LARGE");
    case "balance_insufficient":
    case "insufficient_funds":
      throw new HttpError(409, "INSUFFICIENT_BALANCE");
  }
  if (e.type === "StripePermissionError" || e.type === "StripeAuthenticationError")
    throw new HttpError(502, "STRIPE_PERMISSION");
  if (e.type === "StripeIdempotencyError") throw new HttpError(409, "REFUND_IN_PROGRESS");
  console.error("Stripe-Rückerstattung fehlgeschlagen", e.type, e.code, e.message);
  throw new HttpError(502, "PAYMENT_PROVIDER");
}

/** Kartenanteil über Stripe zurückerstatten. Verbucht wird nichts hier: Das Ereignis `charge.refunded` landet im
 *  Webhook (`record_refund`, idempotent) und setzt refunded_cents, Status und die Kundenmail. Der Gutscheinanteil
 *  gehört nicht dazu (`admin_credit_gift_card`); total_cents ist bereits der Kartenanteil. */
async function refund(
  deps: Deps,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const order = await loadOrder(deps, uuid(body["orderId"]));
  if (!["paid", "shipped"].includes(order.status)) throw new HttpError(409, "ORDER_NOT_PAID");
  const paymentIntent = (order as OrderRecord & { stripe_payment_intent_id?: string | null })
    .stripe_payment_intent_id;
  if (order.total_cents <= 0 || !paymentIntent) throw new HttpError(409, "NO_CARD_PAYMENT");
  const refunded = order.refunded_cents ?? 0;
  const remaining = order.total_cents - refunded;
  if (remaining <= 0) throw new HttpError(409, "ALREADY_REFUNDED");
  const requested = body["amountCents"] ?? remaining;
  if (typeof requested !== "number" || !Number.isInteger(requested) || requested < 1)
    throw new HttpError(400, "INVALID_AMOUNT");
  if (requested > remaining)
    throw new HttpError(400, "AMOUNT_TOO_LARGE", { remainingCents: remaining });
  const reason = body["reason"];
  if (reason !== undefined && reason !== null && !REFUND_REASONS.includes(reason as never))
    throw new HttpError(400, "BAD_REQUEST");
  try {
    const result = await deps.stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        amount: requested,
        ...(reason ? { reason: reason as (typeof REFUND_REASONS)[number] } : {}),
        metadata: { order_id: order.id, order_number: String(order.number), admin_id: adminId },
      },
      // Derselbe Klick (Doppelklick, Wiederholung nach Timeout) erstattet nur einmal; nach dem Webhook hat sich
      // refunded_cents geändert, ein weiterer Teilbetrag ist dann eine neue Anfrage.
      { idempotencyKey: `refund-${order.id}-${requested}-${refunded}` },
    );
    return json(200, {
      refundId: result.id,
      status: result.status,
      amountCents: result.amount,
      remainingCents: remaining - result.amount,
    });
  } catch (error) {
    return mapStripeRefundError(error);
  }
}

/** Textvorschlag (Deutsch) für ein Produkt; zählt auf dasselbe Tageslimit wie die Übersetzung. */
async function draftCopy(
  deps: Deps,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const field = (key: string) => str(body[key], COPY_LIMITS.maxFieldChars);
  const title = field("title");
  const category = field("category");
  const color = field("color");
  if (!title || !category || !color) throw new HttpError(400, "BAD_REQUEST");
  if (!(await deps.rpc<boolean>("translate_guard", { p_user_id: adminId })))
    throw new HttpError(429, "DAILY_LIMIT");
  try {
    const draft = await draftProductCopy(
      {
        title,
        category,
        color,
        material: field("material"),
        fit: field("fit"),
        notes: str(body["notes"], COPY_LIMITS.maxNotesChars),
      },
      deps.env.translate,
    );
    return json(200, draft);
  } catch (error) {
    if (!(error instanceof TranslateError)) throw error;
    if (error.code === "UNAVAILABLE") throw new HttpError(503, "TRANSLATION_UNAVAILABLE");
    if (error.code === "RATE_LIMITED") throw new HttpError(429, "RATE_LIMITED");
    throw new HttpError(502, "COPY_FAILED");
  }
}

/** Stripe-Modus aus dem Präfix des Schlüssels (sk_/rk_ + test/live). Nur der Modus verlässt die Funktion, nie der Schlüssel. */
export function stripeMode(key: string): "test" | "live" | "unknown" | "missing" {
  if (!key) return "missing";
  if (/^[sr]k_test_/.test(key)) return "test";
  if (/^[sr]k_live_/.test(key)) return "live";
  return "unknown";
}

/** Systemstatus für die Checkliste «Bereit für den Livegang»: nur Ja/Nein, ob Secrets gesetzt sind, nie ihre Werte. */
function systemStatus(deps: Deps): Response {
  const env = deps.env;
  const set = (value: string | null | undefined) => Boolean(value && value.trim());
  const required = {
    STRIPE_SECRET_KEY: set(env.stripeSecretKey),
    STRIPE_WEBHOOK_SECRET: set(env.stripeWebhookSecret),
    RESEND_API_KEY: set(env.resendApiKey),
    EMAIL_FROM: !/onboarding@resend\.dev/i.test(env.emailFrom),
    SITE_URL: set(env.siteUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(env.siteUrl),
    SHOP_CONTACT_EMAIL: set(env.shopContactEmail),
    SHOP_NOTIFY_EMAIL: set(env.shopNotifyEmail),
    SHOP_ADDRESS: set(env.shopAddress),
  };
  const optional = {
    LOVABLE_API_KEY: set(env.translate.apiKey),
    SHOP_VAT_RATE: env.vatRate !== null,
    STRIPE_REQUIRE_TERMS: env.stripeRequireTerms,
  };
  return json(200, {
    required,
    optional,
    stripeMode: stripeMode(env.stripeSecretKey),
    emailFromIsOnboarding: /onboarding@resend\.dev/i.test(env.emailFrom),
    // ALLOW_PREVIEW_ORIGINS muss vor dem Livegang weg
    previewOriginsAllowed: env.allowedOrigins.includes(PREVIEW_ORIGINS),
  });
}

export function createAdminActionsHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const admin = await requireAdmin(req, deps.authClient, deps.rpc);
    const body = await readJson(req);
    switch (body["action"]) {
      case "ship":
        return ship(deps, body);
      case "resend_shipping":
        return resendShipping(deps, body);
      case "resend_confirmation":
        return resendConfirmation(deps, body);
      case "issue_gift_card":
        return issueGiftCard(deps, admin.id, body);
      case "resend_gift_card":
        return resendGiftCard(deps, body);
      case "translate":
        return translate(deps, admin.id, body);
      case "notify_restock":
        return notifyRestock(deps, body);
      case "refund":
        return refund(deps, admin.id, body);
      case "draft_copy":
        return draftCopy(deps, admin.id, body);
      case "system_status":
        return systemStatus(deps);
      default:
        throw new HttpError(400, "BAD_REQUEST");
    }
  });
}
