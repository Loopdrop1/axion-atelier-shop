// Rabattcodes: Prozent oder Franken, Mindestbestellwert, Zeitraum, maximale Einlösungen.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteDiscountCode,
  listDiscountCodes,
  saveDiscountCode,
  type DiscountCode,
} from "@/lib/admin/api";
import { zurichDate } from "@/lib/admin/dates";
import { centsToInput, parseChf } from "@/lib/admin/money";
import {
  AreaField,
  Badge,
  CheckField,
  chf,
  ConfirmButton,
  dateOnly,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  SelectField,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/rabattcodes")({
  component: DiscountCodes,
});

function state(c: DiscountCode): { label: string; tone: "ok" | "muted" | "warn" | "danger" } {
  const now = Date.now();
  if (!c.active) return { label: "Ausgeschaltet", tone: "muted" };
  if (c.ends_at && new Date(c.ends_at).getTime() <= now)
    return { label: "Abgelaufen", tone: "muted" };
  if (c.starts_at && new Date(c.starts_at).getTime() > now)
    return { label: "Startet später", tone: "warn" };
  if (c.max_redemptions && c.redemptions >= c.max_redemptions)
    return { label: "Aufgebraucht", tone: "muted" };
  return { label: "Aktiv", tone: "ok" };
}

const valueText = (c: Pick<DiscountCode, "kind" | "value">) =>
  c.kind === "percent" ? `${c.value} %` : chf(c.value);

function isoDay(iso: string | null) {
  return iso
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date(iso))
    : "";
}

interface Draft {
  id?: string;
  code: string;
  kind: "percent" | "amount";
  value: string;
  min: string;
  starts: string;
  ends: string;
  max: string;
  active: boolean;
  note: string;
}

const toDraft = (c: DiscountCode | null): Draft => ({
  ...(c ? { id: c.id } : {}),
  code: c?.code ?? "",
  kind: c?.kind ?? "percent",
  value: c ? (c.kind === "percent" ? String(c.value) : centsToInput(c.value)) : "10",
  min: c?.min_subtotal_cents ? centsToInput(c.min_subtotal_cents) : "",
  starts: isoDay(c?.starts_at ?? null),
  // Enddatum als «bis und mit»: gespeichert ist Mitternacht des Folgetags
  ends: c?.ends_at ? isoDay(new Date(new Date(c.ends_at).getTime() - 3600_000).toISOString()) : "",
  max: c?.max_redemptions ? String(c.max_redemptions) : "",
  active: c?.active ?? true,
  note: c?.note ?? "",
});

