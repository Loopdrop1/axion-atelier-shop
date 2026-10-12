import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale } from "@/i18n";
import { shopConfig } from "@/config/shop";
import { MissingPage } from "@/components/shop/missing-page";
import { productQuery } from "@/lib/commerce/queries";
import { pageHead, pageUrl } from "@/lib/commerce/seo";
import { ProductPage } from "@/components/shop/product";
import { jsonLd } from "@/lib/seo/json-ld";
export const Route = createFileRoute("/{-$locale}/produkt/$handle")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(productQuery(params.handle, toLocale(params.locale))),
  head: ({ loaderData, params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].product;
    const p = loaderData?.product;
    const path = `/produkt/${params.handle}`;
    return {
      ...pageHead(
        p ? `${p.title}, ${p.color.name}` : t.notFoundTitle,
        p?.description || t.notFoundDescription,
        path,
        locale,
      ),
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: jsonLd({
                "@context": "https://schema.org",
                "@type": "Product",
                name: `${p.title}, ${p.color.name}`,
                image: p.images.map((i) => new URL(i.url, shopConfig.siteUrl).href),
                description: p.description,
                url: pageUrl(path, locale),
                offers: {
                  "@type": "AggregateOffer",
                  priceCurrency: "CHF",
                  lowPrice: p.priceRange.min.amount,
                  highPrice: p.priceRange.max.amount,
                  offerCount: p.variants.length,
                  availability: p.variants.some((v) => v.availableForSale)
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                },
              }),
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
  const { data } = useSuspenseQuery({
    ...productQuery(handle, locale),
    initialData: Route.useLoaderData(),
  });
  return <ProductPage {...data} />;
}
