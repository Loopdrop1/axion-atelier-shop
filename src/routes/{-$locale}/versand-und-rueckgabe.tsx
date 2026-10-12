import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/versand-und-rueckgabe")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("versand-und-rueckgabe", locale);
    return pageHead(meta.title, meta.description, "/versand-und-rueckgabe", locale);
  },
  component: () => <ContentPage handle="versand-und-rueckgabe" />,
});
