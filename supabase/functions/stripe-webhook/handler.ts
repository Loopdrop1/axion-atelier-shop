// Stripe-Webhook: verbucht Zahlungen (auch ohne Zahlbetrag, wenn ein Gutschein alles deckt), storniert
// abgelaufene Kassen (mit Einwilligung samt einmaliger Erinnerung), übernimmt Rückerstattungen (mit E-Mail) und
// vermerkt Streitfälle und Radar-Betrugswarnungen an der Bestellung. Jedes Ereignis wird nur einmal verarbeitet;
// scheitert etwas, gibt es 500 und Stripe wiederholt.
import type Stripe from "stripe";
import { RpcError } from "../_shared/db.ts";
import type { Deps } from "../_shared/deps.ts";
import { json } from "../_shared/http.ts";
import {
  sendCartReminder,
  sendLowStockAlert,
  sendPaidEmails,
  sendRefundNotice,
  type OrderRecord,
} from "../_shared/order-mail.ts";
import { stripeCrypto } from "../_shared/stripe.ts";

function orderIdOf(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.["order_id"] ?? session.client_reference_id ?? null;
}

// Bewusst kein Fehler: Die Zahlungsart ist nur Anzeige (Bestellseite, Mails). Scheitert das Lesen oder fehlt die
// Charge (z. B. Gutschein deckt alles), fällt sie still auf null; ein Wurf würde die Verbuchung der bezahlten
// Bestellung blockieren und Stripe in Wiederholungen schicken.
async function paymentMethodOf(deps: Deps, paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const pi = await deps.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
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
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const shipping = session.collected_information?.shipping_details ?? null;
  const address = shipping?.address ?? null;
  const result = await deps.rpc<{ order: OrderRecord; newly_paid?: boolean }>("complete_order", {
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
        ? {
            line1: address.line1,
            line2: address.line2,
            postal_code: address.postal_code,
            city: address.city,
            country: address.country,
          }
        : null,
    },
  });
  // Bestandsmeldung an den Shop nur beim ersten Verbuchen (eine Wiederholung durch Stripe ist nicht mehr «neu»),
  // parallel zu den Kundenmails, damit sie diese nicht verzögert. Sie fängt Fehler selbst ab; scheitern die
  // Kundenmails, gibt es den Fehler weiter (Stripe wiederholt).
  const [, mails] = await Promise.allSettled([
    result.newly_paid !== false ? sendLowStockAlert(deps, result.order) : Promise.resolve(),
    sendPaidEmails(deps, result.order),
  ]);
  if (mails.status === "rejected") throw mails.reason;
}

const DISPUTE_NOTE = "Stripe: Zahlung angefochten (Dispute)";
const FRAUD_WARNING_NOTE = "Stripe: Betrugswarnung (Radar)";

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : (ref.id ?? null);
}

/** PaymentIntent einer Betrugswarnung: direkt am Ereignis, sonst über die Charge. */
async function fraudWarningIntent(
  deps: Deps,
  warning: Stripe.Radar.EarlyFraudWarning,
): Promise<string | null> {
  const direct = idOf(warning.payment_intent);
  if (direct) return direct;
  const chargeId = idOf(warning.charge);
  if (!chargeId) return null;
  try {
    const charge = await deps.stripe.charges.retrieve(chargeId);
    return idOf(charge.payment_intent);
  } catch (error) {
    // Fehlt dem eingeschränkten Schlüssel das Recht «Charges: Lesen», hilft keine Wiederholung: protokollieren und
    // weiter (Stripe zeigt die Warnung trotzdem im Dashboard). Andere Fehler: 500, Stripe wiederholt.
    if ((error as { type?: string }).type === "StripePermissionError") {
      console.error("Betrugswarnung: Charge nicht lesbar (Recht «Charges: Lesen» fehlt)", chargeId);
      return null;
    }
    throw error;
  }
}

/**
 * Streitfall oder Betrugswarnung an der Bestellung vermerken (record_dispute: Admin-Vermerk, Notiz, gekaufter
 * Gutschein gesperrt). Gehört der PaymentIntent zu keiner Bestellung (andere Zahlung auf demselben Stripe-Konto),
 * nur protokollieren: Eine Wiederholung durch Stripe änderte daran nichts.
 */
