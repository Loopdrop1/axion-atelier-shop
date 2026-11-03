import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { sizeGuideQuery, sizeLettersQuery } from "@/lib/commerce/queries";
import { ContentPage } from "@/components/shop/content";
import { contentMeta } from "@/components/shop/content-meta";
export const Route = createFileRoute("/{-$locale}/groessenberatung")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("groessenberatung", locale);
    return pageHead(meta.title, meta.description, "/groessenberatung", locale);
  },
  // Rückgabe = Startwert für die Abfrage im Browser (gleiche Tabellen wie beim Server-Rendering)
  loader: async ({ context, params }) => {
    // Zuordnung Zahl ↔ Buchstabe für den Grössenfinder gleich mitladen (gleicher Katalog, kein Extra-Abruf)
    await context.queryClient.ensureQueryData(sizeLettersQuery()).catch(() => undefined);
    return context.queryClient
      .ensureQueryData(sizeGuideQuery(toLocale(params.locale)))
      .catch(() => undefined);
  },
  component: () => <ContentPage handle="groessenberatung" />,
});
