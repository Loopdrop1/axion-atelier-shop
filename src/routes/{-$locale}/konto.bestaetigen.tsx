// Ziel der Links aus den Konto-E-Mails (auth-email-hook): /konto/bestaetigen?token_hash=…&type=…&next=…
// Bestätigt erst per Klick, damit Link-Scanner von Mailprogrammen den Einmal-Link nicht verbrauchen.
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { localePrefix } from "@/i18n/locale";
import { isOtpType, verifyEmailLink } from "@/lib/account/api";
import { Notice, safeNext } from "@/components/account/form";

interface ConfirmSearch {
  token_hash?: string | undefined;
  type?: string | undefined;
  next?: string | undefined;
}

export const Route = createFileRoute("/{-$locale}/konto/bestaetigen")({
  validateSearch: (s: Record<string, unknown>): ConfirmSearch => ({
    token_hash: typeof s["token_hash"] === "string" ? s["token_hash"] : undefined,
    type: typeof s["type"] === "string" ? s["type"] : undefined,
    next: typeof s["next"] === "string" ? s["next"] : undefined,
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const { token_hash: tokenHash, type, next } = Route.useSearch();
  const [state, setState] = useState<"idle" | "busy" | "done" | "email_change" | "invalid">(
    tokenHash && isOtpType(type) ? "idle" : "invalid",
  );
  const [error, setError] = useState("");
  const target = `${localePrefix(locale)}${safeNext(next)}`;

  async function confirm() {
    if (!tokenHash || !isOtpType(type)) return;
    setError("");
    setState("busy");
    const result = await verifyEmailLink(tokenHash, type);
    if (!result.ok) {
      if (result.problem === "network") {
        setError(t.common.networkError);
        setState("idle");
      } else setState("invalid");
      return;
    }
    if (type === "recovery") {
      void navigate({
        to: "/{-$locale}/konto/passwort-neu",
        params: { locale: lp },
        replace: true,
      });
      return;
    }
    setState(type === "email_change" ? "email_change" : "done");
  }

  return (
    <div className="account-narrow">
      <p className="eyebrow">{t.account.title}</p>
      <h1 className="page-title">{t.account.confirmTitle}</h1>
      {state === "invalid" ? (
        <>
          <Notice kind="error">{t.account.confirmInvalid}</Notice>
          <p className="account-links">
            <Link className="text-link" to="/{-$locale}/konto/anmelden" params={{ locale: lp }}>
              {t.account.signIn}
            </Link>
            <Link
              className="text-link"
              to="/{-$locale}/konto/passwort-vergessen"
              params={{ locale: lp }}
            >
              {t.account.forgot}
            </Link>
          </p>
        </>
      ) : state === "done" || state === "email_change" ? (
        <>
          <Notice kind="success">
            {state === "email_change" ? t.account.confirmEmailChangeDone : t.account.confirmDone}
          </Notice>
          <Button onClick={() => void navigate({ href: target, replace: true })}>
            {t.common.continue}
          </Button>
        </>
      ) : (
        <>
          <p className="page-intro">{t.account.confirmIntro}</p>
          {error && <Notice kind="error">{error}</Notice>}
          <Button onClick={confirm} disabled={state === "busy"}>
            {state === "busy"
              ? t.common.loading
              : type === "recovery"
                ? t.account.confirmRecoveryButton
                : t.account.confirmButton}
          </Button>
        </>
      )}
    </div>
  );
}
