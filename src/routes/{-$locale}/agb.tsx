import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage } from "@/components/shop/content";
import { contentMeta } from "@/components/shop/content-meta";
export const Route = createFileRoute("/{-$locale}/agb")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("agb", locale);
    return pageHead(meta.title, meta.description, "/agb", locale);
  },
  component: () => <ContentPage handle="agb" />,
});
