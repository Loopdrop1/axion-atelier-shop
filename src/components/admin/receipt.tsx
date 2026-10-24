// Quittung zum Ausdrucken (fürs Paket): erscheint nur im Druck, in der Sprache der Bestellung.
// Mit MWST-Pflicht (shopConfig.vatRegistered) mit MWST-Nummer, Satz und Betrag.
// Sie hängt direkt an <body>, damit beim Drucken alles andere ausgeblendet werden kann (keine leeren Seiten).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { shopConfig } from "@/config/shop";
import { sizeText } from "@/lib/commerce/one-size";
import type { AdminOrder } from "@/lib/admin/api";
import { formatCents } from "@/lib/commerce/format";
import { vatIncluded } from "@/lib/admin/vat";

const TEXT = {
  de: {
    receipt: "Quittung",
    order: "Bestellung",
    date: "Datum",
    to: "Lieferadresse",
    item: "Artikel",
    qty: "Menge",
    price: "Preis",
    total: "Total",
    refunded: "Rückerstattet",
    netTotal: "Total nach Rückerstattung",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    shipping: "Versand",
    free: "gratis",
    giftCard: "Bezahlt mit Geschenkgutschein",
    paidWith: "Bezahlt mit",
    size: "Grösse",
    oneSize: "Einheitsgrösse",
    giftCardItem: "Geschenkgutschein",
    vat: (rate: number, amount: string) => `Im Total enthalten: MWST ${rate} % ${amount}`,
    vatNo: "MWST-Nr.",
    returns: (days: number, url: string) =>
      `Rückgabe innert ${days} Tagen ab Erhalt. Alles dazu: ${url}/versand-und-rueckgabe`,
    thanks: "Danke für deinen Einkauf!",
  },
  en: {
    receipt: "Receipt",
    order: "Order",
    date: "Date",
    to: "Delivery address",
    item: "Item",
    qty: "Qty",
    price: "Price",
    total: "Total",
    refunded: "Refunded",
    netTotal: "Total after refund",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    free: "free",
    giftCard: "Paid with gift card",
    paidWith: "Paid with",
    size: "Size",
    oneSize: "One size",
    giftCardItem: "Gift card",
    vat: (rate: number, amount: string) => `Included in the total: VAT ${rate}% ${amount}`,
    vatNo: "VAT no.",
    returns: (days: number, url: string) =>
      `Returns within ${days} days of receipt. Details: ${url}/en/versand-und-rueckgabe`,
    thanks: "Thank you for your purchase!",
  },
};

const PAYMENT: Record<string, string> = {
  card: "Karte / Card",
  twint: "TWINT",
  klarna: "Klarna",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export function Receipt({ order }: { order: AdminOrder }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<ReceiptContent order={order} />, document.body);
}

function ReceiptContent({ order }: { order: AdminOrder }) {
  const locale = order.locale === "en" ? "en" : "de";
  const t = TEXT[locale];
  const money = (cents: number) => formatCents(cents, locale);
  const c = shopConfig.contact;
  const date = new Date(order.paid_at ?? order.created_at).toLocaleDateString(
    locale === "en" ? "en-GB" : "de-CH",
    { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" },
  );
  const a = order.shipping_address;
  // MWST-Basis: Warenwert nach Rabatt plus Versand. Ein Gutschein ist nur ein Zahlungsmittel.
  // Rückerstattungen (Karte über Stripe, Gutscheinanteil als Gutschrift) mindern die MWST-Basis.
  const refunded = order.refunded_cents + (order.gift_card_credited_cents ?? 0);
  const vatBase = Math.max(
    0,
    order.subtotal_cents - order.discount_cents + order.shipping_cents - refunded,
  );
  // Der Satz stammt aus der Bestellung; Altbestellungen fallen auf den Satz der Shop-Konfiguration zurück.
  const vatRate = order.vat_rate ?? shopConfig.vatRate;
  const showVat = (order.vat_rate != null || shopConfig.vatRegistered) && order.kind === "cart";
  return (
    <section className="admin-receipt" aria-hidden="true">
      <header>
        <strong>{shopConfig.brand}</strong>
        <span>{c.company}</span>
        <span>{c.address}</span>
        <span>{c.email}</span>
        {shopConfig.vatRegistered && (
          <span>
            {t.vatNo} {c.uid} MWST
          </span>
        )}
      </header>
      <h1>{t.receipt}</h1>
      <p>
        {t.order} AX-{order.number} · {t.date} {date}
      </p>
      {a && (
        <p>
          <strong>{t.to}</strong>
          <br />
          {[
            order.shipping_name,
            a.line1,
            a.line2,
            [a.postal_code, a.city].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>{t.item}</th>
            <th>{t.qty}</th>
            <th>{t.price}</th>
            <th>{t.total}</th>
          </tr>
        </thead>
        <tbody>
          {order.kind === "gift_card" ? (
            <tr>
              <td>{t.giftCardItem}</td>
              <td>1</td>
              <td>{money(order.subtotal_cents)}</td>
              <td>{money(order.subtotal_cents)}</td>
            </tr>
          ) : (
            order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.title}
                  {[item.color, item.size && sizeText(item.size, t.size, t.oneSize)].filter(Boolean)
                    .length > 0 &&
                    ` (${[item.color, item.size && sizeText(item.size, t.size, t.oneSize)].filter(Boolean).join(", ")})`}
                </td>
                <td>{item.quantity}</td>
                <td>{money(item.unit_price_cents)}</td>
                <td>{money(item.line_total_cents)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <dl>
        <div>
          <dt>{t.subtotal}</dt>
          <dd>{money(order.subtotal_cents)}</dd>
        </div>
        {order.discount_cents > 0 && (
          <div>
            <dt>
              {t.discount}
              {order.discount_code ? ` (${order.discount_code})` : ""}
            </dt>
            <dd>−{money(order.discount_cents)}</dd>
          </div>
        )}
        {order.kind === "cart" && (
          <div>
            <dt>{t.shipping}</dt>
            <dd>{order.shipping_cents ? money(order.shipping_cents) : t.free}</dd>
          </div>
        )}
        {order.gift_card_cents > 0 && (
          <div>
            <dt>{t.giftCard}</dt>
            <dd>−{money(order.gift_card_cents)}</dd>
          </div>
        )}
        <div className="total">
          <dt>{t.total}</dt>
          <dd>{money(order.total_cents)}</dd>
        </div>
        {order.refunded_cents > 0 && (
          <>
            <div>
              <dt>{t.refunded}</dt>
              <dd>−{money(order.refunded_cents)}</dd>
            </div>
            <div className="total">
              <dt>{t.netTotal}</dt>
              <dd>{money(Math.max(0, order.total_cents - order.refunded_cents))}</dd>
            </div>
          </>
        )}
      </dl>
      {showVat && <p>{t.vat(vatRate, money(vatIncluded(vatBase, vatRate)))}</p>}
      {order.payment_method && PAYMENT[order.payment_method] && (
        <p>
          {t.paidWith} {PAYMENT[order.payment_method]}
        </p>
      )}
      {order.kind === "cart" && <p>{t.returns(shopConfig.returnDays, shopConfig.siteUrl)}</p>}
      <p>{t.thanks}</p>
    </section>
  );
}