function DiscountCodes() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "discounts"], queryFn: listDiscountCodes });
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "discounts"] });

  return (
    <>
      <PageHeader
        title="Rabattcodes"
        description="Kundinnen und Kunden geben den Code im Warenkorb ein. Der Rabatt gilt auf den Warenwert, nicht auf Gutscheine."
        actions={
          <Button variant="admin" onClick={() => setDraft(toDraft(null))}>
            <Plus /> Neuer Code
          </Button>
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <p className="admin-empty">Noch keine Rabattcodes.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Rabatt</th>
                <th>Bedingungen</th>
                <th className="num">Eingelöst</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data.map((c) => {
                const s = state(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong className="admin-code">{c.code}</strong>
                      {c.note && <span className="admin-sub">{c.note}</span>}
                    </td>
                    <td>{valueText(c)}</td>
                    <td>
                      {c.min_subtotal_cents > 0
                        ? `ab ${chf(c.min_subtotal_cents)}`
                        : "ohne Mindestwert"}
                      <span className="admin-sub">
                        {c.starts_at || c.ends_at
                          ? `${c.starts_at ? `ab ${dateOnly(c.starts_at)}` : ""} ${c.ends_at ? `bis ${dateOnly(new Date(new Date(c.ends_at).getTime() - 3600_000).toISOString())}` : ""}`
                          : "unbefristet"}
                      </span>
                    </td>
                    <td className="num">
                      {c.redemptions}
                      {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                    </td>
                    <td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="admin-row-actions">
                      <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(c))}>
                        Bearbeiten
                      </Button>
                      <ConfirmButton
                        label="Löschen"
                        variant="ghost"
                        title={`Code ${c.code} löschen?`}
                        description="Bestellungen mit diesem Code bleiben unverändert. Wenn der Code nur pausieren soll: «Aktiv» ausschalten."
                        confirmLabel="Löschen"
                        onConfirm={async () => {
                          await deleteDiscountCode(c.id);
                          notify.ok(`Code ${c.code} gelöscht.`);
                          refresh();
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {draft && <CodeDialog draft={draft} onClose={() => setDraft(null)} onSaved={refresh} />}
    </>
  );
}

function CodeDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(draft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setError("");
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code))
      return setError("Code: 3 bis 40 Zeichen, nur Buchstaben, Zahlen, - und _.");
    const value =
      form.kind === "percent"
        ? /^\d{1,3}$/.test(form.value.trim()) &&
          Number(form.value) >= 1 &&
          Number(form.value) <= 100
          ? Number(form.value)
          : null
        : parseChf(form.value);
    if (!value)
      return setError(
        form.kind === "percent" ? "Prozent zwischen 1 und 100." : "Bitte einen Betrag in Franken.",
      );
    const min = form.min.trim() ? parseChf(form.min) : 0;
    if (min === null) return setError("Mindestbestellwert in Franken, z. B. 200.");
    const starts = form.starts ? zurichDate(form.starts) : null;
    const endDay = form.ends ? zurichDate(form.ends) : null;
    // «bis und mit»: Ende ist Mitternacht des Folgetags
    const ends = endDay
      ? zurichDate(
          new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(
            new Date(endDay.getTime() + 36 * 3600_000),
          ),
        )
      : null;
    if (starts && ends && ends <= starts)
      return setError("Das Enddatum muss nach dem Startdatum liegen.");
    const max = form.max.trim() ? Number(form.max) : null;
    if (max !== null && (!Number.isInteger(max) || max < 1))
      return setError("Maximale Einlösungen: ganze Zahl ab 1.");
    setBusy(true);
    try {
      await saveDiscountCode({
        ...(form.id ? { id: form.id } : {}),
        code,
        kind: form.kind,
        value,
        min_subtotal_cents: min,
        starts_at: starts?.toISOString() ?? null,
        ends_at: ends?.toISOString() ?? null,
        max_redemptions: max,
        active: form.active,
        note: form.note.trim() || null,
      });
      notify.ok(`Code ${code} gespeichert.`);
      onSaved();
      onClose();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="admin-dialog">
        <DialogHeader>
          <DialogTitle>{form.id ? `Code ${draft.code}` : "Neuer Rabattcode"}</DialogTitle>
        </DialogHeader>
        <div className="admin-form">
          <TextField
            label="Code"
            hint="Gross- und Kleinschreibung spielt beim Einlösen keine Rolle."
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
          />
          <div className="admin-grid-2">
            <SelectField
              label="Art"
              value={form.kind}
              onChange={(e) => set("kind", e.target.value as Draft["kind"])}
              options={[
                { value: "percent", label: "Prozent" },
                { value: "amount", label: "Franken" },
              ]}
            />
            <TextField
              label={form.kind === "percent" ? "Rabatt in %" : "Rabatt in CHF"}
              inputMode="decimal"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
            />
          </div>
          <TextField
            label="Mindestbestellwert in CHF (freiwillig)"
            inputMode="decimal"
            value={form.min}
            onChange={(e) => set("min", e.target.value)}
          />
          <div className="admin-grid-2">
            <TextField
              label="Gültig ab (freiwillig)"
              type="date"
              value={form.starts}
              onChange={(e) => set("starts", e.target.value)}
            />
            <TextField
              label="Gültig bis und mit (freiwillig)"
              type="date"
              value={form.ends}
              onChange={(e) => set("ends", e.target.value)}
            />
          </div>
          <TextField
            label="Höchstens so oft einlösbar (freiwillig)"
            inputMode="numeric"
            value={form.max}
            onChange={(e) => set("max", e.target.value.replace(/[^\d]/g, ""))}
          />
          <AreaField
            label="Interne Notiz"
            rows={2}
            maxLength={500}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
          <CheckField label="Aktiv" checked={form.active} onChange={(v) => set("active", v)} />
          {draft.id && (
            <p className="admin-hint">
              Bisher{" "}
              {valueText({
                kind: draft.kind,
                value:
                  draft.kind === "percent" ? Number(draft.value) : (parseChf(draft.value) ?? 0),
              })}{" "}
              Rabatt.
            </p>
          )}
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="admin" disabled={busy} onClick={() => void save()}>
            {busy ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
