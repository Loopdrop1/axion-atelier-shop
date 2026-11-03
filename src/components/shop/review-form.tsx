// Bewertung schreiben: Link aus der Versandmeldung (/bewertung/<schlüssel>) → Stücke der Bestellung → Sterne
// (Radiogruppe), Titel, Text und Anzeigename → Edge Function «review». Die Bewertung erscheint erst nach Freigabe.
import { useId, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, focusFirstInvalid, Notice, TextAreaField } from "@/components/account/form";
import { backendConfigured } from "@/lib/backend";
import { useLocale, useLocaleParam, useT, type Messages } from "@/i18n";
import { imageUrl } from "@/lib/commerce/mapping";
import { sizeText } from "@/lib/commerce/one-size";
import {
  REVIEW_LIMITS,
  lookupReview,
  reviewErrors,
  submitReview,
  type ReviewDraft,
  type ReviewItem,
  type ReviewProblem,
} from "@/lib/reviews";

function problemText(problem: ReviewProblem, r: Messages["reviews"], common: Messages["common"]) {
  switch (problem) {
    case "invalid":
    case "itemNotReviewable":
      return r.invalid;
    case "disabled":
      return r.disabled;
    case "duplicate":
      return r.duplicate;
    case "rateLimited":
      return r.rateLimited;
    case "notConfigured":
      return r.notConfigured;
    case "network":
      return common.networkError;
    default:
      return common.error;
  }
}

const EMPTY: ReviewDraft = { rating: 0, title: "", body: "", displayName: "" };

/** Sterne als Radiogruppe: Pfeiltasten wählen, jede Option sagt «n von 5 Sternen». */
function StarInput({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (n: number) => void;
  error?: string | undefined;
}) {
  const t = useT();
  const id = useId();
  return (
    <fieldset className="star-input" aria-describedby={error ? `${id}-error` : undefined}>
      <legend>{t.reviews.rating}</legend>
      <div className="star-input-options">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n <= value ? "is-on" : undefined}>
            <input
              type="radio"
              name={`${id}-rating`}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-invalid={error ? true : undefined}
            />
            <Star aria-hidden="true" size={28} />
            <span className="sr-only">{t.reviews.stars(n)}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ReviewForm({ token }: { token: string }) {
  const t = useT();
  const r = t.reviews;
  const locale = useLocale();
  const lp = useLocaleParam();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const pickId = useId();

  const lookup = useQuery({
    queryKey: ["review-lookup", token],
    queryFn: async () => {
      const result = await lookupReview(token);
      if (!result.ok) return { problem: result.problem } as const;
      return { data: result.data } as const;
    },
    enabled: backendConfigured,
    staleTime: Infinity,
    retry: false,
  });

  if (!backendConfigured) return <Notice>{r.notConfigured}</Notice>;
  if (lookup.isLoading) return <p className="text-muted">{t.common.loading}</p>;
  if (lookup.isError || !lookup.data) return <Notice kind="error">{t.common.error}</Notice>;
  if ("problem" in lookup.data)
    return <Notice kind="error">{problemText(lookup.data.problem, r, t.common)}</Notice>;

  const list = items ?? lookup.data.data.items;
  const open = list.filter((i) => !i.reviewed);
  const current = open.find((i) => i.orderItemId === selected) ?? open[0];
  const errors = shown ? reviewErrors(draft) : [];
  const set = (key: keyof ReviewDraft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    setShown(true);
    setError("");
    setSent(false);
    if (reviewErrors(draft).length) {
      focusFirstInvalid(formRef.current ?? document);
      return;
    }
    setBusy(true);
    const result = await submitReview(token, current.orderItemId, draft, locale);
    setBusy(false);
    if (!result.ok) {
      setError(problemText(result.problem, r, t.common));
      return;
    }
    setItems(result.data.items);
    setDraft(EMPTY);
    setShown(false);
    setSelected("");
    setSent(true);
  }

  return (
    <div className="review-form">
      <p className="text-muted">{r.order(`AX-${lookup.data.data.orderNumber}`)}</p>
      {sent && <Notice kind="success">{r.sent}</Notice>}
      {list.length === 0 ? (
        <Notice>{r.nothing}</Notice>
      ) : !current ? (
        <>
          <Notice kind="success">{r.allDone}</Notice>
          <div className="empty-links justify-start">
            <Button asChild>
              <Link to="/{-$locale}" params={{ locale: lp }}>
                {t.common.toHome}
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <form ref={formRef} className="return-form" onSubmit={send} noValidate>
          <fieldset className="return-items">
            <legend className="sr-only">{r.choose}</legend>
            {list.map((item) => {
              const src = imageUrl(item.image, "product-images");
              const inputId = `${pickId}-${item.orderItemId}`;
              return (
                <div className="return-item" key={item.orderItemId}>
                  <input
                    type="radio"
                    id={inputId}
                    name={`${pickId}-item`}
                    checked={item.orderItemId === current.orderItemId}
                    disabled={item.reviewed}
                    onChange={() => setSelected(item.orderItemId)}
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
                      <label htmlFor={inputId}>{item.title}</label>
                    </h3>
                    <p>
                      {[
                        item.color,
                        item.size && sizeText(item.size, t.product.size, t.product.oneSize),
                        item.reviewed ? r.reviewed : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </fieldset>
          <StarInput
            value={draft.rating}
            onChange={(rating) => setDraft((d) => ({ ...d, rating }))}
            error={errors.includes("rating") ? r.ratingRequired : undefined}
          />
          <Field
            label={r.reviewTitle}
            value={draft.title}
            onChange={set("title")}
            maxLength={REVIEW_LIMITS.title}
            autoComplete="off"
          />
          <TextAreaField
            label={r.body}
            hint={r.bodyHint(REVIEW_LIMITS.bodyMin, REVIEW_LIMITS.body)}
            value={draft.body}
            onChange={set("body")}
            maxLength={REVIEW_LIMITS.body}
            rows={6}
            required
            error={errors.includes("body") ? r.bodyTooShort(REVIEW_LIMITS.bodyMin) : undefined}
          />
          <Field
            label={r.displayName}
            hint={r.displayNameHint}
            value={draft.displayName}
            onChange={set("displayName")}
            maxLength={REVIEW_LIMITS.displayName}
            autoComplete="off"
            required
            error={errors.includes("displayName") ? r.displayNameRequired : undefined}
          />
          <p className="text-muted review-consent">
            {r.consent}{" "}
            <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
              {r.privacy}
            </Link>
          </p>
          {error && <Notice kind="error">{error}</Notice>}
          <div className="return-actions">
            <Button type="submit" disabled={busy}>
              {busy ? r.sending : r.submit}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
