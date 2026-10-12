// Kasse: reserviert Bestand (RPC), erstellt die Stripe-Checkout-Session und liefert die URL.
// Preise kommen nur aus der Datenbank. Deckt ein Gutschein alles, wird ohne Stripe abgeschlossen.
import type Stripe from "stripe";
import { getUser } from "../_shared/auth.ts";
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { clientIp, HttpError, json, readJson, str, UUID, withHttp } from "../_shared/http.ts";
import { toLocale, type Locale } from "../_shared/money.ts";
import { INTEGRATION_ID } from "../_shared/stripe.ts";

interface ReservedLine {
  variant_id: string;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  unit_price_cents: number;
  quantity: number;
}

interface Reservation {
  order_id: string;
  order_number: number;
  status_token: string;
  email: string;
  subtotal_cents: number;
  discount_cents: number;
  discount_code: string | null;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  lines: ReservedLine[];
}

interface GiftReservation {
  order_id: string;
  order_number: number;
  status_token: string;
  email: string;
  total_cents: number;
  purchase: { recipient_name: string | null; recipient_email: string | null };
}

// Stripe verlangt mindestens 30 Minuten ab Erstellung der Session; 31, damit Netzwerkzeit nicht stört.
// Die Reservierung in der Datenbank läuft 35 Minuten, also länger als die Session.
const SESSION_MINUTES = 31;

function prefix(locale: Locale): string {
  return locale === "en" ? "/en" : "";
}

function imageUrl(deps: Deps, path: string | null): string[] {
  if (!path || path.startsWith("asset:")) return [];
  if (/^https:\/\//.test(path)) return [path];
  return [
    `${deps.env.supabaseUrl}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`,
  ];
}

type ProductData = Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData;

/** Produktangaben für Stripe; leere Beschreibung und Bilder werden weggelassen. */
function productData(name: string, description: string | null, images: string[] = []): ProductData {
  return { name, ...(description ? { description } : {}), ...(images.length ? { images } : {}) };
}

function mapReserveError(error: unknown): never {
  if (error instanceof RpcError) {
    switch (error.code) {
      case "OUT_OF_STOCK":
        throw new HttpError(409, "OUT_OF_STOCK", {
          items: (Array.isArray(error.detail) ? error.detail : []).map(
            (i: { variant_id: string; available: number }) => ({
              variantId: i.variant_id,
              available: i.available,
            }),
          ),
        });
      case "DISCOUNT_INVALID":
      case "GIFT_CARD_INVALID":
        throw new HttpError(422, error.code, {
          reason: (error.detail as { reason?: string } | null)?.reason ?? "invalid",
        });
      case "INVALID_LINES":
      case "INVALID_EMAIL":
      case "INVALID_AMOUNT":
        throw new HttpError(
          400,
          error.code,
          error.detail && typeof error.detail === "object" ? { detail: error.detail } : {},
        );
    }
  }
  throw error;
}

function parseLines(value: unknown): { variant_id: string; quantity: number }[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30)
    throw new HttpError(400, "INVALID_LINES");
  return value.map((l) => {
    const line = l as { variantId?: unknown; quantity?: unknown };
    if (typeof line.variantId !== "string" || !UUID.test(line.variantId))
      throw new HttpError(400, "INVALID_LINES");
    if (
      typeof line.quantity !== "number" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 10
    ) {
      throw new HttpError(400, "INVALID_LINES");
    }
    return { variant_id: line.variantId, quantity: line.quantity };
  });
}

async function cancelQuietly(deps: Deps, orderId: string, reason: string) {
  await deps
    .rpc("cancel_order", { p_order_id: orderId, p_reason: reason })
    .catch((e) => console.error("Storno fehlgeschlagen", e));
}

async function createSession(
  deps: Deps,
  params: Stripe.Checkout.SessionCreateParams,
  orderId: string,
): Promise<Stripe.Checkout.Session> {
  try {
    return await deps.stripe.checkout.sessions.create(params, {
      idempotencyKey: `session-${orderId}`,
    });
  } catch (error) {
    console.error("Stripe-Session fehlgeschlagen", error);
    await cancelQuietly(deps, orderId, "stripe_error");
    throw new HttpError(502, "PAYMENT_PROVIDER");
  }
}

