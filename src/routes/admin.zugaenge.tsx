// Zugänge: wer ins Admin darf. Die Person braucht zuerst ein Konto im Shop (Registrierung mit bestätigter E-Mail).
import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { grantAdmin, listAdmins, revokeAdmin } from "@/lib/admin/api";
import { useSession } from "@/lib/account/session";
import {
  ConfirmButton,
  dateOnly,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/zugaenge")({
  component: Access,
});

function Access() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const query = useQuery({ queryKey: ["admin", "admins"], queryFn: listAdmins });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });

  async function grant(event: FormEvent) {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return notify.error(new Error("INVALID_EMAIL"));
    setBusy(true);
    try {
      await grantAdmin(email.trim());
      notify.ok(`${email.trim()} hat jetzt Zugang zum Admin.`);
      setEmail("");
      refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Zugänge"
        description="Admins sehen alle Bestellungen und Kundendaten. Nur Personen freischalten, die das wirklich brauchen."
      />
      <Panel title="Admins">
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>E-Mail</th>
                <th>Seit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((a) => (
                <tr key={a.user_id}>
                  <td>
                    {a.email}
                    {a.user_id === user?.id && <span className="admin-sub">das bist du</span>}
                  </td>
                  <td>{dateOnly(a.created_at)}</td>
                  <td className="admin-row-actions">
                    {a.user_id !== user?.id && (
                      <ConfirmButton
                        label="Zugang entfernen"
                        variant="ghost"
                        title={`Zugang für ${a.email} entfernen?`}
                        description="Die Person bleibt Kundin oder Kunde im Shop, kommt aber nicht mehr ins Admin."
                        confirmLabel="Entfernen"
                        onConfirm={async () => {
                          await revokeAdmin(a.user_id);
                          notify.ok("Zugang entfernt.");
                          refresh();
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel
        title="Zugang geben"
        description="Die Person registriert sich zuerst im Shop unter «Kundenkonto» und bestätigt ihre E-Mail. Danach hier die gleiche Adresse eintragen."
      >
        <form className="admin-form admin-inline-form" onSubmit={grant} noValidate>
          <TextField
            label="E-Mail-Adresse"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="admin" disabled={busy || !email.trim()}>
            Zugang geben
          </Button>
        </form>
      </Panel>
    </>
  );
}
