// Bestellungen: Liste mit Ansichten, Suche nach Nummer oder E-Mail, Seiten und CSV-Export.
import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { exportOrders, listOrders, PAGE_SIZE, type OrderFilter } from "@/lib/admin/api";
import { downloadCsv } from "@/lib/admin/csv";
import { zurichDate, zurichMidnight } from "@/lib/admin/dates";
import { centsToInput } from "@/lib/admin/money";
import {
  Badge,
  chf,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  orderStatusLabel,
  PageHeader,
  StatusBadge,
  TextField,
} from "@/components/admin/ui";

const VIEWS = [
  { value: "open", label: "Zu versenden" },
  { value: "attention", label: "Prüfen" },
  { value: "all", label: "Alle" },
  { value: "paid", label: "Bezahlt" },
  { value: "shipped", label: "Versendet" },
  { value: "refunded", label: "Zurückerstattet" },
  { value: "cancelled", label: "Abgebrochen" },
  { value: "pending", label: "Zahlung läuft" },
] as const;

type View = OrderFilter["view"];

interface Search {
  ansicht?: View | undefined;
  suche?: string | undefined;
  seite?: number | undefined;
}

export const Route = createFileRoute("/admin/bestellungen/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ansicht: VIEWS.some((v) => v.value === s["ansicht"]) ? (s["ansicht"] as View) : undefined,
    suche: typeof s["suche"] === "string" && s["suche"] ? s["suche"] : undefined,
    seite:
      Number.isInteger(Number(s["seite"])) && Number(s["seite"]) > 0
        ? Number(s["seite"])
        : undefined,
  }),
  component: Orders,
});

function Orders() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/bestellungen/" });
  const view: View = search.ansicht ?? "open";
  const page = (search.seite ?? 1) - 1;
  const [term, setTerm] = useState(search.suche ?? "");
  const [exportOpen, setExportOpen] = useState(false);
  const query = useQuery({
    queryKey: ["admin", "orders", view, search.suche ?? "", page],
    queryFn: () => listOrders({ view, search: search.suche ?? "", page }),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  function submit(event: FormEvent) {
    event.preventDefault();
    void navigate({ search: (s) => ({ ...s, suche: term.trim() || undefined, seite: undefined }) });
  }

  return (
    <>
      <PageHeader
        title="Bestellungen"
        actions={
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download /> Export (CSV)
          </Button>
        }
      />
      <div className="admin-toolbar">
        <nav className="admin-tabs" aria-label="Ansicht">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              to="/admin/bestellungen"
              search={{ ansicht: v.value, suche: search.suche }}
              className={view === v.value ? "active" : ""}
              activeProps={{ className: "" }}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form onSubmit={submit} className="admin-search">
          <Input
            type="search"
            placeholder="Nummer oder E-Mail"
            aria-label="Bestellungen suchen"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Suchen
          </Button>
        </form>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.rows.length ? (
        <p className="admin-empty">Keine Bestellungen in dieser Ansicht.</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-click">
              <thead>
                <tr>
                  <th>Nr.</th>
                  <th className="admin-hide-sm">Datum</th>
                  <th>Kundschaft</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link
                        to="/admin/bestellungen/$id"
                        params={{ id: o.id }}
                        className="admin-link"
                      >
                        AX-{o.number}
                      </Link>
                      {o.kind === "gift_card" && <Badge>Gutschein</Badge>}
                      {o.needs_attention && <Badge tone="danger">Prüfen</Badge>}
                    </td>
                    <td className="admin-hide-sm">{dateTime(o.paid_at ?? o.created_at)}</td>
                    <td>
                      {o.shipping_name ?? "–"}
                      <span className="admin-sub">{o.email}</span>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="num">
                      {chf(o.total_cents)}
                      {o.refunded_cents > 0 && (
                        <span className="admin-sub">−{chf(o.refunded_cents)} zurück</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pager">
            <span className="admin-muted">
              {query.data.count} {query.data.count === 1 ? "Bestellung" : "Bestellungen"} · Seite{" "}
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
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
}

function isoDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(date);
}

function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [from, setFrom] = useState(() => isoDay(zurichMidnight(30)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [busy, setBusy] = useState(false);

  async function run() {
    const start = zurichDate(from);
    const endDay = zurichDate(to);
    if (!start || !endDay || endDay < start) return notify.error(new Error("INVALID_RANGE"));
    const end = new Date(endDay.getTime() + 36 * 3600_000); // nächster Tag, unabhängig von der Zeitumstellung
    const endMidnight = zurichDate(isoDay(end)) ?? end;
    setBusy(true);
    try {
      const orders = await exportOrders(start, endMidnight);
      const rows: (string | number | null)[][] = [
        [
          "Bestellung",
          "Art",
          "Status",
          "Bezahlt am",
          "Versendet am",
          "E-Mail",
          "Name",
          "Adresse",
          "PLZ",
          "Ort",
          "Land",
          "Position",
          "Grösse",
          "Farbe",
          "Menge",
          "Einzelpreis CHF",
          "Positionstotal CHF",
          "Warenwert CHF",
          "Rabatt CHF",
          "Rabattcode",
          "Gutschein CHF",
          "Versand CHF",
          "Total CHF",
          "Zurückerstattet CHF",
          "Zahlungsart",
          "Sendungsnummer",
        ],
      ];
      for (const o of orders) {
        const address = (o.shipping_address ?? {}) as Record<string, string | undefined>;
        const head = [
          `AX-${o.number}`,
          o.kind === "gift_card" ? "Gutschein" : "Warenkorb",
          orderStatusLabel(o.status),
          dateTime(o.paid_at),
          o.shipped_at ? dateTime(o.shipped_at) : "",
          o.email,
          o.shipping_name ?? "",
          [address["line1"], address["line2"]].filter(Boolean).join(", "),
          address["postal_code"] ?? "",
          address["city"] ?? "",
          address["country"] ?? "",
        ];
        const tail = [
          centsToInput(o.subtotal_cents),
          centsToInput(o.discount_cents),
          o.discount_code ?? "",
          centsToInput(o.gift_card_cents),
          centsToInput(o.shipping_cents),
          centsToInput(o.total_cents),
          centsToInput(o.refunded_cents),
          o.payment_method ?? "",
          o.tracking_number ?? "",
        ];
        const items = o.order_items.length ? o.order_items : [null];
        for (const item of items) {
          rows.push([
            ...head,
            item?.title ?? (o.kind === "gift_card" ? "Geschenkgutschein" : ""),
            item?.size ?? "",
            item?.color ?? "",
            item?.quantity ?? 1,
            item ? centsToInput(item.unit_price_cents) : "",
            item ? centsToInput(item.line_total_cents) : "",
            ...tail,
          ]);
        }
      }
      downloadCsv(`axion-bestellungen-${from}-bis-${to}.csv`, rows);
      notify.ok(`${orders.length} Bestellungen exportiert.`);
      onOpenChange(false);
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog">
        <DialogHeader>
          <DialogTitle>Bestellungen exportieren</DialogTitle>
        </DialogHeader>
        <p className="admin-muted">
          Bezahlte, versendete und zurückerstattete Bestellungen nach Zahlungsdatum. Eine Zeile pro
          Position; die Beträge der Bestellung stehen in jeder Zeile. Datei für Excel (Semikolon,
          UTF-8).
        </p>
        <div className="admin-grid-2">
          <TextField
            label="Von"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            label="Bis und mit"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="admin" disabled={busy} onClick={() => void run()}>
            {busy ? "Wird erstellt …" : "CSV herunterladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
