// Admin-Aktionen, die E-Mails auslösen: Versand melden (und Versandmeldung erneut senden), Bestätigung erneut senden,
// Gutschein ausstellen oder erneut senden. Alles andere erledigt das Admin direkt über RLS und RPC.
import { requireAdmin } from "../_shared/auth.ts";
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { sendEmail } from "../_shared/email/send.ts";
import { giftCardEmail, orderConfirmation, type GiftCardInfo } from "../_shared/email/templates.ts";
import { HttpError, json, readJson, str, UUID, withHttp } from "../_shared/http.ts";
import { toLocale } from "../_shared/money.ts";
import { sendShippingEmail, type OrderRecord } from "../_shared/order-mail.ts";

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
  const order = await deps
    .rpc<OrderRecord>("mark_order_shipped", {
      p_order_id: orderId,
      p_tracking: str(body["trackingNumber"], 60) ?? null,
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
      default:
        throw new HttpError(400, "BAD_REQUEST");
    }
  });
}
