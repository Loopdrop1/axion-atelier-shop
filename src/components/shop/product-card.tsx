import { Link } from "@tanstack/react-router";
import { SIZES } from "@/lib/commerce/variants";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo } from "./primitives";
import { useAddToCart } from "./use-add-to-cart";
import { formatPrice, formatDiscount, discountPercent } from "@/lib/commerce/format";
import { oneSizeVariant } from "@/lib/commerce/one-size";
import { isOnSale } from "@/lib/commerce/sale";
import { useWishlist, useShopUI } from "@/lib/commerce/stores";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import type { Product } from "@/lib/commerce";
/** Passform-Code («Slim Fit») als Text in der aktuellen Sprache. */
export function useFitLabel() {
  const t = useT();
  return (fit: string) => t.product.fits[fit] ?? fit;
}
export function ProductCard({
  product,
  eager = false,
  priority = false,
  headingLevel = 3,
}: {
  product: Product;
  eager?: boolean;
  /** Wahrscheinlich grösstes Bild der Seite (erste Karte): mit hoher Priorität laden */
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const fitLabel = useFitLabel();
  const name = `${product.title}, ${product.color.name}`;
  const saved = useWishlist((s) => s.handles.includes(product.handle));
  const toggle = useWishlist((s) => s.toggle);
  const addToCart = useAddToCart();
  const setCart = useShopUI((s) => s.setCart);
  const onSale = isOnSale(product);
  const single = oneSizeVariant(product);
  return (
    <article className="product-card">
      <div className="product-card-image">
        <Link
          to="/{-$locale}/produkt/$handle"
          params={{ locale: lp, handle: product.handle }}
          aria-label={name}
          onClick={(e) => {
            // Nur das angeklickte Bild fliegt auf die Produktseite (Namen müssen eindeutig sein)
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            document
              .querySelectorAll(".vt-product-image")
              .forEach((el) => el.classList.remove("vt-product-image"));
            e.currentTarget.classList.add("vt-product-image");
          }}
        >
          <Photo image={product.images[0]} eager={eager} priority={priority} sizes={SIZES.card} />
          {product.images[1] && (
            <Photo image={product.images[1]} className="second-image" sizes={SIZES.card} />
          )}
        </Link>
        {(product.tags.includes("muster") || onSale || product.tags.includes("neu")) && (
          <span className={`product-badge ${product.tags.includes("muster") ? "is-sample" : ""}`}>
            {product.tags.includes("muster")
              ? t.product.badgeSample
              : onSale
                ? t.product.badgeSale
                : t.product.badgeNew}
          </span>
        )}
        <Button
          variant="icon"
          size="icon"
          className="product-heart"
          aria-label={`${name} ${saved ? t.product.forget : t.product.remember}`}
          aria-pressed={saved}
          onClick={() => toggle(product.handle)}
        >
          <Heart fill={saved ? "currentColor" : "none"} />
        </Button>
        <div className="quick-add">
          {/* Einheitsgrösse: direkt in den Warenkorb, ohne Grössenwahl */}
          {!single && <span>{t.product.chooseSize}</span>}
          <div>
            {single ? (
              single.availableForSale ? (
                <Button
                  variant="icon"
                  onClick={() => {
                    addToCart([single]);
                    setCart(true);
                  }}
                  aria-label={t.product.addOne(name)}
                >
                  {t.product.addToCart}
                </Button>
              ) : (
                <span>{t.product.outfitSoldOut}</span>
              )
            ) : (
              product.variants.map((v) => (
                <Button
                  variant="icon"
                  key={v.id}
                  disabled={!v.availableForSale}
                  onClick={() => {
                    addToCart([v]);
                    setCart(true);
                  }}
                  aria-label={
                    v.availableForSale
                      ? t.product.addSize(name, v.title)
                      : t.product.sizeSoldOut(name, v.title)
                  }
                >
                  {v.title}
                  {!v.availableForSale && <span className="sr-only">, {t.product.soldOut}</span>}
                </Button>
              ))
            )}
          </div>
        </div>
      </div>
      <Link to="/{-$locale}/produkt/$handle" params={{ locale: lp, handle: product.handle }}>
        <Heading>{product.title}</Heading>
      </Link>
      <p className="product-description">
        {product.color.name}
        {product.fit ? ` · ${fitLabel(product.fit)}` : ""}
      </p>
      <div className="price">
        {product.priceRange.min.amount < product.priceRange.max.amount
          ? t.product.from(formatPrice(product.priceRange.min, locale))
          : formatPrice(product.priceRange.min, locale)}{" "}
        {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice, locale)}</del>}
        {discountPercent(product.priceRange.min, product.compareAtPrice) > 0 && (
          <span className="price-off">
            {formatDiscount(
              discountPercent(product.priceRange.min, product.compareAtPrice),
              locale,
            )}
          </span>
        )}
      </div>
    </article>
  );
}
