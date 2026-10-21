import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo } from "./primitives";
import { formatPrice, discountPercent } from "@/lib/commerce/format";
import { oneSizeVariant } from "@/lib/commerce/one-size";
import { useCart, useWishlist, useShopUI } from "@/lib/commerce/stores";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import type { Product } from "@/lib/commerce";
/** Passform-Code («Slim Fit») als Text in der aktuellen Sprache. */
export function useFitLabel() {
  const t = useT();
  return (fit: string) => t.product.fits[fit] ?? fit;
}
export function ProductCard({ product }: { product: Product }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const fitLabel = useFitLabel();
  const name = `${product.title}, ${product.color.name}`;
  const { handles, toggle } = useWishlist();
  const add = useCart((s) => s.add);
  const setCart = useShopUI((s) => s.setCart);
  const saved = handles.includes(product.handle);
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
          <Photo image={product.images[0]} />
          {product.images[1] && <Photo image={product.images[1]} className="second-image" />}
        </Link>
        {(product.tags.includes("muster") ||
          product.tags.includes("sale") ||
          product.tags.includes("neu")) && (
          <span className={`product-badge ${product.tags.includes("muster") ? "is-sample" : ""}`}>
            {product.tags.includes("muster")
              ? t.product.badgeSample
              : product.tags.includes("sale")
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
                    add(single.id);
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
                    add(v.id);
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
        <h3>{product.title}</h3>
      </Link>
      <p className="product-description">
        {product.color.name}
        {product.fit ? ` · ${fitLabel(product.fit)}` : ""}
      </p>
      <div className="price">
        {formatPrice(product.priceRange.min, locale)}{" "}
        {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice, locale)}</del>}
        {discountPercent(product.priceRange.min, product.compareAtPrice) > 0 && (
          <span className="price-off">
            −{discountPercent(product.priceRange.min, product.compareAtPrice)} %
          </span>
        )}
      </div>
    </article>
  );
}
