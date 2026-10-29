// Eine Bestellung im Admin: Versand melden, E-Mails erneut senden, Retoure einbuchen, interne Notiz.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Printer } from "lucide-react";
import { printDoc } from "@/components/admin/print";
import { AddressLabel, PackingSlips } from "@/components/admin/shipping-docs";
import { Receipt } from "@/components/admin/receipt";
import { Button } from "@/components/ui/button";
import {
  creditGiftCard,
  getOrder,
  getVariantCodes,
  notifyRestock,
  postLabel,
  refundOrder,
  resendGiftCard,
  resendOrderEmail,
  restockOrder,
  shipOrder,
  systemStatus,
  updateOrderNote,
  type AdminOrder,
} from "@/lib/admin/api";
import { paymentLabel } from "@/lib/admin/accounting-export";
import { parseChf } from "@/lib/admin/money";
import { imageUrl } from "@/lib/commerce/mapping";
import { sizeText } from "@/lib/commerce/one-size";
import { trackingUrl } from "@/lib/account/api";
import {
  AreaField,
  Badge,
  CheckField,
  chf,
  ConfirmButton,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  SelectField,
  StatusBadge,
  TextField,
  UnsavedChangesGuard,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/bestellungen/$id")({
  component: OrderPage,
});

function stripeUrl(order: AdminOrder): string | null {
  if (!order.stripe_payment_intent_id) return null;
  const test = order.stripe_session_id?.startsWith("cs_test_");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}payments/${order.stripe_payment_intent_id}`;
}

function OrderPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["admin", "order", id], queryFn: () => getOrder(id) });
  const back = (
    <Link to="/admin/bestellungen" className="admin-back">
      <ArrowLeft aria-hidden="true" /> Alle Bestellungen
    </Link>
  );
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data)
    return (
      <>
        {back}
        <p className="admin-empty">Diese Bestellung gibt es nicht.</p>
      </>
    );
  return (
    <>
      {back}
      <OrderView order={query.data} />
    </>
  );
}

function OrderView({ order }: { order: AdminOrder }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "order", order.id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  };
  const address = order.shipping_address;
  const stripe = stripeUrl(order);
  const gift = order.gift_card_purchase;

  return (
    <>
      <PageHeader
        title={`Bestellung AX-${order.number}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => printDoc("receipt")}>
            <Printer /> Quittung drucken
          </Button>
        }
        description={
          <>
            <StatusBadge status={order.status} />{" "}
            {order.kind === "gift_card" && <Badge>Gutschein</Badge>}{" "}
            {order.needs_attention && <Badge tone="danger">Prüfen</Badge>} Erstellt{" "}
            {dateTime(order.created_at)}
            {order.paid_at && ` · bezahlt ${dateTime(order.paid_at)}`}
            {order.shipped_at && ` · versendet ${dateTime(order.shipped_at)}`}
          </>
        }
      />
      <div className="admin-grid-main">
        <div>
          {order.kind === "cart" && <ShipPanel order={order} onDone={refresh} />}
          <Panel title={order.kind === "gift_card" ? "Gutschein" : "Positionen"}>
            {order.kind === "gift_card" ? (
              <div className="admin-gift">
                <p>
                  <strong>{chf(gift?.amount_cents ?? order.subtotal_cents)}</strong>
                  {gift?.recipient_name && ` für ${gift.recipient_name}`}
                  {gift?.sender_name && ` von ${gift.sender_name}`}
                </p>
                {gift?.recipient_email && <p>Geht an: {gift.recipient_email}</p>}
                {gift?.message && <blockquote>«{gift.message}»</blockquote>}
                {order.issued_gift_card ? (
                  <p>
                    Code{" "}
                    <Link
                      to="/admin/gutscheine"
                      search={{ suche: order.issued_gift_card.code }}
                      className="admin-link"
                    >
                      {order.issued_gift_card.code}
                    </Link>{" "}
                    · Guthaben {chf(order.issued_gift_card.balance_cents)}
                  </p>
                ) : (
                  <p className="admin-muted">
                    Der Code entsteht, sobald die Zahlung eingegangen ist.
                  </p>
                )}
                {order.issued_gift_card && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const r = await resendGiftCard(order.issued_gift_card!.id);
                        notify.ok(`Gutschein erneut an ${r.to} gesendet.`);
                      } catch (error) {
                        notify.error(error);
                      }
                    }}
                  >
                    Gutschein-E-Mail erneut senden
                  </Button>
                )}
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th className="num">Menge</th>
                    <th className="num">Preis</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const src = imageUrl(item.image, "product-images");
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="admin-item">
                            {src ? (
                              <img src={src} alt="" width={40} height={50} />
                            ) : (
                              <span className="admin-thumb" />
                            )}
                            <div>
                              {item.title}
                              <span className="admin-sub">
                                {[
                                  item.color,
                                  item.size && sizeText(item.size, "Grösse", "Einheitsgrösse"),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {item.restocked_quantity > 0 &&
                                  ` · ${item.restocked_quantity} zurückgebucht`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{chf(item.unit_price_cents)}</td>
                        <td className="num">{chf(item.line_total_cents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <dl className="admin-totals">
              <div>
                <dt>Zwischensumme</dt>
                <dd>{chf(order.subtotal_cents)}</dd>
              </div>
              {order.discount_cents > 0 && (
                <div>
                  <dt>Rabatt {order.discount_code && `(${order.discount_code})`}</dt>
                  <dd>−{chf(order.discount_cents)}</dd>
                </div>
              )}
              {order.kind === "cart" && (
                <div>
                  <dt>Versand</dt>
                  <dd>{order.shipping_cents ? chf(order.shipping_cents) : "Gratis"}</dd>
                </div>
              )}
              {order.gift_card_cents > 0 && (
                <div>
                  <dt>Gutschein</dt>
                  <dd>−{chf(order.gift_card_cents)}</dd>
                </div>
              )}
              <div className="total">
                <dt>Total</dt>
                <dd>{chf(order.total_cents)}</dd>
              </div>
              {order.refunded_cents > 0 && (
                <div>
                  <dt>Zurückerstattet</dt>
                  <dd>−{chf(order.refunded_cents)}</dd>
                </div>
              )}
            </dl>
          </Panel>
          {["paid", "shipped"].includes(order.status) &&
            order.total_cents > order.refunded_cents &&
            order.stripe_payment_intent_id && <RefundPanel order={order} onDone={refresh} />}
          {order.kind === "cart" && ["paid", "shipped", "refunded"].includes(order.status) && (
            <RestockPanel order={order} onDone={refresh} />
          )}
          {order.kind === "cart" &&
            order.gift_card_cents > 0 &&
            ["paid", "shipped", "refunded"].includes(order.status) && (
              <GiftCreditPanel order={order} onDone={refresh} />
            )}
        </div>
        <div>
          <Panel title="Kundschaft">
            <p>
              <a className="admin-link" href={`mailto:${order.email}`}>
                {order.email}
              </a>
              <span className="admin-sub">
                {order.user_id ? "mit Kundenkonto" : "als Gast"} · Sprache{" "}
                {order.locale === "en" ? "Englisch" : "Deutsch"}
              </span>
            </p>
            {address && (
              <p className="admin-address">
                {[
                  order.shipping_name,
                  address.line1,
                  address.line2,
                  [address.postal_code, address.city].filter(Boolean).join(" "),
                  address.country === "CH"
                    ? "Schweiz"
                    : address.country === "LI"
                      ? "Liechtenstein"
                      : address.country,
                ]
                  .filter(Boolean)
                  .map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
              </p>
            )}
            {order.phone && <p>Telefon: {order.phone}</p>}
          </Panel>
          <Panel title="Zahlung">
            <p>{paymentLabel(order.payment_method) || "–"}</p>
            {stripe && (
              <p>
                <a className="admin-link" href={stripe} target="_blank" rel="noopener noreferrer">
                  In Stripe öffnen <ExternalLink aria-hidden="true" className="admin-inline-icon" />
                </a>
              </p>
            )}
            <p className="admin-hint">
              Rückerstattungen unter «Rückerstatten» auslösen (oder im Stripe-Dashboard). Der Betrag
              erscheint danach automatisch hier. Ware, die zurückkommt, unter «Retoure einbuchen» an
              Lager nehmen.
            </p>
            {order.gift_card_cents > 0 && (
              <p className="admin-hint">
                Achtung: {chf(order.gift_card_cents)} wurden mit Geschenkgutschein bezahlt. Stripe
                erstattet nur den Kartenanteil. Den Gutscheinanteil unter «Gutscheinanteil
                gutschreiben» auf den Gutschein zurückbuchen.
              </p>
            )}
            {order.status === "cancelled" && (
              <p className="admin-hint">
                Abgebrochen {dateTime(order.cancelled_at)}{" "}
                {order.cancel_reason && `(${order.cancel_reason})`}
              </p>
            )}
          </Panel>
          {order.kind === "cart" && order.shipping_address && <ShippingDocsPanel order={order} />}
          <Panel title="E-Mails">
            <ul className="admin-list">
              <li>
                Bestätigung:{" "}
                {order.confirmation_sent_at ? dateTime(order.confirmation_sent_at) : "noch nicht"}
              </li>
              {order.kind === "cart" && (
                <li>
                  Versandmeldung:{" "}
                  {order.shipping_sent_at ? dateTime(order.shipping_sent_at) : "noch nicht"}
                </li>
              )}
              {order.kind === "gift_card" && (
                <li>
                  Gutschein:{" "}
                  {order.gift_card_sent_at ? dateTime(order.gift_card_sent_at) : "noch nicht"}
                </li>
              )}
            </ul>
            {["paid", "shipped", "refunded"].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const r = await resendOrderEmail(order.id, "confirmation");
                    notify.ok(`Bestätigung erneut an ${r.to} gesendet.`);
                    refresh();
                  } catch (error) {
                    notify.error(error);
                  }
                }}
              >
                Bestätigung erneut senden
              </Button>
            )}
          </Panel>
          <NotePanel order={order} onDone={refresh} />
        </div>
      </div>
      <Receipt order={order} />
    </>
  );
}

