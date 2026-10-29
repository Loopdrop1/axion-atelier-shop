import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { messages, toLocale, useLocaleParam, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { releaseCheckout, takePendingCheckout } from "@/lib/commerce/checkout";
import { CartContents } from "@/components/shop/cart";
export const Route = createFileRoute("/{-$locale}/warenkorb")({
  validateSearch: (s: Record<string, unknown>): { abgebrochen?: string | undefined } => ({
    abgebrochen: typeof s["abgebrochen"] === "string" ? s["abgebrochen"] : undefined,
  }),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].cart;
    return pageHead(t.title, t.description, "/warenkorb", locale, { noindex: true });
  },
  component: CartPage,
});
function CartPage() {
  const t = useT();
  const lp = useLocaleParam();
  const { abgebrochen } = Route.useSearch();
  const navigate = useNavigate();
  const [cancelled, setCancelled] = useState(false);
  // Warenkorb und Kasse erst zeigen, wenn die Reservierung freigegeben ist: Sonst sehen Bestand, Gutschein
  // und Rabattcode noch die offene Bestellung (Gutschein «aufgebraucht», Code «zu oft eingelöst»).
  const [releasing, setReleasing] = useState(Boolean(abgebrochen));
  // Zurück aus der Stripe-Kasse ohne Zahlung (cancel_url, oder «Zurück» im Browser mit neu geladener Seite):
  // Reservierung freigeben, Hinweis zeigen, URL aufräumen.
  useEffect(() => {
    const pending = takePendingCheckout();
    const token = abgebrochen ?? pending;
    if (!token) return;
    setReleasing(true);
    void releaseCheckout(token)
      .catch(() => false)
      .finally(() => setReleasing(false));
    if (!abgebrochen) return;
    setCancelled(true);
    navigate({ to: "/{-$locale}/warenkorb", params: { locale: lp }, search: {}, replace: true });
  }, [abgebrochen, lp, navigate]);
  return (
    <div className="container page-body">
      <p className="eyebrow">{t.cart.eyebrow}</p>
      <h1 className="page-title">{t.cart.title}</h1>
      {cancelled && (
        <p className="form-notice" role="status">
          {t.checkout.cancelled}
        </p>
      )}
      {releasing ? <p role="status">{t.cart.loading}</p> : <CartContents page />}
    </div>
  );
}
