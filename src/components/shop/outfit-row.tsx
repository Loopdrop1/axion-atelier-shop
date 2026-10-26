// Eine Zeile im «Komplettes Outfit» der Produktseite: Bild mit Link, Auswahl mit Name, Preis und Grösse.
import { SIZES } from "@/lib/commerce/variants";
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/commerce/format";
import { isOneSizeTitle } from "@/lib/commerce/one-size";
import type { Product } from "@/lib/commerce/types";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo } from "./primitives";
import { isSoldOut, sizesFor, type useOutfit } from "./outfit";

export function OutfitRow({
  product: p,
  state,
  hideSoldOut,
  current = false,
}: {
  product: Product;
  state: ReturnType<typeof useOutfit>;
  hideSoldOut: boolean;
  /** Das Stück dieser Produktseite */
  current?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const soldOut = isSoldOut(p);
  const invalid = state.missing.includes(p.handle);
  const name = `${p.title}, ${p.color.name}`;
  return (
    <div className={`outfit-row ${state.checked.includes(p.handle) ? "" : "is-off"}`}>
      <Link
        className="outfit-thumb"
        to="/{-$locale}/produkt/$handle"
        params={{ locale: lp, handle: p.handle }}
        aria-label={name}
      >
        <Photo image={p.images[0]} sizes={SIZES.thumb} />
      </Link>
      <label className="outfit-pick">
        <input
          type="checkbox"
          id={`outfit-check-${p.handle}`}
          aria-label={t.product.outfitSelect(name)}
          checked={state.checked.includes(p.handle)}
          disabled={soldOut}
          onChange={() => state.toggle(p.handle)}
        />
        <span className="outfit-name">
          <strong>{p.title}</strong>
          {current && <em>{t.product.outfitThis}</em>}
          <span className="price">{formatPrice(p.priceRange.min, locale)}</span>
        </span>
      </label>
      <select
        className="form-select"
        id={`outfit-size-${p.handle}`}
        aria-label={t.product.outfitSize(name)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "outfit-error" : undefined}
        disabled={soldOut}
        value={state.sizes[p.handle] ?? ""}
        onChange={(e) => state.choose(p.handle, e.target.value)}
      >
        <option value="">
          {soldOut
            ? t.product.outfitSoldOut
            : `${t.product.chooseSize}${p.category === "schuhe" ? t.product.euSizes : ""}`}
        </option>
        {sizesFor(p, hideSoldOut).map((v) => (
          <option key={v.id} value={v.id} disabled={!v.availableForSale}>
            {isOneSizeTitle(v.title) ? t.product.oneSize : v.title}
            {!v.availableForSale ? ` – ${t.product.soldOut}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
