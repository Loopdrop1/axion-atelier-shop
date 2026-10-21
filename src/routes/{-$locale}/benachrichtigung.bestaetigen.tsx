// Link aus der «Wieder da»-Bestätigungsmail (Token: 48 Hex-Zeichen, siehe supabase/functions/stock-alert):
// /benachrichtigung/bestaetigen?token=… (mit /en davor auf Englisch). Erst der Klick bestätigt (Link-Scanner).
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/account/form";
import { backendConfigured } from "@/lib/backend";
import { callFunction } from "@/integrations/supabase/functions";
import { messages, toLocale, useLocaleParam, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";

export const Route = createFileRoute("/{-$locale}/benachrichtigung/bestaetigen")({
  validateSearch: (s: Record<string, unknown>): { token?: string | undefined } => ({
    token:
      typeof s["token"] === "string" && /^[0-9a-f]{48}$/i.test(s["token"]) ? s["token"] : undefined,
  }),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].product.stockAlert;
    return pageHead(t.confirmTitle, t.confirmIntro, "/benachrichtigung/bestaetigen", locale, {
      noindex: true,
    });
  },
  component: Page,
});

function Page() {
  const { token } = Route.useSearch();
  const t = useT();
  const s = t.product.stockAlert;
  const lp = useLocaleParam();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"confirmed" | "invalid" | null>(token ? null : "invalid");
  const [error, setError] = useState("");

  async function run() {
    if (!token) return;
    setError("");
    setBusy(true);
    const result = await callFunction<{ status: "confirmed" | "invalid" }>("stock-alert", {
      action: "confirm",
      token,
    });
    setBusy(false);
    if (result.ok) setStatus(result.data.status);
    else setError(result.error === "NETWORK" ? t.common.networkError : t.common.error);
  }

  return (
    <div className="container page-body account-narrow">
      <h1 className="page-title">{s.confirmTitle}</h1>
      {!backendConfigured ? (
        <Notice>{s.notConfigured}</Notice>
      ) : status ? (
        <>
          <Notice kind={status === "confirmed" ? "success" : "error"}>
            {status === "confirmed" ? s.confirmed : s.invalid}
          </Notice>
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
          <p className="page-intro">{s.confirmIntro}</p>
          {error && <Notice kind="error">{error}</Notice>}
          <Button onClick={run} disabled={busy}>
            {busy ? t.common.loading : s.confirmButton}
          </Button>
        </>
      )}
    </div>
  );
}
