import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale, useLocaleParam, useT } from "@/i18n";
import { searchCatalog, searchCatalogWith, type SearchResult } from "@/lib/commerce";
import { searchString } from "@/lib/commerce/presentation";
import { searchQuery } from "@/lib/commerce/queries";
import { pageHead } from "@/lib/commerce/seo";
import { askSearchAssist, wantsAssist } from "@/lib/commerce/search-assist";
import { EmptyState } from "@/components/shop/cart";
import { ProductCard } from "@/components/shop/product-card";
import { IntentChips, RelaxedNotes } from "@/components/shop/search-intent";
import { rememberSearch } from "@/lib/commerce/recent-searches";

export const Route = createFileRoute("/{-$locale}/suche")({
  validateSearch: (s: Record<string, unknown>) => ({ q: searchString(s["q"]) }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, params }) =>
    context.queryClient.ensureQueryData(searchQuery(deps["q"] ?? "", toLocale(params.locale))),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].search;
    return pageHead(t.title, t.description, "/suche", locale, { noindex: true });
  },
  component: SearchPage,
});

function SearchPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  // Startwert aus dem Loader (vom Server mitgeschickt): Server und Browser hydrieren mit denselben Daten,
  // auch wenn der Server-Zwischenspeicher (30 s) nach einer Änderung im Admin noch den alten Stand hat.
  const { data } = useSuspenseQuery({
    ...searchQuery(q ?? "", locale),
    initialData: Route.useLoaderData(),
  });
  // Angepasste Ergebnisse: ein Begriff entfernt oder von der KI verstanden (gilt bis zur nächsten Eingabe)
  const [override, setOverride] = useState<{ q: string; result: SearchResult; ai: boolean } | null>(
    null,
  );
  const [thinking, setThinking] = useState(false);
  const current = override?.q === (q ?? "") ? override : null;
  const result = current?.result ?? data;

  // Längere Sätze («Outfit für eine Sommerhochzeit am See») einmal von der KI in Filter übersetzen lassen
  useEffect(() => {
    const query = q ?? "";
    if (!wantsAssist(query, data)) return;
    let live = true;
    const timer = setTimeout(() => {
      setThinking(true);
      askSearchAssist(query, locale)
        .then(async (extra) => {
          if (!live || !extra) return;
          const next = await searchCatalog(query, locale, extra);
          if (live && next.products.length) setOverride({ q: query, result: next, ai: true });
        })
        .finally(() => live && setThinking(false));
    }, 700);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, locale, data]);

  const go = (next: string) =>
    navigate({
      to: "/{-$locale}/suche",
      params: { locale: lp },
      search: { q: next },
      replace: true,
      // Bei jedem Tastendruck: ohne Überblendung (auch in Browsern ohne Übergangstypen)
      viewTransition: false,
    });

  return (
    <div className="container page-body">
      <h1 className="page-title">{t.search.title}</h1>
      <input
        id="page-search"
        className="search-input mb-6"
        aria-label={t.search.pageLabel}
        placeholder={t.search.pagePlaceholder}
        value={q ?? ""}
        onChange={(e) => go(e.target.value)}
        onBlur={() => rememberSearch(q ?? "")}
      />
      <IntentChips
        intent={result.intent}
        relaxed={result.relaxedChecks}
        onChange={(intent) =>
          searchCatalogWith(intent, locale).then((next) =>
            setOverride({ q: q ?? "", result: next, ai: Boolean(current?.ai) }),
          )
        }
      />
      {current?.ai && <p className="search-note search-ai">{t.search.ai}</p>}
      {(thinking || current?.ai) && (
        <p className="search-note search-ai-notice">
          {t.search.aiNotice}{" "}
          <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
            {t.newsletter.privacy}
          </Link>
        </p>
      )}
      {thinking && !current && (
        <p className="search-note" role="status">
          {t.search.aiWorking}
        </p>
      )}
      {result.didYouMean && (
        <p className="search-note">
          {t.search.didYouMean}{" "}
          <button type="button" className="search-fix" onClick={() => go(result.didYouMean!)}>
            «{result.didYouMean}»
          </button>
          ?
        </p>
      )}
      <RelaxedNotes result={result} />
      {result.intent.gift && (
        <p className="search-note">
          <Link to="/{-$locale}/geschenkgutschein" params={{ locale: lp }}>
            {t.search.giftCard}
          </Link>
        </p>
      )}
      <p className="text-muted mb-8" role="status">
        {t.common.results(result.products.length)}
        {q ? t.search.for(q) : ""}
      </p>
      {result.products.length ? (
        <div className="product-grid">
          {result.products.map((p, i) => (
            <ProductCard
              key={p.handle}
              product={p}
              eager={i < 4}
              priority={i === 0}
              headingLevel={2}
            />
          ))}
        </div>
      ) : q ? (
        <EmptyState title={t.search.none} text={t.search.noneText} suggest />
      ) : (
        <p className="text-muted">{t.search.hint}</p>
      )}
    </div>
  );
}