async function recordDispute(deps: Deps, paymentIntentId: string | null, note: string) {
  if (!paymentIntentId) {
    console.error(`${note}: kein PaymentIntent, nichts vermerkt`);
    return;
  }
  try {
    await deps.rpc("record_dispute", { p_payment_intent_id: paymentIntentId, p_note: note });
  } catch (error) {
    if (error instanceof RpcError && error.code === "ORDER_NOT_FOUND") {
      console.error(`${note}: keine Bestellung zu ${paymentIntentId}`);
      return;
    }
    throw error;
  }
}

export function createStripeWebhookHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
    const signature = req.headers.get("stripe-signature");
    const payload = await req.text();
    let event: Stripe.Event;
    try {
      if (!signature) throw new Error("Signatur fehlt");
      event = await deps.stripe.webhooks.constructEventAsync(
        payload,
        signature,
        deps.env.stripeWebhookSecret,
        undefined,
        stripeCrypto,
      );
    } catch (error) {
      console.warn("Webhook abgelehnt", (error as Error).message);
      return json(400, { error: "INVALID_SIGNATURE" });
    }

    // Erledigt: nichts mehr tun. Läuft gerade (zweite Zustellung, während die erste noch arbeitet): 409,
    // damit Stripe später wiederholt, statt das Ereignis als zugestellt abzuhaken.
    const state = await deps.rpc<"new" | "processing" | "done">("register_stripe_event", {
      p_event_id: event.id,
      p_type: event.type,
    });
    if (state === "done") return json(200, { received: true, duplicate: true });
    if (state === "processing") return json(409, { error: "IN_PROGRESS" });

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await onPaid(deps, event.data.object);
          break;
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const orderId = orderIdOf(event.data.object);
          if (orderId) {
            const expired = event.type === "checkout.session.expired";
            await deps.rpc("cancel_order", {
              p_order_id: orderId,
              p_reason: expired ? "expired" : "payment_failed",
            });
            // Erinnerung nur nach Ablauf und nur mit Einwilligung; ein Fehler hier darf die Stornierung nicht kippen.
            if (expired)
              await sendCartReminder(deps, orderId).catch((e) =>
                console.error("Warenkorb-Erinnerung fehlgeschlagen", (e as Error).message),
              );
          }
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object;
          const pi =
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id;
          if (pi) {
            const refund = await deps.rpc<{ found: boolean }>("record_refund", {
              p_payment_intent_id: pi,
              p_refunded_cents: charge.amount_refunded,
            });
            // Noch keine Bestellung mit diesem PaymentIntent (checkout.session.completed wartet auf eine
            // Wiederholung): werfen, damit Stripe auch die Rückerstattung wiederholt, statt sie als erledigt
            // abzuhaken; sonst wäre die Bestellung später «bezahlt» mit 0 erstattet und würde versandt.
            if (refund?.found === false) throw new Error("REFUND_ORDER_NOT_FOUND");
            // Wirft bei Versandfehlern: Stripe wiederholt, Betrag und Resend-Schlüssel verhindern doppelte Mails.
            await sendRefundNotice(deps, pi);
          }
          break;
        }
        case "charge.dispute.created":
          await recordDispute(deps, idOf(event.data.object.payment_intent), DISPUTE_NOTE);
          break;
        case "radar.early_fraud_warning.created":
          await recordDispute(
            deps,
            await fraudWarningIntent(deps, event.data.object),
            FRAUD_WARNING_NOTE,
          );
          break;
        default:
          break;
      }
      await deps.rpc("finish_stripe_event", { p_event_id: event.id });
    } catch (error) {
      console.error(`Webhook ${event.type} fehlgeschlagen`, error);
      await deps.rpc("forget_stripe_event", { p_event_id: event.id }).catch(() => undefined);
      return json(500, { error: "PROCESSING_FAILED" });
    }
    return json(200, { received: true });
  };
}
