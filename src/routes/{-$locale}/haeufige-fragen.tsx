import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { ContentPage, contentMeta } from "@/components/shop/content";
import { resolvePageVariables } from "@/components/shop/written-content";
import { pages } from "@/content/pages";
import { pagesEn } from "@/content/pages-en";
import { jsonLd } from "@/lib/seo/json-ld";
import { faqLd } from "@/lib/seo/structured";

export const Route = createFileRoute("/{-$locale}/haeufige-fragen")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = contentMeta("haeufige-fragen", locale);
    // FAQ als strukturierte Daten (Suchmaschinen, KI-Antworten); Fragen mit Platzhaltern bleiben weg
    const page = (locale === "en" && pagesEn["haeufige-fragen"]) || pages["haeufige-fragen"];
    const faq = faqLd(page, resolvePageVariables);
    return {
      ...pageHead(meta.title, meta.description, "/haeufige-fragen", locale),
      scripts: faq ? [{ type: "application/ld+json", children: jsonLd(faq) }] : [],
    };
  },
  component: () => <ContentPage handle="haeufige-fragen" />,
});
