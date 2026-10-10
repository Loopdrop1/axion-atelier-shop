import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listProducts, listCollections, getEditorial } from "@/lib/commerce";
import { pageHead } from "@/lib/commerce/seo";
import { HomePage } from "@/components/shop/home";
const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => ({
    products: await listProducts(),
    collections: await listCollections(),
    editorial: await getEditorial(),
  }),
});
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Anzüge, Westen und Schuhe",
      "Entdecke Axion: Anzüge, Westen und Schuhe für Hochzeit, Business und besondere Momente. Gratisversand in der Schweiz.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Index,
});
function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  return <HomePage {...data} />;
}
