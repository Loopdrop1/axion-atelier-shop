// Technische Fehlerberichte aus dem Browser der Kundschaft (ohne Personendaten, 30 Tage), nach Fehler gruppiert.
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearClientErrors, listClientErrors } from "@/lib/admin/api";
import { groupClientErrors } from "@/lib/admin/client-errors";
import {
  Badge,
  ConfirmButton,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/fehler")({
  component: Errors,
});

function Errors() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "fehler"], queryFn: listClientErrors });
  const groups = useMemo(() => groupClientErrors(query.data ?? []), [query.data]);

  async function clear() {
    try {
      await clearClientErrors();
      notify.ok("Alle Fehlerberichte gelöscht.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "fehler"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Fehler"
        description="Technische Fehlerberichte aus dem Browser der Kundschaft. Sie enthalten keine Personendaten (keine IP, keine E-Mail, kein Konto) und werden nach 30 Tagen automatisch gelöscht. Gleiche Fehler sind zusammengefasst."
        actions={
          <ConfirmButton
            label="Alle löschen"
            title="Alle Fehlerberichte löschen?"
            description="Die Berichte sind danach weg. Neue Fehler erscheinen wieder hier."
            confirmLabel="Alle löschen"
            disabled={groups.length === 0}
            onConfirm={clear}
          />
        }
      />
      <Panel title="Letzte Fehler" description={`${groups.length} verschiedene Fehler`}>
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
        ) : groups.length === 0 ? (
          <p className="admin-muted">Keine Fehler gemeldet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fehler</th>
                <th>Seite</th>
                <th className="num">Anzahl</th>
                <th>Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.fingerprint}>
                  <td>
                    <details>
                      <summary>{g.message}</summary>
                      <pre
                        className="admin-muted"
                        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                      >
                        {g.stack || "Kein Stack übermittelt."}
                      </pre>
                      <p className="admin-muted">
                        {g.release ? `Version ${g.release} · ` : ""}
                        {g.userAgent ?? ""}
                      </p>
                    </details>
                  </td>
                  <td>
                    <code>{g.path}</code>
                  </td>
                  <td className="num">
                    {g.count > 1 ? (
                      <Badge tone={g.count >= 10 ? "danger" : "warn"}>{g.count}</Badge>
                    ) : (
                      g.count
                    )}
                  </td>
                  <td>{dateTime(g.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
