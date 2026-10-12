import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { searchProducts, type Product } from "@/lib/commerce";
import { useShopUI } from "@/lib/commerce/stores";
import { formatPrice } from "@/lib/commerce/format";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo, Panel } from "./primitives";
export function SearchOverlay() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const { searchOpen, setSearch } = useShopUI();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  useEffect(() => {
    let live = true;
    searchProducts(query, locale).then((p) => {
      if (live) setResults(p);
    });
    return () => {
      live = false;
    };
  }, [query, locale]);
  return (
    <Panel open={searchOpen} onOpenChange={setSearch} title={t.search.overlayTitle} kind="search">
      <input
        ref={input}
        id="overlay-search"
        aria-label={t.search.label}
        placeholder={t.search.placeholder}
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            refs.current[0]?.focus();
          }
        }}
      />
      <div className="search-results">
        {results.slice(0, 5).map((p, i) => (
          <Link
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="search-result"
            key={p.handle}
            to="/{-$locale}/produkt/$handle"
            params={{ locale: lp, handle: p.handle }}
            onClick={() => setSearch(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                refs.current[Math.min(i + 1, results.length - 1)]?.focus();
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (i === 0) input.current?.focus();
                else refs.current[i - 1]?.focus();
              }
            }}
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
      {query && !results.length && <p className="text-muted">{t.search.none}</p>}
      {query && results.length > 0 && (
        <Link
          className="text-link"
          to="/{-$locale}/suche"
          params={{ locale: lp }}
          search={{ q: query }}
          onClick={() => setSearch(false)}
        >
          {t.search.all} <ArrowRight />
        </Link>
      )}
    </Panel>
  );
}
