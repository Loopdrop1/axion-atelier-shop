// Bestellungen für die Buchhaltung: eine Zeile pro Bestellung, Beträge in CHF. Reine Funktion (Datei: csv.ts, UTF-8 mit
// BOM und Semikolon für Excel in der Schweiz). Die MWST wird wie auf der Quittung gerechnet (components/shop/receipt-document.tsx):
// Basis = Warenwert nach Rabatt plus Versand, abzüglich Rückerstattungen (Karte und auf den Gutschein zurückgebuchter Anteil);
// ein Gutschein ist nur ein Zahlungsmittel. Satz aus der Bestellung, bei Altbestellungen aus der Shop-Konfiguration.
import { centsToInput } from "./money";
import { vatIncluded } from "./vat";

export interface AccountingOrder {
  number: number;
  kind: "cart" | "gift_card";
  status: string;
  email: string;
  created_at: string;
  paid_at: string | null;
  shipping_name: string | null;
  shipping_address: { country?: string } | null;
  subtotal_cents: number;
  discount_cents: number;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  refunded_cents: number;
  /** Auf den Gutschein zurückgebuchter Anteil der Rückerstattung */
  gift_card_credited_cents?: number;
  vat_rate: number | null;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
}

export interface AccountingOptions {
  /** shopConfig.vatRegistered */
  vatRegistered: boolean;
  /** shopConfig.vatRate: Satz für Altbestellungen ohne gespeicherten Satz */
  defaultVatRate: number;
  statusLabel: (status: string) => string;
}

export const ACCOUNTING_HEADER = [
  "Bestellung",
  "Datum",
  "Status",
  "Kundschaft",
  "E-Mail",
  "Land",
  "Warenwert CHF",
  "Rabatt CHF",
  "Gutschein CHF",
  "Versand CHF",
  "Total CHF",
  "Zurückerstattet CHF",
  "MWST-Satz %",
  "MWST CHF",
  "Zahlungsart",
  "Stripe PaymentIntent",
];

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

/** MWST-Satz und enthaltener Betrag (Rappen) einer Bestellung; null, wenn keine MWST ausgewiesen wird. */
export function orderVat(
  order: AccountingOrder,
  options: Pick<AccountingOptions, "vatRegistered" | "defaultVatRate">,
): { rate: number; cents: number } | null {
  if (order.kind !== "cart") return null;
  if (order.vat_rate == null && !options.vatRegistered) return null;
  const rate = order.vat_rate ?? options.defaultVatRate;
  const refunded = order.refunded_cents + (order.gift_card_credited_cents ?? 0);
  const base = Math.max(
    0,
    order.subtotal_cents - order.discount_cents + order.shipping_cents - refunded,
  );
  return { rate, cents: vatIncluded(base, rate) };
}

/** Tag in Zürcher Zeit, «28.10.2026». */
function zurichDay(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
}

export function accountingRows(
  orders: AccountingOrder[],
  options: AccountingOptions,
): (string | number)[][] {
  return [
    ACCOUNTING_HEADER,
    ...orders.map((o) => {
      const vat = orderVat(o, options);
      return [
        `AX-${o.number}`,
        zurichDay(o.paid_at ?? o.created_at),
        options.statusLabel(o.status),
        o.shipping_name ?? "",
        o.email,
        o.shipping_address?.country ?? "",
        centsToInput(o.subtotal_cents),
        centsToInput(o.discount_cents),
        centsToInput(o.gift_card_cents),
        centsToInput(o.shipping_cents),
        centsToInput(o.total_cents),
        centsToInput(o.refunded_cents),
        vat ? String(vat.rate) : "",
        vat ? centsToInput(vat.cents) : "",
        o.payment_method ? (PAYMENT[o.payment_method] ?? o.payment_method) : "",
        o.stripe_payment_intent_id ?? "",
      ];
    }),
  ];
}
