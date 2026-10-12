// Danke- und Statusseite (success_url der Stripe-Kasse: /bestellung/<token>?bezahlt=1).
// Der Status kommt per RPC über das geheime Token; bezahlt wird erst, wenn der Webhook die Zahlung verbucht hat.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messages, toLocale, useLocale, useLocaleParam, useT } from "@/i18n";
import { backendConfigured } from "@/lib/backend";
import { getOrderStatus, type OrderStatus } from "@/lib/commerce/checkout";
import { formatCents } from "@/lib/commerce/format";
import { pageHead } from "@/lib/commerce/seo";
import { useCart } from "@/lib/commerce/stores";
import { useSession } from "@/lib/account/session";
import { Notice } from "@/components/account/form";

/** So lange wartet die Seite nach der Rückkehr von Stripe auf die Bestätigung durch den Webhook. */
const WAIT_MS = 30_000;
const POLL_MS = 2_000;

export const Route = createFileRoute("/{-$locale}/bestellung/$token")({
  validateSearch: (s: Record<string, unknown>): { bezahlt?: string | undefined } => ({
    bezahlt: s["bezahlt"] === "1" || s["bezahlt"] === 1 ? "1" : undefined,
  }),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].order;
    return pageHead(t.title, t.metaDescription, "/bestellung", locale, { noindex: true });
  },
  component: OrderStatusPage,
});

function OrderStatusPage() {
  const t = useT();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const { token } = Route.useParams();
  const { bezahlt } = Route.useSearch();
  const clearCart = useCart((s) => s.clear);
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const handled = useRef(false);

  const status = useQuery({
    queryKey: ["order-status", token],
    queryFn: () => getOrderStatus(token),
    enabled: backendConfigured,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" && Date.now() - startedAt < WAIT_MS ? POLL_MS : false,
  });

  useEffect(() => {
    if (status.data?.status !== "pending") return;
    const timer = setTimeout(
      () => setTimedOut(true),
      Math.max(0, WAIT_MS - (Date.now() - startedAt)),
    );
    return () => clearTimeout(timer);
  }, [status.data?.status, startedAt]);

  // Rückkehr nach der Zahlung: Warenkorb leeren (nur bei Warenkorb-Bestellungen) und «bezahlt» aus der
  // Adresse entfernen, damit ein späterer Aufruf aus dem Verlauf keinen neuen Warenkorb leert.
  useEffect(() => {
    if (!bezahlt || handled.current || !status.data) return;
    handled.current = true;
    if (status.data.kind === "cart" && status.data.status !== "cancelled") clearCart();
    void navigate({
      to: "/{-$locale}/bestellung/$token",
      params: { locale: lp, token },
      search: {},
      replace: true,
    });
  }, [bezahlt, status.data, clearCart, navigate, lp, token]);

  return (
    <div className="container page-body order-status">
      {!backendConfigured ? (
        <Notice>{t.checkout.notConnected}</Notice>
      ) : status.isLoading ? (
        <p role="status">{t.common.loading}</p>
      ) : status.isError ? (
        <Notice kind="error">{t.common.error}</Notice>
      ) : !status.data ? (
        <>
          <h1 className="page-title">{t.order.notFoundTitle}</h1>
          <p className="page-intro">{t.order.notFoundText}</p>
          <Actions />
        </>
      ) : (
        <StatusView order={status.data} timedOut={timedOut} />
      )}
    </div>
  );
}

function StatusView({ order, timedOut }: { order: OrderStatus; timedOut: boolean }) {
  const t = useT();
  const locale = useLocale();
  const total = (
    <p className="order-total">{t.order.total(formatCents(order.total_cents, locale))}</p>
  );
  const head = <p className="eyebrow">{t.order.number(order.order_number)}</p>;
  switch (order.status) {
    case "pending":
      return (
        <>
          {head}
          <h1 className="page-title">{t.order.title}</h1>
          <p className="page-intro" role="status" aria-live="polite">
            {timedOut ? t.order.waitingLong : t.order.waiting}
          </p>
          {!timedOut && <span className="order-spinner" aria-hidden="true" />}
          {total}
          <Actions />
        </>
      );
    case "paid":
      return (
        <>
          {head}
          <span className="order-check" aria-hidden="true">
            <Check />
          </span>
          <h1 className="page-title">{t.order.thanks}</h1>
          <p className="page-intro">
            {order.kind === "gift_card"
              ? t.order.giftPaidText(order.email_hint)
              : t.order.paidText(order.email_hint)}
          </p>
          {total}
          <Actions />
        </>
      );
    case "shipped":
      return (
        <>
          {head}
          <h1 className="page-title">{t.order.shippedTitle}</h1>
          <p className="page-intro">{t.order.shippedText}</p>
          {total}
          <Actions />
        </>
      );
    case "refunded":
      return (
        <>
          {head}
          <h1 className="page-title">{t.order.refundedTitle}</h1>
          <p className="page-intro">{t.order.refundedText}</p>
          <Actions />
        </>
      );
    default:
      return (
        <>
          {head}
          <h1 className="page-title">{t.order.cancelledTitle}</h1>
          <p className="page-intro">{t.order.cancelledText}</p>
          <Actions />
        </>
      );
  }
}

function Actions() {
  const t = useT();
  const lp = useLocaleParam();
  const { user } = useSession();
  return (
    <div className="empty-links justify-start">
      <Button asChild>
        <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "alle" }}>
          {t.order.continueShopping}
        </Link>
      </Button>
      {user && (
        <Button variant="tailored" asChild>
          <Link to="/{-$locale}/konto" params={{ locale: lp }}>
            {t.order.toAccount}
          </Link>
        </Button>
      )}
    </div>
  );
}
