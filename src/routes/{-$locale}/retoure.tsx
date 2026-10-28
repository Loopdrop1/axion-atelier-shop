// Retoure anmelden: Bestellnummer + E-Mail, danach Stücke und Grund wählen. Nicht für Suchmaschinen (noindex, robots.txt).
// ?order=10001 belegt die Bestellnummer vor (Link aus dem Kundenkonto).
import { createFileRoute } from "@tanstack/react-router";
import { ReturnForm } from "@/components/shop/return-form";
import { messages, toLocale, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";

export const Route = createFileRoute("/{-$locale}/retoure")({
  validateSearch: (s: Record<string, unknown>): { order?: string | undefined } => ({
    order: typeof s["order"] === "string" && /^\d{1,12}$/.test(s["order"]) ? s["order"] : undefined,
  }),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].returns;
    return pageHead(t.title, t.metaDescription, "/retoure", locale, { noindex: true });
  },
  component: Page,
});

function Page() {
  const { order } = Route.useSearch();
  const t = useT();
  return (
    <div className="container page-body account-narrow">
      <p className="eyebrow">{t.returns.eyebrow}</p>
      <h1 className="page-title">{t.returns.title}</h1>
      <p className="page-intro">{t.returns.intro}</p>
      <ReturnForm initialOrder={order} />
    </div>
  );
}
