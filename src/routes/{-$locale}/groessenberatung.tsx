import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { sizeGuideQuery, sizeLettersQuery, type SizeGuidePageData } from "@/lib/commerce/queries";
import { ContentPage } from "@/components/shop/content";
import { contentMeta } from "@/components/shop/content-meta";
export const Route = createFileRoute("/{-$locale}/groessenberatung")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("groessenberatung", locale);
    return pageHead(meta.title, meta.description, "/groessenberatung", locale);
  },
  // Rückgabe = Startwerte für die Abfragen im Browser (gleiche Tabellen und Zuordnung wie beim Server-Rendering,
  // sonst weicht der Grössenfinder beim Hydrieren ab)
  loader: async ({ context, params }): Promise<SizeGuidePageData> => {
    const [tables, letters] = await Promise.all([
      context.queryClient
        .ensureQueryData(sizeGuideQuery(toLocale(params.locale)))
        .catch(() => undefined),
      context.queryClient.ensureQueryData(sizeLettersQuery()).catch(() => undefined),
    ]);
    return { tables, letters };
  },
  component: () => <ContentPage handle="groessenberatung" />,
});
