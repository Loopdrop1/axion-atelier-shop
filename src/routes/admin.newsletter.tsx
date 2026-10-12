// Newsletter-Anmeldungen (Double Opt-in): Liste, Export der bestätigten Adressen, Löschen auf Wunsch.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSubscriber, listSubscribers, type Subscriber } from "@/lib/admin/api";
import { downloadCsv } from "@/lib/admin/csv";
import {
  Badge,
  ConfirmButton,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/newsletter")({
  component: Newsletter,
});

const STATUS: Record<Subscriber["status"], { label: string; tone: "ok" | "warn" | "muted" }> = {
  confirmed: { label: "Bestätigt", tone: "ok" },
  pending: { label: "Nicht bestätigt", tone: "warn" },
  unsubscribed: { label: "Abgemeldet", tone: "muted" },
};

const SOURCE: Record<string, string> = {
  footer: "Fusszeile",
  account: "Kundenkonto",
  checkout: "Kasse",
  admin: "Admin",
};

function Newsletter() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "newsletter"], queryFn: listSubscribers });
  const [view, setView] = useState<Subscriber["status"] | "all">("confirmed");
  const [term, setTerm] = useState("");
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (query.data ?? []).filter(
      (s) => (view === "all" || s.status === view) && (!t || s.email.toLowerCase().includes(t)),
    );
  }, [query.data, view, term]);
  const count = (status: Subscriber["status"]) =>
    (query.data ?? []).filter((s) => s.status === status).length;

  function exportConfirmed() {
    const confirmed = (query.data ?? []).filter((s) => s.status === "confirmed");
    downloadCsv(`axion-newsletter-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["E-Mail", "Sprache", "Bestätigt am", "Quelle", "Einwilligung am", "Einwilligungstext"],
      ...confirmed.map((s) => [
        s.email,
        s.locale,
        dateTime(s.confirmed_at),
        SOURCE[s.source] ?? s.source,
        dateTime(s.consent_at),
        s.consent_text,
      ]),
    ]);
    notify.ok(`${confirmed.length} bestätigte Adressen exportiert.`);
  }

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Nur bestätigte Adressen (Klick auf den Link in der E-Mail) dürfen Newsletter erhalten. Der Export enthält den Nachweis der Einwilligung."
        actions={
          <Button variant="outline" onClick={exportConfirmed} disabled={!query.data}>
            <Download /> Bestätigte exportieren (CSV)
          </Button>
        }
      />
      <div className="admin-toolbar">
        <nav className="admin-tabs" aria-label="Status">
          {(["confirmed", "pending", "unsubscribed", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={view === s ? "active" : ""}
              onClick={() => setView(s)}
            >
              {s === "all"
                ? `Alle (${query.data?.length ?? 0})`
                : `${STATUS[s].label} (${count(s)})`}
            </button>
          ))}
        </nav>
        <div className="admin-search">
          <Input
            type="search"
            placeholder="E-Mail"
            aria-label="Anmeldungen suchen"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <p className="admin-empty">Keine Einträge.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>E-Mail</th>
                <th>Status</th>
                <th className="admin-hide-sm">Sprache</th>
                <th className="admin-hide-sm">Quelle</th>
                <th>Angemeldet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td>
                    <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                  </td>
                  <td className="admin-hide-sm">{s.locale === "en" ? "Englisch" : "Deutsch"}</td>
                  <td className="admin-hide-sm">{SOURCE[s.source] ?? s.source}</td>
                  <td>
                    {dateTime(s.consent_at)}
                    {s.confirmed_at && (
                      <span className="admin-sub">bestätigt {dateTime(s.confirmed_at)}</span>
                    )}
                    {s.unsubscribed_at && (
                      <span className="admin-sub">abgemeldet {dateTime(s.unsubscribed_at)}</span>
                    )}
                  </td>
                  <td className="admin-row-actions">
                    <ConfirmButton
                      label="Löschen"
                      variant="ghost"
                      title={`${s.email} löschen?`}
                      description="Für Löschbegehren nach Datenschutzgesetz. Die Adresse und der Nachweis der Einwilligung werden entfernt. Für eine normale Abmeldung reicht der Link in jeder E-Mail."
                      confirmLabel="Endgültig löschen"
                      onConfirm={async () => {
                        await deleteSubscriber(s.id);
                        notify.ok("Gelöscht.");
                        void queryClient.invalidateQueries({ queryKey: ["admin", "newsletter"] });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
