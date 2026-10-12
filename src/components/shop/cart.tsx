import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { MAX_PER_LINE, useCart } from "@/lib/commerce/stores";
import { resolveCart, type Cart as CartType } from "@/lib/commerce";
import { formatPrice } from "@/lib/commerce/format";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo } from "./primitives";
import { CheckoutSummary } from "./checkout-summary";
export function EmptyState({ title, text }: { title: string; text: string }) {
  const t = useT();
  const lp = useLocaleParam();
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p className="text-muted">{text}</p>
      <div className="empty-links">
        <Button asChild>
          <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "alle" }}>
            {t.common.discoverCollection}
          </Link>
        </Button>
      </div>
    </div>
  );
}
/** Warenkorb in der Seitenleiste (page = false) oder auf der Warenkorbseite mit Kasse (page = true). */
export function CartContents({
  page = false,
  onNavigate,
}: {
  page?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const hydrated = useStoreHydrated(useCart.persist);
  const lines = useCart((s) => s.lines);
  const quantity = useCart((s) => s.quantity);
  const remove = useCart((s) => s.remove);
  const [cart, setCart] = useState<CartType | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    setFailed(false);
    resolveCart(lines, locale)
      .then((c) => {
        if (!live) return;
        setCart(c);
        // Positionen, deren Variante es nicht mehr gibt (gelöscht oder aus einem anderen Katalog), entfernen.
        const missing = lines.filter((l) => !c.lines.some((r) => r.variantId === l.variantId));
        if (missing.length) {
          missing.forEach((m) => remove(m.variantId));
          setNotice(t.cart.removedItems);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [lines, hydrated, locale, remove, attempt, t.cart.removedItems]);
  if (failed)
    return (
      <div className="cart-error" role="alert">
        <p>{t.cart.loadError}</p>
        <Button variant="tailored" onClick={() => setAttempt((n) => n + 1)}>
          {t.common.retry}
        </Button>
      </div>
    );
  if (!hydrated || !cart) return <p role="status">{t.cart.loading}</p>;
  if (!cart.lines.length)
    return (
      <>
        {notice && <p className="form-notice">{notice}</p>}
        <EmptyState title={t.cart.emptyTitle} text={t.cart.emptyText} />
      </>
    );
  return (
    <div className={page ? "cart-layout" : ""}>
      <div>
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        {cart.lines.map((l) => (
          <div className="cart-line" key={l.variantId}>
            <Link
              to="/{-$locale}/produkt/$handle"
              params={{ locale: lp, handle: l.product.handle }}
              onClick={onNavigate}
            >
              <Photo image={l.product.images[0]} />
            </Link>
            <div className="cart-line-info">
              <Link
                to="/{-$locale}/produkt/$handle"
                params={{ locale: lp, handle: l.product.handle }}
                onClick={onNavigate}
              >
                <h3>{l.product.title}</h3>
              </Link>
              <p>{t.cart.lineMeta(l.product.color.name, l.variant.title)}</p>
              <span className="price">
                {formatPrice(l.variant.price, locale)}
                {l.variant.compareAtPrice && (
                  <del>{formatPrice(l.variant.compareAtPrice, locale)}</del>
                )}
              </span>
              {!l.variant.availableForSale && <p className="form-error">{t.cart.lineSoldOut}</p>}
              <div className="cart-line-controls">
                <div className="stepper">
                  <Button
                    variant="icon"
                    aria-label={t.cart.decrease}
                    onClick={() => quantity(l.variantId, l.quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <span aria-live="polite">{l.quantity}</span>
                  <Button
                    variant="icon"
                    aria-label={t.cart.increase}
                    disabled={l.quantity >= MAX_PER_LINE}
                    title={l.quantity >= MAX_PER_LINE ? t.cart.maxPerLine : undefined}
                    onClick={() => quantity(l.variantId, l.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={t.cart.remove(l.product.title)}
                  onClick={() => remove(l.variantId)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {page ? (
        <CheckoutSummary cart={cart} onNotice={setNotice} />
      ) : (
        <div className="cart-summary" aria-live="polite">
          <p>
            <span>{t.checkout.subtotal}</span>
            <span className="price">{formatPrice(cart.subtotal, locale)}</span>
          </p>
          <Button
            onClick={() => {
              onNavigate?.();
              navigate({ to: "/{-$locale}/warenkorb", params: { locale: lp } });
            }}
          >
            {t.checkout.toCheckout}
          </Button>
          <span className="checkout-note">{t.checkout.estimateNote}</span>
        </div>
      )}
    </div>
  );
}
