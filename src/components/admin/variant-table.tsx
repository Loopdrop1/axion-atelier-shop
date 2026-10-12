// Grössen eines Produkts: anlegen, ändern, aktivieren, löschen; Bestand nur über den Bestand-Dialog.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addVariant, deleteVariant, updateVariant, type Variant } from "@/lib/admin/api";
import { centsToInput, parseChf } from "@/lib/admin/money";
import { StockDialog, type StockTarget } from "./stock-dialog";
import { Badge, ConfirmButton, notify, Panel } from "./ui";

interface Row {
  size: string;
  sku: string;
  price: string;
  sort: string;
  active: boolean;
}

const toRow = (v: Variant): Row => ({
  size: v.size,
  sku: v.sku ?? "",
  price: centsToInput(v.price_cents),
  sort: String(v.sort),
  active: v.active,
});

export function VariantTable({
  productId,
  productLabel,
  variants,
  onChange,
}: {
  productId: string;
  productLabel: string;
  variants: Variant[];
  onChange: () => void;
}) {
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ size: "", sku: "", stock: "0" });

  const rowOf = (v: Variant) => edits[v.id] ?? toRow(v);
  const setRow = (v: Variant, patch: Partial<Row>) =>
    setEdits((e) => ({ ...e, [v.id]: { ...rowOf(v), ...patch } }));
  const dirty = (v: Variant) =>
    Boolean(edits[v.id]) && JSON.stringify(edits[v.id]) !== JSON.stringify(toRow(v));

  async function save(v: Variant) {
    const row = rowOf(v);
    const price = row.price.trim() ? parseChf(row.price) : null;
    if (!row.size.trim()) return notify.error(new Error("INVALID_SIZE"));
    if (row.price.trim() && price === null) return notify.error(new Error("INVALID_AMOUNT"));
    setBusy(v.id);
    try {
      await updateVariant(v.id, {
        size: row.size.trim(),
        sku: row.sku.trim() || null,
        price_cents: price,
        sort: Number(row.sort) || 0,
        active: row.active,
      });
      setEdits(({ [v.id]: _, ...rest }) => rest);
      notify.ok(`Grösse ${row.size.trim()} gespeichert.`);
      onChange();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const size = draft.size.trim();
    const stock = /^\d{1,5}$/.test(draft.stock.trim()) ? Number(draft.stock.trim()) : NaN;
    if (!size) return notify.error(new Error("INVALID_SIZE"));
    if (!Number.isFinite(stock)) return notify.error(new Error("INVALID_DELTA"));
    setBusy("new");
    try {
      await addVariant(
        {
          product_id: productId,
          size,
          sku: draft.sku.trim() || null,
          sort: Math.max(0, ...variants.map((v) => v.sort)) + 10,
        },
        stock,
      );
      setDraft({ size: "", sku: "", stock: "0" });
      notify.ok(`Grösse ${size} angelegt.`);
      onChange();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Grössen und Bestand"
      description="Preis abweichend nur ausfüllen, wenn diese Grösse mehr oder weniger kostet. Bestand ändern über «Bestand»: so bleibt jede Änderung im Lager nachvollziehbar."
    >
      <div className="admin-table-wrap">
        <table className="admin-table admin-variants">
          <thead>
            <tr>
              <th>Grösse</th>
              <th>Artikelnummer</th>
              <th>Preis abweichend (CHF)</th>
              <th>Reihenfolge</th>
              <th>Aktiv</th>
              <th className="num">Bestand</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const row = rowOf(v);
              return (
                <tr key={v.id}>
                  <td>
                    <Input
                      aria-label="Grösse"
                      value={row.size}
                      maxLength={20}
                      onChange={(e) => setRow(v, { size: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label="Artikelnummer"
                      value={row.sku}
                      maxLength={60}
                      onChange={(e) => setRow(v, { sku: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label="Preis abweichend"
                      inputMode="decimal"
                      placeholder="wie Produkt"
                      value={row.price}
                      onChange={(e) => setRow(v, { price: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label="Reihenfolge"
                      inputMode="numeric"
                      className="admin-narrow-input"
                      value={row.sort}
                      onChange={(e) => setRow(v, { sort: e.target.value.replace(/[^\d]/g, "") })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Aktiv"
                      checked={row.active}
                      onChange={(e) => setRow(v, { active: e.target.checked })}
                    />
                  </td>
                  <td className="num">
                    {v.stock === 0 ? <Badge tone="danger">0</Badge> : v.stock}{" "}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStockTarget({
                          id: v.id,
                          size: v.size,
                          stock: v.stock,
                          label: productLabel,
                        })
                      }
                    >
                      Bestand
                    </Button>
                  </td>
                  <td className="admin-row-actions">
                    {dirty(v) && (
                      <Button
                        variant="admin"
                        size="sm"
                        disabled={busy === v.id}
                        onClick={() => void save(v)}
                      >
                        Speichern
                      </Button>
                    )}
                    <ConfirmButton
                      label="Löschen"
                      variant="ghost"
                      title={`Grösse ${v.size} löschen?`}
                      description="Bestellungen behalten ihre Angaben. Die Lagerbewegungen dieser Grösse werden gelöscht. Wenn die Grösse nur vorübergehend fehlt: besser «Aktiv» ausschalten."
                      confirmLabel="Endgültig löschen"
                      onConfirm={async () => {
                        await deleteVariant(v.id);
                        notify.ok(`Grösse ${v.size} gelöscht.`);
                        onChange();
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="admin-add-row">
              <td>
                <Input
                  aria-label="Neue Grösse"
                  placeholder="z. B. 50"
                  maxLength={20}
                  value={draft.size}
                  onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))}
                />
              </td>
              <td>
                <Input
                  aria-label="Artikelnummer der neuen Grösse"
                  placeholder="freiwillig"
                  maxLength={60}
                  value={draft.sku}
                  onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                />
              </td>
              <td colSpan={3} className="admin-muted">
                Anfangsbestand:{" "}
                <Input
                  aria-label="Anfangsbestand"
                  inputMode="numeric"
                  className="admin-narrow-input"
                  value={draft.stock}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, stock: e.target.value.replace(/[^\d]/g, "") }))
                  }
                />
              </td>
              <td colSpan={2}>
                <Button
                  variant="admin"
                  size="sm"
                  disabled={busy === "new" || !draft.size.trim()}
                  onClick={() => void add()}
                >
                  Grösse hinzufügen
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StockDialog
        target={stockTarget}
        onClose={() => setStockTarget(null)}
        onDone={() => onChange()}
      />
    </Panel>
  );
}
