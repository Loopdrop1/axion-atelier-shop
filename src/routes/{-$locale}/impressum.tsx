import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/impressum")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("impressum", locale);
    return pageHead(meta.title, meta.description, "/impressum", locale);
  },
  component: () => <ContentPage handle="impressum" />,
});
