// Eine Retoure im Admin: Stücke und Gründe, Status setzen, interne Notiz, Link zur Bestellung (dort erstatten und einbuchen).
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReturn, updateReturn, type ReturnRow } from "@/lib/admin/returns-api";
import {
  parseReturnLines,
  RETURN_STATUS,
  RETURN_STATUSES,
  returnReasonLabel,
  returnRef,
  type ReturnStatus,
} from "@/lib/admin/returns";
import { imageUrl } from "@/lib/commerce/mapping";
import { sizeText } from "@/lib/commerce/one-size";
import {
  AreaField,
  Badge,
  chf,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  SelectField,
  UnsavedChangesGuard,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/retouren/$id")({
  component: ReturnPage,
});

function ReturnPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["admin", "return", id], queryFn: () => getReturn(id) });
  const back = (
    <Link to="/admin/retouren" className="admin-back">
      <ArrowLeft aria-hidden="true" /> Alle Retouren
    </Link>
  );
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data)
    return (
      <>
        {back}
        <p className="admin-empty">Diese Retoure gibt es nicht.</p>
      </>
    );
  return (
    <>
      {back}
      <ReturnView row={query.data} />
    </>
  );
}

function ReturnView({ row }: { row: ReturnRow }) {
  const queryClient = useQueryClient();
  const lines = parseReturnLines(row.items);
  const [status, setStatus] = useState<ReturnStatus>(row.status);
  const [note, setNote] = useState(row.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = status !== row.status || note.trim() !== (row.admin_note ?? "");
  const current = RETURN_STATUS[row.status];

  async function save() {
    setBusy(true);
    try {
      await updateReturn(row.id, { status, adminNote: note });
      notify.ok("Retoure gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "return", row.id] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "returns"] });
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <UnsavedChangesGuard active={dirty} />
      <PageHeader
        title={`Retoure ${returnRef(row.number)}`}
        description={
          <>
            <Badge tone={current?.tone ?? "neutral"}>{current?.label ?? row.status}</Badge>{" "}
            Angemeldet {dateTime(row.created_at)} · {row.email}
            {row.locale === "en" && " · Englisch"}
          </>
        }
      />
      <Panel
        title="Bestellung"
        description={
          row.orders
            ? `AX-${row.orders.number} · Total ${chf(row.orders.total_cents)}${
                row.orders.refunded_cents > 0
                  ? ` · bereits ${chf(row.orders.refunded_cents)} erstattet`
                  : ""
              }`
            : "Die Bestellung ist nicht mehr vorhanden."
        }
        actions={
          row.orders && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/bestellungen/$id" params={{ id: row.order_id }}>
                Zur Bestellung AX-{row.orders.number}
              </Link>
            </Button>
          )
        }
      >
        <p className="admin-muted">
          Erstattung und «Retoure einbuchen» (Bestand) erledigst du in der Bestellung. Danach hier
          den Status auf «Erstattet» setzen.
        </p>
      </Panel>
      <Panel title="Zurückgegebene Stücke">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Stück</th>
                <th className="num">Menge</th>
                <th>Grund</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const src = imageUrl(l.image, "product-images");
                return (
                  <tr key={`${l.orderItemId}-${i}`}>
                    <td>
                      <div className="admin-item-cell">
                        {src && <img src={src} alt="" width={40} height={50} loading="lazy" />}
                        <div>
                          {l.title}
                          <span className="admin-sub">
                            {[l.color, l.size && sizeText(l.size, "Grösse", "Einheitsgrösse")]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="num">{l.quantity}</td>
                    <td>{returnReasonLabel(l.reason)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {row.comment && (
          <p style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>
            <strong>Kommentar der Kundschaft</strong>
            <br />
            {row.comment}
          </p>
        )}
      </Panel>
      <Panel title="Bearbeiten">
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ReturnStatus)}
          options={RETURN_STATUSES.map((s) => ({ value: s, label: RETURN_STATUS[s].label }))}
        />
        <p className="admin-muted">{RETURN_STATUS[status].hint}</p>
        <AreaField
          label="Interne Notiz"
          hint="Nur für das Team sichtbar."
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="admin-actions">
          <Button variant="admin" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </div>
      </Panel>
    </>
  );
}
