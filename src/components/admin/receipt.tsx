// Quittung zum Ausdrucken (fürs Paket): erscheint nur im Druck, in der Sprache der Bestellung.
// Die Darstellung teilt sich das Admin mit dem Kundenkonto (components/shop/receipt-document.tsx).
import { ReceiptPortal, type ReceiptData } from "@/components/shop/receipt-document";
import type { AdminOrder } from "@/lib/admin/api";

function receiptData(order: AdminOrder): ReceiptData {
  return {
    number: order.number,
    kind: order.kind,
    locale: order.locale === "en" ? "en" : "de",
    dateIso: order.paid_at ?? order.created_at,
    shippingName: order.shipping_name,
    address: order.shipping_address,
    items: order.items,
    subtotal_cents: order.subtotal_cents,
    discount_cents: order.discount_cents,
    discount_code: order.discount_code,
    shipping_cents: order.shipping_cents,
    gift_card_cents: order.gift_card_cents,
    total_cents: order.total_cents,
    refunded_cents: order.refunded_cents,
    gift_card_credited_cents: order.gift_card_credited_cents ?? 0,
    payment_method: order.payment_method,
    vat_rate: order.vat_rate,
  };
}

export function Receipt({ order }: { order: AdminOrder }) {
  return <ReceiptPortal data={receiptData(order)} />;
}
