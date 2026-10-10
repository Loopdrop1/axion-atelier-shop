import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getProduct, getSiblings, getRecommendations, getProductsByHandles } from "@/lib/commerce";
import { pageHead } from "@/lib/commerce/seo";
import { ProductPage } from "@/components/shop/product";
const productQuery = (handle: string) =>
  queryOptions({
    queryKey: ["product", handle],
    queryFn: async () => {
      const product = await getProduct(handle);
      if (!product) throw notFound();
      return {
        product,
        siblings: await getSiblings(product),
        outfit: await getProductsByHandles(product.outfitHandles),
        recommendations: await getRecommendations(handle, 4),
      };
    },
  });
export const Route = createFileRoute("/produkt/$handle")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQuery(params.handle)),
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    return {
      ...pageHead(
        p?.title || "Produkt",
        p?.description || "Entdecke Anzüge, Westen und Schuhe von Axion.",
      ),
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.title,
                image: p.images.map((i) => i.url),
                description: p.description,
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
  component: Product,
});
function Product() {
  const { handle } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(handle));
  return <ProductPage {...data} />;
}
