// Checkliste «Bereit für den Livegang» auf der Admin-Übersicht: Secrets und Stripe-Modus aus der Edge Function
// (nur Ja/Nein, nie Werte), dazu Prüfungen im Browser (Kontaktdaten, Rechtstexte, Musterstücke, Livegang-Schalter).
import { useQuery } from "@tanstack/react-query";
import { countSampleProducts, systemStatus, type SystemStatus } from "@/lib/admin/api";
import { shopConfig } from "@/config/shop";
import { Badge, Panel } from "./ui";

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
}

const SECRET_LABELS: Record<string, string> = {
  STRIPE_SECRET_KEY: "Stripe-Schlüssel gesetzt",
  STRIPE_WEBHOOK_SECRET: "Stripe-Webhook-Geheimnis gesetzt",
  RESEND_API_KEY: "Resend-Schlüssel gesetzt (E-Mails)",
  EMAIL_FROM: "Absender der E-Mails ist eine eigene Domain",
  SITE_URL: "Adresse des Shops (SITE_URL) gesetzt",
  SHOP_CONTACT_EMAIL: "Kontakt-E-Mail der Mails gesetzt",
  SHOP_NOTIFY_EMAIL: "Empfänger der Bestellmeldungen gesetzt",
  SHOP_ADDRESS: "Adresse im Fuss der E-Mails gesetzt",
};

/** Prüfungen aus der Antwort der Edge Function. Reine Funktion, damit sie testbar bleibt. */
export function serverChecks(status: SystemStatus): Check[] {
  const checks: Check[] = Object.entries(status.required).map(([key, ok]) => ({
    id: key,
    label: SECRET_LABELS[key] ?? `${key} gesetzt`,
    ok,
    hint: `Cloud → Secrets: ${key}`,
  }));
  checks.push({
    id: "stripe-mode",
    label:
      status.stripeMode === "live"
        ? "Stripe im Live-Modus"
        : status.stripeMode === "test"
          ? "Stripe im Testmodus (für den Livegang Live-Schlüssel setzen)"
          : status.stripeMode === "missing"
            ? "Stripe-Schlüssel fehlt"
            : "Stripe-Modus unbekannt",
    ok: status.stripeMode === "live",
  });
  checks.push({
    id: "preview-origins",
    label: "Vorschau-Freigabe (ALLOW_PREVIEW_ORIGINS) entfernt",
    ok: !status.previewOriginsAllowed,
    hint: "Vor dem Livegang in Cloud → Secrets löschen",
  });
  return checks;
}

/** Prüfungen im Browser aus der Konfiguration und der Zahl der Musterstücke. */
export function clientChecks(input: {
  contactPlaceholders: string[];
  draftPages: string[] | null;
  sampleProducts: number | null;
}): Check[] {
  const { contactPlaceholders, draftPages, sampleProducts } = input;
  return [
    {
      id: "contact",
      label: "Firmen- und Kontaktangaben ausgefüllt",
      ok: contactPlaceholders.length === 0,
      hint: contactPlaceholders.length
        ? `Noch offen in shop.ts: ${contactPlaceholders.join(", ")}`
        : "",
    },
    ...(draftPages
      ? [
          {
            id: "legal",
            label: "Rechtstexte ohne Platzhalter",
            ok: draftPages.length === 0,
            hint: draftPages.length ? `Noch Entwurf: ${draftPages.join(", ")}` : "",
          },
        ]
      : []),
    ...(sampleProducts !== null
      ? [
          {
            id: "muster",
            label: "Keine Musterstücke aktiv",
            ok: sampleProducts === 0,
            hint: sampleProducts
              ? `${sampleProducts} aktive Musterstücke (supabase/demo/muster-entfernen.sql)`
              : "",
          },
        ]
      : []),
    {
      id: "launched",
      label: "Livegang-Schalter eingeschaltet (launched)",
      ok: shopConfig.launched,
      hint: "src/config/shop.ts, danach bun scripts/sync-robots.ts",
    },
  ];
}

async function loadDraftPages(): Promise<string[]> {
  const [{ pages }, { pagesEn }, { pageHasPlaceholder }] = await Promise.all([
    import("@/content/pages"),
    import("@/content/pages-en"),
    import("@/components/shop/written-content"),
  ]);
  const names = Object.keys(pages) as (keyof typeof pages)[];
  return names.filter(
    (n) => pageHasPlaceholder(pages[n]) || (pagesEn[n] && pageHasPlaceholder(pagesEn[n]!)),
  );
}

export function contactPlaceholders(): string[] {
  return Object.entries(shopConfig.contact)
    .filter(([, value]) => value.trim().startsWith("["))
    .map(([key]) => key);
}

export function ReadinessPanel() {
  const status = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: systemStatus,
    retry: false,
  });
  const draft = useQuery({
    queryKey: ["admin", "draft-pages"],
    queryFn: loadDraftPages,
    retry: false,
  });
  const muster = useQuery({
    queryKey: ["admin", "muster-count"],
    queryFn: countSampleProducts,
    retry: false,
  });
  const checks = [
    ...(status.data ? serverChecks(status.data) : []),
    ...clientChecks({
      contactPlaceholders: contactPlaceholders(),
      draftPages: draft.data ?? null,
      sampleProducts: muster.data ?? null,
    }),
  ];
  const done = checks.filter((c) => c.ok).length;
  return (
    <Panel
      title="Bereit für den Livegang"
      description={
        status.isError
          ? "Der Systemstatus ist nicht verfügbar (Funktion admin-actions neu veröffentlichen). Es gelten nur die Prüfungen im Browser."
          : "Zeigt nur, ob Secrets gesetzt sind, nie ihre Werte."
      }
      actions={
        <Badge tone={done === checks.length && !status.isError ? "ok" : "warn"}>
          {done} von {checks.length}
        </Badge>
      }
    >
      <ul className="admin-checklist" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {checks.map((c) => (
          <li
            key={c.id}
            style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", padding: "0.2rem 0" }}
          >
            <Badge tone={c.ok ? "ok" : "warn"}>{c.ok ? "OK" : "Offen"}</Badge>
            <span>
              {c.label}
              {!c.ok && c.hint ? <span className="admin-muted"> · {c.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
