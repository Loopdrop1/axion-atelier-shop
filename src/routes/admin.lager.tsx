// Lager: Bestand aller Grössen, Verkauf im Laden mit einem Klick, Korrekturen mit Grund, Bewegungsliste.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjustStock, listMovements, listStock, type MovementRow } from "@/lib/admin/api";
import { downloadCsv } from "@/lib/admin/csv";
import { invalidateCatalog } from "@/lib/commerce/source";
import { StockDialog, type StockTarget } from "@/components/admin/stock-dialog";
import {
  Badge,
  CheckField,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/lager")({
  component: Stock,
});

const REASON: Record<MovementRow["reason"], string> = {
  reservation: "Online-Bestellung (reserviert)",
  release: "Reservierung frei (nicht bezahlt)",
  sale_store: "Verkauf im Laden",
  return: "Retoure",
  correction: "Korrektur",
  reclaim: "Nachträglich bezahlt",
};

function Stock() {
  const queryClient = useQueryClient();
  const stock = useQuery({ queryKey: ["admin", "stock"], queryFn: listStock });
  const moves = useQuery({ queryKey: ["admin", "movements"], queryFn: () => listMovements(200) });
  const [term, setTerm] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [target, setTarget] = useState<StockTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    invalidateCatalog();
    void queryClient.invalidateQueries({ queryKey: ["admin", "stock"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "movements"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  };

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (stock.data ?? []).filter((v) => {
      if (!showInactive && (!v.active || v.product?.status !== "active")) return false;
      if (lowOnly && v.stock > 1) return false;
      if (!t) return true;
      return [v.product?.title_de, v.product?.color_name_de, v.size, v.sku].some((x) =>
        x?.toLowerCase().includes(t),
      );
    });
  }, [stock.data, term, lowOnly, showInactive]);

  async function sellOne(id: string, label: string, size: string) {
    setBusy(id);
    try {
      const left = await adjustStock(id, -1, "sale_store");
      notify.ok(`Verkauf gebucht: ${label}, ${size}. Noch ${left} an Lager.`);
      refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  function exportStock() {
    downloadCsv(`axion-bestand-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Produkt", "Farbe", "Grösse", "Artikelnummer", "Bestand", "Produkt aktiv", "Grösse aktiv"],
      ...(stock.data ?? []).map((v) => [
        v.product?.title_de ?? "",
        v.product?.color_name_de ?? "",
        v.size,
        v.sku ?? "",
        v.stock,
        v.product?.status === "active" ? "ja" : "nein",
        v.active ? "ja" : "nein",
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Lager"
        description="Online-Bestellungen buchen den Bestand automatisch. Hier buchst du Verkäufe im Laden, Retouren und Korrekturen."
        actions={
          <Button variant="outline" onClick={exportStock} disabled={!stock.data}>
            <Download /> Bestandsliste (CSV)
          </Button>
        }
      />
      <div className="admin-toolbar">
        <div className="admin-search">
          <Input
            type="search"
            placeholder="Produkt, Farbe, Grösse oder Artikelnummer"
            aria-label="Lager durchsuchen"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <CheckField label="Nur 0 oder 1 Stück" checked={lowOnly} onChange={setLowOnly} />
        <CheckField label="Auch ausgeblendete" checked={showInactive} onChange={setShowInactive} />
      </div>
      {stock.isLoading ? (
        <Loading />
      ) : stock.isError ? (
        <ErrorBox error={stock.error} onRetry={() => void stock.refetch()} />
      ) : rows.length === 0 ? (
        <p className="admin-empty">Nichts gefunden.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-stock-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Grösse</th>
                <th className="admin-hide-sm">Artikelnummer</th>
                <th className="num">Bestand</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const label = `${v.product?.title_de ?? "?"} · ${v.product?.color_name_de ?? ""}`;
                return (
                  <tr key={v.id}>
                    <td>
                      {v.product ? (
                        <Link
                          to="/admin/produkte/$id"
                          params={{ id: v.product.id }}
                          className="admin-link"
                        >
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                      {(!v.active || v.product?.status !== "active") && (
                        <Badge tone="muted">ausgeblendet</Badge>
                      )}
                    </td>
                    <td>{v.size}</td>
                    <td className="admin-hide-sm">{v.sku ?? "–"}</td>
                    <td className="num">
                      {v.stock === 0 ? <Badge tone="danger">0</Badge> : v.stock}
                    </td>
                    <td className="admin-row-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === v.id || v.stock === 0}
                        onClick={() => void sellOne(v.id, label, v.size)}
                      >
                        Verkauf im Laden −1
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTarget({ id: v.id, size: v.size, stock: v.stock, label })}
                      >
                        Ändern
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Panel title="Letzte Bewegungen" description="Die letzten 200 Änderungen am Bestand.">
        {moves.isLoading ? (
          <Loading />
        ) : moves.isError ? (
          <ErrorBox error={moves.error} onRetry={() => void moves.refetch()} />
        ) : !moves.data?.length ? (
          <p className="admin-empty">Noch keine Bewegungen.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Produkt</th>
                  <th className="num">Änderung</th>
                  <th>Grund</th>
                  <th>Notiz</th>
                </tr>
              </thead>
              <tbody>
                {moves.data.map((m) => (
                  <tr key={m.id}>
                    <td>{dateTime(m.created_at)}</td>
                    <td>
                      {m.variant?.product?.title_de ?? "–"} ·{" "}
                      {m.variant?.product?.color_name_de ?? ""}
                      <span className="admin-sub">Grösse {m.variant?.size ?? "–"}</span>
                    </td>
                    <td className="num">
                      <span className={m.delta > 0 ? "admin-plus" : "admin-minus"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </td>
                    <td>
                      {REASON[m.reason]}
                      {m.order && <span className="admin-sub">Bestellung AX-{m.order.number}</span>}
                    </td>
                    <td>{m.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <StockDialog target={target} onClose={() => setTarget(null)} onDone={refresh} />
    </>
  );
}
