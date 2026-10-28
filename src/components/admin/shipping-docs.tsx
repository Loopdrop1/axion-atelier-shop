// Versanddokumente zum Ausdrucken: Lieferschein (A4, mit oder ohne Preise) und Adressetikette (10 × 15 cm).
// Beide erscheinen nur im Druck, in der Sprache der Bestellung, und hängen wie die Quittung an <body>
// (Regeln in styles.css, Auswahl über print.ts).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { shopConfig } from "@/config/shop";
import { formatCents } from "@/lib/commerce/format";
import { sizeText } from "@/lib/commerce/one-size";
import type { VariantCodes } from "@/lib/admin/api";

export interface SlipItem {
  id: string;
  variant_id: string | null;
  title: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface SlipOrder {
  id: string;
  number: number;
  locale: "de" | "en";
  shipping_name: string | null;
  shipping_address: {
    line1?: string;
    line2?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  } | null;
  phone: string | null;
  created_at: string;
  paid_at: string | null;
  subtotal_cents: number;
  discount_cents: number;
  discount_code: string | null;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  items: SlipItem[];
}

const TEXT = {
  de: {
    slip: "Lieferschein",
    order: "Bestellung",
    date: "Datum",
    to: "Lieferadresse",
    item: "Artikel",
    qty: "Menge",
    price: "Preis",
    total: "Total",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    shipping: "Versand",
    free: "gratis",
    giftCard: "Bezahlt mit Geschenkgutschein",
    size: "Grösse",
    oneSize: "Einheitsgrösse",
    sku: "Art.-Nr.",
    barcode: "Barcode",
    returns: (days: number, url: string) =>
      `Rückgabe innert ${days} Tagen ab Erhalt. Alles dazu: ${url}/versand-und-rueckgabe`,
    thanks: "Danke für deine Bestellung!",
    from: "Absender",
    phone: "Tel.",
    countries: { CH: "Schweiz", LI: "Liechtenstein" } as Record<string, string>,
  },
  en: {
    slip: "Delivery note",
    order: "Order",
    date: "Date",
    to: "Delivery address",
    item: "Item",
    qty: "Qty",
    price: "Price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    free: "free",
    giftCard: "Paid with gift card",
    size: "Size",
    oneSize: "One size",
    sku: "SKU",
    barcode: "Barcode",
    returns: (days: number, url: string) =>
      `Returns within ${days} days of receipt. Details: ${url}/en/versand-und-rueckgabe`,
    thanks: "Thank you for your order!",
    from: "Sender",
    phone: "Tel.",
    countries: { CH: "Switzerland", LI: "Liechtenstein" } as Record<string, string>,
  },
};

const loc = (order: SlipOrder) => (order.locale === "en" ? "en" : "de");

function addressLines(order: SlipOrder): string[] {
  const a = order.shipping_address;
  const t = TEXT[loc(order)];
  return [
    order.shipping_name,
    a?.line1,
    a?.line2,
    [a?.postal_code, a?.city].filter(Boolean).join(" "),
    a?.country ? (t.countries[a.country] ?? a.country) : "",
  ].filter((line): line is string => Boolean(line));
}

/** Nach dem Mounten an <body> hängen (nie beim Server-Rendering). */
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function PackingSlips({
  orders,
  codes,
  withPrices,
}: {
  orders: SlipOrder[];
  codes: VariantCodes;
  withPrices: boolean;
}) {
  return (
    <BodyPortal>
      <div className="admin-slip admin-printdoc" aria-hidden="true">
        {orders.map((order) => (
          <PackingSlipPage key={order.id} order={order} codes={codes} withPrices={withPrices} />
        ))}
      </div>
    </BodyPortal>
  );
}

function PackingSlipPage({
  order,
  codes,
  withPrices,
}: {
  order: SlipOrder;
  codes: VariantCodes;
  withPrices: boolean;
}) {
  const locale = loc(order);
  const t = TEXT[locale];
  const money = (cents: number) => formatCents(cents, locale);
  const c = shopConfig.contact;
  const date = new Date(order.paid_at ?? order.created_at).toLocaleDateString(
    locale === "en" ? "en-GB" : "de-CH",
    { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" },
  );
  return (
    <article className="admin-slip-page">
      <header>
        <strong>{shopConfig.brand}</strong>
        <span>{c.company}</span>
        <span>{c.address}</span>
        <span>{c.email}</span>
      </header>
      <h1>{t.slip}</h1>
      <p>
        {t.order} AX-{order.number} · {t.date} {date}
      </p>
      <p>
        <strong>{t.to}</strong>
        <br />
        {addressLines(order).map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
        {order.phone && `${t.phone} ${order.phone}`}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t.item}</th>
            <th className="num">{t.qty}</th>
            {withPrices && (
              <>
                <th className="num">{t.price}</th>
                <th className="num">{t.total}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => {
            const code = item.variant_id ? codes[item.variant_id] : undefined;
            const detail = [
              item.color,
              item.size && sizeText(item.size, t.size, t.oneSize),
              code?.sku && `${t.sku} ${code.sku}`,
              code?.barcode && `${t.barcode} ${code.barcode}`,
            ].filter(Boolean);
            return (
              <tr key={item.id}>
                <td>
                  {item.title}
                  {detail.length > 0 && <small>{detail.join(" · ")}</small>}
                </td>
                <td className="num">{item.quantity}</td>
                {withPrices && (
                  <>
                    <td className="num">{money(item.unit_price_cents)}</td>
                    <td className="num">{money(item.line_total_cents)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {withPrices && (
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
          <div>
            <dt>{t.shipping}</dt>
            <dd>{order.shipping_cents ? money(order.shipping_cents) : t.free}</dd>
          </div>
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
        </dl>
      )}
      <p>{t.returns(shopConfig.returnDays, shopConfig.siteUrl)}</p>
      <p>{t.thanks}</p>
    </article>
  );
}

/** Adressetikette 10 × 15 cm: Absender klein oben (Platzhalter aus der Konfiguration erscheinen als solche), Empfänger gross. */
export function AddressLabel({ order }: { order: SlipOrder }) {
  const t = TEXT[loc(order)];
  const c = shopConfig.contact;
  return (
    <BodyPortal>
      <section className="admin-label admin-printdoc" aria-hidden="true">
        <div className="sender">
          {t.from}: {c.company}, {c.address}
        </div>
        <div className="recipient">
          {addressLines(order).map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
          {order.phone && <small>{`${t.phone} ${order.phone}`}</small>}
        </div>
        <div className="meta">
          <strong>AX-{order.number}</strong>
          <span>{shopConfig.brand}</span>
        </div>
      </section>
    </BodyPortal>
  );
}
