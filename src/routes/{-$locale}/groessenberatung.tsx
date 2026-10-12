import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/groessenberatung")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("groessenberatung", locale);
    return pageHead(meta.title, meta.description, "/groessenberatung", locale);
  },
  component: () => <ContentPage handle="groessenberatung" />,
});
