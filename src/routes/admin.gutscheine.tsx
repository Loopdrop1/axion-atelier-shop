// Gutscheine: suchen, ausstellen (z. B. Kulanz, Gewinnspiel), sperren, verlängern, E-Mail erneut senden.
import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Input } from "@/components/ui/input";
import {
  issueGiftCard,
  listGiftCards,
  listGiftCardTransactions,
  resendGiftCard,
  updateGiftCard,
  type GiftCard,
} from "@/lib/admin/api";
import { zurichDate } from "@/lib/admin/dates";
import { parseChf } from "@/lib/admin/money";
import {
  AreaField,
  Badge,
  CheckField,
  chf,
  dateOnly,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  SelectField,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/gutscheine")({
  validateSearch: (s: Record<string, unknown>): { suche?: string | undefined } => ({
    suche: typeof s["suche"] === "string" && s["suche"] ? s["suche"] : undefined,
  }),
  component: GiftCards,
});

function cardState(g: GiftCard): { label: string; tone: "ok" | "muted" | "danger" } {
  if (g.status === "disabled") return { label: "Gesperrt", tone: "danger" };
  if (new Date(g.expires_at).getTime() <= Date.now()) return { label: "Abgelaufen", tone: "muted" };
  if (g.balance_cents === 0) return { label: "Aufgebraucht", tone: "muted" };
  return { label: "Aktiv", tone: "ok" };
}

const TX: Record<string, string> = {
  issue: "Ausgestellt",
  redeem: "Eingelöst",
  release: "Zurück (Bestellung nicht bezahlt)",
  adjust: "Korrektur",
};

