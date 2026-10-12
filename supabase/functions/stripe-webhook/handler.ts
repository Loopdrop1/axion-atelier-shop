// Stripe-Webhook: verbucht Zahlungen, storniert abgelaufene Kassen, übernimmt Rückerstattungen.
// Jedes Ereignis wird nur einmal verarbeitet; scheitert etwas, gibt es 500 und Stripe wiederholt.
import type Stripe from "stripe";
import type { Deps } from "../_shared/deps.ts";
import { json } from "../_shared/http.ts";
import { sendPaidEmails, type OrderRecord } from "../_shared/order-mail.ts";
import { stripeCrypto } from "../_shared/stripe.ts";

function orderIdOf(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.["order_id"] ?? session.client_reference_id ?? null;
}

async function paymentMethodOf(deps: Deps, paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const pi = await deps.stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const details = charge?.payment_method_details;
    if (!details) return null;
    const wallet = details.card?.wallet?.type;
    if (wallet === "apple_pay" || wallet === "google_pay") return wallet;
    return details.type ?? null;
  } catch (error) {
    console.error("Zahlungsart konnte nicht gelesen werden", error);
    return null;
  }
}

async function onPaid(deps: Deps, session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status === "unpaid") return; // asynchrone Zahlung: wir warten auf async_payment_succeeded
  const orderId = orderIdOf(session);
  if (!orderId) {
    console.error("Session ohne order_id", session.id);
    return;
  }
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const shipping = session.collected_information?.shipping_details ?? null;
  const address = shipping?.address ?? null;
  const result = await deps.rpc<{ order: OrderRecord }>("complete_order", {
    p_order_id: orderId,
    p_payment: {
      session_id: session.id,
      payment_intent_id: paymentIntentId,
      payment_method: await paymentMethodOf(deps, paymentIntentId),
      amount_total_cents: session.amount_total,
      email: session.customer_details?.email ?? null,
      name: shipping?.name ?? session.customer_details?.name ?? null,
      phone: session.customer_details?.phone ?? null,
      address: address
        ? { line1: address.line1, line2: address.line2, postal_code: address.postal_code, city: address.city, country: address.country }
        : null,
    },
  });
  await sendPaidEmails(deps, result.order);
}

export function createStripeWebhookHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
    const signature = req.headers.get("stripe-signature");
    const payload = await req.text();
    let event: Stripe.Event;
    try {
      if (!signature) throw new Error("Signatur fehlt");
      event = await deps.stripe.webhooks.constructEventAsync(payload, signature, deps.env.stripeWebhookSecret, undefined, stripeCrypto);
    } catch (error) {
      console.warn("Webhook abgelehnt", (error as Error).message);
      return json(400, { error: "INVALID_SIGNATURE" });
    }

    const fresh = await deps.rpc<boolean>("register_stripe_event", { p_event_id: event.id, p_type: event.type });
    if (!fresh) return json(200, { received: true, duplicate: true });

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await onPaid(deps, event.data.object);
          break;
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const orderId = orderIdOf(event.data.object);
          if (orderId) await deps.rpc("cancel_order", { p_order_id: orderId, p_reason: event.type === "checkout.session.expired" ? "expired" : "payment_failed" });
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object;
          const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
          if (pi) await deps.rpc("record_refund", { p_payment_intent_id: pi, p_refunded_cents: charge.amount_refunded });
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error(`Webhook ${event.type} fehlgeschlagen`, error);
      await deps.rpc("forget_stripe_event", { p_event_id: event.id }).catch(() => undefined);
      return json(500, { error: "PROCESSING_FAILED" });
    }
    return json(200, { received: true });
  };
}
