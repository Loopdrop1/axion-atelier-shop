import { useEffect, useState, type CSSProperties } from "react";
import { SIZES } from "@/lib/commerce/variants";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, ArrowLeft, Truck, Clock3, CreditCard, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/commerce/format";
import { shippingLabel } from "@/lib/commerce/shipping-text";
import { useShopSettings } from "@/lib/commerce/use-settings";
import { shopConfig } from "@/config/shop";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import type { Collection, HomeContent, Product } from "@/lib/commerce";
import { BrandMoment } from "./brand-moment";
import { Hero } from "./hero";
import { LookShop } from "./look-shop";
import { outfitKey } from "./outfit-key";
import { Lines, Photo, Reveal } from "./primitives";
import { ProductCard } from "./product-card";
import { occasionHandles } from "./shell";
export function HomePage({
  products,
  collections,
  content,
}: {
  products: Product[];
  collections: Collection[];
  content: HomeContent;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const settings = useShopSettings();
  // Auf Handys natives Wischen (scroll-snap) statt Embla, das dort nicht zuverlässig zieht
  const [embla, api] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    breakpoints: { "(max-width: 767px)": { active: false } },
  });
  const [carousel, setCarousel] = useState({ previous: false, next: false, overflow: false });
  useEffect(() => {
    if (!api) return;
    const update = () =>
      setCarousel({
        previous: api.canScrollPrev(),
        next: api.canScrollNext(),
        overflow: api.scrollSnapList().length > 1,
      });
    update();
    api.on("select", update).on("reInit", update).on("settle", update);
    return () => {
      api.off("select", update).off("reInit", update).off("settle", update);
    };
  }, [api]);
  const [hotspot, setHotspot] = useState<string | null>(null);
  const { look } = content;
  // Jedes Stück nur einmal, auch wenn zwei Punkte auf dasselbe Produkt zeigen
  const lookProducts = look.hotspots.flatMap((h, i, spots) => {
    if (spots.findIndex((s) => s.handle === h.handle) !== i) return [];
    const p = products.find((p) => p.handle === h.handle);
    return p ? [p] : [];
  });
  const newProducts = products
    .filter((p) => p.tags.includes("neu"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const categories = collections.filter((c) => c.image);
  // Der Pfeil im Einstieg führt zum ersten Abschnitt, der etwas zeigt
  const next = newProducts.length
    ? { id: "neuheiten", label: t.home.scrollCue }
    : categories.length
      ? { id: "kollektionen", label: t.home.scrollCueCollections }
      : undefined;
  const activeSpot = look.hotspots.find((h) => h.key === hotspot);
  const active = lookProducts.find((p) => p.handle === activeSpot?.handle);
  return (
    <>
      <Hero content={content.hero} next={next} />
      {/* Wie im Reel: direkt nach dem Einstieg die Stücke, gross und freigestellt */}
      {newProducts.length > 0 && (
        <section className="section container new-section" id="neuheiten">
          <Reveal>
            <div className="section-head">
              <div>
                <p className="eyebrow">{content.newArrivals.eyebrow}</p>
                <h2>{content.newArrivals.title}</h2>
              </div>
              <Link
                className="text-link"
                to="/{-$locale}/kollektion/$handle"
                params={{ locale: lp, handle: "neu" }}
              >
                {content.newArrivals.link} <ArrowRight />
              </Link>
            </div>
          </Reveal>
          <Reveal>
            <div className="product-grid">
              {newProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.handle} product={p} />
              ))}
            </div>
          </Reveal>
        </section>
      )}
      {categories.length > 0 && (
        <section className="section container" id="kollektionen">
          <Reveal>
            <div className="section-head">
              <div>
                <p className="eyebrow">{content.collections.eyebrow}</p>
                <h2>{content.collections.title}</h2>
              </div>
              {carousel.overflow && (
                <div className="carousel-controls">
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={t.home.previousCategories}
                    disabled={!carousel.previous}
                    onClick={() => api?.scrollPrev()}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={t.home.nextCategories}
                    disabled={!carousel.next}
                    onClick={() => api?.scrollNext()}
                  >
                    <ArrowRight />
                  </Button>
                </div>
              )}
            </div>
          </Reveal>
          <div className="carousel-viewport" ref={embla}>
            <div className="carousel-track">
              {categories.map((c) => (
                <Link
                  className="category-card"
                  to="/{-$locale}/kollektion/$handle"
                  params={{ locale: lp, handle: c.handle }}
                  key={c.handle}
                >
                  <div className="category-tile">
                    <Photo image={c.image} sizes={SIZES.tile} />
                  </div>
                  <div className="category-label">
                    <h3>{c.title}</h3>
                    <span>{t.home.discover} ↗</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      {lookProducts.length > 0 && (
        <section className="section look-section">
          <div className="container look-layout">
            <Reveal image>
              <div className="look-photo">
                <div className="look-image">
                  <Photo image={look.image} sizes={SIZES.half} />
                  {look.hotspots.map((h) => (
                    <Button
                      key={h.key}
                      variant="icon"
                      className={`hotspot hotspot-${h.key} ${hotspot === h.key ? "active" : ""}`}
                      style={{ left: `${h.x}%`, top: `${h.y}%` } as CSSProperties}
                      aria-label={t.home.viewHotspot(h.label)}
                      aria-expanded={hotspot === h.key}
                      onClick={() => setHotspot(hotspot === h.key ? null : h.key)}
                    >
                      <Plus />
                    </Button>
                  ))}
                </div>
                {active && (
                  <div
                    className={`hotspot-card ${(activeSpot?.x ?? 0) > 55 ? "side-left" : "side-right"}`}
                    style={
                      {
                        "--spot-x": activeSpot?.x ?? 50,
                        "--spot-y": activeSpot?.y ?? 50,
                      } as CSSProperties
                    }
                  >
                    <Photo image={active.images[0]} sizes={SIZES.thumb} />
                    <div>
                      <h3>{active.title}</h3>
                      <p className="price">{formatPrice(active.priceRange.min, locale)}</p>
                      <Link
                        to="/{-$locale}/produkt/$handle"
                        params={{ locale: lp, handle: active.handle }}
                        className="text-link"
                      >
                        {t.home.view} <ArrowRight />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
            <Reveal className="look-copy">
              <p className="eyebrow">{look.eyebrow}</p>
              <h2>
                <Lines text={look.title} />
              </h2>
              <p className="text-muted">{look.text}</p>
              {/* Neu aufbauen, wenn andere Stücke im Look sind (Auswahl und Grössen zurücksetzen) */}
              <LookShop key={outfitKey(lookProducts)} products={lookProducts} total={look.total} />
            </Reveal>
          </div>
        </section>
      )}
      <section className="section container">
        <Reveal>
          <p className="eyebrow">{content.occasions.eyebrow}</p>
          <h2>{content.occasions.title}</h2>
        </Reveal>
        <div className="occasion-grid">
          {occasionHandles.map((o) => (
            <Link
              className="occasion-link"
              key={o}
              to="/{-$locale}/kollektion/$handle"
              params={{ locale: lp, handle: "alle" }}
              search={{ anlass: o }}
            >
              <h3>
                {t.occasions[o]}
                <ArrowRight />
              </h3>
              <p>{content.occasions.texts[o]}</p>
            </Link>
          ))}
        </div>
      </section>
      <BrandMoment content={content.brand} />
      <div className="container">
        <div className="benefits">
          {[
            { Icon: Truck, text: shippingLabel(settings, locale) },
            { Icon: Clock3, text: t.home.benefits.delivery },
            { Icon: CreditCard, text: t.home.benefits.payment },
            { Icon: RotateCcw, text: t.home.benefits.returns(shopConfig.returnDays) },
          ].map(({ Icon, text }) => (
            <div className="benefit" key={text}>
              <Icon />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <section className="section container about-layout">
        <Reveal image>
          <Photo image={content.story.image} sizes={SIZES.half} />
        </Reveal>
        <Reveal>
          <p className="eyebrow">{content.story.eyebrow}</p>
          <h2>
            <Lines text={content.story.title} />
          </h2>
          <p>{content.story.text}</p>
          <Link className="text-link" to="/{-$locale}/ueber-uns" params={{ locale: lp }}>
            {content.story.link} <ArrowRight />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
