import { useEffect, useRef, useState } from "react";
import { SIZES } from "@/lib/commerce/variants";
import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { MAX_PER_LINE, lineMax, useCart, useShopUI } from "@/lib/commerce/stores";
import { sizeText } from "@/lib/commerce/one-size";
import { listProducts, resolveCart, type Cart as CartType, type Product } from "@/lib/commerce";
import { formatPrice } from "@/lib/commerce/format";
import { useShopSettings } from "@/lib/commerce/use-settings";
import { shippingLabel } from "@/lib/commerce/shipping-text";
import { shopConfig } from "@/config/shop";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo } from "./primitives";
import { CheckoutSummary } from "./checkout-summary";
import { FreeShippingBar } from "./free-shipping-bar";
import { ProductCard } from "./product-card";
export function EmptyState({
  title,
  text,
  suggest = false,
}: {
  title: string;
  text: string;
  /** Neuheiten als Anregung zeigen (Warenkorbseite, Merkliste; nicht in der schmalen Seitenleiste) */
  suggest?: boolean;
}) {
  const t = useT();
  const lp = useLocaleParam();
  const locale = useLocale();
  const [newest, setNewest] = useState<Product[]>([]);
  useEffect(() => {
    if (!suggest) return;
    let live = true;
    listProducts({ collection: "neu" }, locale).then((p) => live && setNewest(p.slice(0, 4)));
    return () => {
      live = false;
    };
  }, [suggest, locale]);
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
      {newest.length > 0 && (
        <section className="empty-suggestions">
          <h3>{t.home.newArrivals.title}</h3>
          <div className="product-grid">
            {newest.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
/** Wie lange «Entfernt · Rückgängig» sichtbar bleibt */
const UNDO_MS = 8000;

/** Warenkorb in der Seitenleiste (page = false) oder auf der Warenkorbseite mit Kasse (page = true). */
export function CartContents({
  page = false,
  onNavigate,
}: {
  page?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const settings = useShopSettings();
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const hydrated = useStoreHydrated(useCart.persist);
  const lines = useCart((s) => s.lines);
  const quantity = useCart((s) => s.quantity);
  const remove = useCart((s) => s.remove);
  const add = useCart((s) => s.add);
  const addNotice = useShopUI((s) => s.cartNotice);
  const [cart, setCart] = useState<CartType | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{
    variantId: string;
    quantity: number;
    stock: number;
    name: string;
  } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const undoLine = useRef<HTMLParagraphElement>(null);
  // Index der entfernten Zeile: danach springt der Fokus auf die nächste Zeile
  const focusAfterRemove = useRef<number | null>(null);
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
        // Mengen über dem Bestand (Lager hat sich seit dem Einlegen verändert) einmalig kürzen
        const over = c.lines.filter(
          (l) =>
            l.variant.availableForSale &&
            l.variant.stock > 0 &&
            l.quantity > lineMax(l.variant.stock),
        );
        if (over.length) {
          over.forEach((l) => quantity(l.variantId, lineMax(l.variant.stock)));
          setNotice(t.cart.reduced);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [lines, hydrated, locale, remove, quantity, attempt, t.cart.removedItems, t.cart.reduced]);
  // «Rückgängig» verschwindet nach einigen Sekunden von selbst
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);
  // Nach dem Entfernen: Fokus auf die Entfernen-Taste der nächsten Zeile, sonst auf die Meldung
  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null || !cart) return;
    focusAfterRemove.current = null;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>(".cart-line-remove");
    const target = buttons?.length
      ? buttons[Math.min(index, buttons.length - 1)]
      : undoLine.current;
    target?.focus();
  }, [cart]);
  const removeLine = (l: CartType["lines"][number], index: number) => {
    focusAfterRemove.current = index;
    remove(l.variantId);
    setUndo({
      variantId: l.variantId,
      quantity: l.quantity,
      stock: l.variant.stock,
      name: l.product.title,
    });
  };
  const undoNotice = undo && (
    <p className="form-notice cart-undo" role="status" tabIndex={-1} ref={undoLine}>
      {t.cart.removedLine(undo.name)} ·{" "}
      <button
        type="button"
        className="text-link"
        onClick={() => {
          add(undo.variantId, undo.quantity, undo.stock);
          setUndo(null);
        }}
      >
        {t.cart.undo}
      </button>
    </p>
  );
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
        {undoNotice}
        {notice && <p className="form-notice">{notice}</p>}
        <EmptyState title={t.cart.emptyTitle} text={t.cart.emptyText} suggest={page} />
      </>
    );
  const subtotalCents = Math.round(cart.subtotal.amount * 100);
  return (
    <div className={page ? "cart-layout" : ""}>
      <div ref={list}>
        {undoNotice}
        {(notice || addNotice) && (
          <p className="form-notice" role="status">
            {[notice, addNotice].filter(Boolean).join(" ")}
          </p>
        )}
        {cart.lines.map((l, index) => {
          const max = l.variant.availableForSale ? lineMax(l.variant.stock) : 0;
          const atMax = l.variant.availableForSale && l.quantity >= max;
          const limitId = `cart-limit-${l.variantId}`;
          return (
            <div className="cart-line" key={l.variantId}>
              <Link
                to="/{-$locale}/produkt/$handle"
                params={{ locale: lp, handle: l.product.handle }}
                onClick={onNavigate}
              >
                <Photo image={l.product.images[0]} sizes={SIZES.thumb} />
              </Link>
              <div className="cart-line-info">
                <Link
                  to="/{-$locale}/produkt/$handle"
                  params={{ locale: lp, handle: l.product.handle }}
                  onClick={onNavigate}
                >
                  <h3>{l.product.title}</h3>
                </Link>
                <p>{`${l.product.color.name} · ${sizeText(l.variant.title, t.product.size, t.product.oneSize)}`}</p>
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
                      disabled={l.quantity <= 1}
                      onClick={() => quantity(l.variantId, l.quantity - 1)}
                    >
                      <Minus />
                    </Button>
                    <output aria-label={t.cart.quantityOf(l.product.title, l.quantity)}>
                      {l.quantity}
                    </output>
                    <Button
                      variant="icon"
                      aria-label={t.cart.increase}
                      aria-describedby={atMax ? limitId : undefined}
                      disabled={!l.variant.availableForSale || l.quantity >= max}
                      onClick={() => quantity(l.variantId, l.quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button
                    variant="icon"
                    size="icon"
                    className="cart-line-remove"
                    aria-label={t.cart.remove(l.product.title)}
                    onClick={() => removeLine(l, index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {/* Immer vorhanden, damit Screenreader die Grenze beim Erreichen vorlesen */}
                <p className="line-limit" id={limitId} role="status">
                  {atMax ? (max < MAX_PER_LINE ? t.cart.onlyLeft(max) : t.cart.maxPerLine) : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {page ? (
        <CheckoutSummary cart={cart} onNotice={setNotice} />
      ) : (
        <div className="cart-summary" aria-live="polite">
          <FreeShippingBar subtotalCents={subtotalCents} settings={settings} />
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
          <p className="cart-trust">
            {shippingLabel(settings, locale)} · {t.home.benefits.returns(shopConfig.returnDays)}
          </p>
          <Button variant="link" className="cart-continue" onClick={onNavigate}>
            {t.order.continueShopping}
          </Button>
        </div>
      )}
    </div>
  );
}
