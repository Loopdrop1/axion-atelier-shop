// Bausteine fürs Admin: Seitenkopf, Bereiche, Felder, Statusanzeigen, Bestätigungsdialog.
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { needsReview, translationNote, type AutoTranslateResult } from "@/lib/admin/auto-translate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminError, adminErrorText, type OrderStatus } from "@/lib/admin/api";
import { formatCents } from "@/lib/commerce/format";
import { cn } from "@/lib/utils";

export const chf = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "–" : formatCents(cents, "de");

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
}

/** Rückmeldungen unten rechts. */
export const notify = {
  ok: (text: string): void => {
    toast.success(text);
  },
  warn: (text: string): void => {
    toast.warning(text, { duration: 12_000 });
  },
  /** Gespeichert, mit Hinweis zur automatischen Übersetzung (Fehler oder «Englisch prüfen» als Warnung). */
  saved: (text: string, translation?: AutoTranslateResult): void => {
    const note = translation
      ? translationNote(translation, (code) => adminErrorText(new AdminError(code)))
      : "";
    if (translation && needsReview(translation)) toast.warning(text + note, { duration: 15_000 });
    else toast.success(text + note);
  },
  error: (error: unknown): void => {
    toast.error(adminErrorText(error));
  },
};

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="admin-muted">{description}</p>}
      </div>
      {actions && <div className="admin-actions">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("admin-panel", className)}>
      {(title || actions) && (
        <div className="admin-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="admin-muted">{description}</p>}
          </div>
          {actions && <div className="admin-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...input
}: React.ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className={cn("admin-field", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") ||
          undefined
        }
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="admin-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="admin-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function AreaField({
  label,
  hint,
  className,
  ...area
}: React.ComponentProps<"textarea"> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("admin-field", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} {...area} />
      {hint && <p className="admin-hint">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  options,
  className,
  ...select
}: React.ComponentProps<"select"> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className={cn("admin-field", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="admin-select" {...select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="admin-check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="admin-hint">{hint}</p>}
      </div>
    </div>
  );
}

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  pending: { label: "Offen (Zahlung läuft)", tone: "neutral" },
  paid: { label: "Bezahlt", tone: "warn" },
  shipped: { label: "Versendet", tone: "ok" },
  cancelled: { label: "Abgebrochen", tone: "muted" },
  refunded: { label: "Zurückerstattet", tone: "muted" },
};

export const PRODUCT_STATUS = {
  active: { label: "Aktiv", tone: "ok" },
  draft: { label: "Entwurf", tone: "warn" },
  archived: { label: "Archiviert", tone: "muted" },
} as const;

export function orderStatusLabel(status: OrderStatus) {
  return STATUS[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" };
  return <span className={`admin-badge tone-${s.tone}`}>{s.label}</span>;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warn" | "danger" | "muted" | "neutral";
  children: ReactNode;
}) {
  return <span className={`admin-badge tone-${tone}`}>{children}</span>;
}

export function Loading() {
  return (
    <p className="admin-muted" role="status">
      Wird geladen …
    </p>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="admin-errorbox" role="alert">
      <p>{adminErrorText(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}

/** Knopf mit Rückfrage für Löschen und andere endgültige Schritte. */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "outline",
  size = "sm",
  disabled,
  danger = true,
}: {
  label: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  variant?: "outline" | "ghost" | "destructive" | "admin";
  size?: "sm" | "default" | "icon";
  disabled?: boolean;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant={danger ? "destructive" : "admin"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (error) {
                  notify.error(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Bitte warten …" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Zwei Spalten für Deutsch und Englisch. */
export function Bilingual({ de, en }: { de: ReactNode; en: ReactNode }) {
  return (
    <div className="admin-bilingual">
      <div>
        <p className="admin-lang">Deutsch</p>
        {de}
      </div>
      <div>
        <p className="admin-lang">English · leer lassen: wird beim Speichern übersetzt</p>
        {en}
      </div>
    </div>
  );
}
