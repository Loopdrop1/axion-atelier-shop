// Formular-Bausteine für Konto, Gutschein und Admin im Axion-Stil.
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useT } from "@/i18n";
import type { AuthProblem } from "@/lib/account/api";

/** Setzt den Fokus nach einem Validierungsfehler auf das erste ungültige Feld (nach dem nächsten Rendern). */
export function focusFirstInvalid(root: ParentNode = document) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

export function Field({
  label,
  hint,
  error,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const id = useId();
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...input} />
      {hint && (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      )}
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className = "",
  ...area
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const id = useId();
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...area} />
      {hint && (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      )}
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  options,
  className = "",
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="form-select" {...select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error";
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/** Interner Zielpfad nach Anmeldung/Bestätigung (Schutz vor Weiterleitung auf fremde Seiten). */
export function safeNext(value: unknown, fallback = "/konto"): string {
  if (typeof value !== "string") return fallback;
  const hasControl = [...value].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);
  if (!value.startsWith("/")) return fallback;
  // Erst das Sprachpräfix entfernen, dann prüfen: sonst wird «/en//host» zu «//host».
  const bare = value.replace(/^\/en(?=\/|$)/, "") || "/";
  if (!bare.startsWith("/") || bare.startsWith("//") || bare.includes("\\") || hasControl)
    return fallback;
  return bare;
}

/** Verständlicher Text zu einem Anmelde- oder Kontofehler. */
export function useProblemText() {
  const t = useT();
  return (problem: AuthProblem): string => {
    switch (problem) {
      case "invalid_credentials":
        return t.account.invalidCredentials;
      case "email_not_confirmed":
        return t.account.emailNotConfirmed;
      case "weak_password":
        return t.account.weakPassword;
      case "rate_limited":
        return t.account.rateLimited;
      case "same_password":
        return t.account.samePassword;
      case "email_exists":
        return t.account.emailExists;
      case "invalid_email":
        return t.common.invalidEmail;
      case "reauth_needed":
        return t.account.reauthNeeded;
      case "not_configured":
        return t.account.notConfigured;
      case "network":
        return t.common.networkError;
      default:
        return t.common.error;
    }
  };
}
