import { createFileRoute, notFound } from "@tanstack/react-router";
import { messages, toLocale } from "@/i18n";
import { guideMeta, guidesUpdated, isGuideSlug } from "@/content/guides-meta";
import { GuidePage } from "@/components/shop/guides";
import { MissingPage } from "@/components/shop/missing-page";
import { pageHead } from "@/lib/commerce/seo";
import { jsonLd } from "@/lib/seo/json-ld";
import { articleLd, breadcrumbLd, faqFromItems } from "@/lib/seo/structured";

export const Route = createFileRoute("/{-$locale}/ratgeber/$slug")({
  // Die langen Texte werden erst hier geladen (nur die Sprache der Seite), nicht mit der Shell
  loader: async ({ params }) => {
    if (!isGuideSlug(params.slug)) throw notFound();
    const guide =
      toLocale(params.locale) === "en"
        ? (await import("@/content/guides-en")).guidesEn[params.slug]
        : (await import("@/content/guides")).guides[params.slug];
    return { guide };
  },
  head: ({ params, loaderData }) => {
    const locale = toLocale(params.locale);
    if (!isGuideSlug(params.slug) || !loaderData) {
      const t = messages[locale].notFound;
      return pageHead(t.metaTitle, t.metaDescription, `/ratgeber/${params.slug}`, locale, {
        noindex: true,
      });
    }
    const meta = guideMeta[locale][params.slug];
    const path = `/ratgeber/${params.slug}`;
    const base = pageHead(meta.title, meta.description, path, locale);
    const faq = faqFromItems(loaderData.guide.faq.map((f) => ({ q: f.question, a: f.answer })));
    return {
      ...base,
      meta: [
        ...base.meta.map((m) =>
          "property" in m && m.property === "og:type" ? { ...m, content: "article" } : m,
        ),
        { property: "article:modified_time", content: guidesUpdated },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd(
            articleLd(
              {
                headline: meta.title,
                description: meta.description,
                path,
                datePublished: guidesUpdated,
                dateModified: guidesUpdated,
              },
              locale,
            ),
          ),
        },
        ...(faq ? [{ type: "application/ld+json", children: jsonLd(faq) }] : []),
        {
          type: "application/ld+json",
          children: jsonLd(
            breadcrumbLd(
              [
                { name: messages[locale].product.home, path: "/" },
                { name: messages[locale].guides.navLabel, path: "/ratgeber" },
                { name: meta.title, path },
              ],
              locale,
            ),
          ),
        },
      ],
    };
  },
  notFoundComponent: MissingPage,
  component: Guide,
});

function Guide() {
  const { slug } = Route.useParams();
  const { guide } = Route.useLoaderData();
  return isGuideSlug(slug) ? <GuidePage slug={slug} guide={guide} /> : <MissingPage />;
}
