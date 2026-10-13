import { useEffect, useRef, useState, type CSSProperties } from "react";
import { outfitKey } from "./outfit-key";
import { isSoldOut, sizesFor, useOutfit } from "./outfit";
import { Link } from "@tanstack/react-router";
import { Heart, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { formatPrice } from "@/lib/commerce/format";
import { shippingLabel } from "@/lib/commerce/shipping-text";
import { useShopSettings } from "@/lib/commerce/use-settings";
import { useCart, useWishlist, useShopUI } from "@/lib/commerce/stores";
import type { Product } from "@/lib/commerce";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo, Panel } from "./primitives";
import { ProductCard, useFitLabel } from "./product-card";
import { SizeGuide } from "./size-guide";
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
  const [size, setSize] = useState("");
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
  const add = useCart((s) => s.add);
  const setCart = useShopUI((s) => s.setCart);
  const { handles, toggle } = useWishlist();
  // Nur bei anderem Produkt zurücksetzen. Neu geladene, gleiche Daten kommen als neue Objekte.
  useEffect(() => {
    setSize("");
  }, [product.handle]);
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
    const target = sizeSelector.current;
    const first = target?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    first?.focus({ preventScroll: true });
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  };
  const addSelected = () => {
    const variant = product.variants.find((v) => v.title === size && v.availableForSale);
    if (!variant) return;
    add(variant.id);
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
                key={image.url}
                onClick={() => {
                  setZoom(i);
                  setZoomed(false);
                }}
                aria-label={t.product.zoomImage(i + 1)}
              >
                <Photo image={image} eager={i === 0} />
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
          <div className="product-info">
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
            <div className="price">
              {formatPrice(product.priceRange.min, locale)}
              {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice, locale)}</del>}
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
                  {!v.availableForSale && <span className="sr-only">, {t.product.soldOut}</span>}
                </Button>
              ))}
            </div>
            <div ref={mainAdd} className="add-row">
              <Button disabled={!size} onClick={addSelected}>
                {t.product.addToCart}
              </Button>
              <Button
                variant="tailored"
                size="icon"
                aria-label={`${product.title}, ${product.color.name} ${handles.includes(product.handle) ? t.product.forget : t.product.remember}`}
                aria-pressed={handles.includes(product.handle)}
                onClick={() => toggle(product.handle)}
              >
                <Heart fill={handles.includes(product.handle) ? "currentColor" : "none"} />
              </Button>
            </div>
            {!size && <p className="size-hint">{t.product.pleaseChooseSize}</p>}
            <p className="delivery-note">{t.product.deliveryNote(shipping)}</p>
            <div className="accordion">
              {[
                { title: t.product.description, text: product.description },
                {
                  title: t.product.materialAndCare,
                  text: t.product.materialCare(
                    product.details.material || t.product.detailsFollow,
                    product.details.care || t.product.detailsFollow,
                  ),
                },
                {
                  title: t.product.fit,
                  text:
                    product.details.fit && product.details.fit !== product.fit
                      ? product.details.fit
                      : product.fit
                        ? `${fitLabel(product.fit)}.`
                        : `${t.product.detailsFollow}.`,
                },
                {
                  title: t.product.shippingAndReturns,
                  text: t.product.shippingText(shipping, shopConfig.returnDays),
                },
              ].map((a) => (
                <details key={a.title}>
                  <summary>
                    {a.title}
                    <Plus size={16} />
                  </summary>
                  <p>{a.text}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
        {outfit.length > 0 && (
          // Neu aufbauen bei anderem Produkt oder anderen Stücken: Auswahl und Grössen zurücksetzen.
          // Der Schlüssel bleibt gleich, wenn dieselben Daten neu geladen werden (gewählte Grössen bleiben).
          <OutfitBuilder key={`${product.handle}:${outfitKey(outfit)}`} outfit={outfit} />
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
          <span className="price">{formatPrice(product.priceRange.min, locale)}</span>
          <Button onClick={size ? addSelected : chooseSize}>
            {size ? t.product.addToCart : t.product.chooseSize}
          </Button>
        </div>
      )}
    </>
  );
}

/** «Komplettes Outfit» auf der Produktseite: passende Stücke mit Grösse zusammen in den Warenkorb. */
function OutfitBuilder({ outfit }: { outfit: Product[] }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const settings = useShopSettings();
  const state = useOutfit(outfit);
  const addToCart = () => {
    const missing = state.addToCart();
    if (missing[0]) document.getElementById(`outfit-size-${missing[0]}`)?.focus();
  };
  return (
    <section className="outfit-builder" id="outfit">
      <p className="eyebrow">{t.product.outfitEyebrow}</p>
      <h2>{t.product.outfitTitle}</h2>
      {outfit.map((p) => {
        const soldOut = isSoldOut(p);
        const invalid = state.missing.includes(p.handle);
        return (
          <div key={p.handle} className="outfit-row">
            <input
              type="checkbox"
              id={`outfit-check-${p.handle}`}
              aria-label={t.product.outfitSelect(`${p.title}, ${p.color.name}`)}
              checked={state.checked.includes(p.handle)}
              disabled={soldOut}
              onChange={() => state.toggle(p.handle)}
            />
            <Link to="/{-$locale}/produkt/$handle" params={{ locale: lp, handle: p.handle }}>
              <Photo image={p.images[0]} />
            </Link>
            <div>
              <h3>{p.title}</h3>
              <p className="price m-0">{formatPrice(p.priceRange.min, locale)}</p>
            </div>
            <select
              className="form-select"
              id={`outfit-size-${p.handle}`}
              aria-label={t.product.outfitSize(`${p.title}, ${p.color.name}`)}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "outfit-error" : undefined}
              disabled={soldOut}
              value={state.sizes[p.handle] ?? ""}
              onChange={(e) => state.choose(p.handle, e.target.value)}
            >
              <option value="">{soldOut ? t.product.outfitSoldOut : t.product.chooseSize}</option>
              {sizesFor(p, settings.hideSoldOut).map((v) => (
                <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                  {v.title}
                  {!v.availableForSale ? ` – ${t.product.soldOut}` : ""}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      <p className="price mt-6">{t.product.outfitSelection(formatPrice(state.total, locale))}</p>
      {state.missing.length > 0 && (
        <p role="alert" id="outfit-error" className="form-error">
          {t.product.outfitError}
        </p>
      )}
      <Button disabled={!state.checked.length} onClick={addToCart}>
        {t.product.outfitAdd}
      </Button>
    </section>
  );
}
