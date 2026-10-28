// Bestellungen: Liste mit Ansichten, Suche nach Nummer oder E-Mail, Seiten und CSV-Export.
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { printDoc } from "@/components/admin/print";
import { PackingSlips, type SlipOrder } from "@/components/admin/shipping-docs";
import { shopConfig } from "@/config/shop";
import {
  AdminError,
  exportOrders,
  getOrdersByIds,
  getVariantCodes,
  listOrders,
  openOrderIds,
  paidOrderIds,
  PAGE_SIZE,
  type OrderFilter,
  type VariantCodes,
} from "@/lib/admin/api";
import { accountingRows } from "@/lib/admin/accounting-export";
import { downloadCsv } from "@/lib/admin/csv";
import { zurichDate, zurichMidnight } from "@/lib/admin/dates";
import { centsToInput } from "@/lib/admin/money";
import {
  Badge,
  CheckField,
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
  const [exportMode, setExportMode] = useState<ExportMode | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [withPrices, setWithPrices] = useState(true);
  const [slipBusy, setSlipBusy] = useState(false);
  const [slipJob, setSlipJob] = useState<{ orders: SlipOrder[]; codes: VariantCodes } | null>(null);
  const query = useQuery({
    queryKey: ["admin", "orders", view, search.suche ?? "", page],
    queryFn: () => listOrders({ view, search: search.suche ?? "", page }),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Lieferscheine der gewählten Bestellungen, sonst aller bezahlten und noch nicht versendeten (höchstens 100). */
  async function printSlips() {
    setSlipBusy(true);
    try {
      const ids = selected.size ? [...selected] : await openOrderIds();
      const orders = (await getOrdersByIds(ids))
        .filter((o) => o.kind === "cart" && o.shipping_address)
        .sort((a, b) => a.number - b.number);
      if (!orders.length) return notify.warn("Keine Bestellungen zum Drucken.");
      const codes = await getVariantCodes(
        orders.flatMap((o) => o.items.flatMap((i) => i.variant_id ?? [])),
      );
      setSlipJob({ orders, codes });
    } catch (error) {
      notify.error(error);
    } finally {
      setSlipBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void navigate({ search: (s) => ({ ...s, suche: term.trim() || undefined, seite: undefined }) });
  }

  return (
    <>
      <PageHeader
        title="Bestellungen"
        actions={
          <>
            <Button variant="outline" disabled={slipBusy} onClick={() => void printSlips()}>
              <Printer />{" "}
              {slipBusy
                ? "Wird vorbereitet …"
                : selected.size
                  ? `Lieferscheine drucken (${selected.size})`
                  : "Lieferscheine drucken (offene)"}
            </Button>
            <Button variant="outline" onClick={() => setExportMode("items")}>
              <Download /> Export (CSV)
            </Button>
            <Button variant="outline" onClick={() => setExportMode("accounting")}>
              <Download /> Buchhaltung (CSV)
            </Button>
          </>
        }
      />
      <div className="admin-toolbar">
        <CheckField
          label="Lieferscheine mit Preisen"
          hint="Gewählte Bestellungen ankreuzen; ohne Auswahl kommen alle bezahlten, noch nicht versendeten dran."
          checked={withPrices}
          onChange={setWithPrices}
        />
      </div>
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
                  <th className="admin-check-col">
                    <input
                      type="checkbox"
                      aria-label="Alle auf dieser Seite auswählen"
                      checked={
                        query.data.rows.length > 0 &&
                        query.data.rows.every((o) => selected.has(o.id))
                      }
                      onChange={(e) => {
                        for (const o of query.data.rows) toggle(o.id, e.target.checked);
                      }}
                    />
                  </th>
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
                    <td className="admin-check-col">
                      {o.kind === "cart" && (
                        <input
                          type="checkbox"
                          aria-label={`AX-${o.number} auswählen`}
                          checked={selected.has(o.id)}
                          onChange={(e) => toggle(o.id, e.target.checked)}
                        />
                      )}
                    </td>
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
      <ExportDialog mode={exportMode} onClose={() => setExportMode(null)} />
      {slipJob && (
        <SlipBatch
          job={slipJob}
          withPrices={withPrices}
          onDone={() => {
            setSlipJob(null);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}

function isoDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(date);
}

/** Sammeldruck: Lieferscheine einhängen, drucken und nach dem Druckdialog wieder entfernen. */
function SlipBatch({
  job,
  withPrices,
  onDone,
}: {
  job: { orders: SlipOrder[]; codes: VariantCodes };
  withPrices: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    let frame = 0;
    window.addEventListener("afterprint", onDone, { once: true });
    // Zwei Bilder abwarten: Das Dokument hängt erst nach dem Mounten an <body>
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => printDoc("slip"));
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", onDone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <PackingSlips orders={job.orders} codes={job.codes} withPrices={withPrices} />;
}

type ExportMode = "items" | "accounting";

/** Wie viele Bestellungen ein Buchhaltungsexport höchstens lädt (jede Bestellung ist eine Abfrage). */
const MAX_ACCOUNTING_ORDERS = 1500;

function ExportDialog({ mode, onClose }: { mode: ExportMode | null; onClose: () => void }) {
  const open = mode !== null;
  const onOpenChange = (value: boolean) => {
    if (!value) onClose();
  };
  const [progress, setProgress] = useState("");
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
      if (mode === "accounting") {
        const ids = await paidOrderIds(start, endMidnight);
        if (ids.length > MAX_ACCOUNTING_ORDERS) throw new AdminError("TOO_MANY_ORDERS");
        const full = await getOrdersByIds(ids, (done, total) => setProgress(`${done} / ${total}`));
        downloadCsv(
          `axion-buchhaltung-${from}-bis-${to}.csv`,
          accountingRows(full, {
            vatRegistered: shopConfig.vatRegistered,
            defaultVatRate: shopConfig.vatRate,
            statusLabel: (status) =>
              orderStatusLabel(status as Parameters<typeof orderStatusLabel>[0]),
          }),
        );
        notify.ok(`${full.length} Bestellungen exportiert.`);
        onOpenChange(false);
        return;
      }
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
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog">
        <DialogHeader>
          <DialogTitle>
            {mode === "accounting" ? "Export für die Buchhaltung" : "Bestellungen exportieren"}
          </DialogTitle>
        </DialogHeader>
        <p className="admin-muted">
          {mode === "accounting"
            ? "Bezahlte, versendete und zurückerstattete Bestellungen nach Zahlungsdatum, eine Zeile pro Bestellung: Beträge, Zahlungsart, Stripe-Zahlung und enthaltene MWST (gerechnet wie auf der Quittung). Datei für Excel (Semikolon, UTF-8)."
            : "Bezahlte, versendete und zurückerstattete Bestellungen nach Zahlungsdatum. Eine Zeile pro Position; die Beträge der Bestellung stehen in jeder Zeile. Datei für Excel (Semikolon, UTF-8)."}
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
            {busy ? `Wird erstellt … ${progress}` : "CSV herunterladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
