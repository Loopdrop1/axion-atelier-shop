// Neues Passwort nach dem Link aus «Passwort vergessen» (die Bestätigungsseite hat die Sitzung schon gesetzt).
import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocaleParam, useT } from "@/i18n";
import { MIN_PASSWORD, updatePassword } from "@/lib/account/api";
import { useSession } from "@/lib/account/session";
import { Field, Notice, useProblemText } from "@/components/account/form";

export const Route = createFileRoute("/{-$locale}/konto/passwort-neu")({
  component: NewPasswordPage,
});

function NewPasswordPage() {
  const t = useT();
  const lp = useLocaleParam();
  const problemText = useProblemText();
  const { ready, user } = useSession();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD) next.password = t.account.passwordTooShort;
    if (password !== repeat) next.repeat = t.account.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.ok) setSaved(true);
    else setError(problemText(result.problem));
  }

  return (
    <div className="account-narrow">
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.newPasswordTitle}</h1>
      {!ready ? (
        <p role="status">{t.common.loading}</p>
      ) : saved ? (
        <>
          <Notice kind="success">{t.account.newPasswordSaved}</Notice>
          <Button asChild>
            <Link to="/{-$locale}/konto" params={{ locale: lp }}>
              {t.order.toAccount}
            </Link>
          </Button>
        </>
      ) : !user ? (
        <>
          <Notice kind="error">{t.account.newPasswordNoSession}</Notice>
          <p className="account-links">
            <Link
              className="text-link"
              to="/{-$locale}/konto/passwort-vergessen"
              params={{ locale: lp }}
            >
              {t.account.forgotTitle}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="page-intro">{t.account.newPasswordIntro}</p>
          <form className="account-form" onSubmit={submit} noValidate>
            <Field
              label={t.common.password}
              type="password"
              maxLength={72}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              hint={t.account.passwordHint}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <Field
              label={t.account.passwordRepeat}
              type="password"
              maxLength={72}
              autoComplete="new-password"
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              error={errors.repeat}
            />
            {error && <Notice kind="error">{error}</Notice>}
            <Button type="submit" disabled={busy}>
              {busy ? t.common.loading : t.account.newPasswordSave}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
