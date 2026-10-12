import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { getProfile, listMyOrders } from "@/lib/account/api";
import { useGuestOrderClaim } from "@/lib/account/claim";
import { formatCents, formatDate } from "@/lib/commerce/format";
import { useRequireSession } from "@/components/account/use-require-session";
import { Notice } from "@/components/account/form";
import { useSignOut } from "@/components/account/use-sign-out";
import { NewsletterForm } from "@/components/shop/newsletter-form";
export const Route = createFileRoute("/{-$locale}/konto/")({
  component: AccountOverview,
});
function AccountOverview() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const { ready, user } = useRequireSession();
  const signOut = useSignOut();
  // Gastbestellungen mit derselben bestätigten Adresse zuerst übernehmen, dann die Liste laden.
  const claim = useGuestOrderClaim(user?.id);
  const orders = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: listMyOrders,
    enabled: Boolean(user) && claim.done,
  });
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  });
  if (!ready || !user) return <p role="status">{t.common.loading}</p>;
  return (
    <>
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.hello(profile.data?.first_name ?? "")}</h1>
      <p className="page-intro">{t.checkout.signedInAs(user.email ?? "")}</p>
      {claim.count > 0 && <Notice kind="success">{t.account.claimed(claim.count)}</Notice>}
      <section className="account-section">
        <h2>{t.account.orders}</h2>
        {!claim.done || orders.isLoading ? (
          <p role="status">{t.common.loading}</p>
        ) : orders.isError ? (
          <Notice kind="error">{t.common.error}</Notice>
        ) : !orders.data?.length ? (
          <p className="text-muted">{t.account.noOrders}</p>
        ) : (
          <div className="table-scroll">
            <table className="account-table">
              <thead>
                <tr>
                  <th>{t.account.orderNumber}</th>
                  <th>{t.account.orderDate}</th>
                  <th>{t.account.orderStatus}</th>
                  <th className="num">{t.account.orderTotal}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.data.map((o) => (
                  <tr key={o.id}>
                    <td>AX-{o.number}</td>
                    <td>{formatDate(o.created_at, locale)}</td>
                    <td>{t.account.statuses[o.status] ?? o.status}</td>
                    <td className="num">{formatCents(o.total_cents, locale)}</td>
                    <td>
                      <Link
                        className="text-link"
                        to="/{-$locale}/konto/bestellungen/$number"
                        params={{ locale: lp, number: String(o.number) }}
                      >
                        {t.account.orderView}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="account-section">
        <h2>{t.account.data}</h2>
        <p className="text-muted">{t.account.dataIntro}</p>
        <Button variant="tailored" asChild>
          <Link to="/{-$locale}/konto/daten" params={{ locale: lp }}>
            {t.account.editData}
          </Link>
        </Button>
      </section>
      <section className="account-section">
        <h2>{t.footer.newsletterTitle}</h2>
        <p className="text-muted">{t.footer.newsletterText}</p>
        <NewsletterForm source="account" initialEmail={user.email ?? ""} />
      </section>
      <Button variant="tailored" onClick={() => void signOut()}>
        {t.account.signOut}
      </Button>
    </>
  );
}
