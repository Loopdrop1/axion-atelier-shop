import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { messages, toLocale, useLocaleParam, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { releaseCheckout } from "@/lib/commerce/checkout";
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
  // Zurück aus der Stripe-Kasse ohne Zahlung: Reservierung freigeben, Hinweis zeigen, URL aufräumen.
  useEffect(() => {
    if (!abgebrochen) return;
    setCancelled(true);
    void releaseCheckout(abgebrochen);
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
      <CartContents page />
    </div>
  );
}
