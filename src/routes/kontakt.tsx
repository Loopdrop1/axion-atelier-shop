import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentPages } from "@/components/shop/content";
export const Route = createFileRoute("/kontakt")({
  head: () => pageHead(contentPages["kontakt"].title, contentPages["kontakt"].description, "/kontakt"),
  component: Page,
});
function Page() {
  return <ContentPage handle="kontakt" />;
}
