import { describe, expect, it } from "vitest";
import type { Locale } from "../money.ts";
import type { ShopInfo } from "./layout.ts";
import {
  authEmail,
  cartReminder,
  cartReminderUrl,
  contactMessage,
  giftCardEmail,
  newsletterConfirm,
  newsletterWelcome,
  orderConfirmation,
  refundNotice,
  securityNotice,
  shippingConfirmation,
  lowStockAlert,
  shopNotification,
  trackingUrl,
  type AuthKind,
  type EmailContent,
  type GiftCardInfo,
  type OrderData,
} from "./templates.ts";

const shop: ShopInfo = {
  name: "Axion",
  siteUrl: "https://shop.test",
  contactEmail: "hallo@shop.test",
  address: "Musterweg 1, 8000 Zürich",
  returnDays: 14,
};

function order(locale: Locale, extra: Partial<OrderData> = {}): OrderData {
  return {
    id: "6b1f0c1e-0000-4000-8000-000000000001",
    number: 10042,
    kind: "cart",
    status: "paid",
    status_token: "0c6b2b9a-0000-4000-8000-000000000002",
    email: "kunde@example.ch",
    locale,
    subtotal_cents: 73800,
    discount_cents: 7380,
    discount_code: "LAUNCH10",
    gift_card_cents: 2000,
    shipping_cents: 0,
    total_cents: 64420,
    payment_method: "twint",
    shipping_name: "Anna <Muster>",
    shipping_address: {
      line1: "Bahnhofstrasse 1",
      line2: null,
      postal_code: "8001",
      city: "Zürich",
      country: "CH",
    },
    tracking_number: "99.00.123456.12345678",
    items: [
      {
        title: "Anzug «Zürich» <Navy>",
        size: "50",
        color: "Navy",
        quantity: 1,
        unit_price_cents: 54900,
        line_total_cents: 54900,
      },
      {
        title: "Weste",
        size: "M",
        color: null,
        quantity: 1,
        unit_price_cents: 18900,
        line_total_cents: 18900,
      },
    ],
    gift_card_purchase: null,
    issued_gift_card: null,
    ...extra,
  };
}

const card = (locale: Locale): GiftCardInfo => ({
  code: "AXN-ABCD-EFGH-JKLM",
  initial_cents: 15000,
  balance_cents: 15000,
  expires_at: "2031-10-12T21:59:59.000Z",
  locale,
  recipient_email: "lea@example.ch",
  recipient_name: "Lea",
  sender_name: "Tom <script>",
  message: "Alles Gute!\n<b>Dein Tom</b>",
});

function reminderOrder(locale: Locale): OrderData {
  const base = order(locale, {
    status: "cancelled",
    discount_cents: 0,
    discount_code: null,
    gift_card_cents: 0,
  });
  return {
    ...base,
    items: base.items.map((i, n) => ({
      ...i,
      image_url: n === 0 ? "https://img.shop.test/anzug-1.webp" : null,
    })),
  };
}

