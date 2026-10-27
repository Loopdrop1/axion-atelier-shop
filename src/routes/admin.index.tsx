// Admin-Übersicht: Umsatz heute / 7 / 30 Tage, offene Versände, Bestand, Bestseller.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { dashboard } from "@/lib/admin/api";
import { zurichMidnight } from "@/lib/admin/dates";
import { Badge, chf, ErrorBox, Loading, PageHeader, Panel } from "@/components/admin/ui";
import { ReadinessPanel } from "@/components/admin/readiness";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

async function loadDashboard() {
  const now = new Date();
  const [today, week, month] = await Promise.all([
    dashboard(zurichMidnight(0, now), now),
    dashboard(zurichMidnight(6, now), now),
    dashboard(zurichMidnight(29, now), now),
  ]);
  return { today, week, month };
}

function Dashboard() {
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: loadDashboard,
    refetchInterval: 60_000,
  });
  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data)
    return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  const { today, week, month } = query.data;
  const max = Math.max(1, ...month.daily.map((d) => d.revenue_cents));
  return (
    <>
      <PageHeader
        title="Übersicht"
        description="Umsatz ohne Versand, nach Rabatten und Rückerstattungen. Gutscheinverkäufe separat."
      />
      <div className="admin-stats">
        {[
          { label: "Heute", stats: today },
          { label: "Letzte 7 Tage", stats: week },
          { label: "Letzte 30 Tage", stats: month },
        ].map(({ label, stats }) => (
          <div className="admin-stat" key={label}>
            <p className="admin-stat-label">{label}</p>
            <p className="admin-stat-value">{chf(stats.revenue_cents)}</p>
            <p className="admin-muted">
              {stats.orders} {stats.orders === 1 ? "Bestellung" : "Bestellungen"}
              {stats.gift_cards_sold_cents > 0 &&
                ` · Gutscheine ${chf(stats.gift_cards_sold_cents)}`}
            </p>
          </div>
        ))}
      </div>
      <div className="admin-stats">
        <Link to="/admin/bestellungen" search={{ ansicht: "open" }} className="admin-stat link">
          <p className="admin-stat-label">Zu versenden</p>
          <p className="admin-stat-value">{month.open_to_ship}</p>
          <p className="admin-muted">bezahlt, noch nicht versendet</p>
        </Link>
        <Link
          to="/admin/bestellungen"
          search={{ ansicht: "attention" }}
          className="admin-stat link"
        >
          <p className="admin-stat-label">Prüfen</p>
          <p className="admin-stat-value">
            {month.needs_attention}
            {month.needs_attention > 0 && <Badge tone="danger">Achtung</Badge>}
          </p>
          <p className="admin-muted">z. B. Zahlung nach Ablauf der Reservierung</p>
        </Link>
        <Link to="/admin/newsletter" className="admin-stat link">
          <p className="admin-stat-label">Newsletter</p>
          <p className="admin-stat-value">{month.newsletter_confirmed}</p>
          <p className="admin-muted">bestätigte Anmeldungen</p>
        </Link>
      </div>

      <ReadinessPanel />

      <Panel title="Umsatz pro Tag" description="Letzte 30 Tage">
        <div className="admin-bars" role="list">
          {month.daily.map((d) => (
            <div
              key={d.day}
              role="listitem"
              className="admin-bar"
              title={`${new Date(d.day).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}: ${chf(d.revenue_cents)}, ${d.orders} Bestellungen`}
              aria-label={`${d.day}: ${chf(d.revenue_cents)}`}
            >
              <span style={{ height: `${Math.round((d.revenue_cents / max) * 100)}%` }} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="admin-grid-2">
        <Panel title="Bestseller" description="Letzte 30 Tage, nach Stückzahl">
          {month.top_products.length === 0 ? (
            <p className="admin-muted">Noch keine Verkäufe in diesem Zeitraum.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th className="num">Stück</th>
                  <th className="num">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {month.top_products.map((p) => (
                  <tr key={`${p.handle}-${p.title}`}>
                    <td>{p.title}</td>
                    <td className="num">{p.quantity}</td>
                    <td className="num">{chf(p.revenue_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel
          title="Tiefer Bestand"
          description="Aktive Produkte mit 0 oder 1 Stück"
          actions={
            <Link to="/admin/lager" className="admin-link">
              Zum Lager
            </Link>
          }
        >
          {month.low_stock.length === 0 ? (
            <p className="admin-muted">Alles an Lager.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Grösse</th>
                  <th className="num">Bestand</th>
                </tr>
              </thead>
              <tbody>
                {month.low_stock.map((v) => (
                  <tr key={v.variant_id}>
                    <td>
                      {v.title} <span className="admin-muted">· {v.color}</span>
                    </td>
                    <td>{v.size}</td>
                    <td className="num">
                      {v.stock === 0 ? <Badge tone="danger">0</Badge> : v.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
