import { createFileRoute, notFound } from "@tanstack/react-router";
import { messages, toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { MissingPage } from "@/components/shop/missing-page";
export const Route = createFileRoute("/{-$locale}/$")({
  loader: () => {
    throw notFound();
  },
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].notFound;
    return pageHead(t.metaTitle, t.metaDescription, `/${params._splat || ""}`, locale, {
      noindex: true,
    });
  },
  notFoundComponent: MissingPage,
  component: MissingPage,
});
