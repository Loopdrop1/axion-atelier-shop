// Bewertung schreiben: Link aus der Versandmeldung (/bewertung/<schlüssel>, mit /en davor auf Englisch). Nur mit
// shopConfig.features.reviews, sonst 404. Nicht für Suchmaschinen (noindex, robots.txt).
import { createFileRoute, notFound } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { MissingPage } from "@/components/shop/missing-page";
import { Notice } from "@/components/account/form";
import { ReviewForm } from "@/components/shop/review-form";
import { messages, toLocale, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { REVIEW_TOKEN } from "@/lib/reviews";

export const Route = createFileRoute("/{-$locale}/bewertung/$token")({
  loader: () => {
    if (!shopConfig.features.reviews) throw notFound();
  },
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].reviews;
    return pageHead(t.pageTitle, t.pageDescription, "/bewertung", locale, { noindex: true });
  },
  notFoundComponent: MissingPage,
  component: Page,
});

function Page() {
  const { token } = Route.useParams();
  const t = useT();
  const valid = REVIEW_TOKEN.test(token.toLowerCase());
  return (
    <div className="container page-body account-narrow">
      <h1 className="page-title">{t.reviews.pageTitle}</h1>
      <p className="page-intro">{t.reviews.pageIntro}</p>
      {valid ? (
        <ReviewForm token={token.toLowerCase()} />
      ) : (
        <Notice kind="error">{t.reviews.invalid}</Notice>
      )}
    </div>
  );
}
