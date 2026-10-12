import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale, useLocaleParam, useT } from "@/i18n";
import { searchString } from "@/lib/commerce/presentation";
import { searchQuery } from "@/lib/commerce/queries";
import { pageHead } from "@/lib/commerce/seo";
import { ProductCard } from "@/components/shop/product-card";
export const Route = createFileRoute("/{-$locale}/suche")({
  validateSearch: (s: Record<string, unknown>) => ({ q: searchString(s["q"]) }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, params }) =>
    context.queryClient.ensureQueryData(searchQuery(deps["q"] ?? "", toLocale(params.locale))),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].search;
    return pageHead(t.title, t.description, "/suche", locale);
  },
  component: SearchPage,
});
function SearchPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(searchQuery(q ?? "", locale));
  return (
    <div className="container page-body">
      <h1 className="page-title">{t.search.title}</h1>
      <input
        id="page-search"
        className="search-input mb-10"
        aria-label={t.search.pageLabel}
        placeholder={t.search.pagePlaceholder}
        value={q ?? ""}
        onChange={(e) =>
          navigate({
            to: "/{-$locale}/suche",
            params: { locale: lp },
            search: { q: e.target.value },
            replace: true,
          })
        }
      />
      <p className="text-muted mb-8">
        {t.common.results(data.length)}
        {q ? t.search.for(q) : ""}
      </p>
      {data.length ? (
        <div className="product-grid">
          {data.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : (
        <p className="text-muted">{q ? t.search.none : t.search.hint}</p>
      )}
    </div>
  );
}
