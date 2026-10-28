import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SIZES } from "@/lib/commerce/variants";
import { outfitKey } from "./outfit-key";
import { sizesFor, useOutfit } from "./outfit";
import { OutfitRow } from "./outfit-row";
import { useAddToCart } from "./use-add-to-cart";
import { Link } from "@tanstack/react-router";
import { Heart, Plus, ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { formatPrice, formatDiscount, discountPercent } from "@/lib/commerce/format";
import { oneSizeVariant } from "@/lib/commerce/one-size";
import { shippingLabel } from "@/lib/commerce/shipping-text";
import { useShopSettings } from "@/lib/commerce/use-settings";
import { useRecentlyViewed, useWishlist, useShopUI } from "@/lib/commerce/stores";
import { getProductsByHandles, type Product } from "@/lib/commerce";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo } from "./primitives";
import { materialLine } from "@/lib/commerce/material-line";
import { DeliveryEstimate } from "./delivery-estimate";
import { Panel } from "./panel";
import { ProductCard, useFitLabel } from "./product-card";
import { SizeGuide } from "./size-guide";
import { ShareButton } from "./share-button";
import { StockAlertForm } from "./stock-alert-form";
/** Bis zu diesem Bestand zeigt die Seite «Nur noch … an Lager» (bei 3 wäre es bei kleinen Beständen fast immer) */
const LOW_STOCK = 2;

