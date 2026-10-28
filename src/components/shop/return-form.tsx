// Retoure anmelden: Bestellnummer + E-Mail → Stücke, Menge und Grund wählen → anmelden (Edge Function «return-request»).
// Gastfreundlich; aus dem Kundenkonto kommt die Bestellnummer vorbelegt (?order=…) und die E-Mail-Adresse der Sitzung.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Field,
  focusFirstInvalid,
  Notice,
  SelectField,
  TextAreaField,
} from "@/components/account/form";
import { backendConfigured } from "@/lib/backend";
import { useLocale, useLocaleParam, useT, type Messages } from "@/i18n";
import { useSession } from "@/lib/account/session";
import { formatDate } from "@/lib/commerce/format";
import { imageUrl } from "@/lib/commerce/mapping";
import { sizeText } from "@/lib/commerce/one-size";
import {
  MAX_RETURN_COMMENT,
  RETURN_REASONS,
  lookupReturn,
  parseOrderNumber,
  selectionFrom,
  submitReturn,
  type Draft,
  type ReturnFailure,
  type ReturnLookup,
  type ReturnReceipt,
} from "@/lib/returns";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function problemText(r: Messages["returns"], failure: ReturnFailure, common: Messages["common"]) {
  switch (failure.problem) {
    case "notFound":
      return r.errors.notFound;
    case "windowClosed":
      return r.errors.windowClosed(failure.returnDays ?? 14);
    case "nothingReturnable":
      return r.errors.nothingReturnable;
    case "itemsNotReturnable":
      return r.errors.itemsNotReturnable;
    case "rateLimited":
      return r.errors.rateLimited;
    case "commentTooLong":
      return r.errors.commentTooLong;
    case "notConfigured":
      return r.notConfigured;
    case "network":
      return common.networkError;
    default:
      return common.error;
  }
}

