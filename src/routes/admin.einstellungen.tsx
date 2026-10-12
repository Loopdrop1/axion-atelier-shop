// Einstellungen: Versandkosten, ausverkaufte Grössen, Gutscheinbeträge und -gültigkeit, Willkommens-Rabatt im
// Newsletter, Adresse für Bestellmeldungen.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getSettings, saveSettings } from "@/lib/admin/api";
import { centsToInput, parseChf } from "@/lib/admin/money";
import { invalidateCatalog } from "@/lib/commerce/source";
import {
  CheckField,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/einstellungen")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings });
  const [form, setForm] = useState({
    shipping: "",
    freeFrom: "",
    giftMin: "",
    giftMax: "",
    giftYears: "",
    welcome: "",
    notify: "",
  });
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = query.data;
    if (!s) return;
    setForm({
      shipping: centsToInput(s.shipping_cents),
      freeFrom: centsToInput(s.free_shipping_from_cents),
      giftMin: centsToInput(s.gift_card_min_cents),
      giftMax: centsToInput(s.gift_card_max_cents),
      giftYears: String(s.gift_card_valid_years),
      welcome: s.newsletter_welcome_percent ? String(s.newsletter_welcome_percent) : "",
      notify: s.notify_email ?? "",
    });
    setHideSoldOut(s.hide_sold_out);
  }, [query.data]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save() {
    setError("");
    const shipping = parseChf(form.shipping || "0");
    const freeFrom = form.freeFrom.trim() ? parseChf(form.freeFrom) : null;
    const giftMin = parseChf(form.giftMin);
    const giftMax = parseChf(form.giftMax);
    const years = Number(form.giftYears);
    if (shipping === null || shipping > 100000)
      return setError("Versandkosten in Franken, höchstens CHF 1'000.");
    if (form.freeFrom.trim() && freeFrom === null)
      return setError("Gratisversand ab: Betrag in Franken oder leer.");
    if (
      giftMin === null ||
      giftMax === null ||
      giftMin < 100 ||
      giftMax > 1000000 ||
      giftMin > giftMax
    )
      return setError(
        "Gutscheinbeträge: von mindestens CHF 1 bis höchstens CHF 10'000, «von» nicht grösser als «bis».",
      );
    if (giftMin % 100 !== 0 || giftMax % 100 !== 0)
      return setError("Gutscheinbeträge in ganzen Franken.");
    if (!Number.isInteger(years) || years < 1 || years > 30)
      return setError("Gültigkeit: 1 bis 30 Jahre.");
    const welcome = form.welcome.trim() ? Number(form.welcome.trim().replace("%", "")) : null;
    if (welcome !== null && (!Number.isInteger(welcome) || welcome < 1 || welcome > 50))
      return setError("Willkommens-Rabatt: ganze Prozent von 1 bis 50, oder leer für keinen.");
    if (form.notify.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.notify.trim()))
      return setError("Die E-Mail-Adresse für Bestellmeldungen ist ungültig.");
    setBusy(true);
    try {
      await saveSettings({
        shipping_cents: shipping,
        free_shipping_from_cents: freeFrom,
        gift_card_min_cents: giftMin,
        gift_card_max_cents: giftMax,
        gift_card_valid_years: years,
        newsletter_welcome_percent: welcome,
        hide_sold_out: hideSoldOut,
        notify_email: form.notify.trim() || null,
      });
      invalidateCatalog();
      void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      notify.ok("Einstellungen gespeichert.");
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <>
      <PageHeader title="Einstellungen" />
      <Panel title="Versand" description="Gilt für alle Bestellungen im Liefergebiet.">
        <div className="admin-form admin-grid-2">
          <TextField
            label="Versandkosten (CHF)"
            hint="0 = Gratisversand"
            inputMode="decimal"
            value={form.shipping}
            onChange={set("shipping")}
          />
          <TextField
            label="Gratisversand ab Warenwert (CHF, freiwillig)"
            hint="Nach Rabatt gerechnet. Leer = immer die Versandkosten oben."
            inputMode="decimal"
            value={form.freeFrom}
            onChange={set("freeFrom")}
          />
        </div>
        <p className="admin-hint">
          Produktseiten und Startseite zeigen die Versandkosten automatisch passend an. Das Laufband
          und den Text im Einstieg der Startseite passt du unter «Startseite und Laufband» selbst
          an, falls dort «Gratisversand» steht.
        </p>
      </Panel>
      <Panel title="Ausverkaufte Grössen">
        <div className="admin-form">
          <CheckField
            label="Ausverkaufte Grössen im Shop ausblenden"
            hint="Ohne Haken erscheinen sie durchgestrichen und lassen sich nicht wählen."
            checked={hideSoldOut}
            onChange={setHideSoldOut}
          />
        </div>
      </Panel>
      <Panel
        title="Gutscheine"
        description="Gilt für neu gekaufte Gutscheine. Bestehende Gutscheine behalten ihre Gültigkeit."
      >
        <div className="admin-form admin-grid-3">
          <TextField
            label="Kleinster Betrag (CHF)"
            inputMode="decimal"
            value={form.giftMin}
            onChange={set("giftMin")}
          />
          <TextField
            label="Grösster Betrag (CHF)"
            inputMode="decimal"
            value={form.giftMax}
            onChange={set("giftMax")}
          />
          <TextField
            label="Gültig (Jahre)"
            inputMode="numeric"
            value={form.giftYears}
            onChange={set("giftYears")}
          />
        </div>
      </Panel>
      <Panel
        title="Newsletter"
        description="Rabatt in der Willkommens-E-Mail nach der bestätigten Anmeldung: ein persönlicher Code, einmal einlösbar, 90 Tage gültig."
      >
        <div className="admin-form admin-grid-3">
          <TextField
            label="Willkommens-Rabatt (%)"
            hint="Leer = kein Rabatt"
            inputMode="numeric"
            value={form.welcome}
            onChange={set("welcome")}
          />
        </div>
      </Panel>
      <Panel
        title="Meldungen"
        description="An diese Adresse geht bei jeder Bestellung eine kurze Meldung. Leer = Adresse aus der Einrichtung."
      >
        <div className="admin-form">
          <TextField
            label="E-Mail für Bestellmeldungen"
            type="email"
            value={form.notify}
            onChange={set("notify")}
          />
        </div>
      </Panel>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-savebar">
        <Button variant="admin" disabled={busy} onClick={() => void save()}>
          {busy ? "Wird gespeichert …" : "Einstellungen speichern"}
        </Button>
      </div>
    </>
  );
}
