// Link aus der Newsletter-E-Mail (Token: 48 Hex-Zeichen, siehe supabase/functions/newsletter): /newsletter/abmelden?token=… (mit /en davor auf Englisch).
import { createFileRoute, notFound } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { messages, toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { NewsletterAction } from "@/components/shop/newsletter-action";

export const Route = createFileRoute("/{-$locale}/newsletter/abmelden")({
  validateSearch: (s: Record<string, unknown>): { token?: string | undefined } => ({
    token:
      typeof s["token"] === "string" && /^[0-9a-f]{48}$/i.test(s["token"]) ? s["token"] : undefined,
  }),
  beforeLoad: () => {
    if (!shopConfig.features.newsletter) throw notFound();
  },
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].newsletter;
    return pageHead(t.unsubscribeTitle, t.unsubscribeIntro, "/newsletter/abmelden", locale, {
      noindex: true,
    });
  },
  component: Page,
});

function Page() {
  const { token } = Route.useSearch();
  return <NewsletterAction action="unsubscribe" token={token} />;
}
