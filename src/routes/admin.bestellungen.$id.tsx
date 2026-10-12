// Eine Bestellung im Admin: Versand melden, E-Mails erneut senden, Retoure einbuchen, interne Notiz.
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Printer } from "lucide-react";
import { Receipt } from "@/components/admin/receipt";
import { Button } from "@/components/ui/button";
import {
  getOrder,
  resendGiftCard,
  resendOrderEmail,
  restockOrder,
  shipOrder,
  updateOrderNote,
  type AdminOrder,
} from "@/lib/admin/api";
import { imageUrl } from "@/lib/commerce/mapping";
import { trackingUrl } from "@/lib/account/api";
import {
  AreaField,
  Badge,
  CheckField,
  chf,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  StatusBadge,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/bestellungen/$id")({
  component: OrderPage,
});

const PAYMENT: Record<string, string> = {
  card: "Karte",
  twint: "TWINT",
  klarna: "Klarna",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  gift_card: "Geschenkgutschein",
  discount: "Rabatt",
  link: "Link",
};

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
          <Button variant="outline" size="sm" onClick={() => window.print()}>
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
                                {[item.color, item.size && `Grösse ${item.size}`]
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
          {order.kind === "cart" && ["paid", "shipped", "refunded"].includes(order.status) && (
            <RestockPanel order={order} onDone={refresh} />
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
            <p>
              {order.payment_method ? (PAYMENT[order.payment_method] ?? order.payment_method) : "–"}
            </p>
            {stripe && (
              <p>
                <a className="admin-link" href={stripe} target="_blank" rel="noopener noreferrer">
                  In Stripe öffnen <ExternalLink aria-hidden="true" className="admin-inline-icon" />
                </a>
              </p>
            )}
            <p className="admin-hint">
              Rückerstattungen im Stripe-Dashboard auslösen. Der Betrag erscheint danach automatisch
              hier. Ware, die zurückkommt, unter «Retoure einbuchen» an Lager nehmen.
            </p>
            {order.status === "cancelled" && (
              <p className="admin-hint">
                Abgebrochen {dateTime(order.cancelled_at)}{" "}
                {order.cancel_reason && `(${order.cancel_reason})`}
              </p>
            )}
          </Panel>
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

function ShipPanel({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
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
          hint="Bitte immer eintragen: AGB und Häufige Fragen sagen der Kundschaft die Sendungsnummer zu."
          placeholder="z. B. 99.00.123456.12345678"
          value={tracking}
          maxLength={60}
          onChange={(e) => setTracking(e.target.value)}
        />
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
      description="Zurückgekommene Stücke wieder an Lager nehmen. Das Geld erstattest du in Stripe."
    >
      <div className="admin-restock">
        {open.map((item) => (
          <label key={item.id}>
            <span>
              {item.title} {item.size && `· ${item.size}`}
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