function GiftCards() {
  const { suche } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/gutscheine" });
  const queryClient = useQueryClient();
  const [term, setTerm] = useState(suche ?? "");
  const [issueOpen, setIssueOpen] = useState(false);
  const [detail, setDetail] = useState<GiftCard | null>(null);
  const query = useQuery({
    queryKey: ["admin", "giftcards", suche ?? ""],
    queryFn: () => listGiftCards(suche ?? ""),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "giftcards"] });

  function submit(event: FormEvent) {
    event.preventDefault();
    void navigate({ search: { suche: term.trim() || undefined } });
  }

  return (
    <>
      <PageHeader
        title="Gutscheine"
        description="Gekaufte Gutscheine entstehen automatisch nach der Zahlung. Hier kannst du zusätzlich Gutscheine ausstellen."
        actions={
          <Button variant="admin" onClick={() => setIssueOpen(true)}>
            <Plus /> Gutschein ausstellen
          </Button>
        }
      />
      <form onSubmit={submit} className="admin-search admin-toolbar">
        <Input
          type="search"
          placeholder="Code oder E-Mail"
          aria-label="Gutscheine suchen"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Suchen
        </Button>
      </form>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <p className="admin-empty">
          {suche ? "Kein Gutschein gefunden." : "Noch keine Gutscheine."}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Für</th>
                <th className="num admin-hide-sm">Wert</th>
                <th className="num">Guthaben</th>
                <th>Gültig bis</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data.map((g) => {
                const s = cardState(g);
                return (
                  <tr key={g.id}>
                    <td>
                      <strong className="admin-code">{g.code}</strong>
                      <span className="admin-sub">
                        {g.purchase_order_id ? "gekauft" : "ausgestellt"} {dateOnly(g.created_at)}
                      </span>
                    </td>
                    <td>
                      {g.recipient_name ?? "–"}
                      <span className="admin-sub">
                        {g.recipient_email ?? g.purchaser_email ?? ""}
                      </span>
                    </td>
                    <td className="num admin-hide-sm">{chf(g.initial_cents)}</td>
                    <td className="num">{chf(g.balance_cents)}</td>
                    <td>{dateOnly(g.expires_at)}</td>
                    <td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="admin-row-actions">
                      <Button variant="outline" size="sm" onClick={() => setDetail(g)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {issueOpen && <IssueDialog onClose={() => setIssueOpen(false)} onDone={refresh} />}
      {detail && <DetailDialog card={detail} onClose={() => setDetail(null)} onDone={refresh} />}
    </>
  );
}

function IssueDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    amount: "50",
    locale: "de" as "de" | "en",
    recipientEmail: "",
    recipientName: "",
    senderName: "Axion",
    message: "",
    note: "",
    send: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ code: string; emailed: boolean } | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function issue() {
    setError("");
    const cents = parseChf(form.amount);
    if (!cents || cents < 100 || cents > 1_000_000)
      return setError("Betrag zwischen CHF 1 und CHF 10'000.");
    if (form.send && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.recipientEmail.trim()))
      return setError("Zum Senden braucht es eine gültige E-Mail-Adresse.");
    setBusy(true);
    try {
      const r = await issueGiftCard({
        amountCents: cents,
        locale: form.locale,
        recipientEmail: form.recipientEmail.trim() || undefined,
        recipientName: form.recipientName.trim() || undefined,
        senderName: form.senderName.trim() || undefined,
        message: form.message.trim() || undefined,
        note: form.note.trim() || undefined,
        send: form.send && Boolean(form.recipientEmail.trim()),
      });
      setIssued({ code: r.giftCard.code, emailed: r.emailed });
      if (r.emailError) notify.error(new Error("EMAIL_FAILED"));
      onDone();
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
          <DialogTitle>Gutschein ausstellen</DialogTitle>
        </DialogHeader>
        {issued ? (
          <>
            <p>Gutschein erstellt:</p>
            <p className="admin-code admin-code-big">{issued.code}</p>
            <p className="admin-muted">
              {issued.emailed ? "Die E-Mail ist unterwegs." : "Es wurde keine E-Mail gesendet."}
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(issued.code)
                    .then(() => notify.ok("Code kopiert."))
                }
              >
                Code kopieren
              </Button>
              <Button variant="admin" onClick={onClose}>
                Fertig
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="admin-form">
              <div className="admin-grid-2">
                <TextField
                  label="Betrag in CHF"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                />
                <SelectField
                  label="Sprache der E-Mail"
                  value={form.locale}
                  onChange={(e) => set("locale", e.target.value as "de" | "en")}
                  options={[
                    { value: "de", label: "Deutsch" },
                    { value: "en", label: "Englisch" },
                  ]}
                />
              </div>
              <div className="admin-grid-2">
                <TextField
                  label="Name der beschenkten Person"
                  maxLength={100}
                  value={form.recipientName}
                  onChange={(e) => set("recipientName", e.target.value)}
                />
                <TextField
                  label="E-Mail der beschenkten Person"
                  type="email"
                  maxLength={254}
                  value={form.recipientEmail}
                  onChange={(e) => set("recipientEmail", e.target.value)}
                />
              </div>
              <TextField
                label="Absender"
                maxLength={100}
                value={form.senderName}
                onChange={(e) => set("senderName", e.target.value)}
              />
              <AreaField
                label="Nachricht (freiwillig)"
                rows={3}
                maxLength={500}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
              />
              <TextField
                label="Interne Notiz"
                hint="z. B. Kulanz Bestellung AX-10042"
                maxLength={500}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
              />
              <CheckField
                label="Gutschein per E-Mail senden"
                checked={form.send}
                onChange={(v) => set("send", v)}
              />
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
              <Button variant="admin" disabled={busy} onClick={() => void issue()}>
                {busy ? "Wird erstellt …" : "Ausstellen"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  card,
  onClose,
  onDone,
}: {
  card: GiftCard;
  onClose: () => void;
  onDone: () => void;
}) {
  const tx = useQuery({
    queryKey: ["admin", "giftcard-tx", card.id],
    queryFn: () => listGiftCardTransactions(card.id),
  });
  const [expires, setExpires] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(
      new Date(card.expires_at),
    ),
  );
  const [note, setNote] = useState(card.note ?? "");
  const [busy, setBusy] = useState(false);
  const s = cardState(card);

  async function save(values: Parameters<typeof updateGiftCard>[1], text: string) {
    setBusy(true);
    try {
      await updateGiftCard(card.id, values);
      notify.ok(text);
      onDone();
      onClose();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="admin-dialog admin-dialog-wide">
        <DialogHeader>
          <DialogTitle>
            Gutschein <span className="admin-code">{card.code}</span>
          </DialogTitle>
        </DialogHeader>
        <p>
          <Badge tone={s.tone}>{s.label}</Badge> Guthaben {chf(card.balance_cents)} von{" "}
          {chf(card.initial_cents)} · gültig bis {dateOnly(card.expires_at)}
        </p>
        {(card.recipient_name || card.recipient_email || card.purchaser_email) && (
          <p className="admin-muted">
            {card.recipient_name && `Für ${card.recipient_name}`}{" "}
            {card.recipient_email && `(${card.recipient_email})`}
            {card.purchaser_email && ` · gekauft von ${card.purchaser_email}`}
          </p>
        )}
        {card.message && <blockquote className="admin-quote">«{card.message}»</blockquote>}
        <h3>Buchungen</h3>
        {tx.isLoading ? (
          <Loading />
        ) : tx.isError ? (
          <ErrorBox error={tx.error} />
        ) : (
          <table className="admin-table">
            <tbody>
              {(tx.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{dateTime(t.created_at)}</td>
                  <td>
                    {TX[t.kind] ?? t.kind}
                    {t.order && (
                      <span className="admin-sub">
                        <Link
                          to="/admin/bestellungen"
                          search={{ suche: String(t.order.number) }}
                          className="admin-link"
                        >
                          AX-{t.order.number}
                        </Link>
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <span className={t.delta_cents > 0 ? "admin-plus" : "admin-minus"}>
                      {t.delta_cents > 0 ? "+" : "−"}
                      {chf(Math.abs(t.delta_cents))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-form">
          <div className="admin-grid-2 admin-align-end">
            <TextField
              label="Gültig bis"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const day = zurichDate(expires);
                if (!day) return notify.error(new Error("INVALID_RANGE"));
                const end = zurichDate(
                  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(
                    new Date(day.getTime() + 36 * 3600_000),
                  ),
                );
                void save({ expires_at: (end ?? day).toISOString() }, "Gültigkeit geändert.");
              }}
            >
              Gültigkeit speichern
            </Button>
          </div>
          <AreaField
            label="Interne Notiz"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter className="admin-dialog-footer-wrap">
          {card.status === "active" ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void save({ status: "disabled" }, "Gutschein gesperrt.")}
            >
              Sperren
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void save({ status: "active" }, "Gutschein entsperrt.")}
            >
              Entsperren
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy || !(card.recipient_email || card.purchaser_email)}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await resendGiftCard(card.id);
                notify.ok(`Gutschein an ${r.to} gesendet.`);
              } catch (e) {
                notify.error(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            E-Mail erneut senden
          </Button>
          <Button
            variant="admin"
            disabled={busy || note === (card.note ?? "")}
            onClick={() => void save({ note: note.trim() || null }, "Notiz gespeichert.")}
          >
            Notiz speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
