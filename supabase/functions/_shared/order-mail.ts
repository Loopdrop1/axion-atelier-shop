// Versand der Bestell-E-Mails mit Merker in der Datenbank: jede E-Mail geht genau einmal raus,
// auch wenn Stripe ein Ereignis wiederholt oder ein früherer Versuch fehlgeschlagen ist.
import type { Deps } from "./deps.ts";
import { sendEmail } from "./email/send.ts";
import {
  cartReminder,
  giftCardEmail,
  orderConfirmation,
  refundNotice,
  shippingConfirmation,
  shopNotification,
  type OrderData,
} from "./email/templates.ts";

export interface MailState {
  confirmation_sent_at: string | null;
  notification_sent_at: string | null;
  gift_card_sent_at: string | null;
  shipping_sent_at: string | null;
}

export type OrderRecord = OrderData & MailState;

async function notifyAddress(deps: Deps): Promise<string> {
  const fromDb = await deps.rpc<string | null>("get_shop_notify_email").catch(() => null);
  return fromDb || deps.env.shopNotifyEmail;
}

/** Schickt alle noch offenen E-Mails nach Zahlungseingang. Wirft bei Versandfehlern (Stripe wiederholt dann). */
export async function sendPaidEmails(deps: Deps, order: OrderRecord): Promise<string[]> {
  const sent: string[] = [];
  if (!order.confirmation_sent_at) {
    await sendEmail(
      order.email,
      orderConfirmation(order, deps.shop),
      deps.mail,
      `order-${order.id}-confirmation`,
    );
    await deps.rpc("mark_order_email_sent", { p_order_id: order.id, p_kind: "confirmation" });
    sent.push("confirmation");
  }
  if (order.kind === "gift_card" && order.issued_gift_card && !order.gift_card_sent_at) {
    const card = order.issued_gift_card;
    await sendEmail(
      card.recipient_email ?? order.email,
      giftCardEmail(card, deps.shop),
      deps.mail,
      `order-${order.id}-giftcard`,
    );
    await deps.rpc("mark_order_email_sent", { p_order_id: order.id, p_kind: "gift_card" });
    sent.push("gift_card");
  }
  if (!order.notification_sent_at) {
    const to = await notifyAddress(deps);
    if (to) {
      await sendEmail(
        to,
        shopNotification(order, deps.shop),
        deps.mail,
        `order-${order.id}-notification`,
      );
      await deps.rpc("mark_order_email_sent", { p_order_id: order.id, p_kind: "notification" });
      sent.push("notification");
    }
  }
  return sent;
}

/** Versandmeldung. dedupe=false für bewusstes erneutes Senden (sonst blockt Resend 24 h lang denselben Schlüssel). */
export async function sendShippingEmail(
  deps: Deps,
  order: OrderRecord,
  opts: { dedupe?: boolean } = {},
): Promise<void> {
  const key =
    opts.dedupe === false
      ? undefined
      : `order-${order.id}-shipping-${order.tracking_number ?? "ohne"}`;
  await sendEmail(order.email, shippingConfirmation(order, deps.shop), deps.mail, key);
  await deps.rpc("mark_order_email_sent", { p_order_id: order.id, p_kind: "shipping" });
}

function imageUrl(deps: Deps, path: string | null | undefined): string | null {
  if (!path || path.startsWith("asset:")) return null;
  if (/^https:\/\//.test(path)) return path;
  return `${deps.env.supabaseUrl}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Erinnerung an eine abgelaufene Kasse. Nur mit Einwilligung (orders.reminder_opt_in), höchstens einmal
 * (reminder_sent_at, dazu Idempotenz-Schlüssel bei Resend). Gibt true zurück, wenn eine E-Mail rausging.
 * Wirft bei Versandfehlern; der Webhook fängt das ab, damit die Stornierung nicht darunter leidet.
 */
export async function sendCartReminder(deps: Deps, orderId: string): Promise<boolean> {
  const order = await deps.rpc<(OrderData & { items: { image?: string | null }[] }) | null>(
    "get_cart_reminder",
    { p_order_id: orderId },
  );
  if (!order || order.items.length === 0) return false;
  const withImages: OrderData = {
    ...order,
    items: order.items.map((i) => ({
      ...i,
      image_url: imageUrl(deps, (i as { image?: string | null }).image),
    })),
  };
  await sendEmail(
    order.email,
    cartReminder(withImages, deps.shop),
    deps.mail,
    `order-${order.id}-reminder`,
  );
  await deps.rpc("mark_order_email_sent", { p_order_id: order.id, p_kind: "reminder" });
  return true;
}

/**
 * Rückerstattungs-E-Mail nach `record_refund`: pro neuem Gesamtbetrag genau eine (orders.refund_notified_cents
 * und Resend-Schlüssel mit Bestellung und Betrag). Gibt true zurück, wenn eine E-Mail rausging.
 */
export async function sendRefundNotice(deps: Deps, paymentIntentId: string): Promise<boolean> {
  const order = await deps.rpc<
    (OrderData & { refunded_cents: number; refund_notified_cents: number }) | null
  >("get_refund_notice", { p_payment_intent_id: paymentIntentId });
  if (!order) return false;
  const amount = order.refunded_cents - order.refund_notified_cents;
  if (amount <= 0) return false;
  await sendEmail(
    order.email,
    refundNotice(order, amount, deps.shop),
    deps.mail,
    `order-${order.id}-refund-${order.refunded_cents}`,
  );
  await deps.rpc("mark_refund_notified", { p_order_id: order.id, p_cents: order.refunded_cents });
  return true;
}
