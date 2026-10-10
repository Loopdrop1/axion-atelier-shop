import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCollection, listProducts } from "@/lib/commerce";
import { searchString } from "@/lib/commerce/presentation";
import { pageHead } from "@/lib/commerce/seo";
import { CollectionPage, type CollectionSearch } from "@/components/shop/collection";
const collectionQuery = (handle: string, s: CollectionSearch) =>
  queryOptions({
    queryKey: ["collection", handle, s],
    queryFn: async () => {
      const collection = await getCollection(handle);
      if (!collection) throw notFound();
      return {
        collection,
        catalogue: await listProducts({ collection: handle }),
        products: await listProducts({
          collection: handle,
          occasion: s["anlass"],
          sizes: s["groesse"]?.split(","),
          colors: s["farbe"]?.split(","),
          fits: s["passform"]?.split(","),
          priceMax: s["preis"],
          sort: s["sort"],
        }),
      };
    },
  });
export const Route = createFileRoute("/kollektion/$handle")({
  validateSearch: (s: Record<string, unknown>): CollectionSearch => ({
    anlass: searchString(s["anlass"]),
    groesse: searchString(s["groesse"]),
    farbe: searchString(s["farbe"]),
    passform: searchString(s["passform"]),
    preis: s["preis"] && Number.isFinite(Number(s["preis"])) ? Number(s["preis"]) : undefined,
    sort: s["sort"] === "price-asc" || s["sort"] === "price-desc" ? s["sort"] : s["sort"] === "newest" ? "newest" : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(collectionQuery(params.handle, deps)),
  head: ({ loaderData, params }) =>
    pageHead(
      loaderData?.collection.title || "Seite nicht gefunden",
      loaderData?.collection.description || "Diese Kollektion wurde nicht gefunden. Entdecke die Stücke von Axion.",
      `/kollektion/${params.handle}`,
    ),
  component: Collection,
});
function Collection() {
  const { handle } = Route.useParams();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(collectionQuery(handle, search));
  return <CollectionPage {...data} search={search} />;
}
