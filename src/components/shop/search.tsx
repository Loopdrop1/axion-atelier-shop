import { useEffect, useRef, useState } from "react";
import { SIZES } from "@/lib/commerce/variants";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { searchCatalog, type SearchResult } from "@/lib/commerce";
import { useShopUI } from "@/lib/commerce/stores";
import { formatPrice } from "@/lib/commerce/format";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Photo } from "./primitives";
import { Panel } from "./panel";
import { IntentChips, RelaxedNotes } from "./search-intent";
import { readRecentSearches, rememberSearch } from "@/lib/commerce/recent-searches";

export function SearchOverlay() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const { searchOpen, setSearch } = useShopUI();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  useEffect(() => {
    if (searchOpen) setRecent(readRecentSearches());
  }, [searchOpen]);
  useEffect(() => {
    let live = true;
    if (!query.trim()) {
      setResult(null);
      return;
    }
    searchCatalog(query, locale).then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, [query, locale]);
  const products = result?.products ?? [];
  const close = () => {
    rememberSearch(query);
    setSearch(false);
  };
  const openAll = (q = query) => {
    rememberSearch(q);
    setSearch(false);
    navigate({ to: "/{-$locale}/suche", params: { locale: lp }, search: { q } });
  };
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
          if (e.key === "Enter" && query.trim()) {
            e.preventDefault();
            openAll();
          }
        }}
      />
      <p role="status" className="sr-only">
        {query.trim() && result
          ? products.length
            ? t.common.results(products.length)
            : t.search.none
          : ""}
      </p>
      {!query.trim() ? (
        <div className="search-start">
          {recent.length > 0 && (
            <section>
              <h3>{t.search.recent}</h3>
              <div className="search-pills">
                {recent.map((r) => (
                  <button type="button" key={r} onClick={() => setQuery(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3>{t.search.popular}</h3>
            <div className="search-pills">
              {t.search.popularItems.map((r) => (
                <button type="button" key={r} onClick={() => setQuery(r)}>
                  {r}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <>
          <IntentChips intent={result?.intent} relaxed={result?.relaxedChecks} />
          {result?.didYouMean && (
            <p className="search-note">
              {t.search.didYouMean}{" "}
              <button
                type="button"
                className="search-fix"
                onClick={() => setQuery(result.didYouMean!)}
              >
                «{result.didYouMean}»
              </button>
              ?
            </p>
          )}
          <RelaxedNotes result={result ?? undefined} onNavigate={close} />
          {result && result.intent.categories.length > 0 && (
            <div className="search-pills" role="group" aria-label={t.search.categories}>
              {result.intent.categories.map((c) => (
                <Link
                  key={c}
                  to="/{-$locale}/kollektion/$handle"
                  params={{ locale: lp, handle: c }}
                  onClick={close}
                >
                  {t.nav.labels[c] ?? c} <ArrowRight aria-hidden="true" />
                </Link>
              ))}
              {result.intent.gift && (
                <Link to="/{-$locale}/geschenkgutschein" params={{ locale: lp }} onClick={close}>
                  {t.search.giftCard} <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
          <div className="search-results">
            {products.slice(0, 6).map((p, i) => (
              <Link
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className="search-result"
                key={p.handle}
                to="/{-$locale}/produkt/$handle"
                params={{ locale: lp, handle: p.handle }}
                onClick={close}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    refs.current[Math.min(i + 1, Math.min(products.length, 6) - 1)]?.focus();
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (i === 0) input.current?.focus();
                    else refs.current[i - 1]?.focus();
                  }
                }}
              >
                <Photo image={p.images[0]} sizes={SIZES.thumb} />
                <div>
                  <h3>{p.title}</h3>
                  <p>
                    {p.color.name} · {p.categoryTitle}
                  </p>
                </div>
                <span className="price">
                  {p.priceRange.min.amount < p.priceRange.max.amount
                    ? t.product.from(formatPrice(p.priceRange.min, locale))
                    : formatPrice(p.priceRange.min, locale)}
                </span>
              </Link>
            ))}
          </div>
          {result && !products.length && <p className="text-muted">{t.search.none}</p>}
          {products.length > 0 && (
            <button type="button" className="text-link" onClick={() => openAll()}>
              {t.search.all} ({products.length}) <ArrowRight />
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
