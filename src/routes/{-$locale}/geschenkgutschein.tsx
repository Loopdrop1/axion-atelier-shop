// Geschenkgutschein kaufen (Stripe-Kasse) und Guthaben prüfen. Beträge und Gültigkeit kommen aus den Shop-Einstellungen.
import { useEffect, useId, useState, type FormEvent } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { messages, toLocale, useLocale, useLocaleParam, useT } from "@/i18n";
import { backendConfigured } from "@/integrations/supabase/client";
import { checkGiftCard, releaseCheckout, startCheckout } from "@/lib/commerce/checkout";
import { formatCents, formatDate, formatFrancs } from "@/lib/commerce/format";
import { settingsQuery } from "@/lib/commerce/queries";
import { pageHead } from "@/lib/commerce/seo";
import { DEFAULT_SETTINGS } from "@/lib/commerce/source";
import { useCart } from "@/lib/commerce/stores";
import { useSession } from "@/lib/account/session";
import { Field, Notice, TextAreaField } from "@/components/account/form";
import { normalizeGiftCode } from "@/components/shop/checkout-summary";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PRESETS = [50, 100, 150, 200, 300];
const MESSAGE_MAX = 500;

export const Route = createFileRoute("/{-$locale}/geschenkgutschein")({
  validateSearch: (s: Record<string, unknown>): { abgebrochen?: string | undefined } => ({
    abgebrochen: typeof s["abgebrochen"] === "string" ? s["abgebrochen"] : undefined,
  }),
  beforeLoad: () => {
    if (!shopConfig.features.giftCards) throw notFound();
  },
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].giftCard;
    return pageHead(t.title, t.metaDescription, "/geschenkgutschein", locale);
  },
  component: GiftCardPage,
});

function GiftCardPage() {
  const t = useT();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const { abgebrochen } = Route.useSearch();
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery());
  const [cancelled, setCancelled] = useState(false);

  // Zurück aus der Stripe-Kasse ohne Zahlung: Reservierung freigeben und Adresse aufräumen.
  useEffect(() => {
    if (!abgebrochen) return;
    setCancelled(true);
    void releaseCheckout(abgebrochen);
    void navigate({
      to: "/{-$locale}/geschenkgutschein",
      params: { locale: lp },
      search: {},
      replace: true,
    });
  }, [abgebrochen, lp, navigate]);

  return (
    <div className="container page-body gift-page">
      <p className="eyebrow">{t.giftCard.eyebrow}</p>
      <h1 className="page-title">{t.giftCard.title}</h1>
      <p className="page-intro">{t.giftCard.intro(settings.giftCardValidYears)}</p>
      {cancelled && <Notice>{t.giftCard.cancelled}</Notice>}
      {!backendConfigured && <Notice>{t.giftCard.notConfigured}</Notice>}
      <GiftCardForm minCents={settings.giftCardMinCents} maxCents={settings.giftCardMaxCents} />
      <BalanceCheck />
      <p className="checkout-note">
        {t.giftCard.terms}{" "}
        <Link to="/{-$locale}/agb" params={{ locale: lp }}>
          {t.checkout.termsLink}
        </Link>
        .
      </p>
    </div>
  );
}

