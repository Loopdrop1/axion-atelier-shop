import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale } from "@/i18n";
import { shopConfig } from "@/config/shop";
import { MissingPage } from "@/components/shop/missing-page";
import { productQuery, productReviewsQuery } from "@/lib/commerce/queries";
import { pageHead, pageUrl } from "@/lib/commerce/seo";
import { breadcrumbLd, productLd } from "@/lib/seo/structured";
import { ProductPage } from "@/components/shop/product";
import { jsonLd } from "@/lib/seo/json-ld";
export const Route = createFileRoute("/{-$locale}/produkt/$handle")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      productQuery(params.handle, toLocale(params.locale)),
    );
    // Bewertungen nur mit Schalter (sonst kein Aufruf); ein Fehler darf die Produktseite nicht kippen
    const reviews = shopConfig.features.reviews
      ? await context.queryClient
          .ensureQueryData(productReviewsQuery(params.handle))
          .catch(() => null)
      : null;
    return { ...data, reviews };
  },
  head: ({ loaderData, params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].product;
    const p = loaderData?.product;
    const path = `/produkt/${params.handle}`;
    return {
      ...pageHead(
        p ? `${p.title}, ${p.color.name}` : t.notFoundTitle,
        p ? p.description || `${p.title}, ${p.color.name}` : t.notFoundDescription,
        path,
        locale,
        { image: p?.images[0] ? new URL(p.images[0].url, shopConfig.siteUrl).href : undefined },
      ),
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: jsonLd(productLd(p, path, locale, loaderData?.reviews ?? null)),
            },
            {
              type: "application/ld+json",
              children: jsonLd(
                breadcrumbLd(
                  [
                    { name: t.home, path: "/" },
                    { name: p.categoryTitle, path: `/kollektion/${p.category}` },
                    { name: `${p.title}, ${p.color.name}`, path },
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
  component: Product,
});
function Product() {
  const { handle } = Route.useParams();
  const locale = useLocale();
  // Startwert aus dem Loader (vom Server mitgeschickt): Server und Browser hydrieren mit denselben Daten,
  // auch wenn der Server-Zwischenspeicher (30 s) nach einer Änderung im Admin noch den alten Stand hat.
  const { reviews, ...initialData } = Route.useLoaderData();
  const { data } = useSuspenseQuery({ ...productQuery(handle, locale), initialData });
  return <ProductPage {...data} reviews={reviews} />;
}
