import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/agb")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("agb", locale);
    return pageHead(meta.title, meta.description, "/agb", locale);
  },
  component: () => <ContentPage handle="agb" />,
});
