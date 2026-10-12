import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/haeufige-fragen")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("haeufige-fragen", locale);
    return pageHead(meta.title, meta.description, "/haeufige-fragen", locale);
  },
  component: () => <ContentPage handle="haeufige-fragen" />,
});
