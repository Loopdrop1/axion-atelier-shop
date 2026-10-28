// Quittung zum Ausdrucken im Kundenkonto, in der Sprache der Seite. Für Gäste gibt es sie nicht:
// `get_order_status` liefert dort weder Positionen noch Preise.
import { ReceiptPortal } from "@/components/shop/receipt-document";
import type { Locale } from "@/i18n";
import type { OrderDetail } from "@/lib/account/api";
import { orderReceiptData } from "./order-receipt-data";

export function OrderReceipt({ order, locale }: { order: OrderDetail; locale: Locale }) {
  return <ReceiptPortal data={orderReceiptData(order, locale)} />;
}
