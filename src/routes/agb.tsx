import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentPages } from "@/components/shop/content";
export const Route = createFileRoute("/agb")({
  head: () => pageHead(contentPages["agb"].title, contentPages["agb"].description, "/agb"),
  component: Page,
});
function Page() {
  return <ContentPage handle="agb" />;
}
