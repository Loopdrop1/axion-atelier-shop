// Link für ein neues Passwort anfordern. Die Antwort ist für bekannte und unbekannte Adressen gleich.
import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { requestPasswordReset } from "@/lib/account/api";
import { Field, Notice, useProblemText } from "@/components/account/form";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const Route = createFileRoute("/{-$locale}/konto/passwort-vergessen")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const problemText = useProblemText();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!EMAIL.test(email.trim())) return setError(t.common.invalidEmail);
    setBusy(true);
    const result = await requestPasswordReset(email, locale);
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(problemText(result.problem));
  }

  return (
    <div className="account-narrow">
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.forgotTitle}</h1>
      {sent ? (
        <Notice kind="success">{t.account.forgotSent}</Notice>
      ) : (
        <>
          <p className="page-intro">{t.account.forgotIntro}</p>
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
            {error && <Notice kind="error">{error}</Notice>}
            <Button type="submit" disabled={busy}>
              {busy ? t.common.loading : t.account.forgotSend}
            </Button>
          </form>
        </>
      )}
      <p className="account-links">
        <Link className="text-link" to="/{-$locale}/konto/anmelden" params={{ locale: lp }}>
          {t.account.signIn}
        </Link>
      </p>
    </div>
  );
}