export function ReturnForm({ initialOrder }: { initialOrder?: string | undefined }) {
  const t = useT();
  const r = t.returns;
  const locale = useLocale();
  const lp = useLocaleParam();
  const id = useId();
  const session = useSession();
  const [orderNumber, setOrderNumber] = useState(initialOrder ?? "");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [lookup, setLookup] = useState<ReturnLookup | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft | undefined>>({});
  const [comment, setComment] = useState("");
  const [receipt, setReceipt] = useState<ReturnReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const prefilled = useRef(false);

  // Angemeldete Kundschaft: E-Mail-Adresse des Kontos vorbelegen (einmal, nur wenn noch nichts getippt wurde).
  useEffect(() => {
    if (prefilled.current || !session.user?.email) return;
    prefilled.current = true;
    setEmail((current) => current || session.user?.email || "");
  }, [session.user?.email]);

  async function find(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (parseOrderNumber(orderNumber) === null) {
      focusFirstInvalid();
      return setError(r.errors.invalidOrderNumber);
    }
    if (!EMAIL.test(email.trim())) {
      focusFirstInvalid();
      return setError(t.common.invalidEmail);
    }
    if (!backendConfigured) return setError(r.notConfigured);
    setBusy(true);
    const result = await lookupReturn(orderNumber, email);
    setBusy(false);
    if (!result.ok) return setError(problemText(r, result, t.common));
    requestId.current = crypto.randomUUID();
    setDrafts({});
    setComment("");
    setLookup(result.data);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!lookup) return;
    setError("");
    const { error: problem, selection } = selectionFrom(lookup.items, drafts);
    if (problem) {
      focusFirstInvalid();
      return setError(problem === "noItem" ? r.errors.noItem : r.errors.noReason);
    }
    if (comment.trim().length > MAX_RETURN_COMMENT) return setError(r.errors.commentTooLong);
    setBusy(true);
    const result = await submitReturn({
      orderNumber,
      email,
      items: selection,
      comment: comment.trim(),
      locale,
      requestId: requestId.current,
      website,
    });
    setBusy(false);
    if (!result.ok) return setError(problemText(r, result, t.common));
    setReceipt(result.data);
  }

  function reset() {
    setReceipt(null);
    setLookup(null);
    setDrafts({});
    setComment("");
    setError("");
  }

  const patch = (itemId: string, change: Partial<Draft>) =>
    setDrafts((d) => ({
      ...d,
      [itemId]: { checked: false, quantity: 1, reason: "", ...d[itemId], ...change },
    }));

  if (receipt)
    return (
      <div className="return-form" aria-live="polite">
        <Notice kind="success">
          <strong>{r.doneTitle}</strong>
          <br />
          {r.done(receipt.returnNumber, `AX-${receipt.orderNumber}`)}
        </Notice>
        <p>{receipt.emailed ? r.doneMail : r.doneMailFailed}</p>
        <div className="return-actions">
          <Button type="button" variant="outline" onClick={reset}>
            {r.another}
          </Button>
          <Link className="text-link" to="/{-$locale}" params={{ locale: lp }}>
            {t.common.toHome}
          </Link>
        </div>
      </div>
    );

  // Für Menschen unsichtbar; Bots füllen es oft aus.
  const honeypot = (
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
  );

  if (!lookup)
    return (
      <form className="return-form" onSubmit={find} noValidate>
        {initialOrder && session.user && <Notice>{r.prefilled}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        <Field
          label={r.orderNumber}
          hint={r.orderNumberHint}
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          inputMode="text"
          autoComplete="off"
          placeholder="AX-10001"
          required
          aria-invalid={Boolean(error) && parseOrderNumber(orderNumber) === null}
        />
        <Field
          label={r.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error) && !EMAIL.test(email.trim())}
          required
        />
        {honeypot}
        <div className="return-actions">
          <Button type="submit" disabled={busy}>
            {busy ? r.looking : r.lookup}
          </Button>
        </div>
      </form>
    );

  return (
    <form className="return-form" onSubmit={send} noValidate>
      <div>
        <h2>{r.itemsTitle}</h2>
        <p className="text-muted">
          {r.itemsHint} {r.deadline(formatDate(lookup.deadline, locale))}
        </p>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <fieldset className="return-items">
        <legend className="sr-only">{r.itemsTitle}</legend>
        {lookup.items.map((item) => {
          const d = drafts[item.orderItemId];
          const src = imageUrl(item.image, "product-images");
          const fieldId = `${id}-${item.orderItemId}`;
          return (
            <div className="return-item" key={item.orderItemId}>
              <input
                type="checkbox"
                id={`${fieldId}-check`}
                aria-label={r.selectItem(item.title)}
                checked={d?.checked ?? false}
                onChange={(e) => patch(item.orderItemId, { checked: e.target.checked })}
              />
              {src ? (
                <img
                  className="order-line-image"
                  src={src}
                  alt=""
                  loading="lazy"
                  width={64}
                  height={80}
                />
              ) : (
                <div className="order-line-image" aria-hidden="true" />
              )}
              <div>
                <h3>
                  <label htmlFor={`${fieldId}-check`}>{item.title}</label>
                </h3>
                <p>
                  {[item.color, item.size && sizeText(item.size, t.product.size, t.product.oneSize)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {d?.checked && (
                <div className="return-item-fields">
                  {item.quantity > 1 ? (
                    <SelectField
                      label={`${r.quantity} (${r.quantityOf(item.quantity)})`}
                      value={String(d.quantity)}
                      onChange={(e) =>
                        patch(item.orderItemId, { quantity: Number(e.target.value) })
                      }
                      options={Array.from({ length: item.quantity }, (_, i) => ({
                        value: String(i + 1),
                        label: String(i + 1),
                      }))}
                    />
                  ) : (
                    <span />
                  )}
                  <div className="field">
                    <label htmlFor={`${fieldId}-reason`}>{r.reason}</label>
                    <select
                      id={`${fieldId}-reason`}
                      className="form-select"
                      value={d.reason}
                      aria-invalid={Boolean(error) && !d.reason}
                      onChange={(e) =>
                        patch(item.orderItemId, { reason: e.target.value as Draft["reason"] })
                      }
                    >
                      <option value="">{r.reasonPlaceholder}</option>
                      {RETURN_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {r.reasons[reason]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      <TextAreaField
        label={r.comment}
        hint={r.commentHint}
        rows={3}
        maxLength={MAX_RETURN_COMMENT}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <p className="text-muted">{r.privacy}</p>
      <div className="return-actions">
        <Button type="submit" disabled={busy}>
          {busy ? r.sending : r.submit}
        </Button>
        <button type="button" className="text-link" onClick={reset}>
          {r.otherOrder}
        </button>
      </div>
    </form>
  );
}