function GiftCardForm({ minCents, maxCents }: { minCents: number; maxCents: number }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const id = useId();
  const { user } = useSession();
  const storedEmail = useCart((s) => s.email);
  const setStoredEmail = useCart((s) => s.setEmail);
  const presets = PRESETS.filter((a) => a * 100 >= minCents && a * 100 <= maxCents);
  const [choice, setChoice] = useState<number | "custom">(
    presets.includes(100) ? 100 : (presets[0] ?? "custom"),
  );
  const [custom, setCustom] = useState("");
  const [forSomeone, setForSomeone] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(storedEmail);
  const [errors, setErrors] = useState<{
    amount?: string;
    recipientEmail?: string;
    email?: string;
  }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setEmail((current) => current || storedEmail), [storedEmail]);

  const customFrancs = /^\d{1,6}$/.test(custom.trim()) ? Number(custom.trim()) : NaN;
  const amountCents = choice === "custom" ? customFrancs * 100 : choice * 100;
  const amountValid =
    Number.isInteger(amountCents) && amountCents >= minCents && amountCents <= maxCents;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const next: typeof errors = {};
    if (!amountValid) next.amount = t.giftCard.invalidAmount;
    if (forSomeone && recipientEmail.trim() && !EMAIL.test(recipientEmail.trim()))
      next.recipientEmail = t.common.invalidEmail;
    if (!user && !EMAIL.test(email.trim())) next.email = t.common.invalidEmail;
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!user) setStoredEmail(email.trim());
    setBusy(true);
    const result = await startCheckout({
      kind: "gift_card",
      amountCents,
      recipientName: forSomeone ? recipientName.trim() || undefined : undefined,
      recipientEmail: forSomeone ? recipientEmail.trim() || undefined : undefined,
      senderName: forSomeone ? senderName.trim() || undefined : undefined,
      message: forSomeone ? message.trim() || undefined : undefined,
      email: user ? undefined : email.trim(),
      locale,
    });
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    setBusy(false);
    if (result.error === "INVALID_AMOUNT") setErrors({ amount: t.giftCard.invalidAmount });
    else if (result.error === "INVALID_EMAIL") setErrors({ email: t.common.invalidEmail });
    else if (result.error === "RATE_LIMITED" || result.error === "TOO_MANY_CHECKOUTS")
      setError(t.checkout.tooManyAttempts);
    else setError(result.error === "NETWORK" ? t.common.networkError : t.checkout.paymentError);
  }

  return (
    <div className="gift-layout">
      <form className="account-form gift-form" onSubmit={submit} noValidate>
        <fieldset className="choice-group">
          <legend>{t.giftCard.amount}</legend>
          <div className="choice-chips">
            {presets.map((francs) => (
              <label key={francs} className={`choice-chip ${choice === francs ? "selected" : ""}`}>
                <input
                  type="radio"
                  name={`${id}-amount`}
                  checked={choice === francs}
                  onChange={() => {
                    setChoice(francs);
                    setErrors(({ amount: _, ...rest }) => rest);
                  }}
                />
                {formatFrancs(francs * 100, locale)}
              </label>
            ))}
            <label className={`choice-chip ${choice === "custom" ? "selected" : ""}`}>
              <input
                type="radio"
                name={`${id}-amount`}
                checked={choice === "custom"}
                onChange={() => setChoice("custom")}
              />
              {t.giftCard.customAmount}
            </label>
          </div>
          {choice === "custom" && (
            <Field
              label={t.giftCard.customAmountLabel}
              inputMode="numeric"
              autoComplete="off"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value.replace(/[^\d]/g, ""));
                setErrors(({ amount: _, ...rest }) => rest);
              }}
              hint={t.giftCard.amountRange(
                formatCents(minCents, locale),
                formatCents(maxCents, locale),
              )}
            />
          )}
          {errors.amount && (
            <p className="form-error" role="alert">
              {errors.amount}
            </p>
          )}
        </fieldset>

        <fieldset className="choice-group">
          <legend>{t.giftCard.forWhom}</legend>
          <div className="choice-chips">
            <label className={`choice-chip ${forSomeone ? "selected" : ""}`}>
              <input
                type="radio"
                name={`${id}-for`}
                checked={forSomeone}
                onChange={() => setForSomeone(true)}
              />
              {t.giftCard.forSomeone}
            </label>
            <label className={`choice-chip ${!forSomeone ? "selected" : ""}`}>
              <input
                type="radio"
                name={`${id}-for`}
                checked={!forSomeone}
                onChange={() => setForSomeone(false)}
              />
              {t.giftCard.forMe}
            </label>
          </div>
        </fieldset>

        {forSomeone && (
          <>
            <Field
              label={t.giftCard.recipientName}
              autoComplete="off"
              maxLength={100}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            <Field
              label={t.giftCard.recipientEmail}
              type="email"
              inputMode="email"
              autoComplete="off"
              maxLength={254}
              value={recipientEmail}
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                setErrors(({ recipientEmail: _, ...rest }) => rest);
              }}
              hint={t.giftCard.recipientEmailHint}
              error={errors.recipientEmail}
            />
            <Field
              label={t.giftCard.senderName}
              autoComplete="name"
              maxLength={100}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
            <TextAreaField
              label={t.giftCard.message}
              rows={4}
              maxLength={MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              hint={t.giftCard.messageCount(message.length)}
            />
          </>
        )}

        {user?.email ? (
          <p className="text-muted">{t.checkout.signedInAs(user.email)}</p>
        ) : (
          <Field
            label={t.giftCard.buyerEmail}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors(({ email: _, ...rest }) => rest);
            }}
            error={errors.email}
          />
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <Button type="submit" disabled={!backendConfigured || busy}>
          {busy ? t.checkout.redirecting : t.giftCard.buy}
        </Button>
        <p className="checkout-note">
          {t.checkout.terms}{" "}
          <Link to="/{-$locale}/agb" params={{ locale: lp }}>
            {t.checkout.termsLink}
          </Link>
          . {t.checkout.privacyNote}{" "}
          <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
            {t.checkout.privacyLink}
          </Link>
          .
        </p>
      </form>

      <aside className="gift-preview" aria-label={t.giftCard.preview}>
        <p className="gift-preview-caption">{t.giftCard.preview}</p>
        <div className="gift-card">
          <div className="gift-card-top">
            <span className="gift-card-brand">AXION</span>
            <span className="gift-card-label">{t.giftCard.previewLabel}</span>
          </div>
          <p className="gift-card-amount">
            {amountValid ? formatCents(amountCents, locale) : "CHF —"}
          </p>
          {forSomeone && recipientName.trim() && (
            <p className="gift-card-for">{t.giftCard.previewFor(recipientName.trim())}</p>
          )}
          {forSomeone && message.trim() && <p className="gift-card-message">«{message.trim()}»</p>}
          {forSomeone && senderName.trim() && (
            <p className="gift-card-from">{t.giftCard.previewFrom(senderName.trim())}</p>
          )}
          <p className="gift-card-code">AXN-••••-••••-••••</p>
        </div>
      </aside>
    </div>
  );
}