async function cartCheckout(
  deps: Deps,
  body: Record<string, unknown>,
  email: string,
  userId: string | null,
  locale: Locale,
) {
  const lines = parseLines(body["lines"]);
  const reservation = await deps
    .rpc<Reservation>("reserve_checkout", {
      p_lines: lines,
      p_email: email,
      p_locale: locale,
      p_discount_code: str(body["discountCode"], 40) ?? null,
      p_gift_card_code: str(body["giftCardCode"], 40) ?? null,
      p_user_id: userId,
    })
    .catch(mapReserveError);

  const base = deps.env.siteUrl + prefix(locale);
  const successUrl = `${base}/bestellung/${reservation.status_token}?bezahlt=1`;
  // Auch wenn Gutschein oder Rabatt alles decken, läuft die Bestellung über Stripe: Bei 0 Franken verlangt
  // Stripe keine Zahlung, erfasst aber die Lieferadresse. Der Webhook verbucht die Bestellung wie sonst.
  const free = reservation.total_cents === 0;

  const reduction = reservation.discount_cents + reservation.gift_card_cents;
  const couponAmount = Math.min(reduction, reservation.subtotal_cents);
  const stripeShipping = reservation.shipping_cents - (reduction - couponAmount);
  let couponId: string | undefined;
  if (couponAmount > 0) {
    const parts = [
      reservation.discount_cents > 0
        ? (locale === "en" ? "Discount" : "Rabatt") +
          (reservation.discount_code ? ` ${reservation.discount_code}` : "")
        : null,
      reservation.gift_card_cents > 0 ? (locale === "en" ? "Gift card" : "Gutschein") : null,
    ].filter(Boolean);
    try {
      const coupon = await deps.stripe.coupons.create(
        {
          amount_off: couponAmount,
          currency: "chf",
          duration: "once",
          max_redemptions: 1,
          name: parts.join(" + ").slice(0, 40),
        },
        { idempotencyKey: `coupon-${reservation.order_id}` },
      );
      couponId = coupon.id;
    } catch (error) {
      console.error("Stripe-Coupon fehlgeschlagen", error);
      await cancelQuietly(deps, reservation.order_id, "stripe_error");
      throw new HttpError(502, "PAYMENT_PROVIDER");
    }
  }

  const expiresAt = Math.floor(deps.now().getTime() / 1000) + SESSION_MINUTES * 60;
  const sizeWord = locale === "en" ? "Size" : "Grösse";
  const metadata = {
    order_id: reservation.order_id,
    order_number: String(reservation.order_number),
  };
  const session = await createSession(
    deps,
    {
      mode: "payment",
      integration_identifier: INTEGRATION_ID,
      locale: locale === "en" ? "en" : "de",
      customer_email: reservation.email,
      client_reference_id: reservation.order_id,
      metadata,
      // Ohne Zahlbetrag gibt es keinen PaymentIntent
      ...(free
        ? {}
        : {
            payment_intent_data: { metadata, description: `Axion AX-${reservation.order_number}` },
          }),
      line_items: reservation.lines.map((l): Stripe.Checkout.SessionCreateParams.LineItem => ({
        quantity: l.quantity,
        price_data: {
          currency: "chf",
          unit_amount: l.unit_price_cents,
          product_data: productData(
            l.title,
            [l.color, l.size ? `${sizeWord} ${l.size}` : null].filter(Boolean).join(" · "),
            imageUrl(deps, l.image),
          ),
        },
      })),
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      shipping_address_collection: { allowed_countries: deps.env.shippingCountries },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: locale === "en" ? "Swiss Post" : "Post",
            fixed_amount: { amount: stripeShipping, currency: "chf" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
      ],
      ...(deps.env.stripeRequireTerms
        ? { consent_collection: { terms_of_service: "required" as const } }
        : {}),
      expires_at: expiresAt,
      success_url: successUrl,
      cancel_url: `${base}/warenkorb?abgebrochen=${reservation.status_token}`,
    },
    reservation.order_id,
  );
  await deps.rpc("attach_checkout_session", {
    p_order_id: reservation.order_id,
    p_session_id: session.id,
    p_expires_at: new Date(expiresAt * 1000).toISOString(),
  });
  return json(200, { url: session.url, orderNumber: reservation.order_number });
}

