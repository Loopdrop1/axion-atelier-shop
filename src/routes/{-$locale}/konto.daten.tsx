// Persönliche Angaben, Adresse, E-Mail, Passwort und Konto löschen.
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useLocaleParam, useT, messages, toLocale } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import {
  changeEmail,
  deleteMyAccount,
  getProfile,
  MIN_PASSWORD,
  updatePassword,
  updateProfile,
  type Profile,
} from "@/lib/account/api";
import { Field, Notice, SelectField, useProblemText } from "@/components/account/form";
import { useRequireSession } from "@/components/account/use-require-session";
import { useSignOut } from "@/components/account/use-sign-out";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const Route = createFileRoute("/{-$locale}/konto/daten")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].account;
    return pageHead(t.data, t.metaDescription, "/konto/daten", locale, { noindex: true });
  },
  component: AccountDataPage,
});

function AccountDataPage() {
  const t = useT();
  const lp = useLocaleParam();
  const [deleted, setDeleted] = useState(false);
  const { ready, user } = useRequireSession({ redirect: !deleted });
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  });

  if (deleted)
    return (
      <div className="account-narrow">
        <h1 className="page-title">{t.account.deleteTitle}</h1>
        <Notice kind="success">{t.account.deleted}</Notice>
        <Button asChild>
          <Link to="/{-$locale}" params={{ locale: lp }}>
            {t.common.toHome}
          </Link>
        </Button>
      </div>
    );
  if (!ready || !user || profile.isLoading) return <p role="status">{t.common.loading}</p>;
  return (
    <>
      <Link className="text-link account-back" to="/{-$locale}/konto" params={{ locale: lp }}>
        <ArrowLeft aria-hidden="true" /> {t.account.orderBack}
      </Link>
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.data}</h1>
      <p className="page-intro">{t.account.dataIntro}</p>
      {profile.isError ? (
        <Notice kind="error">{t.common.error}</Notice>
      ) : (
        <ProfileForm userId={user.id} initial={profile.data ?? null} />
      )}
      <EmailForm current={user.email ?? ""} pending={user.new_email ?? ""} />
      <PasswordForm />
      <DeleteAccount onDeleted={() => setDeleted(true)} />
    </>
  );
}

function ProfileForm({ userId, initial }: { userId: string; initial: Profile | null }) {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    phone: initial?.phone ?? "",
    line1: initial?.address?.line1 ?? "",
    line2: initial?.address?.line2 ?? "",
    postal_code: initial?.address?.postal_code ?? "",
    city: initial?.address?.city ?? "",
    country: initial?.address?.country === "LI" ? "LI" : "CH",
    locale: initial?.locale === "en" ? "en" : initial ? "de" : locale,
  }));
  const [postalError, setPostalError] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setState("idle");
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const postal = form.postal_code.trim();
    if (postal && !/^\d{4}$/.test(postal)) return setPostalError(t.account.invalidPostalCode);
    setPostalError("");
    setState("busy");
    const hasAddress = [form.line1, form.line2, postal, form.city].some((v) => v.trim());
    const next: Profile = {
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      address: hasAddress
        ? {
            line1: form.line1.trim(),
            line2: form.line2.trim(),
            postal_code: postal,
            city: form.city.trim(),
            country: form.country,
          }
        : null,
      locale: form.locale,
    };
    const result = await updateProfile(userId, next);
    setState(result.ok ? "saved" : "error");
    if (result.ok) void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <section className="account-section">
      <h2>{t.account.profile}</h2>
      <form className="account-form" onSubmit={submit} noValidate>
        <div className="field-row">
          <Field
            label={t.account.firstName}
            autoComplete="given-name"
            maxLength={100}
            value={form.first_name}
            onChange={set("first_name")}
          />
          <Field
            label={t.account.lastName}
            autoComplete="family-name"
            maxLength={100}
            value={form.last_name}
            onChange={set("last_name")}
          />
        </div>
        <Field
          label={t.account.phone}
          type="tel"
          autoComplete="tel"
          maxLength={30}
          value={form.phone}
          onChange={set("phone")}
        />
        <h3>{t.account.address}</h3>
        <Field
          label={t.account.street}
          autoComplete="address-line1"
          maxLength={200}
          value={form.line1}
          onChange={set("line1")}
        />
        <Field
          label={t.account.addressLine2}
          autoComplete="address-line2"
          maxLength={200}
          value={form.line2}
          onChange={set("line2")}
        />
        <div className="field-row field-row-postal">
          <Field
            label={t.account.postalCode}
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={4}
            value={form.postal_code}
            onChange={set("postal_code")}
            error={postalError || undefined}
          />
          <Field
            label={t.account.city}
            autoComplete="address-level2"
            maxLength={100}
            value={form.city}
            onChange={set("city")}
          />
        </div>
        <SelectField
          label={t.account.country}
          autoComplete="country"
          value={form.country}
          onChange={set("country")}
          options={["CH", "LI"].map((c) => ({ value: c, label: t.account.countries[c] ?? c }))}
        />
        <SelectField
          label={t.account.emailLanguage}
          value={form.locale}
          onChange={set("locale")}
          options={["de", "en"].map((l) => ({ value: l, label: t.account.languages[l] ?? l }))}
        />
        {state === "saved" && <Notice kind="success">{t.common.saved}</Notice>}
        {state === "error" && <Notice kind="error">{t.common.error}</Notice>}
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? t.common.loading : t.common.save}
        </Button>
      </form>
    </section>
  );
}

