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
};

describe("returnConfirmation", () => {
  it("deutsch: Nummern, Stücke, Rücksendeadresse und Schritte; kein Etikettversprechen", () => {
    const m = returnConfirmation(data, shop);
    expect(m.subject).toBe("Deine Retoure R-1001 ist angemeldet");
    expect(m.text).toContain("AX-10001");
    expect(m.text).toContain("1 × Anzug Limmat, Blau, Grösse 50 (Zu gross)");
    expect(m.text).toContain("2 × Gürtel, Einheitsgrösse (Anderer Grund)");
    expect(m.text).toContain("Schicke das Paket an: Axion AG, Teststrasse 1, 8000 Zürich");
    expect(m.text).toContain("https://shop.test/versand-und-rueckgabe");
    expect(m.text + m.html).not.toMatch(/Retourenetikett|Rücksendeetikett|kostenlos|gratis/i);
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
    expect(m.text).toContain("Send the parcel to: [return address]");
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
  });
});
