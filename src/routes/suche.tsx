import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { searchProducts } from "@/lib/commerce";
import { pageHead } from "@/lib/commerce/seo";
import { ProductCard } from "@/components/shop/product-card";
const searchQuery = (q: string) =>
  queryOptions({ queryKey: ["search", q], queryFn: () => searchProducts(q) });
export const Route = createFileRoute("/suche")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "" }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(searchQuery(deps["q"])),
  head: () =>
    pageHead("Suche", "Suche nach Anzügen, Westen, Schuhen und Farben in der Axion Kollektion."),
  component: SearchPage,
});
function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(searchQuery(q));
  return (
    <div className="container page-body">
      <h1 className="page-title">Suche</h1>
      <input
        className="search-input mb-10"
        aria-label="Kollektion durchsuchen"
        placeholder="Was suchst du?"
        value={q}
        onChange={(e) => navigate({ to: "/suche", search: { q: e.target.value }, replace: true })}
      />
      <p className="text-muted mb-8">
        {data.length} Ergebnisse{q ? ` für «${q}»` : ""}
      </p>
      {data.length ? (
        <div className="product-grid">
          {data.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : (
        <p className="text-muted">
          {q
            ? "Keine passenden Stücke gefunden."
            : "Suche nach einem Stück, einer Kategorie oder einer Farbe."}
        </p>
      )}
    </div>
  );
}