/** PDF aus Base64 als Datei speichern (Download im Browser). */
function downloadPdf(base64: string, filename: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function ShipPanel({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [trackingMissing, setTrackingMissing] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelMade, setLabelMade] = useState(false);
  // Gleicher Schlüssel wie die Checkliste auf der Übersicht; unbekannt (lädt oder Fehler) heisst nicht «aus».
  const system = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: systemStatus,
    retry: false,
  });
  const postReady = system.data?.swissPost;
  const postCountry = ["CH", "LI"].includes((order.shipping_address?.country ?? "").toUpperCase());
  if (order.status === "shipped")
    return (
      <Panel title="Versand">
        <p>
          Versendet {dateTime(order.shipped_at)}
          {order.tracking_number && (
            <>
              {" "}
              · Sendungsnummer{" "}
              <a
                className="admin-link"
                href={trackingUrl(order.tracking_number)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {order.tracking_number}
              </a>
            </>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const r = await resendOrderEmail(order.id, "shipping");
              notify.ok(`Versandmeldung erneut an ${r.to} gesendet.`);
              onDone();
            } catch (error) {
              notify.error(error);
            }
          }}
        >
          Versandmeldung erneut senden
        </Button>
      </Panel>
    );
  if (order.status !== "paid") return null;
  return (
    <Panel
      title="Versenden"
      description="Paket bei der Post aufgeben, dann hier die Sendungsnummer eintragen."
      className="admin-highlight"
    >
      <div className="admin-form">
        <TextField
          label="Sendungsnummer"
          hint="Bitte immer eintragen: AGB und Häufige Fragen sagen der Kundschaft die Sendungsnummer zu. Pflicht, wenn die Kundschaft benachrichtigt wird."
          required={notifyCustomer}
          error={trackingMissing ? "Bitte die Sendungsnummer eintragen." : undefined}
          placeholder="z. B. 99.00.123456.12345678"
          value={tracking}
          maxLength={60}
          onChange={(e) => {
            setTracking(e.target.value);
            setTrackingMissing(false);
          }}
        />
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={labelBusy || postReady === false || !postCountry}
            onClick={async () => {
              setLabelBusy(true);
              try {
                const r = await postLabel(order.id);
                downloadPdf(r.labelPdfBase64, `Post-Etikett-AX-${order.number}.pdf`);
                // Die bestehende Versandmeldung bleibt der Weg zum «Versendet»: Nummer eintragen, dann bestätigen.
                setTracking(r.identCode);
                setTrackingMissing(false);
                setLabelMade(true);
                notify.ok(`Etikett erstellt, Sendungsnummer ${r.identCode} eingetragen.`);
              } catch (error) {
                notify.error(error);
              } finally {
                setLabelBusy(false);
              }
            }}
          >
            <Printer /> {labelBusy ? "Bitte warten …" : "Etikett (Post) erstellen"}
          </Button>
          <p className="admin-hint">
            {postReady === false
              ? "Nicht eingerichtet: Die Secrets POST_CLIENT_ID, POST_CLIENT_SECRET und POST_FRANKING_LICENSE fehlen (Cloud → Secrets, siehe docs/BETRIEB.md)."
              : !postCountry
                ? "Post-Etiketten gibt es nur für Lieferungen in die Schweiz und nach Liechtenstein."
                : labelMade
                  ? "Etikett heruntergeladen und ausgedruckt? Dann unten «Als versendet markieren». Ein weiterer Klick erzeugt ein neues Etikett (kostenpflichtig)."
                  : "Erzeugt das A6-Etikett als PDF und trägt die Sendungsnummer ein. Erst «Als versendet markieren» informiert die Kundschaft. Noch nicht mit der echten Post getestet."}
          </p>
        </div>
        <CheckField
          label="Kundschaft per E-Mail informieren"
          hint="Die Versandmeldung enthält den Link zur Sendungsverfolgung."
          checked={notifyCustomer}
          onChange={setNotifyCustomer}
        />
        <Button
          variant="admin"
          disabled={busy}
          onClick={async () => {
            // Mit Benachrichtigung ist die Sendungsnummer Pflicht (der Server prüft es ebenfalls).
            if (notifyCustomer && !tracking.trim()) return setTrackingMissing(true);
            setBusy(true);
            try {
              const r = await shipOrder(order.id, tracking, notifyCustomer);
              if (r.emailError) notify.error(new Error("EMAIL_FAILED"));
              notify.ok(
                r.emailed
                  ? "Als versendet markiert und E-Mail gesendet."
                  : "Als versendet markiert.",
              );
              onDone();
            } catch (error) {
              notify.error(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Bitte warten …" : "Als versendet markieren"}
        </Button>
      </div>
    </Panel>
  );
}

const REFUND_REASONS = [
  { value: "requested_by_customer", label: "Auf Wunsch der Kundschaft" },
  { value: "duplicate", label: "Doppelt bezahlt" },
  { value: "fraudulent", label: "Betrugsverdacht" },
];

/** Kartenanteil über Stripe zurückzahlen. Gebucht wird erst, wenn Stripe `charge.refunded` meldet (Webhook):
 *  Status, Betrag und Kundenmail kommen von dort. Ein Gutscheinanteil bleibt davon unberührt (eigenes Feld unten). */
function RefundPanel({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const remaining = Math.max(0, order.total_cents - order.refunded_cents);
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState("requested_by_customer");
  useEffect(() => setAmount((remaining / 100).toFixed(2)), [remaining]);
  const cents = parseChf(amount);
  const valid = cents !== null && cents >= 1 && cents <= remaining;
  // Ein Vorgang = eine requestId: Wiederholung nach Fehler oder Timeout erstattet nicht doppelt, eine weitere
  // Rückerstattung (nach Erfolg oder mit anderem Betrag/Grund) bekommt eine neue.
  const request = useRef({ key: "", id: "" });
  const requestId = () => {
    const key = `${cents}-${reason}`;
    if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    return request.current.id;
  };
  return (
    <Panel
      title="Rückerstatten"
      description={`Zahlt den Betrag auf das Zahlungsmittel der Kundschaft zurück (über Stripe). Noch erstattbar: ${chf(remaining)}${order.refunded_cents > 0 ? `, schon erstattet ${chf(order.refunded_cents)}` : ""}.`}
    >
      <div className="admin-form">
        <TextField
          label="Betrag (CHF)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={`Höchstens ${chf(remaining)}. Der Rest bleibt erstattbar.`}
          error={amount && !valid ? `Bitte einen Betrag bis ${chf(remaining)} angeben.` : undefined}
        />
        <SelectField
          label="Grund (für Stripe)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REFUND_REASONS}
        />
        <ConfirmButton
          label="Rückerstatten …"
          title={`${valid ? chf(cents) : "Betrag"} zurückzahlen?`}
          description={
            <>
              <p>
                {valid ? chf(cents) : ""} gehen über Stripe an die Kundschaft zurück. Das lässt sich
                nicht rückgängig machen. Die Kundschaft erhält eine E-Mail.
              </p>
              <p>
                Ware, die zurückkommt, danach unter «Retoure einbuchen» an Lager nehmen.
                {order.gift_card_cents > 0 &&
                  " Der Gutscheinanteil wird nicht erstattet (siehe «Gutscheinanteil gutschreiben»)."}
              </p>
            </>
          }
          confirmLabel="Jetzt zurückzahlen"
          variant="outline"
          size="default"
          disabled={!valid}
          onConfirm={async () => {
            const r = await refundOrder(
              order.id,
              cents!,
              reason as "requested_by_customer" | "duplicate" | "fraudulent",
              requestId(),
            );
            request.current = { key: "", id: "" };
            if (r.status === "succeeded" || r.status === "pending")
              notify.ok(
                `${chf(r.amountCents)} bei Stripe zurückgezahlt. Hier erscheint der Betrag, sobald Stripe ihn meldet.`,
              );
            else
              notify.warn(
                `Stripe meldet den Status «${r.status}». Bitte im Stripe-Dashboard prüfen.`,
              );
            onDone();
            // Der Webhook trifft meist nach wenigen Sekunden ein
            window.setTimeout(onDone, 5000);
          }}
        />
      </div>
    </Panel>
  );
}

/** Lieferschein (A4) und Adressetikette (10 × 15 cm) zum Ausdrucken. */
function ShippingDocsPanel({ order }: { order: AdminOrder }) {
  const [withPrices, setWithPrices] = useState(true);
  const variantIds = order.items.flatMap((i) => (i.variant_id ? [i.variant_id] : []));
  const codes = useQuery({
    queryKey: ["admin", "variant-codes", variantIds.join(",")],
    queryFn: () => getVariantCodes(variantIds),
    enabled: variantIds.length > 0,
  });
  return (
    <Panel
      title="Versanddokumente"
      description="Im Druckdialog das Papierformat wählen: A4 für den Lieferschein, 10 × 15 cm für die Etikette."
    >
      <div className="admin-form">
        <CheckField
          label="Lieferschein mit Preisen"
          hint="Ohne Preise eignet er sich für Geschenke."
          checked={withPrices}
          onChange={setWithPrices}
        />
        <div className="admin-actions">
          <Button variant="outline" size="sm" onClick={() => printDoc("slip")}>
            <Printer /> Lieferschein
          </Button>
          <Button variant="outline" size="sm" onClick={() => printDoc("label")}>
            <Printer /> Adressetikette
          </Button>
        </div>
      </div>
      <PackingSlips orders={[order]} codes={codes.data ?? {}} withPrices={withPrices} />
      <AddressLabel order={order} />
    </Panel>
  );
}

function RestockPanel({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const open = order.items.filter((i) => i.restocked_quantity < i.quantity);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  if (!open.length) return null;
  const items = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([order_item_id, quantity]) => ({ order_item_id, quantity }));
  return (
    <Panel
      title="Retoure einbuchen"
      description="Zurückgekommene Stücke wieder an Lager nehmen. Das Geld erstattest du unter «Rückerstatten»."
    >
      <div className="admin-restock">
        {open.map((item) => (
          <label key={item.id}>
            <span>
              {item.title} {item.size && `· ${sizeText(item.size, "Grösse", "Einheitsgrösse")}`}
            </span>
            <select
              className="admin-select"
              value={qty[item.id] ?? 0}
              onChange={(e) => setQty((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
            >
              {Array.from({ length: item.quantity - item.restocked_quantity + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={busy || items.length === 0}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await restockOrder(order.id, items);
            notify.ok(`${r.restocked} ${r.restocked === 1 ? "Stück" : "Stücke"} wieder an Lager.`);
            setQty({});
            // Grössen, die von ausverkauft auf vorrätig gingen: Wartende benachrichtigen
            await notifyBackInStock(r.back_in_stock ?? []);
            onDone();
          } catch (error) {
            notify.error(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        An Lager nehmen
      </Button>
    </Panel>
  );
}

/** Wartende («Benachrichtigen, wenn wieder da») der wieder vorrätigen Grössen informieren; Fehler bleiben vorgemerkt. */
async function notifyBackInStock(variantIds: string[]) {
  let notified = 0;
  let failed = 0;
  for (const id of variantIds) {
    try {
      const r = await notifyRestock(id);
      notified += r.notified;
      failed += r.failed;
    } catch (error) {
      notify.error(error);
    }
  }
  if (notified) notify.ok(`${notified} wartende Kundschaft benachrichtigt.`);
  if (failed)
    notify.warn(
      `${failed} E-Mail(s) nicht verschickt (E-Mail-Versand eingerichtet?). Sie bleiben vorgemerkt.`,
    );
}

/** Die Rückerstattung läuft über Stripe und deckt nur den Kartenanteil; der Gutscheinanteil wird hier gutgeschrieben. */
function GiftCreditPanel({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const open = Math.max(0, order.gift_card_cents - order.gift_card_credited_cents);
  const [amount, setAmount] = useState((open / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  useEffect(() => setAmount((open / 100).toFixed(2)), [open]);
  const cents = parseChf(amount);
  const valid = cents !== null && cents >= 1 && cents <= open;
  return (
    <Panel
      title="Gutscheinanteil gutschreiben"
      description={`${chf(order.gift_card_cents)} wurden mit Geschenkgutschein bezahlt${order.gift_card_credited_cents > 0 ? `, davon ${chf(order.gift_card_credited_cents)} schon gutgeschrieben` : ""}. Stripe erstattet nur den Kartenanteil.`}
    >
      {open > 0 ? (
        <div className="admin-form">
          <TextField
            label="Betrag (CHF)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Höchstens ${chf(open)}. Der Betrag kommt auf den Gutschein zurück.`}
            error={amount && !valid ? `Bitte einen Betrag bis ${chf(open)} angeben.` : undefined}
          />
          <ConfirmButton
            label="Auf den Gutschein buchen …"
            title={`${valid ? chf(cents) : "Betrag"} gutschreiben?`}
            description={`${valid ? chf(cents) : ""} kommen auf den Geschenkgutschein dieser Bestellung zurück. Das lässt sich nicht rückgängig machen.`}
            confirmLabel="Jetzt gutschreiben"
            variant="outline"
            size="default"
            danger={false}
            disabled={busy || !valid}
            onConfirm={async () => {
              setBusy(true);
              try {
                const r = await creditGiftCard(order.id, cents!);
                notify.ok(`Gutschein: ${chf(r.balance_cents)} Guthaben.`);
                onDone();
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      ) : (
        <p className="admin-muted">Der ganze Gutscheinanteil ist gutgeschrieben.</p>
      )}
    </Panel>
  );
}

function NotePanel({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const [note, setNote] = useState(order.admin_note ?? "");
  const [attention, setAttention] = useState(order.needs_attention);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNote(order.admin_note ?? "");
    setAttention(order.needs_attention);
  }, [order.admin_note, order.needs_attention]);
  const dirty = note !== (order.admin_note ?? "") || attention !== order.needs_attention;
  return (
    <Panel title="Interne Notiz" description="Nur im Admin sichtbar, nie für die Kundschaft.">
      <UnsavedChangesGuard active={dirty && !busy} />
      <div className="admin-form">
        <AreaField
          label="Notiz"
          rows={4}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <CheckField label="Zum Prüfen markieren" checked={attention} onChange={setAttention} />
        <Button
          variant="outline"
          disabled={busy || !dirty}
          onClick={async () => {
            setBusy(true);
            try {
              await updateOrderNote(order.id, note, attention);
              notify.ok("Gespeichert.");
              onDone();
            } catch (error) {
              notify.error(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          Speichern
        </Button>
      </div>
    </Panel>
  );
}
