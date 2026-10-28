import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AddressLabel, PackingSlips, type SlipOrder } from "./shipping-docs";
import { printDoc } from "./print";

const order: SlipOrder = {
  id: "o1",
  number: 1042,
  locale: "de",
  shipping_name: "Max Muster",
  shipping_address: { line1: "Dorfstrasse 2", postal_code: "8498", city: "Gibswil", country: "CH" },
  phone: "+41 79 000 00 00",
  created_at: "2026-10-27T10:00:00Z",
  paid_at: "2026-10-27T10:05:00Z",
  subtotal_cents: 24900,
  discount_cents: 0,
  discount_code: null,
  gift_card_cents: 0,
  shipping_cents: 0,
  total_cents: 24900,
  items: [
    {
      id: "i1",
      variant_id: "v1",
      title: "Mantel",
      size: "M",
      color: "Navy",
      quantity: 2,
      unit_price_cents: 12450,
      line_total_cents: 24900,
    },
  ],
};
const codes = { v1: { sku: "AX-MA-NAV-M", barcode: "7612345678900" } };

afterEach(() => {
  delete document.body.dataset["print"];
});

describe("Lieferschein", () => {
  it("zeigt Artikel mit Farbe, Grösse, Artikelnummer und Barcode, Rückgabehinweis und Preise", async () => {
    render(<PackingSlips orders={[order]} codes={codes} withPrices />);
    const slip = await waitForDoc(".admin-slip");
    const text = slip.textContent ?? "";
    expect(text).toContain("Lieferschein");
    expect(text).toContain("Bestellung AX-1042");
    expect(text).toContain("Max Muster");
    expect(text).toContain("Navy · Grösse M · Art.-Nr. AX-MA-NAV-M · Barcode 7612345678900");
    expect(text).toContain("Rückgabe innert 14 Tagen");
    expect(text).toContain("/versand-und-rueckgabe");
    expect(text).toContain("249.00");
    expect(slip.classList.contains("admin-printdoc")).toBe(true);
  });

  it("ohne Preise: keine Beträge, Menge bleibt", async () => {
    render(<PackingSlips orders={[order]} codes={codes} withPrices={false} />);
    const text = (await waitForDoc(".admin-slip")).textContent ?? "";
    expect(text).not.toMatch(/249\.00|124\.50|Total|Preis/);
    expect(text).toContain("Mantel");
  });

  it("englische Bestellung: englischer Lieferschein; eine Seite pro Bestellung", async () => {
    render(
      <PackingSlips
        orders={[
          { ...order, locale: "en" },
          { ...order, id: "o2", number: 1043 },
        ]}
        codes={codes}
        withPrices
      />,
    );
    const slip = await waitForDoc(".admin-slip");
    expect(slip.querySelectorAll(".admin-slip-page")).toHaveLength(2);
    expect(slip.textContent).toContain("Delivery note");
    expect(slip.textContent).toContain("Switzerland");
    expect(slip.textContent).toContain("Returns within 14 days");
  });
});

describe("Adressetikette", () => {
  it("Absender (Platzhalter bleiben sichtbar), Empfänger und Bestellnummer", async () => {
    render(<AddressLabel order={order} />);
    const label = await waitForDoc(".admin-label");
    expect(label.querySelector(".sender")?.textContent).toMatch(/Absender: .+/);
    expect(label.querySelector(".recipient")?.textContent).toContain("Dorfstrasse 2");
    expect(label.querySelector(".recipient")?.textContent).toContain("8498 Gibswil");
    expect(label.querySelector(".recipient")?.textContent).toContain("Schweiz");
    expect(label.querySelector(".meta")?.textContent).toContain("AX-1042");
  });
});

describe("printDoc", () => {
  it("wählt das Dokument über data-print und räumt nach dem Drucken auf", () => {
    let printed: string | undefined;
    window.print = () => {
      printed = document.body.dataset["print"];
    };
    printDoc("slip");
    expect(printed).toBe("slip");
    window.dispatchEvent(new Event("afterprint"));
    expect(document.body.dataset["print"]).toBeUndefined();
    printDoc("receipt");
    expect(printed).toBeUndefined();
  });
});

/** Portal hängt erst nach dem Mounten an <body>. */
async function waitForDoc(selector: string): Promise<HTMLElement> {
  for (let i = 0; i < 20; i++) {
    const el = document.body.querySelector<HTMLElement>(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`${selector} nicht gefunden`);
}
