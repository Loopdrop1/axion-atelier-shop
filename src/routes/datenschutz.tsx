import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentPages } from "@/components/shop/content";
export const Route = createFileRoute("/datenschutz")({
  head: () => pageHead(contentPages["datenschutz"].title, contentPages["datenschutz"].description),
  component: Page,
});
function Page() {
  return <ContentPage handle="datenschutz" />;
}
