import { createFileRoute } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { guideIndexMeta } from "@/content/guides-meta";
import { GuideIndex } from "@/components/shop/guides";
import { pageHead } from "@/lib/commerce/seo";
import { jsonLd } from "@/lib/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo/structured";
import { messages } from "@/i18n";

export const Route = createFileRoute("/{-$locale}/ratgeber/")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const meta = guideIndexMeta[locale];
    return {
      ...pageHead(meta.title, meta.description, "/ratgeber", locale),
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd(
            breadcrumbLd(
              [
                { name: messages[locale].product.home, path: "/" },
                { name: meta.title, path: "/ratgeber" },
              ],
              locale,
            ),
          ),
        },
      ],
    };
  },
  component: GuideIndex,
});
