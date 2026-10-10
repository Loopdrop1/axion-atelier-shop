import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { formatPrice } from "@/lib/commerce/format";
import { useCart, useWishlist, useShopUI } from "@/lib/commerce/stores";
import type { Product } from "@/lib/commerce";
import { Photo, Panel } from "./primitives";
import { ProductCard } from "./product-card";
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
  const [size, setSize] = useState("");
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const swipeStart = useRef(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [bottom, setBottom] = useState(false);
  const mainAdd = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const add = useCart((s) => s.add);
  const setCart = useShopUI((s) => s.setCart);
  const { handles, toggle } = useWishlist();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string[]>(outfit.map((p) => p.handle));
  const [outfitError, setOutfitError] = useState("");
  useEffect(() => {
    setSize("");
    setChosen({});
    setChecked(outfit.map((p) => p.handle));
  }, [product.handle, outfit]);
  useEffect(() => {
    const node = mainAdd.current;
    if (!node) return;
    const o = new IntersectionObserver(([e]) =>
      setBottom(Boolean(e && !e.isIntersecting && e.boundingClientRect.top < 0)),
    );
    o.observe(node);
    return () => o.disconnect();
  }, []);
  const addSelected = () => {
    const variant = product.variants.find((v) => v.title === size && v.availableForSale);
    if (!variant) return;
    add(variant.id);
    setCart(true);
  };
  const outfitTotal = outfit
    .filter((p) => checked.includes(p.handle))
    .reduce((sum, p) => sum + p.priceRange.min.amount, 0);
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
                aria-label={`Bild ${i + 1} vergrössern`}
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
                aria-label={`Bild ${i + 1}`}
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
            <nav className="breadcrumb" aria-label="Brotkrümelnavigation">
              <Link to="/">Startseite</Link>
              <span>/</span>
              <Link to="/kollektion/$handle" params={{ handle: product.category }}>
                {product.category === "anzuege"
                  ? "Anzüge"
                  : product.category === "westen"
                    ? "Westen"
                    : "Schuhe"}
              </Link>
            </nav>
            <h1>{product.title}</h1>
            <p className="text-muted text-sm">
              {product.color.name}
              {product.fit
                ? ` · ${product.fit === "Slim Fit" ? "Schmale Passform" : "Gerade Passform"}`
                : ""}
            </p>
            <div className="price">
              {formatPrice(product.priceRange.min)}
              {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice)}</del>}
            </div>
            {shopConfig.vatRegistered && <p className="text-xs text-muted">inkl. MWST</p>}
            <p className="text-xs mb-2">Farbe: {product.color.name}</p>
            <div className="swatches">
              {siblings.map((p) => (
                <Link
                  key={p.handle}
                  to="/produkt/$handle"
                  params={{ handle: p.handle }}
                  aria-label={p.color.name}
                  title={p.color.name}
                  className={`swatch swatch-${p.color.name.toLowerCase().replace("ü", "ue")} ${p.handle === product.handle ? "active" : ""}`}
                />
              ))}
            </div>
            <div className="size-label">
              <span>Grösse wählen{product.category === "schuhe" ? " · EU" : ""}</span>
              <Button variant="icon" onClick={() => setGuide(true)}>
                Grössentabelle
              </Button>
            </div>
            <div className="size-grid">
              {product.variants.map((v) => (
                <Button
                  variant="icon"
                  key={v.id}
                  className={size === v.title ? "selected" : ""}
                  disabled={!v.availableForSale}
                  aria-pressed={size === v.title}
                  onClick={() => setSize(v.title)}
                >
                  {v.title}
                </Button>
              ))}
            </div>
            <div ref={mainAdd} className="add-row">
              <Button disabled={!size} onClick={addSelected}>
                In den Warenkorb
              </Button>
              <Button
                variant="tailored"
                size="icon"
                aria-label="Zur Merkliste hinzufügen"
                aria-pressed={handles.includes(product.handle)}
                onClick={() => toggle(product.handle)}
              >
                <Heart fill={handles.includes(product.handle) ? "currentColor" : "none"} />
              </Button>
            </div>
            {!size && <p className="size-hint">Bitte Grösse wählen</p>}
            <p className="delivery-note">
              Gratisversand in der Schweiz · Lieferung in 2 bis 5 Arbeitstagen
            </p>
            <div className="accordion">
              {[
                { title: "Beschreibung", text: product.description },
                {
                  title: "Material und Pflege",
                  text: `Material: ${product.details.material}. Pflege: ${product.details.care}.`,
                },
                {
                  title: "Passform",
                  text: product.fit
                    ? product.fit === "Slim Fit"
                      ? "Schmale Passform."
                      : "Gerade Passform."
                    : "Angaben folgen.",
                },
                {
                  title: "Versand und Rückgabe",
                  text: `Gratisversand in der Schweiz. Lieferung in 2 bis 5 Arbeitstagen. Rückgabe innert ${shopConfig.returnDays} Tagen; die Bedingungen werden vor dem Livegang bestätigt.`,
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
          <section className="outfit-builder" id="outfit">
            <p className="eyebrow">Zusammen getragen</p>
            <h2>Komplettes Outfit</h2>
            {outfit.map((p) => (
              <div key={p.handle} className="outfit-row">
                <input
                  type="checkbox"
                  aria-label={`${p.title} auswählen`}
                  checked={checked.includes(p.handle)}
                  onChange={() =>
                    setChecked((s) =>
                      s.includes(p.handle) ? s.filter((h) => h !== p.handle) : [...s, p.handle],
                    )
                  }
                />
                <Link to="/produkt/$handle" params={{ handle: p.handle }}>
                  <Photo image={p.images[0]} />
                </Link>
                <div>
                  <h3>{p.title}</h3>
                  <p className="price m-0">{formatPrice(p.priceRange.min)}</p>
                </div>
                <select
                  className="form-select"
                  aria-label={`Grösse für ${p.title}`}
                  value={chosen[p.handle] || ""}
                  onChange={(e) => setChosen((s) => ({ ...s, [p.handle]: e.target.value }))}
                >
                  <option value="">Grösse wählen</option>
                  {p.variants.map((v) => (
                    <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                      {v.title}
                      {!v.availableForSale ? " – ausverkauft" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="price mt-6">Auswahl: {formatPrice(outfitTotal)}</p>
            {outfitError && (
              <p role="alert" className="size-hint">
                {outfitError}
              </p>
            )}
            <Button
              disabled={!checked.length}
              onClick={() => {
                if (checked.some((h) => !chosen[h])) {
                  setOutfitError("Bitte wähle eine Grösse für jedes ausgewählte Stück.");
                  return;
                }
                checked.forEach((h) => {
                  const id = chosen[h];
                  if (id) add(id);
                });
                setOutfitError("");
                setCart(true);
              }}
            >
              Auswahl in den Warenkorb
            </Button>
          </section>
        )}
        <section className="section pb-0">
          <div className="section-head">
            <h2>Das könnte dir auch gefallen</h2>
          </div>
          <div className="product-grid">
            {recommendations.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </section>
      </div>
      <Panel open={guide} onOpenChange={setGuide} title="Grössentabelle">
        <SizeGuide />
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
              onTouchStart={(e) => {
                swipeStart.current = e.touches[0]?.clientX || 0;
              }}
              onTouchEnd={(e) => {
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
                aria-label="Vorheriges Bild"
                onClick={() => {
                  setZoom((zoom - 1 + product.images.length) % product.images.length);
                  setZoomed(false);
                }}
              >
                <ArrowLeft />
              </Button>
              <Button variant="icon" onClick={() => setZoomed(!zoomed)}>
                {zoomed ? "Verkleinern" : "Vergrössern"}
              </Button>
              <Button
                variant="icon"
                size="icon"
                aria-label="Nächstes Bild"
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
          <span className="price">{formatPrice(product.priceRange.min)}</span>
          <Button disabled={!size} onClick={addSelected}>
            {size ? "In den Warenkorb" : "Grösse wählen"}
          </Button>
        </div>
      )}
    </>
  );
}
