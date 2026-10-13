// Startseite: den Look neben dem Bild direkt kaufen. Stücke an- oder abwählen, je eine Grösse wählen,
// dann den ganzen Look oder die Auswahl in den Warenkorb legen (gleiche Regeln wie auf der Produktseite).
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/commerce/format";
import { useShopSettings } from "@/lib/commerce/use-settings";
import type { Product } from "@/lib/commerce";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo } from "./primitives";
import { isSoldOut, sizesFor, useOutfit } from "./outfit";

const ERROR_ID = "look-error";

export function LookShop({ products, total }: { products: Product[]; total: string }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const settings = useShopSettings();
  const outfit = useOutfit(products);
  const count = outfit.checked.length;
  // «Ganzer Look» nur, wenn wirklich alle Stücke dabei sind (ein ausverkauftes Stück fehlt sonst)
  const whole = products.length > 0 && products.every((p) => outfit.checked.includes(p.handle));

  const addToCart = () => {
    const missing = outfit.addToCart();
    // Erste fehlende Grösse anspringen, damit klar ist, wo es fehlt
    if (missing[0]) document.getElementById(`look-size-${missing[0]}`)?.focus();
  };

  return (
    <>
      <ul className="look-items">
        {products.map((p) => {
          const soldOut = isSoldOut(p);
          const selected = outfit.checked.includes(p.handle);
          const invalid = outfit.missing.includes(p.handle);
          const name = `${p.title}, ${p.color.name}`;
          return (
            <li key={p.handle} className={`look-item ${selected ? "" : "is-off"}`}>
              <input
                type="checkbox"
                className="look-check"
                aria-label={t.product.outfitSelect(name)}
                checked={selected}
                disabled={soldOut}
                onChange={() => outfit.toggle(p.handle)}
              />
              <Link
                className="look-thumb"
                to="/{-$locale}/produkt/$handle"
                params={{ locale: lp, handle: p.handle }}
                tabIndex={-1}
                aria-hidden="true"
              >
                <Photo image={p.images[0]} />
              </Link>
              <div className="look-info">
                <h3>
                  <Link to="/{-$locale}/produkt/$handle" params={{ locale: lp, handle: p.handle }}>
                    {p.title}
                  </Link>
                </h3>
                <p>{p.color.name}</p>
              </div>
              <span className="price">{formatPrice(p.priceRange.min, locale)}</span>
              <select
                className="form-select look-size"
                id={`look-size-${p.handle}`}
                aria-label={t.product.outfitSize(name)}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? ERROR_ID : undefined}
                disabled={soldOut}
                value={outfit.sizes[p.handle] ?? ""}
                onChange={(e) => outfit.choose(p.handle, e.target.value)}
              >
                <option value="">
                  {soldOut
                    ? t.product.outfitSoldOut
                    : `${t.product.chooseSize}${p.category === "schuhe" ? t.product.euSizes : ""}`}
                </option>
                {sizesFor(p, settings.hideSoldOut).map((v) => (
                  <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                    {v.title}
                    {!v.availableForSale ? ` – ${t.product.soldOut}` : ""}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <div className="look-total">
        <span>{whole ? total : t.home.lookSelection(count, products.length)}</span>
        <strong>{formatPrice(outfit.total, locale)}</strong>
      </div>
      {outfit.missing.length > 0 && (
        <p role="alert" id={ERROR_ID} className="form-error look-error">
          {t.product.outfitError}
        </p>
      )}
      <Button className="look-add" disabled={!count} onClick={addToCart}>
        {whole ? t.home.lookAddAll : t.product.outfitAdd}
      </Button>
    </>
  );
}