export function ProductPage({
  product,
  siblings,
  outfit,
  recommendations,
}: {
  product: Product;
  siblings: Product[];
  outfit: Product[];
  recommendations: Product[];
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const fitLabel = useFitLabel();
  const settings = useShopSettings();
  const shipping = shippingLabel(settings, locale);
  // Einheitsgrösse (z. B. Krawatte): die Grösse ist gesetzt, es gibt nichts zu wählen
  const onlyVariant = oneSizeVariant(product);
  const presetSize = onlyVariant?.availableForSale ? onlyVariant.title : "";
  const [size, setSize] = useState(presetSize);
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const swipeStart = useRef(0);
  const sizeSelector = useRef<HTMLDivElement>(null);
  const zoomSurface = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [bottom, setBottom] = useState(false);
  const mainAdd = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const addToCart = useAddToCart();
  const setCart = useShopUI((s) => s.setCart);
  const saved = useWishlist((s) => s.handles.includes(product.handle));
  const toggle = useWishlist((s) => s.toggle);
  // «Bitte Grösse wählen» erst nach einem Klick auf den Knopf ohne gewählte Grösse
  const [hint, setHint] = useState(false);
  // Nur bei anderem Produkt zurücksetzen. Neu geladene, gleiche Daten kommen als neue Objekte.
  useEffect(() => {
    setSize(presetSize);
  }, [product.handle, presetSize]);
  useEffect(() => {
    const node = mainAdd.current;
    if (!node) return;
    const footer = document.querySelector(".site-footer");
    let frame = 0;
    const update = () => {
      const mainRect = node.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      setBottom(mainRect.bottom <= 0 && (!footerRect || footerRect.top >= window.innerHeight));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(schedule);
    observer.observe(node);
    if (footer) observer.observe(footer);
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    window.addEventListener("pageshow", schedule);
    schedule();
    const settled = window.setTimeout(schedule, 300);
    return () => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settled);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("pageshow", schedule);
    };
  }, [product.handle]);
  const chooseSize = () => {
    setHint(true);
    const target = sizeSelector.current;
    // Kurz hervorheben, wohin es geht (Animation nur ohne «weniger Bewegung», siehe styles.css)
    target?.classList.remove("attention");
    void target?.offsetWidth;
    target?.classList.add("attention");
    const first = target?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    first?.focus({ preventScroll: true });
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  };
  // Hervorhebung endet, sobald eine Grösse gewählt ist
  useEffect(() => {
    sizeSelector.current?.classList.remove("attention");
    if (size) setHint(false);
  }, [size]);
  const sample = product.tags.includes("muster");
  const klarna = (shopConfig.paymentMethods as readonly string[]).includes("Klarna");
  // «Nur noch 2 an Lager» erst, wenn eine knappe Grösse gewählt ist
  const chosen = product.variants.find((v) => v.title === size && v.availableForSale);
  const lowStock = chosen && chosen.stock <= LOW_STOCK ? chosen.stock : 0;
  // Preis der gewählten Grösse; ohne Wahl und bei Variantenpreisen «ab»
  const pick = product.variants.find((v) => v.title === size);
  const shownPrice = pick?.price ?? product.priceRange.min;
  const shownCompare = pick ? pick.compareAtPrice : product.compareAtPrice;
  const hasRange = product.priceRange.min.amount < product.priceRange.max.amount;
  const priceText = formatPrice(shownPrice, locale);
  const soldOutSingle = !!onlyVariant && !onlyVariant.availableForSale;
  const fitNote =
    product.details.fit && product.details.fit !== product.fit ? product.details.fit : "";
  const headline = materialLine(product.details);
  const facts = [
    {
      label: t.product.fit,
      value: [product.fit ? fitLabel(product.fit) : "", fitNote].filter(Boolean).join(". "),
      explain: false,
    },
    { label: t.product.material, value: product.details.material ?? "", explain: true },
    { label: t.product.origin, value: product.details.origin ?? "", explain: false },
    { label: t.product.care, value: product.details.care ?? "", explain: false },
  ].filter((f) => f.value.trim());
  const addSelected = () => {
    const variant = product.variants.find((v) => v.title === size && v.availableForSale);
    if (!variant) return;
    addToCart([variant]);
    setCart(true);
  };
  return (
    <>
      <div className="container page-body">
        <div className="product-layout">
          <div
            className="product-gallery"
            ref={gallery}
            onScroll={(e) =>
              setGalleryIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
            }
          >
            {product.images.map((image, i) => (
              <Button
                variant="icon"
                key={`${image.url}-${i}`}
                className={i === 0 ? "vt-product-image" : undefined}
                style={{ "--i": i } as CSSProperties}
                onClick={() => {
                  setZoom(i);
                  setZoomed(false);
                }}
                aria-label={t.product.zoomImage(i + 1)}
              >
                <Photo image={image} eager={i === 0} priority={i === 0} sizes={SIZES.gallery} />
              </Button>
            ))}
          </div>
          <div className="gallery-dots">
            {product.images.map((_, i) => (
              <Button
                variant="icon"
                key={i}
                className={galleryIndex === i ? "active" : ""}
                aria-label={t.product.image(i + 1)}
                onClick={() =>
                  gallery.current?.scrollTo({
                    left: i * gallery.current.clientWidth,
                    behavior: "smooth",
                  })
                }
              />
            ))}
          </div>
          <div className="product-text">
            <div className="product-head">
              <nav className="breadcrumb" aria-label={t.product.breadcrumb}>
                <Link to="/{-$locale}" params={{ locale: lp }}>
                  {t.product.home}
                </Link>
                <span>/</span>
                <Link
                  to="/{-$locale}/kollektion/$handle"
                  params={{ locale: lp, handle: product.category }}
                >
                  {product.categoryTitle}
                </Link>
              </nav>
              <h1>{product.title}</h1>
              <p className="text-muted text-sm">
                {product.color.name}
                {product.fit ? ` · ${fitLabel(product.fit)}` : ""}
              </p>
              {headline && <p className="product-material-line">{headline}</p>}
              {sample && <p className="sample-notice">{t.product.sampleNotice}</p>}
            </div>
            <div className="product-details">
              {product.description && (
                <p className="product-text-description">{product.description}</p>
              )}
              <h2 className="details-title">{t.product.detailsTitle}</h2>
              {facts.length > 0 && (
                <dl className="product-facts">
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.value}
                        {f.explain && (
                          <>
                            {" "}
                            <Link
                              className="fact-link"
                              to="/{-$locale}/ratgeber/$slug"
                              params={{ locale: lp, slug: "stoffe-und-qualitaet" }}
                            >
                              {t.product.materialExplain}
                            </Link>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {product.details.features.length > 0 && (
                <ul className="product-features" aria-label={t.product.features}>
                  {product.details.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}
              {facts.length === 0 && product.details.features.length === 0 && (
                <p className="text-muted">{t.product.detailsFollow}.</p>
              )}
            </div>
          </div>
          <div className="product-buy">
            <div className="price">
              {!pick && hasRange ? t.product.from(priceText) : priceText}
              {shownCompare && <del>{formatPrice(shownCompare, locale)}</del>}
              {discountPercent(shownPrice, shownCompare) > 0 && (
                <span className="price-off">
                  {formatDiscount(discountPercent(shownPrice, shownCompare), locale)}
                </span>
              )}
            </div>
            {shopConfig.vatRegistered && (
              <p className="text-xs text-muted">{t.product.vatIncluded}</p>
            )}
            <p className="text-xs mb-2">{t.product.colorLabel(product.color.name)}</p>
            <div className="swatches">
              {siblings.map((p) => (
                <Link
                  key={p.handle}
                  to="/{-$locale}/produkt/$handle"
                  params={{ locale: lp, handle: p.handle }}
                  aria-label={p.color.name}
                  title={p.color.name}
                  className={`swatch ${p.handle === product.handle ? "active" : ""}`}
                  style={{ "--swatch": p.color.hex } as CSSProperties}
                />
              ))}
            </div>
            {onlyVariant ? (
              <p className="size-single">
                {t.product.oneSize}
                {!onlyVariant.availableForSale && ` · ${t.product.soldOut}`}
              </p>
            ) : (
              <>
                <div className="size-label">
                  <span>
                    {t.product.chooseSize}
                    {product.category === "schuhe" ? t.product.euSizes : ""}
                  </span>
                  <Button variant="icon" onClick={() => setGuide(true)}>
                    {t.product.sizeGuide}
                  </Button>
                </div>
                <div className="size-grid" ref={sizeSelector}>
                  {sizesFor(product, settings.hideSoldOut).map((v) => (
                    <Button
                      variant="icon"
                      key={v.id}
                      className={size === v.title ? "selected" : ""}
                      disabled={!v.availableForSale}
                      aria-pressed={size === v.title}
                      onClick={() => setSize(v.title)}
                    >
                      {v.title}
                      {!v.availableForSale && (
                        <span className="sr-only">, {t.product.soldOut}</span>
                      )}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {/* Immer vorhanden, damit Screenreader den Hinweis beim Wechsel der Grösse vorlesen */}
            <p className="stock-hint" role="status">
              {lowStock > 0 ? t.product.lowStock(lowStock) : ""}
            </p>
            <div ref={mainAdd} className="add-row">
              {/* Wie die Leiste unten: ohne Grösse «Grösse wählen», Einheitsgrösse ausverkauft gesperrt */}
              <Button disabled={soldOutSingle} onClick={size ? addSelected : chooseSize}>
                {soldOutSingle
                  ? t.product.soldOut
                  : size
                    ? t.product.addToCart
                    : t.product.chooseSize}
              </Button>
              <Button
                variant="tailored"
                size="icon"
                aria-label={`${product.title}, ${product.color.name} ${saved ? t.product.forget : t.product.remember}`}
                aria-pressed={saved}
                onClick={() => toggle(product.handle)}
              >
                <Heart fill={saved ? "currentColor" : "none"} />
              </Button>
            </div>
            {hint && !size && !onlyVariant && (
              <p className="size-hint" role="status">
                {t.product.pleaseChooseSize}
              </p>
            )}
            <ShareButton title={product.title} />
            <StockAlertForm product={product} />
            <p className="delivery-note">{t.product.deliveryNote(shipping)}</p>
            {/* Nur mit lieferbarer Grösse; Platzhalter gleicher Höhe, bis das Datum im Browser berechnet ist */}
            {product.variants.some((v) => v.availableForSale) && <DeliveryEstimate />}
            <p className="trust-line">
              {t.home.benefits.returns(shopConfig.returnDays)} ·{" "}
              <Link to="/{-$locale}/versand-und-rueckgabe" params={{ locale: lp }}>
                {t.product.returnsLink}
              </Link>
            </p>
            {klarna && <p className="pay-hint">{t.product.klarna}</p>}
            <div className="accordion">
              <details>
                <summary>
                  {t.product.shippingAndReturns}
                  <Plus size={16} />
                </summary>
                <p>{t.product.shippingText(shipping, shopConfig.returnDays)}</p>
              </details>
            </div>
            <ConsultCard />
          </div>
        </div>
        {outfit.length > 0 && (
          // Neu aufbauen bei anderem Produkt oder anderen Stücken: Auswahl und Grössen zurücksetzen.
          // Der Schlüssel bleibt gleich, wenn dieselben Daten neu geladen werden (gewählte Grössen bleiben).
          <OutfitBuilder
            key={`${product.handle}:${outfitKey([product, ...outfit])}`}
            product={product}
            outfit={[product, ...outfit]}
            startVariantId={chosen?.id ?? ""}
          />
        )}
        <section className="section pb-0">
          <div className="section-head">
            <h2>{t.product.recommendations}</h2>
          </div>
          <div className="product-grid">
            {recommendations.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </section>
        <RecentlyViewed current={product.handle} />
      </div>
      <Panel open={guide} onOpenChange={setGuide} title={t.product.sizeGuide}>
        <SizeGuide category={product.category} />
      </Panel>
      <Panel
        open={zoom !== null}
        onOpenChange={(v) => {
          if (!v) setZoom(null);
        }}
        title={product.title}
        kind="zoom"
      >
        {zoom !== null && (
          <>
            <div
              ref={zoomSurface}
              className={`zoom-surface ${zoomed ? "is-zoomed" : ""}`}
              onPointerDown={(e) => {
                if (!zoomed) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                pan.current = {
                  x: e.clientX,
                  y: e.clientY,
                  left: e.currentTarget.scrollLeft,
                  top: e.currentTarget.scrollTop,
                };
              }}
              onPointerMove={(e) => {
                if (!pan.current || !zoomed) return;
                e.currentTarget.scrollLeft = pan.current.left - (e.clientX - pan.current.x);
                e.currentTarget.scrollTop = pan.current.top - (e.clientY - pan.current.y);
              }}
              onPointerUp={() => {
                pan.current = null;
              }}
              onPointerCancel={() => {
                pan.current = null;
              }}
              onTouchStart={(e) => {
                if (zoomed) return;
                swipeStart.current = e.touches[0]?.clientX || 0;
              }}
              onTouchEnd={(e) => {
                if (zoomed) return;
                const end = e.changedTouches[0]?.clientX;
                if (end === undefined) return;
                const delta = end - swipeStart.current;
                if (Math.abs(delta) > 60) {
                  setZoom(
                    (zoom + (delta < 0 ? 1 : -1) + product.images.length) % product.images.length,
                  );
                  setZoomed(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") setZoom((zoom + 1) % product.images.length);
                if (e.key === "ArrowLeft")
                  setZoom((zoom - 1 + product.images.length) % product.images.length);
              }}
              tabIndex={0}
            >
              <Photo
                image={product.images[zoom]}
                sizes="200vw"
                className={`zoom-image ${zoomed ? "zoomed" : ""}`}
              />
            </div>
            <div className="zoom-controls">
              <Button
                variant="icon"
                size="icon"
                aria-label={t.product.previousImage}
                onClick={() => {
                  setZoom((zoom - 1 + product.images.length) % product.images.length);
                  setZoomed(false);
                }}
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="icon"
                onClick={() => {
                  setZoomed(!zoomed);
                  requestAnimationFrame(() => {
                    const surface = zoomSurface.current;
                    if (surface) {
                      surface.scrollLeft = (surface.scrollWidth - surface.clientWidth) / 2;
                      surface.scrollTop = (surface.scrollHeight - surface.clientHeight) / 2;
                    }
                  });
                }}
              >
                {zoomed ? t.product.zoomOut : t.product.zoomIn}
              </Button>
              <Button
                variant="icon"
                size="icon"
                aria-label={t.product.nextImage}
                onClick={() => {
                  setZoom((zoom + 1) % product.images.length);
                  setZoomed(false);
                }}
              >
                <ArrowRight />
              </Button>
            </div>
          </>
        )}
      </Panel>
      {bottom && (
        <div className="mobile-add-bar">
          <span className="price">{!pick && hasRange ? t.product.from(priceText) : priceText}</span>
          {/* Einheitsgrösse ausverkauft: nichts zu wählen, also auch kein «Grösse wählen» */}
          <Button onClick={size ? addSelected : chooseSize} disabled={!size && !!onlyVariant}>
            {size ? t.product.addToCart : onlyVariant ? t.product.soldOut : t.product.chooseSize}
          </Button>
        </div>
      )}
    </>
  );
}

/** «Komplettes Outfit» auf der Produktseite: dieses Stück und die passenden zusammen mit Grösse in den Warenkorb. */
function OutfitBuilder({
  product,
  outfit,
  startVariantId,
}: {
  product: Product;
  /** Dieses Stück zuerst, dann die passenden */
  outfit: Product[];
  /** Grösse aus der Kaufbox (Startwert und Folgewert für dieses Stück) */
  startVariantId: string;
}) {
  const t = useT();
  const locale = useLocale();
  const settings = useShopSettings();
  const state = useOutfit(outfit, startVariantId ? { [product.handle]: startVariantId } : {});
  // Die Grösse in der Kaufbox gilt auch für dieses Stück im Outfit
  const choose = state.choose;
  useEffect(() => {
    if (startVariantId) choose(product.handle, startVariantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choose ist bei jedem Rendern neu, die Grösse löst aus
  }, [startVariantId, product.handle]);
  const addToCart = () => {
    const missing = state.addToCart();
    if (missing[0]) document.getElementById(`outfit-size-${missing[0]}`)?.focus();
  };
  const count = state.checked.length;
  return (
    <section className="outfit-builder" id="outfit">
      <p className="eyebrow">{t.product.outfitEyebrow}</p>
      <h2>{t.product.outfitTitle}</h2>
      {outfit.map((p) => (
        <OutfitRow
          key={p.handle}
          product={p}
          state={state}
          hideSoldOut={settings.hideSoldOut}
          current={p.handle === product.handle}
        />
      ))}
      <p className="price mt-6">{t.product.outfitSelection(formatPrice(state.total, locale))}</p>
      {state.missing.length > 0 && (
        <p role="alert" id="outfit-error" className="form-error">
          {t.product.outfitError}
        </p>
      )}
      <Button disabled={!count} onClick={addToCart}>
        {count ? t.product.outfitAddCount(count) : t.product.outfitAdd}
      </Button>
    </section>
  );
}

/** Persönlicher Service: Kontakt, auf Wunsch mit Telefonnummer (nur wenn in der Konfiguration eingetragen). */
function ConsultCard() {
  const t = useT();
  const lp = useLocaleParam();
  const phone = shopConfig.contact.phone;
  const showPhone = phone.trim() !== "" && !phone.startsWith("[");
  return (
    <div className="consult-card">
      <MessageCircle aria-hidden="true" />
      <div>
        <p className="consult-title">{t.product.consultTitle}</p>
        <p>{t.product.consultText}</p>
        <Link className="text-link" to="/{-$locale}/kontakt" params={{ locale: lp }}>
          {t.product.consultLink} <ArrowRight />
        </Link>
        {showPhone && <p className="consult-phone">{t.product.consultPhone(phone)}</p>}
      </div>
    </div>
  );
}

/** Merkt sich das Produkt (nach dem Laden des Speichers) und zeigt die zuvor angesehenen Stücke. */
function RecentlyViewed({ current }: { current: string }) {
  const t = useT();
  const locale = useLocale();
  const hydrated = useStoreHydrated(useRecentlyViewed.persist);
  const add = useRecentlyViewed((s) => s.add);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!hydrated) return;
    // Vor dem Merken lesen, damit das aktuelle Stück nicht in der eigenen Liste steht
    const handles = useRecentlyViewed
      .getState()
      .handles.filter((h) => h !== current)
      .slice(0, 4);
    add(current);
    let alive = true;
    if (handles.length) getProductsByHandles(handles, locale).then((p) => alive && setProducts(p));
    else setProducts([]);
    return () => {
      alive = false;
    };
  }, [hydrated, current, locale, add]);
  if (!products.length) return null;
  return (
    <section className="section pb-0 recently-viewed">
      <div className="section-head">
        <h2>{t.product.recentlyViewed}</h2>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <ProductCard key={p.handle} product={p} />
        ))}
      </div>
    </section>
  );
}
