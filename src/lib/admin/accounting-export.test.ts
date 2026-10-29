import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_HEADER,
  accountingRows,
  orderVat,
  paymentLabel,
  type AccountingOptions,
  type AccountingOrder,
} from "./accounting-export";
import { toCsv } from "./csv";

const options: AccountingOptions = {
  vatRegistered: true,
  defaultVatRate: 8.1,
  statusLabel: (s) =>
    ({ paid: "Bezahlt", shipped: "Versendet", refunded: "Zurückerstattet" })[s] ?? s,
};

function order(overrides: Partial<AccountingOrder> = {}): AccountingOrder {
  return {
    number: 1042,
    kind: "cart",
    status: "shipped",
    email: "kunde@example.ch",
    created_at: "2026-10-27T10:30:00Z",
    paid_at: "2026-10-27T22:40:00Z", // 23:40 in Zürich: noch der 27.10.
    shipping_name: "Max Muster",
    shipping_address: { country: "CH" },
    subtotal_cents: 49900,
    discount_cents: 0,
    gift_card_cents: 0,
    shipping_cents: 0,
    total_cents: 49900,
    refunded_cents: 0,
    vat_rate: 8.1,
    payment_method: "twint",
    stripe_payment_intent_id: "pi_123",
    ...overrides,
  };
}

describe("accountingRows", () => {
  it("Kopfzeile und eine Zeile pro Bestellung mit allen Spalten", () => {
    const rows = accountingRows([order()], options);
    expect(rows[0]).toEqual(ACCOUNTING_HEADER);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      "AX-1042",
      "27.10.2026",
      "Versendet",
      "Max Muster",
      "kunde@example.ch",
      "CH",
      "499.00",
      "0.00",
      "0.00",
      "0.00",
      "499.00",
      "0.00",
      "8.1",
      "37.39",
      "TWINT",
      "pi_123",
    ]);
    expect(rows[1]).toHaveLength(ACCOUNTING_HEADER.length);
  });

  it("Datum nach Zürcher Zeit, nicht UTC", () => {
    const row = accountingRows([order({ paid_at: "2026-10-27T23:30:00Z" })], options)[1]!;
    expect(row[1]).toBe("28.10.2026");
  });

  it("rechnet Rabatt, Versand, Gutschein und Rückerstattung in die MWST-Basis wie die Quittung", () => {
    // Warenwert 500, Rabatt 50, Versand 9.90, davon 100 per Gutschein (nur Zahlungsmittel), 20 Karte zurück
    const o = order({
      subtotal_cents: 50000,
      discount_cents: 5000,
      shipping_cents: 990,
      gift_card_cents: 10000,
      total_cents: 35990,
      refunded_cents: 2000,
    });
    // Basis 50000 - 5000 + 990 - 2000 = 43990
    expect(orderVat(o, options)).toEqual({ rate: 8.1, cents: Math.round((43990 * 8.1) / 108.1) });
    // Gutscheinanteil, der zurückgebucht wurde, mindert die Basis ebenfalls
    expect(orderVat({ ...o, gift_card_credited_cents: 10000 }, options)?.cents).toBe(
      Math.round((33990 * 8.1) / 108.1),
    );
  });

  it("ohne MWST-Pflicht und ohne gespeicherten Satz: keine MWST; Altbestellung mit Satz bleibt", () => {
    const off = { ...options, vatRegistered: false };
    expect(orderVat(order({ vat_rate: null }), off)).toBeNull();
    expect(orderVat(order({ vat_rate: 8.1 }), off)).toMatchObject({ rate: 8.1 });
    expect(orderVat(order({ vat_rate: null }), options)).toMatchObject({ rate: 8.1 });
    const row = accountingRows([order({ vat_rate: null })], off)[1]!;
    expect(row.slice(12, 14)).toEqual(["", ""]);
  });

  it("Gutscheinkäufe weisen keine MWST aus; fehlende Angaben bleiben leer", () => {
    const row = accountingRows(
      [
        order({
          kind: "gift_card",
          shipping_name: null,
          shipping_address: null,
          payment_method: null,
          stripe_payment_intent_id: null,
          paid_at: null,
        }),
      ],
      options,
    )[1]!;
    expect(row.slice(12, 14)).toEqual(["", ""]);
    expect(row[3]).toBe("");
    expect(row[5]).toBe("");
    expect(row.slice(14)).toEqual(["", ""]);
    expect(row[1]).toBe("27.10.2026"); // ohne Zahlungsdatum das Bestelldatum
  });

  it("Rappenbeträge mit führender Null; unbekannte Zahlungsart bleibt als Code", () => {
    const row = accountingRows(
      [order({ total_cents: 5, subtotal_cents: 5, payment_method: "sepa" })],
      options,
    )[1]!;
    expect(row[6]).toBe("0.05");
    expect(row[14]).toBe("sepa");
  });

  it("CSV: BOM, Semikolon, CRLF; Namen mit Formelzeichen werden entschärft", () => {
    const csv = toCsv(accountingRows([order({ shipping_name: "=1+1;x" })], options));
    expect(csv.startsWith("﻿Bestellung;Datum;Status;")).toBe(true);
    expect(csv).toContain('\r\nAX-1042;27.10.2026;Versendet;"\'=1+1;x";kunde@example.ch;CH;');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("paymentLabel", () => {
  it("übersetzt bekannte Codes, lässt unbekannte stehen und leert fehlende", () => {
    expect(paymentLabel("apple_pay")).toBe("Apple Pay");
    expect(paymentLabel("twint")).toBe("TWINT");
    expect(paymentLabel("sepa")).toBe("sepa");
    expect(paymentLabel(null)).toBe("");
  });
});
