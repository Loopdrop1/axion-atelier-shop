import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage } from "@/components/shop/content";
import { contentMeta } from "@/components/shop/content-meta";
import { jsonLd } from "@/lib/seo/json-ld";
import { faqLd } from "@/lib/seo/structured";

export const Route = createFileRoute("/{-$locale}/haeufige-fragen")({
  // Die Seitentexte werden erst hier geladen, damit sie nicht in jedem Seitenaufruf stecken
  loader: async ({ params }) => {
    const locale = toLocale(params.locale);
    const [{ pages }, { pagesEn }, { resolvePageVariables }] = await Promise.all([
      import("@/content/pages"),
      import("@/content/pages-en"),
      import("@/components/shop/written-content"),
    ]);
    // FAQ als strukturierte Daten (Suchmaschinen, KI-Antworten); Fragen mit Platzhaltern bleiben weg
    const page = (locale === "en" && pagesEn["haeufige-fragen"]) || pages["haeufige-fragen"];
    return { faq: faqLd(page, resolvePageVariables) ?? null };
  },
  head: ({ params, loaderData }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("haeufige-fragen", locale);
    const faq = loaderData?.faq;
    return {
      ...pageHead(meta.title, meta.description, "/haeufige-fragen", locale),
      scripts: faq ? [{ type: "application/ld+json", children: jsonLd(faq) }] : [],
    };
  },
  component: () => <ContentPage handle="haeufige-fragen" />,
});
