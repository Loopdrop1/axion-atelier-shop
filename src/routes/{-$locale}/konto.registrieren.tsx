// Konto erstellen. Supabase schickt (über den Send Email Hook) einen Bestätigungslink.
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { localePrefix } from "@/i18n/locale";
import { MIN_PASSWORD, signUp } from "@/lib/account/api";
import { useSession } from "@/lib/account/session";
import { Field, Notice, safeNext, useProblemText } from "@/components/account/form";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const Route = createFileRoute("/{-$locale}/konto/registrieren")({
  validateSearch: (s: Record<string, unknown>): { weiter?: string | undefined } => ({
    weiter: typeof s["weiter"] === "string" ? s["weiter"] : undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const problemText = useProblemText();
  const { weiter } = Route.useSearch();
  const { ready, user } = useSession();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    repeat: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const target = `${localePrefix(locale)}${safeNext(weiter)}`;

  useEffect(() => {
    if (ready && user) void navigate({ href: target, replace: true });
  }, [ready, user, navigate, target]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const next: typeof errors = {};
    if (!form.firstName.trim()) next.firstName = t.common.required;
    if (!form.lastName.trim()) next.lastName = t.common.required;
    if (!EMAIL.test(form.email.trim())) next.email = t.common.invalidEmail;
    if (form.password.length < MIN_PASSWORD) next.password = t.account.passwordTooShort;
    else if (form.password !== form.repeat) next.repeat = t.account.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const result = await signUp({
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      locale,
    });
    setBusy(false);
    if (!result.ok) return setError(problemText(result.problem));
    // Mit E-Mail-Bestätigung (Standard) gibt es noch keine Sitzung: Hinweis zeigen.
    if (!result.signedIn) setSent(true);
  }

  if (sent)
    return (
      <div className="account-narrow">
        <p className="eyebrow">{t.account.title}</p>
        <h1 className="page-title">{t.account.registerTitle}</h1>
        <Notice kind="success">{t.account.registered}</Notice>
      </div>
    );

  return (
    <div className="account-narrow">
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.registerTitle}</h1>
      <p className="page-intro">{t.account.registerIntro}</p>
      <form className="account-form" onSubmit={submit} noValidate>
        <div className="field-row">
          <Field
            label={t.account.firstName}
            autoComplete="given-name"
            required
            maxLength={100}
            value={form.firstName}
            onChange={set("firstName")}
            error={errors.firstName}
          />
          <Field
            label={t.account.lastName}
            autoComplete="family-name"
            required
            maxLength={100}
            value={form.lastName}
            onChange={set("lastName")}
            error={errors.lastName}
          />
        </div>
        <Field
          label={t.common.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <Field
          label={t.common.password}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={t.account.passwordHint}
          value={form.password}
          onChange={set("password")}
          error={errors.password}
        />
        <Field
          label={t.account.passwordRepeat}
          type="password"
          autoComplete="new-password"
          required
          value={form.repeat}
          onChange={set("repeat")}
          error={errors.repeat}
        />
        <p className="checkout-note">
          {t.checkout.privacyNote}{" "}
          <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
            {t.checkout.privacyLink}
          </Link>
          .
        </p>
        {error && <Notice kind="error">{error}</Notice>}
        <Button type="submit" disabled={busy}>
          {busy ? t.common.loading : t.account.register}
        </Button>
      </form>
      <p className="account-switch">
        {t.account.haveAccount}{" "}
        <Link
          className="text-link"
          to="/{-$locale}/konto/anmelden"
          params={{ locale: lp }}
          search={{ weiter }}
        >
          {t.account.signIn}
        </Link>
      </p>
    </div>
  );
}