function EmailForm({ current, pending }: { current: string; pending: string }) {
  const t = useT();
  const locale = useLocale();
  const problemText = useProblemText();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">(pending ? "sent" : "idle");
  const [error, setError] = useState("");
  useEffect(() => {
    if (pending) setState("sent");
  }, [pending]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const next = email.trim();
    if (!EMAIL.test(next) || next.toLowerCase() === current.toLowerCase())
      return setError(t.common.invalidEmail);
    setState("busy");
    const result = await changeEmail(next, locale);
    if (result.ok) return setState("sent");
    setState("idle");
    setError(problemText(result.problem));
  }

  return (
    <section className="account-section">
      <h2>{t.account.changeEmail}</h2>
      <p className="text-muted">{t.checkout.signedInAs(current)}</p>
      {state === "sent" ? (
        <>
          <Notice kind="success">
            {t.account.changeEmailSent} {pending || email}
          </Notice>
          <Button type="button" variant="outline" onClick={() => setState("idle")}>
            {t.account.changeEmailOther}
          </Button>
        </>
      ) : (
        <form className="account-form" onSubmit={submit} noValidate>
          <p className="text-muted">{t.account.changeEmailIntro}</p>
          <Field
            label={t.account.newEmail}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error || undefined}
          />
          <Button type="submit" variant="tailored" disabled={state === "busy" || !email.trim()}>
            {state === "busy" ? t.common.loading : t.account.changeEmail}
          </Button>
        </form>
      )}
    </section>
  );
}

function PasswordForm() {
  const t = useT();
  const problemText = useProblemText();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD) next.password = t.account.passwordTooShort;
    if (password !== repeat) next.repeat = t.account.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length) return;
    setState("busy");
    const result = await updatePassword(password);
    if (result.ok) {
      setPassword("");
      setRepeat("");
      return setState("saved");
    }
    setState("idle");
    setError(problemText(result.problem));
  }

  return (
    <section className="account-section">
      <h2>{t.account.changePassword}</h2>
      <form className="account-form" onSubmit={submit} noValidate>
        <Field
          label={t.common.password}
          type="password"
          maxLength={72}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          hint={t.account.passwordHint}
          value={password}
          onChange={(e) => {
            setState("idle");
            setPassword(e.target.value);
          }}
          error={errors.password}
        />
        <Field
          label={t.account.passwordRepeat}
          type="password"
          maxLength={72}
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={errors.repeat}
        />
        {state === "saved" && <Notice kind="success">{t.account.newPasswordSaved}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        <Button type="submit" variant="tailored" disabled={state === "busy"}>
          {state === "busy" ? t.common.loading : t.account.changePassword}
        </Button>
      </form>
    </section>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const t = useT();
  const locale = useLocale();
  const signOut = useSignOut();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches =
    word.trim().toLocaleUpperCase(locale === "en" ? "en" : "de-CH") === t.account.deleteConfirmWord;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!matches) return setError(t.account.deleteConfirmMismatch);
    setBusy(true);
    const result = await deleteMyAccount();
    setBusy(false);
    if (result.ok) {
      onDeleted();
      await signOut();
      return;
    }
    setError(
      result.error === "LAST_ADMIN"
        ? t.account.lastAdmin
        : result.error === "NETWORK"
          ? t.common.networkError
          : t.common.error,
    );
  }

  return (
    <section className="account-section account-danger">
      <h2>{t.account.deleteTitle}</h2>
      <p className="text-muted">{t.account.deleteText}</p>
      <form className="account-form" onSubmit={submit} noValidate>
        <Field
          label={t.account.deleteConfirmLabel}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          error={error || undefined}
        />
        <Button
          type="submit"
          variant="tailored"
          className="button-danger"
          disabled={busy || !matches}
        >
          {busy ? t.common.loading : t.account.deleteButton}
        </Button>
      </form>
    </section>
  );
}
