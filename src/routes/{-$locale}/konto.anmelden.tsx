// Anmeldung fürs Kundenkonto. Danach zurück zur Seite, von der man kam (nur interne Pfade).
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { localePrefix } from "@/i18n/locale";
import { resendConfirmation, signIn } from "@/lib/account/api";
import { useSession } from "@/lib/account/session";
import { Field, Notice, safeNext, useProblemText } from "@/components/account/form";

export const Route = createFileRoute("/{-$locale}/konto/anmelden")({
  validateSearch: (s: Record<string, unknown>): { weiter?: string | undefined } => ({
    weiter: typeof s["weiter"] === "string" ? s["weiter"] : undefined,
  }),
  component: SignInPage,
});

function SignInPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const problemText = useProblemText();
  const { weiter } = Route.useSearch();
  const { ready, user } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resend, setResend] = useState<"idle" | "busy" | "sent">("idle");
  const target = `${localePrefix(locale)}${safeNext(weiter)}`;

  // Schon angemeldet (oder gerade erfolgreich): direkt weiter.
  useEffect(() => {
    if (ready && user) void navigate({ href: target, replace: true });
  }, [ready, user, navigate, target]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setUnconfirmed(false);
    setResend("idle");
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(problemText(result.problem));
      setUnconfirmed(result.problem === "email_not_confirmed");
    }
  }

  async function sendAgain() {
    setResend("busy");
    const result = await resendConfirmation(email, locale);
    if (result.ok) return setResend("sent");
    setResend("idle");
    setError(problemText(result.problem));
  }

  return (
    <div className="account-narrow">
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.signInTitle}</h1>
      <p className="page-intro">{t.account.signInIntro}</p>
      <form className="account-form" onSubmit={submit} noValidate>
        <Field
          label={t.common.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t.common.password}
          type="password"
          maxLength={72}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Notice kind="error">{error}</Notice>}
        {unconfirmed &&
          (resend === "sent" ? (
            <Notice kind="success">{t.account.confirmationResent}</Notice>
          ) : (
            <Button
              type="button"
              variant="tailored"
              disabled={resend === "busy" || !email.trim()}
              onClick={sendAgain}
            >
              {resend === "busy" ? t.common.loading : t.account.resendConfirmation}
            </Button>
          ))}
        <Button type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? t.account.signingIn : t.account.signIn}
        </Button>
      </form>
      <p className="account-links">
        <Link
          className="text-link"
          to="/{-$locale}/konto/passwort-vergessen"
          params={{ locale: lp }}
        >
          {t.account.forgot}
        </Link>
      </p>
      <p className="account-switch">
        {t.account.noAccount}{" "}
        <Link
          className="text-link"
          to="/{-$locale}/konto/registrieren"
          params={{ locale: lp }}
          search={{ weiter }}
        >
          {t.account.register}
        </Link>
      </p>
    </div>
  );
}
