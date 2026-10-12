import { useEffect, useState, type CSSProperties } from "react";
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
import { Hero } from "./hero";
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
  const [embla, api] = useEmblaCarousel({ align: "start", dragFree: true });
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
  const lookProducts = look.hotspots.flatMap((h) => {
    const p = products.find((p) => p.handle === h.handle);
    return p ? [p] : [];
  });
  const newProducts = products
    .filter((p) => p.tags.includes("neu"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = lookProducts.find((p) => p.handle === hotspot);
  const activeSpot = look.hotspots.find((h) => h.handle === active?.handle);
  return (
    <>
      <Hero content={content.hero} />
      <section className="section container" id="kollektionen">
        <Reveal>
          <div className="section-head">
            <div>
              <p className="eyebrow">{content.collections.eyebrow}</p>
              <h2>{content.collections.title}</h2>
            </div>
          </div>
        </Reveal>
        <div className="category-grid">
          {collections
            .filter((c) => c.image)
            .map((c) => (
              <Link
                to="/{-$locale}/kollektion/$handle"
                params={{ locale: lp, handle: c.handle }}
                key={c.handle}
              >
                <Reveal image>
                  <div className="category-tile">
                    {c.image && <Photo image={c.image} />}
                    <div className="category-label">
                      <h3>{c.title}</h3>
                      <span>{t.home.discover} ↗</span>
                    </div>
                  </div>
                </Reveal>
              </Link>
            ))}
        </div>
      </section>
      <section className="section container new-section">
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
        <div className="carousel-viewport" ref={embla}>
          <div className="carousel-track">
            {newProducts.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </div>
        {carousel.overflow && (
          <div className="carousel-controls justify-end mt-6">
            <Button
              variant="icon"
              size="icon"
              aria-label={t.home.previous}
              disabled={!carousel.previous}
              onClick={() => api?.scrollPrev()}
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="icon"
              size="icon"
              aria-label={t.home.next}
              disabled={!carousel.next}
              onClick={() => api?.scrollNext()}
            >
              <ArrowRight />
            </Button>
          </div>
        )}
      </section>
      {lookProducts.length > 0 && (
        <section className="section look-section">
          <div className="container look-layout">
            <Reveal image>
              <div className="look-photo">
                <div className="look-image">
                  <Photo image={look.image} />
                  {look.hotspots.map((h) => (
                    <Button
                      key={h.handle}
                      variant="icon"
                      className={`hotspot hotspot-${h.key} ${hotspot === h.handle ? "active" : ""}`}
                      style={{ left: `${h.x}%`, top: `${h.y}%` } as CSSProperties}
                      aria-label={t.home.viewHotspot(h.label)}
                      aria-expanded={hotspot === h.handle}
                      onClick={() => setHotspot(hotspot === h.handle ? null : h.handle)}
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
                    <Photo image={active.images[0]} />
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
              <div className="look-items">
                {lookProducts.map((p) => (
                  <Link
                    className="look-item"
                    key={p.handle}
                    to="/{-$locale}/produkt/$handle"
                    params={{ locale: lp, handle: p.handle }}
                  >
                    <Photo image={p.images[0]} />
                    <div>
                      <h3>{p.title}</h3>
                      <p>{p.color.name}</p>
                    </div>
                    <span className="price">{formatPrice(p.priceRange.min, locale)}</span>
                  </Link>
                ))}
              </div>
              <div className="look-total">
                <span>{look.total}</span>
                <strong>
                  {formatPrice(
                    lookProducts.reduce((s, p) => s + p.priceRange.min.amount, 0),
                    locale,
                  )}
                </strong>
              </div>
              {look.ctaHandle && (
                <Button asChild>
                  <Link
                    to="/{-$locale}/produkt/$handle"
                    params={{ locale: lp, handle: look.ctaHandle }}
                    hash="outfit"
                  >
                    {look.cta}
                  </Link>
                </Button>
              )}
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
          <Photo image={content.story.image} />
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
