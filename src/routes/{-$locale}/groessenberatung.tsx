import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { sizeGuideQuery } from "@/lib/commerce/queries";
import { ContentPage, contentMeta } from "@/components/shop/content";
export const Route = createFileRoute("/{-$locale}/groessenberatung")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("groessenberatung", locale);
    return pageHead(meta.title, meta.description, "/groessenberatung", locale);
  },
  // Rückgabe = Startwert für die Abfrage im Browser (gleiche Tabellen wie beim Server-Rendering)
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(sizeGuideQuery(toLocale(params.locale))).catch(() => undefined),
  component: () => <ContentPage handle="groessenberatung" />,
});