async function giftCardCheckout(
  deps: Deps,
  body: Record<string, unknown>,
  email: string,
  userId: string | null,
  locale: Locale,
) {
  const amount = body["amountCents"];
  if (typeof amount !== "number" || !Number.isInteger(amount))
    throw new HttpError(400, "INVALID_AMOUNT");
  const reservation = await deps
    .rpc<GiftReservation>("reserve_gift_card_purchase", {
      p_amount_cents: amount,
      p_email: email,
      p_locale: locale,
      p_purchase: {
        recipient_name: str(body["recipientName"], 100) ?? null,
        recipient_email: str(body["recipientEmail"], 254) ?? null,
        sender_name: str(body["senderName"], 100) ?? null,
        message: str(body["message"], 500) ?? null,
      },
      p_user_id: userId,
    })
    .catch(mapReserveError);
  const base = deps.env.siteUrl + prefix(locale);
  const expiresAt = Math.floor(deps.now().getTime() / 1000) + SESSION_MINUTES * 60;
  const metadata = {
    order_id: reservation.order_id,
    order_number: String(reservation.order_number),
    kind: "gift_card",
  };
  const forName = reservation.purchase.recipient_name;
  const session = await createSession(
    deps,
    {
      mode: "payment",
      integration_identifier: INTEGRATION_ID,
      locale: locale === "en" ? "en" : "de",
      customer_email: reservation.email,
      client_reference_id: reservation.order_id,
      metadata,
      payment_intent_data: {
        metadata,
        description: `Axion AX-${reservation.order_number} Gutschein`,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "chf",
            unit_amount: reservation.total_cents,
            product_data: productData(
              locale === "en" ? "Axion gift card" : "Axion-Geschenkgutschein",
              forName ? (locale === "en" ? `For ${forName}` : `Für ${forName}`) : null,
            ),
          },
        },
      ],
      ...(deps.env.stripeRequireTerms
        ? { consent_collection: { terms_of_service: "required" as const } }
        : {}),
      expires_at: expiresAt,
      success_url: `${base}/bestellung/${reservation.status_token}?bezahlt=1`,
      cancel_url: `${base}/geschenkgutschein?abgebrochen=${reservation.status_token}`,
    },
    reservation.order_id,
  );
  await deps.rpc("attach_checkout_session", {
    p_order_id: reservation.order_id,
    p_session_id: session.id,
    p_expires_at: new Date(expiresAt * 1000).toISOString(),
  });
  return json(200, { url: session.url, orderNumber: reservation.order_number });
}

/**
 * Zurück von Stripe ohne Zahlung (cancel_url mit Status-Token): Reservierung sofort freigeben und die
 * Stripe-Session beenden, damit Bestand und Gutschein nicht 30 Minuten blockiert bleiben.
 */
async function releaseCheckout(deps: Deps, body: Record<string, unknown>) {
  const token = body["token"];
  if (typeof token !== "string" || !UUID.test(token)) throw new HttpError(400, "INVALID_TOKEN");
  const pending = await deps.rpc<{ order_id: string | null; session_id: string | null }>(
    "pending_checkout_by_token",
    { p_token: token },
  );
  if (!pending.order_id) return json(200, { released: false });
  // Zuerst bei Stripe beenden. Nur eine abgelaufene Session darf freigegeben werden: Ist sie schon bezahlt,
  // verbucht der Webhook die Bestellung, und Gutschein und Rabattcode bleiben verbraucht.
  if (pending.session_id && !(await expireSession(deps, pending.session_id)))
    return json(200, { released: false });
  const result = await deps.rpc<{ cancelled: boolean }>("cancel_checkout_by_token", {
    p_token: token,
  });
  return json(200, { released: result.cancelled });
}

/** true, wenn die Session bei Stripe abgelaufen ist (jetzt beendet oder schon vorher). */
async function expireSession(deps: Deps, sessionId: string): Promise<boolean> {
  try {
    return (await deps.stripe.checkout.sessions.expire(sessionId)).status === "expired";
  } catch (error) {
    console.warn("Stripe-Session liess sich nicht beenden", (error as Error).message);
    try {
      return (await deps.stripe.checkout.sessions.retrieve(sessionId)).status === "expired";
    } catch {
      return false;
    }
  }
}

/** Schutz vor Missbrauch (Bestand blockieren, Codes durchprobieren), siehe checkout_guard. */
async function guard(deps: Deps, req: Request, email: string) {
  const verdict = await deps.rpc<"ok" | "rate_limited" | "too_many_open">("checkout_guard", {
    p_email: email,
    p_ip: clientIp(req),
  });
  if (verdict === "rate_limited") throw new HttpError(429, "RATE_LIMITED");
  if (verdict === "too_many_open") throw new HttpError(429, "TOO_MANY_CHECKOUTS");
}

export function createCheckoutHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req);
    if (body["kind"] === "release") return releaseCheckout(deps, body);
    const user = await getUser(req, deps.authClient);
    const email = str(body["email"], 254) ?? user?.email ?? undefined;
    if (!email) throw new HttpError(400, "INVALID_EMAIL");
    const locale = toLocale(body["locale"]);
    if (body["kind"] !== "gift_card" && body["kind"] !== "cart" && body["kind"] !== undefined)
      throw new HttpError(400, "BAD_REQUEST");
    await guard(deps, req, email);
    if (body["kind"] === "gift_card")
      return giftCardCheckout(deps, body, email, user?.id ?? null, locale);
    if (body["kind"] === "cart" || body["kind"] === undefined)
      return cartCheckout(deps, body, email, user?.id ?? null, locale);
    throw new HttpError(400, "BAD_REQUEST");
  });
}
