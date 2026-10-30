import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptDocument } from "@/components/shop/receipt-document";
import type { OrderDetail } from "@/lib/account/api";
import { orderReceiptData, receiptAvailable } from "./order-receipt-data";

const order = {
  id: "o1",
  number: 1042,
  status: "shipped",
  kind: "cart",
  created_at: "2026-10-27T10:00:00Z",
  paid_at: "2026-10-27T10:05:00Z",
  shipped_at: null,
  email: "kunde@example.ch",
  subtotal_cents: 24900,
  discount_cents: 0,
  discount_code: null,
  gift_card_cents: 0,
  shipping_cents: 0,
  total_cents: 24900,
  refunded_cents: 0,
  shipping_name: "Max Muster",
  shipping_address: { line1: "Dorfstrasse 2", postal_code: "8498", city: "Gibswil", country: "CH" },
  payment_method: "twint",
  tracking_number: "99.00.1",
  gift_card_purchase: null,
  order_items: [
    {
      id: "i1",
      title: "Mantel",
      size: "M",
      color: "Navy",
      image: null,
      handle: "mantel",
      unit_price_cents: 24900,
      quantity: 1,
      line_total_cents: 24900,
    },
  ],
} as unknown as OrderDetail;

describe("Kunden-Quittung", () => {
  it("gibt nur Quittungsdaten weiter (keine E-Mail, Sendungsnummer, Stripe- oder Admin-Felder)", () => {
    const data = orderReceiptData(order, "de");
    const json = JSON.stringify(data);
    expect(json).not.toContain("kunde@example.ch");
    expect(json).not.toContain("99.00.1");
    expect(json).not.toMatch(/stripe|admin_note|status_token/i);
    expect(data.vat_rate).toBeNull();
    expect(data.items[0]).toEqual({
      id: "i1",
      title: "Mantel",
      color: "Navy",
      size: "M",
      quantity: 1,
      unit_price_cents: 24900,
      line_total_cents: 24900,
    });
  });

  it("übernimmt den bei der Zahlung gespeicherten MWST-Satz, sonst null (dann gilt die Konfiguration)", () => {
    expect(
      orderReceiptData({ ...order, vat_rate: 8.1 } as unknown as OrderDetail, "de").vat_rate,
    ).toBe(8.1);
    expect(
      orderReceiptData({ ...order, vat_rate: "2.60" } as unknown as OrderDetail, "de").vat_rate,
    ).toBe(2.6);
    expect(
      orderReceiptData({ ...order, vat_rate: 0 } as unknown as OrderDetail, "de").vat_rate,
    ).toBe(0);
    expect(
      orderReceiptData({ ...order, vat_rate: null } as unknown as OrderDetail, "de").vat_rate,
    ).toBeNull();
    // gespeicherter Satz erzeugt auch ohne MWST-Pflicht in der Konfiguration die MWST-Zeile
    const withVat = render(
      <ReceiptDocument
        data={orderReceiptData({ ...order, vat_rate: 8.1 } as unknown as OrderDetail, "de")}
      />,
    ).container;
    expect(withVat.textContent).toContain("MWST");
    expect(withVat.textContent).toContain("8.1");
  });

  it("nur bezahlte Bestellungen haben eine Quittung", () => {
    for (const status of ["paid", "shipped", "refunded"])
      expect(receiptAvailable({ status } as never)).toBe(true);
    for (const status of ["pending", "cancelled"])
      expect(receiptAvailable({ status } as never)).toBe(false);
  });

  it("Deutsch und Englisch nach Sprache der Seite; MWST-Zeile nur mit MWST-Pflicht", () => {
    const de = render(<ReceiptDocument data={orderReceiptData(order, "de")} />).container;
    expect(de.textContent).toContain("Quittung");
    expect(de.textContent).toContain("Bestellung AX-1042");
    expect(de.textContent).toContain("Rückgabe innert");
    expect(de.textContent).not.toContain("MWST");
    const en = render(<ReceiptDocument data={orderReceiptData(order, "en")} />).container;
    expect(en.textContent).toContain("Receipt");
    expect(en.textContent).toContain("Order AX-1042");
    expect(en.textContent).toContain("Returns within");
  });
});
