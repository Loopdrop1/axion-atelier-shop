// Kundenkonto (nur im Browser, Anmeldung über Supabase Auth). Nicht für Suchmaschinen.
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { messages, toLocale, useT } from "@/i18n";
import { backendConfigured } from "@/lib/backend";
import { pageHead } from "@/lib/commerce/seo";
import { Notice } from "@/components/account/form";
export const Route = createFileRoute("/{-$locale}/konto")({
  beforeLoad: () => {
    if (!shopConfig.features.customerAccounts) throw notFound();
  },
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].account;
    return pageHead(t.title, t.metaDescription, "/konto", locale, { noindex: true });
  },
  component: AccountLayout,
});
function AccountLayout() {
  const t = useT();
  return (
    <div className="container page-body account-page">
      {backendConfigured ? <Outlet /> : <Notice>{t.account.notConfigured}</Notice>}
    </div>
  );
}
