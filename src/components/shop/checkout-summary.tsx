// Kasse auf der Warenkorbseite: Rabattcode, Gutschein, E-Mail, Beträge und Weiterleitung zu Stripe.
// Die Beträge hier sind eine Vorschau; verbindlich rechnet der Server (reserve_checkout).
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backendConfigured } from "@/lib/backend";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import type { Cart } from "@/lib/commerce";
import {
  checkDiscount,
  checkGiftCard,
  releaseCheckout,
  startCheckout,
  takePendingCheckout,
  type DiscountCheck,
} from "@/lib/commerce/checkout";
import { formatCents, formatDiscount } from "@/lib/commerce/format";
import { settingsQuery } from "@/lib/commerce/queries";
import { DEFAULT_SETTINGS, estimateTotals } from "@/lib/commerce/source";
import { clampLines, useCart } from "@/lib/commerce/stores";
import { useSession } from "@/lib/account/session";
import { FreeShippingBar } from "./free-shipping-bar";
import { DeliveryEstimate } from "./delivery-estimate";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Gutscheincode in die Schreibweise AXN-XXXX-XXXX-XXXX bringen (Leerzeichen und Kleinbuchstaben erlaubt). */
export function normalizeGiftCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^AXN[A-Z0-9]{12}$/.test(raw)
    ? `AXN-${raw.slice(3, 7)}-${raw.slice(7, 11)}-${raw.slice(11, 15)}`
    : input.trim().toUpperCase();
}