function all(locale: Locale): [string, EmailContent][] {
  const kinds: AuthKind[] = [
    "signup",
    "recovery",
    "email_change",
    "email",
    "magiclink",
    "invite",
    "reauthentication",
  ];
  return [
    ["orderConfirmation", orderConfirmation(order(locale), shop)],
    [
      "orderConfirmation (Gutscheinkauf)",
      orderConfirmation(
        order(locale, {
          kind: "gift_card",
          items: [],
          subtotal_cents: 15000,
          discount_cents: 0,
          discount_code: null,
          gift_card_cents: 0,
          total_cents: 15000,
          shipping_address: null,
          shipping_name: null,
          gift_card_purchase: { amount_cents: 15000, recipient_email: "lea@example.ch" },
        }),
        shop,
      ),
    ],
    ["shopNotification", shopNotification(order(locale), shop)],
    ["shippingConfirmation", shippingConfirmation(order(locale), shop)],
    [
      "shippingConfirmation (ohne Nummer)",
      shippingConfirmation(order(locale, { tracking_number: null }), shop),
    ],
    ["giftCardEmail", giftCardEmail(card(locale), shop)],
    ["cartReminder", cartReminder(reminderOrder(locale), shop)],
    ["refundNotice (teilweise)", refundNotice(order(locale, { refunded_cents: 5000 }), 5000, shop)],
    [
      "refundNotice (ganz, storniert)",
      refundNotice(
        order(locale, { refunded_cents: 64420, tracking_number: null, shipped_at: null }),
        64420,
        shop,
      ),
    ],
    [
      "newsletterConfirm",
      newsletterConfirm(
        { locale, confirmUrl: "https://shop.test/newsletter/bestaetigen?token=abc" },
        shop,
      ),
    ],
    [
      "newsletterWelcome",
      newsletterWelcome(
        {
          locale,
          unsubscribeUrl: "https://shop.test/newsletter/abmelden?token=abc",
          welcomeCode: "WILLKOMMEN-ABC123",
          welcomePercent: 10,
        },
        shop,
      ),
    ],
    [
      "newsletterWelcome (ohne Rabatt)",
      newsletterWelcome(
        { locale, unsubscribeUrl: "https://shop.test/newsletter/abmelden?token=abc" },
        shop,
      ),
    ],
    ...kinds.map((kind): [string, EmailContent] => [
      `authEmail ${kind}`,
      authEmail(
        {
          kind,
          locale,
          actionUrl: "https://shop.test/konto/bestaetigen?token_hash=x&type=" + kind,
          token: "123456",
        },
        shop,
      ),
    ]),
    [
      "authEmail email_change (alte Adresse)",
      authEmail(
        {
          kind: "email_change",
          audience: "current",
          newEmail: "neu@example.ch",
          locale,
          actionUrl: "https://shop.test/konto/bestaetigen?token_hash=y&type=email_change",
        },
        shop,
      ),
    ],
    ...[
      "password_changed_notification",
      "email_changed_notification",
      "identity_linked_notification",
    ].map((kind): [string, EmailContent] => [
      `securityNotice ${kind}`,
      securityNotice(
        { kind, locale, oldEmail: "alt@example.ch", newEmail: "neu@example.ch" },
        shop,
      ),
    ]),
  ];
}

describe("E-Mail-Vorlagen: Grundregeln für alle Vorlagen in DE und EN", () => {
  for (const locale of ["de", "en"] as const) {
    for (const [name, mail] of all(locale)) {
      it(`${locale}: ${name}`, () => {
        expect(mail.subject.trim().length).toBeGreaterThan(5);
        expect(mail.text.trim().length).toBeGreaterThan(20);
        expect(mail.html.startsWith("<!doctype html>")).toBe(true);
        for (const s of [mail.subject, mail.text, mail.html]) {
          expect(s).not.toMatch(/\{\{|\}\}|undefined|NaN|\[object Object\]/);
          expect(s).not.toMatch(/\bnull\b/);
          expect(s).not.toContain("ß");
        }
        // Benutzereingaben sind in HTML maskiert
        expect(mail.html).not.toMatch(/<script>|<Muster>|<Navy>|<b>Dein Tom<\/b>/);
        expect(mail.html).toContain("Musterweg 1, 8000 Zürich");
      });
    }
  }
});