function BalanceCheck() {
  const t = useT();
  const locale = useLocale();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await checkGiftCard(normalizeGiftCode(code));
      if (r.valid) {
        const amount = formatCents(r.balance_cents ?? 0, locale);
        setResult({
          ok: true,
          text: r.expires_at
            ? t.giftCard.balanceResult(amount, formatDate(r.expires_at, locale))
            : t.checkout.giftCardBalance(amount),
        });
      } else {
        setResult({
          ok: false,
          text:
            t.checkout.giftCardReasons[r.reason ?? "invalid"] ??
            t.checkout.giftCardReasons["invalid"]!,
        });
      }
    } catch {
      setResult({ ok: false, text: t.common.networkError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-section gift-balance">
      <h2>{t.giftCard.balanceTitle}</h2>
      <p className="text-muted">{t.giftCard.balanceIntro}</p>
      <form className="code-field" onSubmit={submit}>
        <label htmlFor="gift-balance-code" className="sr-only">
          {t.checkout.giftCardCode}
        </label>
        <div className="code-row">
          <input
            id="gift-balance-code"
            value={code}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="AXN-XXXX-XXXX-XXXX"
            onChange={(e) => setCode(e.target.value)}
          />
          <Button
            type="submit"
            variant="tailored"
            disabled={!backendConfigured || busy || !code.trim()}
          >
            {t.giftCard.balanceCheck}
          </Button>
        </div>
      </form>
      {result && <Notice kind={result.ok ? "success" : "error"}>{result.text}</Notice>}
    </section>
  );
}
