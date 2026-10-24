// «Benachrichtigen, wenn wieder da» für ausverkaufte Grössen (Double Opt-in über die Edge Function «stock-alert»).
// Die Antwort verrät nie, ob eine Adresse schon eingetragen ist.
import { useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { focusFirstInvalid } from "@/components/account/form";
import { backendConfigured } from "@/lib/backend";
import { callFunction } from "@/integrations/supabase/functions";
import type { Product } from "@/lib/commerce";
import { oneSizeVariant } from "@/lib/commerce/one-size";
import { useLocale, useLocaleParam, useT } from "@/i18n";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function StockAlertForm({ product }: { product: Product }) {
  const t = useT();
  const s = t.product.stockAlert;
  const locale = useLocale();
  const lp = useLocaleParam();
  const id = useId();
  const soldOut = product.variants.filter((v) => !v.availableForSale);
  const [variantId, setVariantId] = useState(soldOut.length === 1 ? soldOut[0]!.id : "");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  if (!soldOut.length) return null;
  const single = oneSizeVariant(product);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!variantId) {
      focusFirstInvalid();
      return setError(s.chooseSize);
    }
    if (!EMAIL.test(email.trim())) {
      focusFirstInvalid();
      return setError(t.common.invalidEmail);
    }
    if (!backendConfigured) return setError(s.notConfigured);
    setState("sending");
    const result = await callFunction<{ ok: true }>("stock-alert", {
      action: "request",
      variantId,
      email: email.trim(),
      locale,
      website,
    });
    if (result.ok) return setState("sent");
    setState("idle");
    setError(
      result.status === 429
        ? s.rateLimited
        : result.error === "IN_STOCK"
          ? s.inStock
          : result.error === "INVALID_EMAIL"
            ? t.common.invalidEmail
            : result.error === "NETWORK"
              ? t.common.networkError
              : t.common.error,
    );
  }

  return (
    <details className="stock-alert">
      <summary>{s.toggle}</summary>
      {state === "sent" ? (
        <p className="newsletter-done" role="status">
          {s.sent}
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          {!single && soldOut.length > 1 && (
            <>
              <label htmlFor={`${id}-size`}>{s.size}</label>
              <select
                id={`${id}-size`}
                value={variantId}
                aria-invalid={Boolean(error) && !variantId}
                onChange={(e) => setVariantId(e.target.value)}
              >
                <option value="">{s.chooseSize}</option>
                {soldOut.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor={`${id}-email`}>{s.email}</label>
          <div className="newsletter-row">
            <input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error) && !EMAIL.test(email.trim())}
              aria-describedby={error ? `${id}-error` : `${id}-note`}
            />
            <Button type="submit" disabled={state === "sending"}>
              {state === "sending" ? t.newsletter.sending : s.submit}
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
          <p className="stock-alert-note" id={`${id}-note`}>
            {s.note}{" "}
            <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
              {t.newsletter.privacy}
            </Link>
          </p>
          {error && (
            <p className="form-error" id={`${id}-error`} role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </details>
  );
}
