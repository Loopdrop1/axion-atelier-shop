import { describe, expect, it } from "vitest";
import { returnConfirmation, returnNotification, type ReturnMailData } from "./returns.ts";
import type { ShopInfo } from "./layout.ts";

const shop: ShopInfo = {
  name: "Axion",
  siteUrl: "https://shop.test",
  contactEmail: "info@axion.test",
  address: "Axion AG, Teststrasse 1, 8000 Zürich",
  returnDays: 14,
};

const data: ReturnMailData = {
  locale: "de",
  returnNumber: 1001,
  orderNumber: 10001,
  email: "kunde@example.ch",
  items: [
    { title: "Anzug Limmat", size: "50", color: "Blau", quantity: 1, reason: "too_large" },
    { title: "Gürtel", size: "One Size", color: null, quantity: 2, reason: "other" },
  ],
  comment: "Zu <b>weit</b>",
  refundMethod: "original",
};

describe("returnConfirmation", () => {
  it("deutsch: Nummern, Stücke, Etikett im Paket, gratis, Rückerstattung aufs Zahlungsmittel", () => {
    const m = returnConfirmation(data, shop);
    expect(m.subject).toBe("Deine Retoure R-1001 ist angemeldet");
    expect(m.text).toContain("AX-10001");
    expect(m.text).toContain("1 × Anzug Limmat, Blau, Grösse 50 (Zu gross)");
    expect(m.text).toContain("2 × Gürtel, Einheitsgrösse (Anderer Grund)");
    expect(m.text).toContain("Rücksendeetikett auf, das deinem Paket beiliegt");
    expect(m.text).toContain("Die Rücksendung ist für dich gratis.");
    expect(m.text).toContain("Rücksendeadresse: Axion AG, Teststrasse 1, 8000 Zürich");
    expect(m.text).toContain("Rückerstattung: Ursprüngliches Zahlungsmittel");
    expect(m.text).toContain(
      "Innert 7 Tagen nach Eingang deiner Rücksendung erstatten wir den Kaufpreis der zurückgegebenen Stücke auf das ursprüngliche Zahlungsmittel.",
    );
    expect(m.text).toContain(
      "Mit einem Gutschein bezahlte Beträge schreiben wir immer dem Gutschein gut.",
    );
    expect(m.text).toContain("https://shop.test/versand-und-rueckgabe");
    expect(m.html).toContain("Rückerstattung: Ursprüngliches Zahlungsmittel");
  });

  it("Gutschein gewählt: Rückerstattung als Gutschein (deutsch und englisch)", () => {
    const de = returnConfirmation({ ...data, refundMethod: "gift_card" }, shop);
    expect(de.text).toContain("Rückerstattung: Gutschein");
    expect(de.text).toContain("zurückgegebenen Stücke als Gutschein.");
    expect(de.text).not.toContain("auf das ursprüngliche Zahlungsmittel");
    const en = returnConfirmation({ ...data, locale: "en", refundMethod: "gift_card" }, shop);
    expect(en.text).toContain("Refund: Gift card");
    expect(en.text).toContain("Within 7 days of your return arriving");
    expect(en.text).toContain("returned pieces as a gift card.");
  });

  it("maskiert HTML im Kommentar", () => {
    const m = returnConfirmation(data, shop);
    expect(m.html).not.toContain("<b>weit</b>");
    expect(m.html).toContain("&lt;b&gt;weit&lt;/b&gt;");
  });

  it("englisch mit /en-Link; ohne Adresse ein Platzhalter", () => {
    const m = returnConfirmation(
      { ...data, locale: "en", comment: null },
      { ...shop, address: "" },
    );
    expect(m.subject).toBe("Your return R-1001 is registered");
    expect(m.text).toContain("Return address: [return address]");
    expect(m.text).toContain("Attach the return label enclosed in your parcel");
    expect(m.text).toContain("Returns are free for you.");
    expect(m.text).toContain("to the original payment method");
    expect(m.text).toContain("Refund: Original payment method");
    expect(m.text).toContain("https://shop.test/en/versand-und-rueckgabe");
    expect(m.text).toContain("One size");
    expect(m.text).not.toContain("Your comment");
  });
});

describe("returnNotification", () => {
  it("geht immer auf Deutsch an den Shop, mit Link in den Admin", () => {
    const m = returnNotification(
      { ...data, locale: "en" },
      shop,
      "https://shop.test/admin/retouren",
    );
    expect(m.subject).toBe("Neue Retoure R-1001 zu AX-10001");
    expect(m.text).toContain("kunde@example.ch (Englisch)");
    expect(m.text).toContain("Zu gross");
    expect(m.text).toContain("https://shop.test/admin/retouren");
    expect(m.text).toContain("Rückerstattung: Zahlungsmittel");
  });

  it("zeigt die Wahl Gutschein", () => {
    const m = returnNotification(
      { ...data, refundMethod: "gift_card" },
      shop,
      "https://shop.test/admin/retouren",
    );
    expect(m.text).toContain("Rückerstattung: Gutschein");
    expect(m.html).toContain("Rückerstattung: Gutschein");
  });
});
