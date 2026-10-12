// Newsletter-Anmeldung mit Einwilligung (Double Opt-in über die Edge Function «newsletter»).
// Die Antwort verrät nie, ob eine Adresse schon eingetragen ist.
import { useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { backendConfigured } from "@/integrations/supabase/client";
import { callFunction } from "@/integrations/supabase/functions";
import { useLocale, useLocaleParam, useT } from "@/i18n";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function NewsletterForm({
  source = "footer",
  dark = false,
  initialEmail = "",
}: {
  source?: "footer" | "account";
  dark?: boolean;
  /** Im Konto: eigene Adresse vorausfüllen */
  initialEmail?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!EMAIL.test(email.trim())) return setError(t.common.invalidEmail);
    if (!consent) return setError(t.newsletter.consentRequired);
    if (!backendConfigured) return setError(t.newsletter.notConfigured);
    setState("sending");
    const result = await callFunction<{ ok: true }>("newsletter", {
      action: "subscribe",
      email: email.trim(),
      consent: t.newsletter.consent,
      locale,
      source,
      website,
    });
    if (result.ok) {
      setState("sent");
      return;
    }
    setState("idle");
    setError(
      result.status === 429
        ? t.newsletter.rateLimited
        : result.error === "INVALID_EMAIL"
          ? t.common.invalidEmail
          : result.error === "NETWORK"
            ? t.common.networkError
            : t.common.error,
    );
  }

  if (state === "sent") {
    return (
      <p className="newsletter-done" role="status">
        {t.newsletter.sent}
      </p>
    );
  }

  return (
    <form className={`newsletter-form ${dark ? "on-dark" : ""}`} onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={`${id}-email`}>
        {t.newsletter.label}
      </label>
      <div className="newsletter-row">
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t.newsletter.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error) && !EMAIL.test(email.trim())}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant={dark ? "dark" : "default"} disabled={state === "sending"}>
          {state === "sending" ? t.newsletter.sending : t.newsletter.submit}
        </Button>
      </div>
      {/* Für Menschen unsichtbar; Bots füllen es oft aus. */}
      <div className="hp-field" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <label className="consent" htmlFor={`${id}-consent`}>
        <input
          id={`${id}-consent`}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {t.newsletter.consent}{" "}
          <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
            {t.newsletter.privacy}
          </Link>
        </span>
      </label>
      {error && (
        <p className="form-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
