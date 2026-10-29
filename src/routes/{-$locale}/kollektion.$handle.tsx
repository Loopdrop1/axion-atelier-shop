import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale } from "@/i18n";
import { searchString } from "@/lib/commerce/presentation";
import { collectionQuery, type CollectionSearch } from "@/lib/commerce/queries";
import { MissingPage } from "@/components/shop/missing-page";
import { pageHead } from "@/lib/commerce/seo";
import { jsonLd } from "@/lib/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo/structured";
import { CollectionPage } from "@/components/shop/collection";
export const Route = createFileRoute("/{-$locale}/kollektion/$handle")({
  validateSearch: (s: Record<string, unknown>): CollectionSearch => ({
    anlass: searchString(s["anlass"]),
    groesse: searchString(s["groesse"]),
    farbe: searchString(s["farbe"]),
    passform: searchString(s["passform"]),
    preis: s["preis"] && Number.isFinite(Number(s["preis"])) ? Number(s["preis"]) : undefined,
    sort:
      s["sort"] === "price-asc" || s["sort"] === "price-desc"
        ? s["sort"]
        : s["sort"] === "newest"
          ? "newest"
          : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(
      collectionQuery(params.handle, deps, toLocale(params.locale)),
    ),
  head: ({ loaderData, params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].collections;
    const c = loaderData?.collection;
    return {
      ...pageHead(
        c?.title || t.notFoundTitle,
        c ? c.description || c.title : t.notFoundDescription,
        `/kollektion/${params.handle}`,
        locale,
      ),
      scripts: c
        ? [
            {
              type: "application/ld+json",
              children: jsonLd(
                breadcrumbLd(
                  [
                    { name: messages[locale].product.home, path: "/" },
                    { name: c.title, path: `/kollektion/${params.handle}` },
                  ],
                  locale,
                ),
              ),
            },
          ]
        : [],
    };
  },
  notFoundComponent: MissingPage,
  component: Collection,
});
function Collection() {
  const { handle } = Route.useParams();
  const search = Route.useSearch();
  const locale = useLocale();
  // Startwert aus dem Loader (vom Server mitgeschickt): Server und Browser hydrieren mit denselben Daten,
  // auch wenn der Server-Zwischenspeicher (30 s) nach einer Änderung im Admin noch den alten Stand hat.
  const { data } = useSuspenseQuery({
    ...collectionQuery(handle, search, locale),
    initialData: Route.useLoaderData(),
  });
  return <CollectionPage {...data} search={search} />;
}
