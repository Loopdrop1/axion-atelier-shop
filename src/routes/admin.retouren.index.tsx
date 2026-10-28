// Retouren: Anmeldungen der Kundschaft (Formular «Retoure anmelden»), nach Status gefiltert.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listReturns, RETURNS_PAGE_SIZE } from "@/lib/admin/returns-api";
import { RETURN_STATUS, returnPieces, returnRef, type ReturnStatus } from "@/lib/admin/returns";
import { Badge, dateTime, ErrorBox, Loading, PageHeader } from "@/components/admin/ui";

const VIEWS = [
  { value: "requested", label: "Angemeldet" },
  { value: "received", label: "Eingegangen" },
  { value: "all", label: "Alle" },
  { value: "refunded", label: "Erstattet" },
  { value: "rejected", label: "Abgelehnt" },
] as const;

type View = ReturnStatus | "all";

interface Search {
  ansicht?: View | undefined;
  seite?: number | undefined;
}

export const Route = createFileRoute("/admin/retouren/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ansicht: VIEWS.some((v) => v.value === s["ansicht"]) ? (s["ansicht"] as View) : undefined,
    seite:
      Number.isInteger(Number(s["seite"])) && Number(s["seite"]) > 0
        ? Number(s["seite"])
        : undefined,
  }),
  component: Returns,
});

function Returns() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/retouren/" });
  const view: View = search.ansicht ?? "requested";
  const page = (search.seite ?? 1) - 1;
  const query = useQuery({
    queryKey: ["admin", "returns", view, page],
    queryFn: () => listReturns(view, page),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / RETURNS_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Retouren"
        description="Anmeldungen der Kundschaft. Prüfen, Eingang buchen und erstatten gehen in der Bestellung; hier steht der Stand."
      />
      <div className="admin-toolbar">
        <nav className="admin-tabs" aria-label="Ansicht">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              to="/admin/retouren"
              search={{ ansicht: v.value }}
              className={view === v.value ? "active" : ""}
              activeProps={{ className: "" }}
            >
              {v.label}
            </Link>
          ))}
        </nav>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.rows.length ? (
        <p className="admin-empty">Keine Retouren in dieser Ansicht.</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-click">
              <thead>
                <tr>
                  <th>Retoure</th>
                  <th>Bestellung</th>
                  <th className="admin-hide-sm">Angemeldet</th>
                  <th>Kundschaft</th>
                  <th className="num">Stücke</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((r) => {
                  const status = RETURN_STATUS[r.status];
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to="/admin/retouren/$id" params={{ id: r.id }} className="admin-link">
                          {returnRef(r.number)}
                        </Link>
                      </td>
                      <td>{r.orders ? `AX-${r.orders.number}` : "–"}</td>
                      <td className="admin-hide-sm">{dateTime(r.created_at)}</td>
                      <td>{r.email}</td>
                      <td className="num">{returnPieces(r.items)}</td>
                      <td>
                        <Badge tone={status?.tone ?? "neutral"}>{status?.label ?? r.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-pager">
            <span className="admin-muted">
              {query.data.count} {query.data.count === 1 ? "Retoure" : "Retouren"} · Seite{" "}
              {page + 1} von {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() =>
                void navigate({ search: (s) => ({ ...s, seite: page > 1 ? page : undefined }) })
              }
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pages}
              onClick={() => void navigate({ search: (s) => ({ ...s, seite: page + 2 }) })}
            >
              Weiter
            </Button>
          </div>
        </>
      )}
    </>
  );
}