function CodeField({
  label,
  applied,
  detail,
  error,
  busy,
  onApply,
  onRemove,
}: {
  label: string;
  applied: string | null;
  detail?: string | undefined;
  error: string;
  busy: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const id = useId();
  const [value, setValue] = useState("");
  if (applied)
    return (
      <div className="code-applied">
        <Check aria-hidden="true" />
        <span>
          <strong>{applied}</strong>
          {detail && <small>{detail}</small>}
        </span>
        <Button
          variant="icon"
          size="icon"
          aria-label={`${label} ${t.checkout.removeCode}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
    );
  return (
    <form
      className="code-field"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (value.trim()) onApply(value.trim());
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="code-row">
        <input
          id={id}
          value={value}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant="tailored" disabled={busy || !value.trim()}>
          {t.checkout.apply}
        </Button>
      </div>
      {error && (
        <p className="form-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function CheckoutSummary({
  cart,
  onNotice,
}: {
  cart: Cart;
  onNotice: (text: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const id = useId();
  const { user } = useSession();
  const setQuantity = useCart((s) => s.quantity);
  const discountCode = useCart((s) => s.discountCode);
  const setDiscountCode = useCart((s) => s.setDiscountCode);
  const giftCardCode = useCart((s) => s.giftCardCode);
  const setGiftCardCode = useCart((s) => s.setGiftCardCode);
  const storedEmail = useCart((s) => s.email);
  const setStoredEmail = useCart((s) => s.setEmail);
  const { data: settings = DEFAULT_SETTINGS } = useQuery(settingsQuery());
  const subtotalCents = Math.round(cart.subtotal.amount * 100);
  const [discount, setDiscount] = useState<{ cents: number; code: string; label: string } | null>(
    null,
  );
  const [discountError, setDiscountError] = useState("");
  const [gift, setGift] = useState<{ balance: number } | null>(null);
  const [giftError, setGiftError] = useState("");
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [checkingGift, setCheckingGift] = useState(false);
  const [showCodes, setShowCodes] = useState(Boolean(discountCode || giftCardCode));
  const [email, setEmail] = useState(storedEmail);
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState(false);
  // Einwilligung zur einmaligen Erinnerung (UWG Art. 3 lit. o): standardmässig aus
  const [remind, setRemind] = useState(false);
  // Sperre gegen Doppelklick (state ist erst nach dem Rendern gesetzt)
  const paying = useRef(false);
  const [error, setError] = useState("");

  // «Zurück» von Stripe holt die Seite aus dem bfcache mit gesetztem busy: zuerst die eigene Reservierung
  // freigeben (sonst blockiert sie Bestand, Gutschein und Rabattcode bis zum Ablauf), dann Knopf freigeben.
  useEffect(() => {
    const show = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const token = takePendingCheckout();
      void (token ? releaseCheckout(token).catch(() => false) : Promise.resolve(false)).then(() => {
        paying.current = false;
        setBusy(false);
      });
    };
    window.addEventListener("pageshow", show);
    return () => window.removeEventListener("pageshow", show);
  }, []);

  const discountMessage = (r: DiscountCheck) =>
    r.reason === "min_subtotal" && r.min_subtotal_cents
      ? `${t.checkout.discountReasons["min_subtotal"]} ${t.checkout.minSubtotal(formatCents(r.min_subtotal_cents, locale))}`
      : (t.checkout.discountReasons[r.reason ?? "invalid"] ??
        t.checkout.discountReasons["invalid"]!);

  useEffect(() => setEmail((current) => current || storedEmail), [storedEmail]);

  // Rabatt hängt vom Warenwert ab: bei jeder Änderung neu prüfen.
  useEffect(() => {
    if (!discountCode || !backendConfigured) {
      setDiscount(null);
      return;
    }
    let live = true;
    setCheckingDiscount(true);
    checkDiscount(discountCode, subtotalCents)
      .then((r) => {
        if (!live) return;
        if (r.valid) {
          setDiscount({
            cents: r.discount_cents ?? 0,
            code: r.code ?? discountCode.toUpperCase(),
            // «−10 %» oder «−CHF 20.00» unter dem Code
            label:
              r.kind === "percent"
                ? formatDiscount(r.value ?? 0, locale)
                : r.kind === "amount"
                  ? `−${formatCents(r.value ?? 0, locale)}`
                  : "",
          });
          setDiscountError("");
        } else {
          setDiscount(null);
          setDiscountError(discountMessage(r));
        }
      })
      .catch(() => live && setDiscountError(t.common.networkError))
      .finally(() => live && setCheckingDiscount(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Meldungstexte ändern die Prüfung nicht
  }, [discountCode, subtotalCents]);

  useEffect(() => {
    if (!giftCardCode || !backendConfigured) {
      setGift(null);
      return;
    }
    let live = true;
    setCheckingGift(true);
    checkGiftCard(giftCardCode)
      .then((r) => {
        if (!live) return;
        if (r.valid) {
          setGift({ balance: r.balance_cents ?? 0 });
          setGiftError("");
        } else {
          setGift(null);
          setGiftError(
            t.checkout.giftCardReasons[r.reason ?? "invalid"] ??
              t.checkout.giftCardReasons["invalid"]!,
          );
        }
      })
      .catch(() => live && setGiftError(t.common.networkError))
      .finally(() => live && setCheckingGift(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Meldungstexte ändern die Prüfung nicht
  }, [giftCardCode]);

  const totals = estimateTotals(subtotalCents, discount?.cents ?? 0, gift?.balance ?? 0, settings);
  const blocked = cart.lines.some((l) => !l.variant.availableForSale);

  async function pay() {
    if (paying.current) return;
    setError("");
    setEmailError("");
    const mail = (user?.email ?? email).trim();
    if (!user && !EMAIL.test(mail)) {
      setEmailError(t.common.invalidEmail);
      return;
    }
    if (!user) setStoredEmail(mail);
    paying.current = true;
    setBusy(true);
    const result = await startCheckout({
      kind: "cart",
      lines: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      email: user ? undefined : mail,
      discountCode: discount ? discountCode : undefined,
      giftCardCode: gift ? giftCardCode : undefined,
      remind: remind ? true : undefined,
      locale,
    });
    if (result.ok) {
      // Weiter zu Stripe (oder direkt zur Bestellung, wenn der Gutschein alles deckt). busy bleibt an.
      window.location.assign(result.url);
      return;
    }
    paying.current = false;
    setBusy(false);
    switch (result.error) {
      case "OUT_OF_STOCK":
        result.items?.forEach((i) => setQuantity(i.variantId, i.available));
        onNotice(t.checkout.outOfStock);
        break;
      case "INVALID_LINES":
        // Menge über der Höchstmenge (z. B. ein älterer Warenkorb): kürzen statt eine Fehlermeldung zu zeigen
        useCart.setState((s) => ({ lines: clampLines(s.lines) }));
        onNotice(t.cart.reduced);
        break;
      case "DISCOUNT_INVALID":
        setDiscount(null);
        setDiscountError(
          t.checkout.discountReasons[result.reason ?? "invalid"] ??
            t.checkout.discountReasons["invalid"]!,
        );
        break;
      case "GIFT_CARD_INVALID":
        setGift(null);
        setGiftError(
          t.checkout.giftCardReasons[result.reason ?? "invalid"] ??
            t.checkout.giftCardReasons["invalid"]!,
        );
        break;
      case "INVALID_EMAIL":
        setEmailError(t.common.invalidEmail);
        break;
      case "NETWORK":
        setError(t.common.networkError);
        break;
      case "PAYMENTS_DISABLED":
        setError(t.checkout.notConnected);
        break;
      case "RATE_LIMITED":
      case "TOO_MANY_CHECKOUTS":
        setError(t.checkout.tooManyAttempts);
        break;
      default:
        setError(t.checkout.paymentError);
    }
  }

  const row = (label: string, value: string, className = "") => (
    <p className={className}>
      <span>{label}</span>
      <span className="price">{value}</span>
    </p>
  );

  return (
    <div className="cart-summary checkout-summary" aria-live="polite">
      <div className="checkout-codes">
        {!showCodes ? (
          <button type="button" className="text-link" onClick={() => setShowCodes(true)}>
            {t.checkout.haveCode}
          </button>
        ) : (
          <>
            <CodeField
              label={t.checkout.discountCode}
              applied={discount?.code ?? null}
              detail={discount?.label || undefined}
              error={discountError}
              busy={checkingDiscount}
              onApply={(code) => {
                setDiscountError("");
                setDiscountCode(code);
              }}
              onRemove={() => {
                setDiscountCode("");
                setDiscount(null);
                setDiscountError("");
              }}
            />
            <CodeField
              label={t.checkout.giftCardCode}
              applied={gift ? giftCardCode : null}
              detail={
                gift ? t.checkout.giftCardBalance(formatCents(gift.balance, locale)) : undefined
              }
              error={giftError}
              busy={checkingGift}
              onApply={(code) => {
                setGiftError("");
                setGiftCardCode(normalizeGiftCode(code));
              }}
              onRemove={() => {
                setGiftCardCode("");
                setGift(null);
                setGiftError("");
              }}
            />
          </>
        )}
      </div>
      <FreeShippingBar
        subtotalCents={totals.subtotalCents}
        discountCents={totals.discountCents}
        settings={settings}
      />
      <div className="checkout-totals">
        {row(t.checkout.subtotal, formatCents(totals.subtotalCents, locale))}
        {totals.discountCents > 0 &&
          row(
            `${t.checkout.discount} (${discount?.code ?? ""})`,
            `−${formatCents(totals.discountCents, locale)}`,
          )}
        {row(
          t.checkout.shipping,
          totals.shippingCents > 0 ? formatCents(totals.shippingCents, locale) : t.common.free,
          totals.shippingCents > 0 ? "" : "text-muted",
        )}
        {totals.giftCardCents > 0 &&
          row(t.checkout.giftCard, `−${formatCents(totals.giftCardCents, locale)}`)}
        {row(t.checkout.total, formatCents(totals.totalCents, locale), "checkout-total")}
      </div>
      <DeliveryEstimate className="in-checkout" />
      {totals.totalCents === 0 && (
        <p className="form-notice">
          {totals.giftCardCents > 0 ? t.checkout.giftCardCoversAll : t.checkout.nothingToPay}
        </p>
      )}
      {backendConfigured && (
        <div className="checkout-email">
          {user?.email ? (
            <p className="text-muted">{t.checkout.signedInAs(user.email)}</p>
          ) : (
            <>
              <label htmlFor={`${id}-email`}>{t.checkout.email}</label>
              <input
                id={`${id}-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                aria-invalid={Boolean(emailError)}
                aria-describedby={`${id}-email-hint`}
              />
              <small id={`${id}-email-hint`}>{t.checkout.emailHint}</small>
              {emailError && (
                <p className="form-error" role="alert">
                  {emailError}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {backendConfigured && totals.totalCents > 0 && (
        <div className="checkout-remind">
          <label className="consent" htmlFor={`${id}-remind`}>
            <input
              id={`${id}-remind`}
              type="checkbox"
              checked={remind}
              onChange={(e) => setRemind(e.target.checked)}
              aria-describedby={`${id}-remind-hint`}
            />
            <span>{t.checkout.remindMe}</span>
          </label>
          <small id={`${id}-remind-hint`}>{t.checkout.remindHint}</small>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button
        disabled={!backendConfigured || busy || blocked || checkingDiscount || checkingGift}
        onClick={pay}
      >
        {busy
          ? t.checkout.redirecting
          : totals.totalCents === 0
            ? t.checkout.placeOrder
            : t.checkout.pay}
      </Button>
      {backendConfigured ? (
        <>
          <span className="checkout-note">
            {t.checkout.terms}{" "}
            <Link to="/{-$locale}/agb" params={{ locale: lp }}>
              {t.checkout.termsLink}
            </Link>
            . {t.checkout.privacyNote}{" "}
            <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
              {t.checkout.privacyLink}
            </Link>
            .
          </span>
          <span className="checkout-note">{t.checkout.secure}</span>
        </>
      ) : (
        <span className="checkout-note">{t.checkout.notConnected}</span>
      )}
    </div>
  );
}
