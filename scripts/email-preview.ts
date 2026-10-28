// Schreibt alle E-Mail-Vorlagen mit Beispieldaten nach .local/email-preview/ (HTML und Text) zur Sichtprüfung.
// Aufruf: bun scripts/email-preview.ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Locale } from "../supabase/functions/_shared/money.ts";
import {
  authEmail,
  cartReminder,
  giftCardEmail,
  lowStockAlert,
  newsletterConfirm,
  newsletterWelcome,
  orderConfirmation,
  refundNotice,
  securityNotice,
  shippingConfirmation,
  shopNotification,
  type EmailContent,
  type OrderData,
} from "../supabase/functions/_shared/email/templates.ts";

const OUT = path.resolve(import.meta.dirname, "../.local/email-preview");
const shop = {
  name: "Axion",
  siteUrl: "https://axion.ch",
  contactEmail: "hallo@axion.ch",
  address: "Musterstrasse 1, 8000 Zürich",
  returnDays: 14,
};

function order(locale: Locale, extra: Partial<OrderData> = {}): OrderData {
  return {
    id: "6b1f0c1e-0000-4000-8000-000000000001",
    number: 10042,
    kind: "cart",
    status: "paid",
    status_token: "0c6b2b9a-0000-4000-8000-000000000002",
    email: "anna.muster@example.ch",
    locale,
    subtotal_cents: 73800,
    discount_cents: 7380,
    discount_code: "LAUNCH10",
    gift_card_cents: 2000,
    shipping_cents: 0,
    total_cents: 64420,
    payment_method: "twint",
    shipping_name: "Anna Muster",
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
        title: "Anzug Milano",
        size: "50",
        color: "Navy",
        quantity: 1,
        unit_price_cents: 54900,
        line_total_cents: 54900,
      },
      {
        title: "Weste Milano",
        size: "50",
        color: "Navy",
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

const mails: Record<string, EmailContent> = {};
for (const locale of ["de", "en"] as const) {
  mails[`${locale}-bestellung`] = orderConfirmation(order(locale), shop);
  mails[`${locale}-gutscheinkauf`] = orderConfirmation(
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
  );
  mails[`${locale}-versand`] = shippingConfirmation(order(locale), shop);
  mails[`${locale}-warenkorb-erinnerung`] = cartReminder(
    order(locale, {
      status: "cancelled",
      discount_cents: 0,
      discount_code: null,
      gift_card_cents: 0,
      items: order(locale).items.map((i, n) => ({
        ...i,
        image_url: n === 0 ? "https://axion.ch/og.jpg" : null,
      })),
    }),
    shop,
  );
  mails[`${locale}-rueckerstattung-teilweise`] = refundNotice(
    order(locale, { refunded_cents: 5000 }),
    5000,
    shop,
  );
  mails[`${locale}-rueckerstattung-storniert`] = refundNotice(
    order(locale, { refunded_cents: 64420, tracking_number: null, shipped_at: null }),
    64420,
    shop,
  );
  mails[`${locale}-gutschein`] = giftCardEmail(
    {
      code: "AXN-K7QM-4XTB-9WRD",
      initial_cents: 15000,
      balance_cents: 15000,
      expires_at: "2031-10-12T21:59:59Z",
      locale,
      recipient_email: "lea@example.ch",
      recipient_name: "Lea",
      sender_name: "Tom",
      message: locale === "de" ? "Alles Gute zum Geburtstag!\nDein Tom" : "Happy birthday!\nTom",
    },
    shop,
  );
  mails[`${locale}-newsletter-bestaetigen`] = newsletterConfirm(
    { locale, confirmUrl: "https://axion.ch/newsletter/bestaetigen?token=abc" },
    shop,
  );
  mails[`${locale}-newsletter-willkommen`] = newsletterWelcome(
    {
      locale,
      unsubscribeUrl: "https://axion.ch/newsletter/abmelden?token=abc",
      welcomeCode: "WILLKOMMEN-4F9A2C",
      welcomePercent: 10,
    },
    shop,
  );
  for (const kind of [
    "signup",
    "recovery",
    "email_change",
    "magiclink",
    "invite",
    "reauthentication",
  ] as const) {
    mails[`${locale}-konto-${kind}`] = authEmail(
      {
        kind,
        locale,
        actionUrl: "https://axion.ch/konto/bestaetigen?token_hash=x&type=" + kind,
        token: "482913",
      },
      shop,
    );
  }
  mails[`${locale}-konto-email_change-alt`] = authEmail(
    {
      kind: "email_change",
      audience: "current",
      newEmail: "anna.neu@example.ch",
      locale,
      actionUrl: "https://axion.ch/konto/bestaetigen?token_hash=y&type=email_change",
    },
    shop,
  );
  mails[`${locale}-sicherheit-passwort`] = securityNotice(
    { kind: "password_changed_notification", locale },
    shop,
  );
}
mails["de-shop-meldung"] = shopNotification(order("de"), shop);
mails["de-shop-bestand"] = lowStockAlert(
  {
    orderNumber: 10042,
    threshold: 2,
    items: [
      { title: "Anzug Milano", color: "Navy", size: "50", stock: 2 },
      { title: "Weste Milano", color: "Navy", size: "50", stock: 0 },
      { title: "Gürtel Classic", color: "Schwarz", size: "One Size", stock: 1 },
    ],
  },
  shop,
);
mails["de-shop-meldung-pruefen"] = shopNotification(
  order("de", { needs_attention: true, admin_note: "Bestand fehlte nach Zahlungseingang" }),
  shop,
);

mkdirSync(OUT, { recursive: true });
const index: string[] = [];
for (const [name, mail] of Object.entries(mails)) {
  writeFileSync(path.join(OUT, `${name}.html`), mail.html);
  writeFileSync(path.join(OUT, `${name}.txt`), `Betreff: ${mail.subject}\n\n${mail.text}\n`);
  index.push(`<li><a href="${name}.html">${name}</a> · ${mail.subject.replace(/</g, "&lt;")}</li>`);
}
writeFileSync(
  path.join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>E-Mail-Vorschau</title><ul>${index.join("\n")}</ul>`,
);
console.log(`${Object.keys(mails).length} E-Mails geschrieben: ${OUT}`);
