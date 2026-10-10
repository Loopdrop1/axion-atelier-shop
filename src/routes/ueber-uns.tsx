import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentPages } from "@/components/shop/content";
import { getEditorial } from "@/lib/commerce";
export const Route = createFileRoute("/ueber-uns")({
  loader: () => getEditorial(),
  head: () => pageHead(contentPages["ueber-uns"].title, contentPages["ueber-uns"].description),
  component: Page,
});
function Page() {
  const data = Route.useLoaderData();
  return <ContentPage handle="ueber-uns" image={data.fabric} />;
}
