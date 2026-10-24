// Bestand ändern: Verkauf im Laden, Retoure oder Korrektur (Inventur). Jede Änderung wird als Lagerbewegung gespeichert.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminError,
  adjustStock,
  notifyRestock,
  setStock,
  waitingForVariant,
  type StockReason,
} from "@/lib/admin/api";
import { notify, SelectField, TextField } from "./ui";

export interface StockTarget {
  id: string;
  size: string;
  stock: number;
  label: string;
}

const REASONS: { value: StockReason; label: string }[] = [
  { value: "sale_store", label: "Verkauf im Laden (Bestand minus)" },
  { value: "return", label: "Retoure ohne Online-Bestellung (Bestand plus)" },
  { value: "correction", label: "Korrektur oder Inventur (neuer Bestand)" },
];

export function StockDialog({
  target,
  onClose,
  onDone,
}: {
  target: StockTarget | null;
  onClose: () => void;
  onDone: (stock: number) => void;
}) {
  const [reason, setReason] = useState<StockReason>("sale_store");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(0);
  // Bestand, den der Server zuletzt gemeldet hat (nach STOCK_CHANGED); sonst der Bestand beim Öffnen.
  const [seen, setSeen] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    setReason("sale_store");
    setAmount("1");
    setNote("");
    setError("");
    setWaiting(0);
    setSeen(null);
    let alive = true;
    waitingForVariant(target.id).then(
      (n) => alive && setWaiting(n),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [target]);

  /** Wartende benachrichtigen; scheitert eine E-Mail, bleibt der Wunsch für später stehen. */
  async function notifyWaiting(variantId: string) {
    try {
      const r = await notifyRestock(variantId);
      if (r.notified) notify.ok(`${r.notified} wartende Kundschaft benachrichtigt.`);
      if (r.failed)
        notify.warn(
          `${r.failed} E-Mail(s) nicht verschickt (E-Mail-Versand eingerichtet?). Sie bleiben vorgemerkt.`,
        );
      setWaiting(r.failed);
    } catch (e) {
      notify.error(e);
    }
  }

  if (!target) return null;
  const current = seen ?? target.stock;
  const value = /^\d{1,5}$/.test(amount.trim()) ? Number(amount.trim()) : NaN;
  const delta =
    reason === "correction" ? value - current : reason === "sale_store" ? -value : value;
  const after = current + delta;

  async function save() {
    if (!target) return;
    setError("");
    if (!Number.isFinite(delta) || delta === 0)
      return setError("Bitte eine Menge angeben, die den Bestand ändert.");
    if (after < 0) return setError(`Es sind nur ${current} Stück an Lager.`);
    if (reason === "correction" && !note.trim())
      return setError("Bitte einen Grund für die Korrektur angeben.");
    setBusy(true);
    try {
      // Inventur: der Server rechnet das Delta unter Sperre und meldet STOCK_CHANGED, wenn inzwischen verkauft wurde.
      const stock =
        reason === "correction"
          ? await setStock(target.id, value, current, note.trim() || undefined)
          : await adjustStock(target.id, delta, reason, note.trim() || undefined);
      notify.ok(`Bestand ${target.label}, ${target.size}: ${stock}`);
      // Von ausverkauft auf vorrätig: Wartende automatisch benachrichtigen
      if (current <= 0 && stock > 0 && waiting > 0) await notifyWaiting(target.id);
      onDone(stock);
      onClose();
    } catch (e) {
      if (e instanceof AdminError && e.code === "STOCK_CHANGED") {
        const available = (e.detail as { available?: number } | undefined)?.available;
        if (typeof available === "number") {
          setSeen(available);
          setAmount(String(available));
        }
        setError(
          `Der Bestand hat sich geändert${typeof available === "number" ? ` (jetzt ${available})` : ""}. Bitte neu zählen.`,
        );
      } else {
        notify.error(e);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="admin-dialog">
        <DialogHeader>
          <DialogTitle>
            Bestand ändern: {target.label}, Grösse {target.size}
          </DialogTitle>
        </DialogHeader>
        <p className="admin-muted">Aktuell an Lager: {current}</p>
        {waiting > 0 && (
          <p className="admin-muted">
            {waiting} {waiting === 1 ? "Person wartet" : "Personen warten"} auf diese Grösse
            {current > 0 ? (
              <>
                {" · "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  disabled={busy}
                  onClick={() => notifyWaiting(target.id)}
                >
                  jetzt benachrichtigen
                </Button>
              </>
            ) : (
              " (Benachrichtigung beim Aufstocken)"
            )}
          </p>
        )}
        <div className="admin-form">
          <SelectField
            label="Was ist passiert?"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as StockReason);
              setAmount(e.target.value === "correction" ? String(current) : "1");
            }}
            options={REASONS}
          />
          <TextField
            label={reason === "correction" ? "Neuer Bestand (gezählt)" : "Menge"}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            hint={Number.isFinite(after) ? `Danach an Lager: ${after}` : undefined}
          />
          <TextField
            label={reason === "correction" ? "Grund (Pflicht)" : "Notiz (freiwillig)"}
            maxLength={500}
            placeholder={reason === "correction" ? "z. B. Inventur, beschädigt, Fehlbuchung" : ""}
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
          <Button variant="admin" disabled={busy} onClick={() => void save()}>
            {busy ? "Bitte warten …" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
