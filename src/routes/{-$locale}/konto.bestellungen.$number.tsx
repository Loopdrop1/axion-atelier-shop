// Eine Bestellung im Kundenkonto (RLS: nur eigene Bestellungen sind lesbar).
import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { shopConfig } from "@/config/shop";
import { getMyOrder, trackingUrl, type OrderDetail, type ProfileAddress } from "@/lib/account/api";
import { useGuestOrderClaim } from "@/lib/account/claim";
import { formatCents, formatDate } from "@/lib/commerce/format";
import { sizeText } from "@/lib/commerce/one-size";
import { imageUrl } from "@/lib/commerce/mapping";
import { useRequireSession } from "@/components/account/use-require-session";
import { Notice } from "@/components/account/form";
import { OrderReceipt } from "@/components/account/order-receipt";
import { receiptAvailable } from "@/components/account/order-receipt-data";

export const Route = createFileRoute("/{-$locale}/konto/bestellungen/$number")({
  component: OrderPage,
});

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function OrderPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const { number } = Route.useParams();
  const { ready, user } = useRequireSession();
  const claim = useGuestOrderClaim(user?.id);
  const orderNumber = /^\d{1,12}$/.test(number) ? Number(number) : null;
  const order = useQuery({
    queryKey: ["my-order", user?.id, orderNumber],
    queryFn: () => getMyOrder(orderNumber!),
    enabled: Boolean(user) && claim.done && orderNumber !== null,
  });

  const back = (
    <Link className="text-link account-back" to="/{-$locale}/konto" params={{ locale: lp }}>
      <ArrowLeft aria-hidden="true" /> {t.account.orderBack}
    </Link>
  );

  if (!ready || !user || (orderNumber !== null && (!claim.done || order.isLoading)))
    return <p role="status">{t.common.loading}</p>;
  if (order.isError)
    return (
      <>
        {back}
        <Notice kind="error">{t.common.error}</Notice>
      </>
    );
  if (!order.data)
    return (
      <>
        {back}
        <h1 className="page-title">{t.order.notFoundTitle}</h1>
        <Notice>{t.account.orderNotFound}</Notice>
      </>
    );
  return <OrderView order={order.data} back={back} />;
}

function OrderView({ order, back }: { order: OrderDetail; back: ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const money = (cents: number) => formatCents(cents, locale);
  const address = (order.shipping_address ?? null) as ProfileAddress | null;
  const gift = (order.gift_card_purchase ?? null) as Record<string, unknown> | null;
  const items = [...(order.order_items ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  const row = (label: string, value: string, className = "") => (
    <p className={className}>
      <span>{label}</span>
      <span className="price">{value}</span>
    </p>
  );

  return (
    <>
      {back}
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.order.number(order.number)}</h1>
      <p className="page-intro">
        {formatDate(order.created_at, locale)} · {t.account.statuses[order.status] ?? order.status}
      </p>

      {order.tracking_number && (
        <Notice>
          {t.account.trackingNumber}: <strong>{order.tracking_number}</strong>{" "}
          <a
            className="text-link"
            href={trackingUrl(order.tracking_number)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.account.trackParcel}
          </a>
        </Notice>
      )}

      <div className="order-layout">
        <section className="account-section" aria-label={t.account.orderNumber}>
          {order.kind === "gift_card" ? (
            <div className="order-line">
              <div className="order-line-image gift" aria-hidden="true">
                AXN
              </div>
              <div>
                <h3>{t.giftCard.title}</h3>
                {text(gift?.["recipient_name"]) && (
                  <p>{t.account.giftCardFor(text(gift?.["recipient_name"]))}</p>
                )}
              </div>
              <span className="price">{money(order.subtotal_cents)}</span>
            </div>
          ) : (
            items.map((item) => {
              const src = imageUrl(item.image, "product-images");
              return (
                <div className="order-line" key={item.id}>
                  {src ? (
                    <img
                      className="order-line-image"
                      src={src}
                      alt=""
                      loading="lazy"
                      width={64}
                      height={80}
                    />
                  ) : (
                    <div className="order-line-image" aria-hidden="true" />
                  )}
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {[
                        item.color,
                        item.size && sizeText(item.size, t.product.size, t.product.oneSize),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p>
                      {t.account.quantity(item.quantity)} × {money(item.unit_price_cents)}
                    </p>
                  </div>
                  <span className="price">{money(item.line_total_cents)}</span>
                </div>
              );
            })
          )}
        </section>

        <aside className="cart-summary order-summary">
          <div className="checkout-totals">
            {row(t.checkout.subtotal, money(order.subtotal_cents))}
            {order.discount_cents > 0 &&
              row(
                order.discount_code
                  ? `${t.checkout.discount} (${order.discount_code})`
                  : t.checkout.discount,
                `−${money(order.discount_cents)}`,
              )}
            {order.kind === "cart" &&
              row(
                t.checkout.shipping,
                order.shipping_cents > 0 ? money(order.shipping_cents) : t.common.free,
                order.shipping_cents > 0 ? "" : "text-muted",
              )}
            {order.gift_card_cents > 0 &&
              row(t.checkout.giftCard, `−${money(order.gift_card_cents)}`)}
            {row(t.checkout.total, money(order.total_cents), "checkout-total")}
            {order.refunded_cents > 0 &&
              row(t.account.refundedAmount, `−${money(order.refunded_cents)}`)}
          </div>
          {order.kind === "cart" && (order.status === "paid" || order.status === "shipped") && (
            <div className="order-meta">
              <Link
                className="text-link"
                to="/{-$locale}/retoure"
                params={{ locale: lp }}
                search={{ order: String(order.number) }}
              >
                {t.returns.accountLink}
              </Link>
              <p className="text-muted">{t.returns.accountHint(shopConfig.returnDays)}</p>
            </div>
          )}
          {receiptAvailable(order) && (
            <button type="button" className="text-link order-print" onClick={() => window.print()}>
              <Printer aria-hidden="true" /> {t.account.printReceipt}
            </button>
          )}
          {address && (
            <div className="order-meta">
              <h2>{t.account.shippingAddress}</h2>
              <p>
                {[
                  order.shipping_name,
                  address.line1,
                  address.line2,
                  [address.postal_code, address.city].filter(Boolean).join(" "),
                  address.country ? (t.account.countries[address.country] ?? address.country) : "",
                ]
                  .filter(Boolean)
                  .map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
              </p>
            </div>
          )}
          {order.payment_method && (
            <div className="order-meta">
              <h2>{t.account.paymentMethod}</h2>
              <p>{t.account.paymentMethods[order.payment_method] ?? order.payment_method}</p>
            </div>
          )}
        </aside>
      </div>
      {receiptAvailable(order) && <OrderReceipt order={order} locale={locale} />}
    </>
  );
}
