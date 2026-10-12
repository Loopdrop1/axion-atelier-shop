// Bestätigen oder Abmelden per Klick (Links aus den Newsletter-E-Mails). Erst der Klick löst die Aktion aus,
// damit Link-Scanner von Mailprogrammen nichts bestätigen oder abmelden.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { backendConfigured } from "@/integrations/supabase/client";
import { callFunction } from "@/integrations/supabase/functions";
import { useLocaleParam, useT } from "@/i18n";
import { Notice } from "@/components/account/form";

type Status = "confirmed" | "unsubscribed" | "invalid";

export function NewsletterAction({
  action,
  token,
}: {
  action: "confirm" | "unsubscribe";
  token: string | undefined;
}) {
  const t = useT();
  const lp = useLocaleParam();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(token ? null : "invalid");
  const [error, setError] = useState("");
  const confirm = action === "confirm";

  async function run() {
    if (!token) return;
    setError("");
    setBusy(true);
    const result = await callFunction<{ status: Status }>("newsletter", { action, token });
    setBusy(false);
    if (result.ok) setStatus(result.data.status);
    else setError(result.error === "NETWORK" ? t.common.networkError : t.common.error);
  }

  const done =
    status === "invalid"
      ? { kind: "error" as const, text: t.newsletter.invalid }
      : status === "confirmed"
        ? { kind: "success" as const, text: t.newsletter.confirmed }
        : status === "unsubscribed"
          ? {
              kind: confirm ? ("info" as const) : ("success" as const),
              text: confirm ? t.newsletter.alreadyUnsubscribed : t.newsletter.unsubscribed,
            }
          : null;

  return (
    <div className="container page-body account-narrow">
      <p className="eyebrow">{t.footer.newsletterTitle}</p>
      <h1 className="page-title">
        {confirm ? t.newsletter.confirmTitle : t.newsletter.unsubscribeTitle}
      </h1>
      {!backendConfigured ? (
        <Notice>{t.newsletter.notConfigured}</Notice>
      ) : done ? (
        <>
          <Notice kind={done.kind}>{done.text}</Notice>
          <div className="empty-links justify-start">
            <Button asChild>
              <Link to="/{-$locale}" params={{ locale: lp }}>
                {t.common.toHome}
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="page-intro">
            {confirm ? t.newsletter.confirmIntro : t.newsletter.unsubscribeIntro}
          </p>
          {error && <Notice kind="error">{error}</Notice>}
          <Button onClick={run} disabled={busy} variant={confirm ? "default" : "tailored"}>
            {busy
              ? t.common.loading
              : confirm
                ? t.newsletter.confirmButton
                : t.newsletter.unsubscribeButton}
          </Button>
        </>
      )}
    </div>
  );
}