describe("E-Mail-Vorlagen: Inhalte", () => {
  it("Bestellbestätigung: Beträge im Schweizer Format, Rabatt, Gutschein, Gratis-Versand, Zahlungsart, Statuslink", () => {
    const de = orderConfirmation(order("de"), shop);
    expect(de.subject).toBe("Bestellbestätigung AX-10042");
    expect(de.text).toMatch(/Total: CHF\s644\.20/);
    expect(de.text).toMatch(/Rabatt \(LAUNCH10\): −CHF\s73\.80/);
    expect(de.text).toMatch(/Geschenkgutschein: −CHF\s20\.00/);
    expect(de.text).toContain("Versand: Gratis");
    expect(de.text).toContain("Bezahlt mit: TWINT");
    expect(de.text).toContain("https://shop.test/bestellung/0c6b2b9a-0000-4000-8000-000000000002");
    const en = orderConfirmation(order("en"), shop);
    expect(en.text).toContain("Shipping: Free");
    expect(en.text).toContain(
      "https://shop.test/en/bestellung/0c6b2b9a-0000-4000-8000-000000000002",
    );
    expect(en.text).toContain("Switzerland");
  });

  it("Bestellbestätigung: Hinweis auf Rückgabe und Umtausch (nicht beim Gutscheinkauf)", () => {
    expect(orderConfirmation(order("de"), shop).text).toContain(
      "Rückgabe und Umtausch: Du hast 14 Tage Zeit. Alles Wichtige steht unter https://shop.test/versand-und-rueckgabe",
    );
    expect(orderConfirmation(order("en"), shop).html).toContain(
      "https://shop.test/en/versand-und-rueckgabe",
    );
    const gift = orderConfirmation(order("de", { kind: "gift_card", items: [] }), shop);
    expect(gift.text).not.toContain("Rückgabe und Umtausch");
  });

  it("Versandbestätigung: nennt die Rückgabefrist aus ShopInfo", () => {
    const de = shippingConfirmation(order("de"), { ...shop, returnDays: 30 });
    expect(de.text).toContain("Du hast 30 Tage Zeit");
    expect(de.html).toContain("Du hast 30 Tage Zeit");
    expect(shippingConfirmation(order("en"), shop).text).toContain("you have 14 days");
  });

  it("Kontaktformular: Absender, maskierte Nachricht, Sprache", () => {
    const mail = contactMessage(
      {
        name: "Anna <Muster>",
        email: "anna@example.ch",
        message: "Hallo\n<b>Frage</b>",
        locale: "en",
      },
      shop,
    );
    expect(mail.subject).toBe("Kontaktformular: Anna <Muster>");
    expect(mail.html).toContain("Anna &lt;Muster&gt;");
    expect(mail.html).toContain("Hallo<br>&lt;b&gt;Frage&lt;/b&gt;");
    expect(mail.text).toContain("auf Englisch geschrieben");
  });

  it("Tausendertrennzeichen wie im Shop (CHF 1’299.00)", () => {
    const mail = orderConfirmation(order("de", { total_cents: 129900 }), shop);
    expect(mail.text).toMatch(/Total: CHF\s1’299\.00/);
  });

  it("Versandmeldung: Sendungsnummer und Link der Post", () => {
    const mail = shippingConfirmation(order("de"), shop);
    expect(mail.text).toContain("99.00.123456.12345678");
    expect(mail.text).toContain(trackingUrl("99.00.123456.12345678"));
    expect(trackingUrl("AB 12/3")).toBe(
      "https://www.post.ch/swisspost-tracking?formattedParcelCodes=AB%2012%2F3",
    );
  });

  it("Shop-Meldung: immer Deutsch, Link ins Admin, Hinweis bei Prüfbedarf", () => {
    const normal = shopNotification(order("en"), shop);
    expect(normal.subject).toMatch(/^Neue Bestellung AX-10042 · CHF\s644\.20$/);
    expect(normal.text).toContain(
      "https://shop.test/admin/bestellungen/6b1f0c1e-0000-4000-8000-000000000001",
    );
    expect(normal.text).toContain("Versand: Gratis");
    const attention = shopNotification(
      order("de", { needs_attention: true, admin_note: "Bestand fehlte nach Zahlungseingang" }),
      shop,
    );
    expect(attention.subject).toMatch(/^Bitte prüfen: Neue Bestellung/);
    expect(attention.text).toContain("Achtung, bitte prüfen: Bestand fehlte nach Zahlungseingang");
    expect(attention.html).toContain("Bestand fehlte nach Zahlungseingang");
  });

  it("Gutschein: Code, Betrag, Gültigkeit und maskierte persönliche Nachricht", () => {
    const de = giftCardEmail(card("de"), shop);
    expect(de.subject).toMatch(/^Dein Axion-Geschenkgutschein über CHF\s150\.00$/);
    expect(de.text).toContain("AXN-ABCD-EFGH-JKLM");
    expect(de.text).toContain("Gültig bis 12. Oktober 2031.");
    expect(de.html).toContain("Alles Gute!<br>&lt;b&gt;Dein Tom&lt;/b&gt;");
    expect(giftCardEmail(card("en"), shop).text).toContain("Valid until 12 October 2031.");
  });

  it("Newsletter-Willkommen: Abmeldelink in HTML und Text", () => {
    const mail = newsletterWelcome(
      { locale: "de", unsubscribeUrl: "https://shop.test/newsletter/abmelden?token=abc" },
      shop,
    );
    expect(mail.html).toContain('href="https://shop.test/newsletter/abmelden?token=abc"');
    expect(mail.text).toContain("Abmelden: https://shop.test/newsletter/abmelden?token=abc");
  });

  it("Erinnerung: Artikel mit Bild, Link zum Wiederherstellen, Grund des Versands, kein Rabatt", () => {
    const de = cartReminder(reminderOrder("de"), shop);
    expect(de.subject).toBe("Dein Warenkorb wartet auf dich");
    const url = "https://shop.test/warenkorb/wiederherstellen/0c6b2b9a-0000-4000-8000-000000000002";
    expect(cartReminderUrl(shop, reminderOrder("de"))).toBe(url);
    expect(de.text).toContain(`Zum Warenkorb: ${url}`);
    expect(de.html).toContain(`href="${url}"`);
    expect(de.html).toContain('src="https://img.shop.test/anzug-1.webp"');
    expect(de.html.match(/<img /g)).toHaveLength(1);
    expect(de.text).toContain("Weste");
    expect(de.text).toContain("angekreuzt");
    expect(de.html).toContain("«Erinnere mich per E-Mail, falls ich den Kauf nicht abschliesse»");
    expect(de.text).not.toMatch(/Rabatt|Gutschein|Gratis|%|Code/);
    const en = cartReminder(reminderOrder("en"), shop);
    expect(en.subject).toBe("Your basket is waiting for you");
    expect(en.text).toContain(`Go to basket: https://shop.test/en/warenkorb/wiederherstellen/`);
    expect(en.text).not.toMatch(/discount|gift card|%|code/i);
  });

  it("Erinnerung: Bilder nur über https, Titel maskiert", () => {
    const o = reminderOrder("de");
    o.items[0]!.image_url = "javascript:alert(1)";
    const mail = cartReminder(o, shop);
    expect(mail.html).not.toContain("javascript:");
    expect(mail.html).not.toContain("<img ");
    expect(mail.html).toContain("Anzug «Zürich» &lt;Navy&gt;");
  });

  it("Rückerstattung: Betrag, Bestellnummer, Hinweis zur Bank; ganz vs. teilweise", () => {
    const partial = refundNotice(order("de", { refunded_cents: 5000 }), 5000, shop);
    expect(partial.subject).toBe("Deine Rückerstattung zur Bestellung AX-10042");
    expect(partial.text).toMatch(
      /einen Teil deiner Bestellung AX-10042 zurückerstattet: CHF\s50\.00/,
    );
    expect(partial.text).toContain("ein paar Tage");
    expect(partial.text).not.toContain("storniert");
    // 5000 von 64420: Rest bleibt offen
    expect(partial.text).toMatch(/Bestellung AX-10042, Total: CHF\s644\.20/);

    const second = refundNotice(order("de", { refunded_cents: 64420 }), 59420, shop);
    expect(second.text).toMatch(/vollständig zurückerstattet: CHF\s594\.20/);
    expect(second.text).toMatch(/Insgesamt zurückerstattet: CHF\s644\.20/);
    // Schon versandt (Sendungsnummer): Rückgabe, keine Stornierung
    expect(second.text).not.toContain("storniert");

    const cancelled = refundNotice(
      order("de", { refunded_cents: 64420, tracking_number: null }),
      64420,
      shop,
    );
    expect(cancelled.text).toContain("Die Bestellung ist damit storniert");
    // Geschenkgutschein-Anteil wird erklärt
    expect(cancelled.text).toContain("Geschenkgutschein bezahlter Anteil");

    const en = refundNotice(order("en", { refunded_cents: 5000 }), 5000, shop);
    expect(en.subject).toBe("Your refund for order AX-10042");
    expect(en.text).toMatch(/refunded part of your order AX-10042: CHF\s50\.00/);
    expect(en.text).toContain("few days");
    expect(en.text).toContain(
      "https://shop.test/en/bestellung/0c6b2b9a-0000-4000-8000-000000000002",
    );
  });
});

describe("lowStockAlert", () => {
  it("nennt Produkt, Grösse und Restbestand, Null als ausverkauft, escaped HTML", () => {
    const mail = lowStockAlert(
      {
        orderNumber: 7,
        threshold: 2,
        items: [
          { title: "Anzug <b>", color: "Navy", size: "50", stock: 1 },
          { title: "Gürtel", color: null, size: "One Size", stock: 0 },
        ],
      },
      shop,
    );
    expect(mail.subject).toBe("Bestand knapp: 2 Artikel, davon 1 ausverkauft");
    expect(mail.text).toContain("Anzug <b>, Navy, Grösse 50: noch 1");
    expect(mail.text).toContain("Gürtel, Einheitsgrösse: ausverkauft");
    expect(mail.text).toContain("AX-7");
    expect(mail.text).toContain("https://shop.test/admin/produkte");
    expect(mail.html).toContain("Anzug &lt;b&gt;");
    expect(mail.html).not.toContain("Anzug <b>");
  });
});
