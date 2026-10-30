// Daten der Kunden-Quittung aus einer Bestellung im Kundenkonto: nur, was die Kundschaft ohnehin sieht.
import type { ReceiptData } from "@/components/shop/receipt-document";
import type { Locale } from "@/i18n";
import type { OrderDetail, ProfileAddress } from "@/lib/account/api";

/** Nur bezahlte Bestellungen haben eine Quittung. */
export const receiptAvailable = (order: Pick<OrderDetail, "status">) =>
  ["paid", "shipped", "refunded"].includes(order.status);

export function orderReceiptData(order: OrderDetail, locale: Locale): ReceiptData {
  return {
    number: order.number,
    kind: order.kind,
    locale: locale === "en" ? "en" : "de",
    dateIso: order.paid_at ?? order.created_at,
    shippingName: order.shipping_name,
    address: (order.shipping_address ?? null) as ProfileAddress | null,
    items: (order.order_items ?? []).map((i) => ({
      id: i.id,
      title: i.title,
      color: i.color,
      size: i.size,
      quantity: i.quantity,
      unit_price_cents: i.unit_price_cents,
      line_total_cents: i.line_total_cents,
    })),
    subtotal_cents: order.subtotal_cents,
    discount_cents: order.discount_cents,
    discount_code: order.discount_code,
    shipping_cents: order.shipping_cents,
    gift_card_cents: order.gift_card_cents,
    total_cents: order.total_cents,
    refunded_cents: order.refunded_cents,
    payment_method: order.payment_method,
    // Satz zum Zahlungszeitpunkt; ältere Bestellungen ohne gespeicherten Satz: Shop-Konfiguration (im Dokument).
    vat_rate: order.vat_rate == null ? null : Number(order.vat_rate),
  };
}
