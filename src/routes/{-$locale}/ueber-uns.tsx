import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { getEditorial } from "@/lib/commerce";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/ueber-uns")({
  loader: ({ params }) => getEditorial(toLocale(params.locale)),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("ueber-uns", locale);
    return pageHead(meta.title, meta.description, "/ueber-uns", locale);
  },
  component: Page,
});
function Page() {
  const data = Route.useLoaderData();
  return <ContentPage handle="ueber-uns" image={data.fabric} />;
}
