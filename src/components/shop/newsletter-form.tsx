// Newsletter-Anmeldung mit Einwilligung (Double Opt-in über die Edge Function «newsletter»).
// Die Antwort verrät nie, ob eine Adresse schon eingetragen ist.
import { useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { focusFirstInvalid } from "@/components/account/form";
import { backendConfigured } from "@/lib/backend";
import { callFunction } from "@/integrations/supabase/functions";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { useShopSettings } from "@/lib/commerce/use-settings";

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
  // Im Footer steht der Rabatt im Text darüber; an anderen Orten direkt beim Formular.
  const { newsletterWelcomePercent } = useShopSettings();
  const [email, setEmail] = useState(initialEmail);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  // Welches Feld den Fehler verursacht hat, für aria-invalid.
  const [errorField, setErrorField] = useState<"email" | "consent" | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setErrorField(null);
    if (!EMAIL.test(email.trim())) {
      setErrorField("email");
      focusFirstInvalid();
      return setError(t.common.invalidEmail);
    }
    if (!consent) {
      setErrorField("consent");
      focusFirstInvalid();
      return setError(t.newsletter.consentRequired);
    }
    if (!backendConfigured) return setError(t.newsletter.notConfigured);
    setState("sending");
    const result = await callFunction<{ ok: true }>("newsletter", {
      action: "subscribe",
      email: email.trim(),
      // Wortlaut und Version legt der Server fest.
      consent: true,
      locale,
      source,
      website,
    });
    if (result.ok) {
      setState("sent");
      return;
    }
    setState("idle");
    if (result.error === "INVALID_EMAIL") setErrorField("email");
    if (result.error === "CONSENT_REQUIRED") setErrorField("consent");
    if (result.error === "INVALID_EMAIL" || result.error === "CONSENT_REQUIRED")
      focusFirstInvalid();
    setError(
      result.status === 429
        ? t.newsletter.rateLimited
        : result.error === "INVALID_EMAIL"
          ? t.common.invalidEmail
          : result.error === "CONSENT_REQUIRED"
            ? t.newsletter.consentRequired
            : result.error === "NETWORK"
              ? t.common.networkError
              : t.common.error,
    );
  }

  if (state === "sent") {
    return (
      <p className="newsletter-done" role="status" tabIndex={-1} ref={(el) => el?.focus()}>
        {t.newsletter.sent}
      </p>
    );
  }

  return (
    <form className={`newsletter-form ${dark ? "on-dark" : ""}`} onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={`${id}-email`}>
        {t.newsletter.label}
      </label>
      {source !== "footer" && newsletterWelcomePercent ? (
        <p className="newsletter-perk">{t.footer.welcomeOffer(newsletterWelcomePercent)}</p>
      ) : null}
      <div className="newsletter-row">
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t.newsletter.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={errorField === "email"}
          aria-describedby={errorField === "email" ? `${id}-error` : undefined}
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
          aria-invalid={errorField === "consent"}
          aria-describedby={errorField === "consent" ? `${id}-error` : undefined}
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
