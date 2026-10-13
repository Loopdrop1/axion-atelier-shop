// Alle E-Mail-Vorlagen in Deutsch und Englisch. Jede liefert Betreff, HTML und Text.
import { formatChf, type Locale } from "../money.ts";
import { sizeText } from "../size.ts";
import {
  button,
  codeBox,
  divider,
  esc,
  escLines,
  h1,
  label,
  layout,
  p,
  rows,
  type ShopInfo,
} from "./layout.ts";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface OrderItem {
  title: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface Address {
  line1?: string | null;
  line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface GiftCardInfo {
  code: string;
  initial_cents: number;
  balance_cents: number;
  expires_at: string;
  locale: Locale;
  purchaser_email?: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  sender_name: string | null;
  message: string | null;
}

export interface OrderData {
  id: string;
  number: number;
  kind: "cart" | "gift_card";
  status: string;
  status_token: string;
  email: string;
  locale: Locale;
  subtotal_cents: number;
  discount_cents: number;
  discount_code: string | null;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  payment_method: string | null;
  shipping_name: string | null;
  shipping_address: Address | null;
  tracking_number: string | null;
  /** Nur für die Shop-Meldung: Zahlung kam an, aber etwas stimmt nicht (z. B. Bestand fehlte). */
  needs_attention?: boolean;
  admin_note?: string | null;
  items: OrderItem[];
  gift_card_purchase: {
    amount_cents?: number;
    recipient_name?: string | null;
    recipient_email?: string | null;
  } | null;
  issued_gift_card: GiftCardInfo | null;
}

export const orderNumber = (n: number) => `AX-${n}`;

export function trackingUrl(tracking: string): string {
  return `https://www.post.ch/swisspost-tracking?formattedParcelCodes=${encodeURIComponent(tracking)}`;
}

const prefixFor = (locale: Locale) => (locale === "en" ? "/en" : "");

function statusUrl(shop: ShopInfo, order: OrderData): string {
  return `${shop.siteUrl}${prefixFor(order.locale)}/bestellung/${order.status_token}`;
}

function paymentLabel(method: string | null, locale: Locale): string {
  const de: Record<string, string> = {
    card: "Karte",
    twint: "TWINT",
    klarna: "Klarna",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    gift_card: "Geschenkgutschein",
    discount: "Rabatt",
    link: "Link",
  };
  const en: Record<string, string> = {
    ...de,
    card: "Card",
    gift_card: "Gift card",
    discount: "Discount",
  };
  if (!method) return "";
  return (locale === "en" ? en : de)[method] ?? method;
}

function countryName(code: string | null | undefined, locale: Locale): string {
  if (code === "CH") return locale === "en" ? "Switzerland" : "Schweiz";
  if (code === "LI") return "Liechtenstein";
  return code ?? "";
}

function addressLines(name: string | null, a: Address | null, locale: Locale): string[] {
  if (!a) return [];
  return [
    name,
    a.line1,
    a.line2,
    [a.postal_code, a.city].filter(Boolean).join(" "),
    countryName(a.country, locale),
  ].filter((x): x is string => Boolean(x && String(x).trim()));
}

function dateText(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
}

const T = {
  de: {
    size: "Grösse",
    oneSize: "Einheitsgrösse",
    qty: "Menge",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    giftCard: "Geschenkgutschein",
    shipping: "Versand",
    free: "Gratis",
    total: "Total",
    paidWith: "Bezahlt mit",
    shipTo: "Lieferadresse",
    viewOrder: "Bestellung ansehen",
    questions: "Fragen? Antworte einfach auf diese E-Mail.",
  },
  en: {
    size: "Size",
    oneSize: "One size",
    qty: "Qty",
    subtotal: "Subtotal",
    discount: "Discount",
    giftCard: "Gift card",
    shipping: "Shipping",
    free: "Free",
    total: "Total",
    paidWith: "Paid with",
    shipTo: "Shipping address",
    viewOrder: "View order",
    questions: "Questions? Just reply to this email.",
  },
} as const;

function itemsBlock(order: OrderData): { html: string; text: string } {
  const t = T[order.locale];
  const html = rows(
    order.items.map((i) => ({
      left: `${esc(i.title)}<br><span style="color:#5F5F5F;font-size:13px;">${[i.color, i.size ? sizeText(i.size, t.size, t.oneSize) : null].filter(Boolean).map(esc).join(" · ")}${i.quantity > 1 ? ` · ${i.quantity} × ${esc(formatChf(i.unit_price_cents, order.locale))}` : ""}</span>`,
      right: esc(formatChf(i.line_total_cents, order.locale)),
    })),
  );
  const text = order.items
    .map(
      (i) =>
        `${i.quantity} × ${i.title}${i.color ? `, ${i.color}` : ""}${i.size ? `, ${sizeText(i.size, t.size, t.oneSize)}` : ""}: ${formatChf(i.line_total_cents, order.locale)}`,
    )
    .join("\n");
  return { html, text };
}

function totalsBlock(order: OrderData): { html: string; text: string } {
  const t = T[order.locale];
  const L = (c: number) => formatChf(c, order.locale);
  const entries: { left: string; right: string; strong?: boolean }[] = [
    { left: t.subtotal, right: L(order.subtotal_cents) },
  ];
  if (order.discount_cents > 0)
    entries.push({
      left: `${t.discount}${order.discount_code ? ` (${order.discount_code})` : ""}`,
      right: `−${L(order.discount_cents)}`,
    });
  if (order.gift_card_cents > 0)
    entries.push({ left: t.giftCard, right: `−${L(order.gift_card_cents)}` });
  if (order.kind === "cart")
    entries.push({
      left: t.shipping,
      right: order.shipping_cents > 0 ? L(order.shipping_cents) : t.free,
    });
  entries.push({ left: t.total, right: L(order.total_cents), strong: true });
  return {
    html: rows(entries.map((e) => ({ ...e, left: esc(e.left), right: esc(e.right) }))),
    text: entries.map((e) => `${e.left}: ${e.right}`).join("\n"),
  };
}

/** Bestellbestätigung an die Kundschaft (Waren oder Gutscheinkauf). */
/** Hinweis zu Rückgabe und Umtausch mit Link auf die Seite «Versand und Rückgabe». */
function returnsNote(shop: ShopInfo, de: boolean): string {
  return de
    ? `Rückgabe und Umtausch: Alles Wichtige steht unter ${shop.siteUrl}/versand-und-rueckgabe`
    : `Returns and exchanges: everything you need to know is at ${shop.siteUrl}/en/versand-und-rueckgabe`;
}

export function orderConfirmation(order: OrderData, shop: ShopInfo): EmailContent {
  const de = order.locale !== "en";
  const t = T[order.locale];
  const no = orderNumber(order.number);
  const subject = de ? `Bestellbestätigung ${no}` : `Order confirmation ${no}`;
  const items = itemsBlock(order);
  const totals = totalsBlock(order);
  const address = addressLines(order.shipping_name, order.shipping_address, order.locale);
  const isGift = order.kind === "gift_card";
  const recipient = order.gift_card_purchase?.recipient_email;
  const intro = isGift
    ? de
      ? `Wir haben deinen Geschenkgutschein über ${formatChf(order.total_cents, "de")} ${recipient ? `per E-Mail an ${recipient} geschickt` : "per E-Mail an dich geschickt"}.`
      : `We have emailed your gift card worth ${formatChf(order.total_cents, "en")} ${recipient ? `to ${recipient}` : "to you"}.`
    : de
      ? "Wir packen deine Stücke sorgfältig ein und melden uns, sobald sie unterwegs sind. Die Lieferung dauert 2 bis 5 Arbeitstage."
      : "We will pack your pieces carefully and let you know as soon as they are on their way. Delivery takes 2 to 5 working days.";
  const body = [
    h1(de ? "Danke für deine Bestellung" : "Thank you for your order"),
    p(esc(intro)),
    p(`${de ? "Bestellnummer" : "Order number"}: <strong>${esc(no)}</strong>`),
    button(t.viewOrder, statusUrl(shop, order)),
    label(de ? "Deine Bestellung" : "Your order"),
    isGift
      ? rows([
          {
            left: esc(de ? "Geschenkgutschein" : "Gift card"),
            right: esc(formatChf(order.total_cents, order.locale)),
          },
        ])
      : items.html,
    divider(),
    totals.html,
    order.payment_method
      ? p(`${esc(t.paidWith)}: ${esc(paymentLabel(order.payment_method, order.locale))}`, {
          muted: true,
          size: 13,
          margin: "12px 0 0",
        })
      : "",
    address.length ? divider() + label(t.shipTo) + p(address.map(esc).join("<br>")) : "",
    divider(),
    isGift ? "" : p(esc(returnsNote(shop, de)), { muted: true, size: 13 }),
    p(esc(t.questions), { muted: true, size: 13 }),
  ].join("\n");
  const text = [
    de ? "Danke für deine Bestellung" : "Thank you for your order",
    "",
    intro,
    "",
    `${de ? "Bestellnummer" : "Order number"}: ${no}`,
    "",
    isGift
      ? `${de ? "Geschenkgutschein" : "Gift card"}: ${formatChf(order.total_cents, order.locale)}`
      : items.text,
    "",
    totals.text,
    order.payment_method
      ? `${t.paidWith}: ${paymentLabel(order.payment_method, order.locale)}`
      : "",
    address.length ? `\n${t.shipTo}:\n${address.join("\n")}` : "",
    "",
    `${t.viewOrder}: ${statusUrl(shop, order)}`,
    "",
    isGift ? "" : returnsNote(shop, de),
    t.questions,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return {
    subject,
    html: layout({
      locale: order.locale,
      subject,
      preheader: `${no} · ${formatChf(order.total_cents, order.locale)}`,
      body,
      shop,
    }),
    text,
  };
}

/** Meldung an den Shop (immer Deutsch). */
export function shopNotification(order: OrderData, shop: ShopInfo): EmailContent {
  const no = orderNumber(order.number);
  const isGift = order.kind === "gift_card";
  const subject = `${order.needs_attention ? "Bitte prüfen: " : ""}${isGift ? "Gutscheinkauf" : "Neue Bestellung"} ${no} · ${formatChf(order.total_cents, "de")}`;
  const deOrder: OrderData = { ...order, locale: "de" };
  const items = itemsBlock(deOrder);
  const totals = totalsBlock(deOrder);
  const address = addressLines(order.shipping_name, order.shipping_address, "de");
  const adminUrl = `${shop.siteUrl}/admin/bestellungen/${order.id}`;
  const attention = order.needs_attention
    ? `Achtung, bitte prüfen: ${order.admin_note?.trim() || "Diese Bestellung ist im Admin markiert."}`
    : "";
  const body = [
    h1(isGift ? "Gutschein verkauft" : "Neue Bestellung"),
    attention
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#FBEDEC;border-left:3px solid #B5403A;padding:12px 14px;font-family:Helvetica, Arial, sans-serif;font-size:14px;line-height:1.5;color:#141414;">${escLines(attention)}</td></tr></table>`
      : "",
    p(
      `<strong>${esc(no)}</strong> von ${esc(order.email)}${order.locale === "en" ? " (Englisch)" : ""}`,
    ),
    button("Im Admin öffnen", adminUrl),
    isGift
      ? rows([{ left: "Geschenkgutschein", right: esc(formatChf(order.total_cents, "de")) }])
      : items.html,
    divider(),
    totals.html,
    order.payment_method
      ? p(`Bezahlt mit: ${esc(paymentLabel(order.payment_method, "de"))}`, {
          muted: true,
          size: 13,
          margin: "12px 0 0",
        })
      : "",
    address.length ? divider() + label("Lieferadresse") + p(address.map(esc).join("<br>")) : "",
  ].join("\n");
  const text = [
    isGift ? "Gutschein verkauft" : "Neue Bestellung",
    attention ? `\n${attention}\n` : "",
    `${no} von ${order.email}`,
    "",
    isGift ? `Geschenkgutschein: ${formatChf(order.total_cents, "de")}` : items.text,
    "",
    totals.text,
    address.length ? `\nLieferadresse:\n${address.join("\n")}` : "",
    "",
    `Admin: ${adminUrl}`,
  ].join("\n");
  return { subject, html: layout({ locale: "de", subject, preheader: subject, body, shop }), text };
}

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  locale: Locale;
}

/** Nachricht aus dem Kontaktformular an den Shop (Antworten gehen per Reply-To an die Kundschaft). */
export function contactMessage(msg: ContactMessage, shop: ShopInfo): EmailContent {
  const subject = `Kontaktformular: ${msg.name}`;
  const lang = msg.locale === "en" ? " (auf Englisch geschrieben)" : "";
  const body = [
    h1("Neue Nachricht"),
    p(`Von <strong>${esc(msg.name)}</strong>, ${esc(msg.email)}${lang}`),
    divider(),
    p(escLines(msg.message)),
    divider(),
    p("Antworten: einfach auf diese E-Mail antworten, sie geht direkt an die Person.", {
      muted: true,
      size: 13,
    }),
  ].join("\n");
  const text = [
    "Neue Nachricht aus dem Kontaktformular",
    `Von ${msg.name}, ${msg.email}${lang}`,
    "",
    msg.message,
    "",
    "Antworten: einfach auf diese E-Mail antworten, sie geht direkt an die Person.",
  ].join("\n");
  return { subject, html: layout({ locale: "de", subject, preheader: subject, body, shop }), text };
}

/** Versandbestätigung mit Sendungsnummer. */
export function shippingConfirmation(order: OrderData, shop: ShopInfo): EmailContent {
  const de = order.locale !== "en";
  const no = orderNumber(order.number);
  const subject = de ? `Deine Bestellung ${no} ist unterwegs` : `Your order ${no} is on its way`;
  const tracking = order.tracking_number;
  const items = itemsBlock(order);
  const address = addressLines(order.shipping_name, order.shipping_address, order.locale);
  const intro = de
    ? "Gute Nachricht: Wir haben deine Bestellung der Post übergeben. Sie ist in der Regel in 1 bis 3 Arbeitstagen bei dir."
    : "Good news: we have handed your order to Swiss Post. It usually arrives within 1 to 3 working days.";
  const body = [
    h1(de ? "Deine Bestellung ist unterwegs" : "Your order is on its way"),
    p(esc(intro)),
    tracking
      ? codeBox(tracking, de ? "Sendungsnummer" : "Tracking number") +
        button(de ? "Sendung verfolgen" : "Track parcel", trackingUrl(tracking))
      : "",
    label(`${de ? "Bestellung" : "Order"} ${no}`),
    items.html,
    address.length
      ? divider() + label(T[order.locale].shipTo) + p(address.map(esc).join("<br>"))
      : "",
    divider(),
    p(esc(T[order.locale].questions), { muted: true, size: 13 }),
  ].join("\n");
  const text = [
    de ? "Deine Bestellung ist unterwegs" : "Your order is on its way",
    "",
    intro,
    tracking
      ? `\n${de ? "Sendungsnummer" : "Tracking number"}: ${tracking}\n${trackingUrl(tracking)}`
      : "",
    "",
    `${de ? "Bestellung" : "Order"} ${no}`,
    items.text,
    address.length ? `\n${T[order.locale].shipTo}:\n${address.join("\n")}` : "",
  ].join("\n");
  return {
    subject,
    html: layout({
      locale: order.locale,
      subject,
      preheader: tracking ? `${tracking}` : no,
      body,
      shop,
    }),
    text,
  };
}

/** Geschenkgutschein mit Code an die beschenkte Person (oder die Käuferin). */
export function giftCardEmail(card: GiftCardInfo, shop: ShopInfo): EmailContent {
  const de = card.locale !== "en";
  const amount = formatChf(card.initial_cents, card.locale);
  const subject = de
    ? `Dein Axion-Geschenkgutschein über ${amount}`
    : `Your Axion gift card worth ${amount}`;
  const greeting = card.recipient_name
    ? de
      ? `Hallo ${card.recipient_name}`
      : `Hello ${card.recipient_name}`
    : de
      ? "Hallo"
      : "Hello";
  const from = card.sender_name
    ? de
      ? `${card.sender_name} schenkt dir einen Gutschein von Axion.`
      : `${card.sender_name} has sent you a gift card from Axion.`
    : de
      ? "Hier ist dein Gutschein von Axion."
      : "Here is your gift card from Axion.";
  const how = de
    ? "So löst du ihn ein: Leg deine Wunschstücke in den Warenkorb und gib den Code im Feld «Geschenkgutschein» ein. Ein Restbetrag bleibt auf dem Gutschein."
    : "To redeem it, add your pieces to the cart and enter the code in the “Gift card” field. Any remaining balance stays on the card.";
  const valid = de
    ? `Gültig bis ${dateText(card.expires_at, "de")}.`
    : `Valid until ${dateText(card.expires_at, "en")}.`;
  const shopUrl = `${shop.siteUrl}${prefixFor(card.locale)}/`;
  const body = [
    h1(greeting),
    p(esc(from)),
    card.message
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;"><tr><td style="border-left:3px solid #B8955A;padding:4px 0 4px 14px;font-family:Georgia, serif;font-size:16px;font-style:italic;line-height:1.55;color:#141414;">${escLines(card.message)}</td></tr></table>`
      : "",
    codeBox(card.code, `${de ? "Gutschein" : "Gift card"} · ${amount}`),
    p(esc(how)),
    p(esc(valid), { muted: true, size: 13 }),
    button(de ? "Jetzt einkaufen" : "Start shopping", shopUrl),
  ].join("\n");
  const text = [
    greeting,
    "",
    from,
    card.message ? `\n«${card.message}»\n` : "",
    `${de ? "Gutscheincode" : "Gift card code"}: ${card.code}`,
    `${de ? "Betrag" : "Amount"}: ${amount}`,
    "",
    how,
    valid,
    "",
    shopUrl,
  ].join("\n");
  return {
    subject,
    html: layout({
      locale: card.locale,
      subject,
      preheader: `${amount} · ${card.code}`,
      body,
      shop,
    }),
    text,
  };
}

export function newsletterConfirm(
  data: { locale: Locale; confirmUrl: string },
  shop: ShopInfo,
): EmailContent {
  const de = data.locale !== "en";
  const subject = de ? "Bitte bestätige deine Anmeldung" : "Please confirm your subscription";
  const intro = de
    ? "Du möchtest den Newsletter von Axion erhalten. Bitte bestätige deine E-Mail-Adresse mit einem Klick. Ohne Bestätigung erhältst du keine Newsletter."
    : "You would like to receive the Axion newsletter. Please confirm your email address with one click. Without confirmation you will not receive any newsletters.";
  const ignore = de
    ? "Du hast dich nicht angemeldet? Dann ignoriere diese E-Mail einfach."
    : "Didn't sign up? Simply ignore this email.";
  const body = [
    h1(subject),
    p(esc(intro)),
    button(de ? "Anmeldung bestätigen" : "Confirm subscription", data.confirmUrl),
    p(esc(ignore), { muted: true, size: 13 }),
  ].join("\n");
  const text = [subject, "", intro, "", data.confirmUrl, "", ignore].join("\n");
  return {
    subject,
    html: layout({ locale: data.locale, subject, preheader: subject, body, shop }),
    text,
  };
}

export function newsletterWelcome(
  data: {
    locale: Locale;
    unsubscribeUrl: string;
    welcomeCode?: string | null;
    welcomePercent?: number | null;
  },
  shop: ShopInfo,
): EmailContent {
  const de = data.locale !== "en";
  const subject = de ? "Willkommen bei Axion" : "Welcome to Axion";
  const intro = de
    ? "Danke für deine Anmeldung. Du erfährst als Erstes von neuen Stücken, Kombinationen und Aktionen."
    : "Thank you for subscribing. You'll be the first to hear about new pieces, combinations and offers.";
  const gift =
    data.welcomeCode && data.welcomePercent
      ? de
        ? `Als Dankeschön erhältst du ${data.welcomePercent} % auf deine nächste Bestellung. Der Code ist 90 Tage gültig und einmal einlösbar.`
        : `As a thank-you, you get ${data.welcomePercent}% off your next order. The code is valid for 90 days and can be used once.`
      : "";
  const unsub = de ? "Abmelden" : "Unsubscribe";
  const body = [
    h1(subject),
    p(esc(intro)),
    gift
      ? p(esc(gift)) +
        codeBox(data.welcomeCode ?? "", de ? "Dein Rabattcode" : "Your discount code")
      : "",
    button(de ? "Zum Shop" : "Visit the shop", `${shop.siteUrl}${prefixFor(data.locale)}/`),
  ].join("\n");
  const footerNote = `<a href="${esc(data.unsubscribeUrl)}" style="color:#5F5F5F;">${esc(unsub)}</a>`;
  const text = [
    subject,
    "",
    intro,
    gift ? `\n${gift}\n${data.welcomeCode}` : "",
    "",
    `${unsub}: ${data.unsubscribeUrl}`,
  ].join("\n");
  return {
    subject,
    html: layout({ locale: data.locale, subject, preheader: intro, body, shop, footerNote }),
    text,
  };
}

export type AuthKind =
  "signup" | "recovery" | "email_change" | "email" | "magiclink" | "invite" | "reauthentication";

export function authEmail(
  data: {
    kind: AuthKind;
    locale: Locale;
    actionUrl: string;
    token?: string | null;
    /** Nur email_change: «current» = Mail an die bisherige Adresse, «new» = an die neue Adresse */
    audience?: "current" | "new";
    newEmail?: string | null;
  },
  shop: ShopInfo,
): EmailContent {
  if (data.kind === "email_change" && data.audience === "current")
    return emailChangeCurrent(data, shop);
  const de = data.locale !== "en";
  const texts: Record<AuthKind, { subject: string; title: string; intro: string; cta: string }> = de
    ? {
        signup: {
          subject: "Bestätige dein Axion-Konto",
          title: "Willkommen bei Axion",
          intro: "Bitte bestätige deine E-Mail-Adresse, damit dein Kundenkonto aktiv wird.",
          cta: "E-Mail bestätigen",
        },
        recovery: {
          subject: "Neues Passwort für dein Axion-Konto",
          title: "Passwort zurücksetzen",
          intro: "Du hast ein neues Passwort angefordert. Der Link ist eine Stunde gültig.",
          cta: "Neues Passwort setzen",
        },
        email_change: {
          subject: "Neue E-Mail-Adresse bestätigen",
          title: "E-Mail-Adresse ändern",
          intro: "Bitte bestätige deine neue E-Mail-Adresse für dein Axion-Konto.",
          cta: "Neue Adresse bestätigen",
        },
        email: {
          subject: "Bestätige deine E-Mail-Adresse",
          title: "E-Mail bestätigen",
          intro: "Bitte bestätige deine E-Mail-Adresse für dein Axion-Konto.",
          cta: "E-Mail bestätigen",
        },
        magiclink: {
          subject: "Dein Anmeldelink für Axion",
          title: "Anmelden",
          intro: "Mit diesem Link meldest du dich bei Axion an. Er ist eine Stunde gültig.",
          cta: "Jetzt anmelden",
        },
        invite: {
          subject: "Einladung zu Axion",
          title: "Du wurdest eingeladen",
          intro: "Du wurdest zu einem Konto bei Axion eingeladen. Leg jetzt dein Passwort fest.",
          cta: "Einladung annehmen",
        },
        reauthentication: {
          subject: "Dein Bestätigungscode",
          title: "Bestätigungscode",
          intro: "Gib diesen Code ein, um die Aktion zu bestätigen.",
          cta: "",
        },
      }
    : {
        signup: {
          subject: "Confirm your Axion account",
          title: "Welcome to Axion",
          intro: "Please confirm your email address to activate your customer account.",
          cta: "Confirm email",
        },
        recovery: {
          subject: "New password for your Axion account",
          title: "Reset your password",
          intro: "You requested a new password. The link is valid for one hour.",
          cta: "Set new password",
        },
        email_change: {
          subject: "Confirm your new email address",
          title: "Change email address",
          intro: "Please confirm your new email address for your Axion account.",
          cta: "Confirm new address",
        },
        email: {
          subject: "Confirm your email address",
          title: "Confirm email",
          intro: "Please confirm your email address for your Axion account.",
          cta: "Confirm email",
        },
        magiclink: {
          subject: "Your Axion sign-in link",
          title: "Sign in",
          intro: "Use this link to sign in to Axion. It is valid for one hour.",
          cta: "Sign in now",
        },
        invite: {
          subject: "Invitation to Axion",
          title: "You've been invited",
          intro: "You have been invited to an Axion account. Set your password now.",
          cta: "Accept invitation",
        },
        reauthentication: {
          subject: "Your confirmation code",
          title: "Confirmation code",
          intro: "Enter this code to confirm the action.",
          cta: "",
        },
      };
  const t = texts[data.kind];
  const ignore = de
    ? "Du hast das nicht angefordert? Dann ignoriere diese E-Mail."
    : "Didn't request this? Simply ignore this email.";
  const body = [
    h1(t.title),
    p(esc(t.intro)),
    data.kind === "reauthentication" && data.token
      ? codeBox(data.token)
      : button(t.cta, data.actionUrl),
    p(esc(ignore), { muted: true, size: 13 }),
  ].join("\n");
  const text = [
    t.title,
    "",
    t.intro,
    "",
    data.kind === "reauthentication" && data.token ? data.token : data.actionUrl,
    "",
    ignore,
  ].join("\n");
  return {
    subject: t.subject,
    html: layout({ locale: data.locale, subject: t.subject, preheader: t.intro, body, shop }),
    text,
  };
}

/** Änderung der E-Mail-Adresse: Bestätigung über die bisherige Adresse (bei «Secure email change»). */
function emailChangeCurrent(
  data: { locale: Locale; actionUrl: string; newEmail?: string | null },
  shop: ShopInfo,
): EmailContent {
  const de = data.locale !== "en";
  const subject = de
    ? "Änderung deiner E-Mail-Adresse bestätigen"
    : "Confirm the change of your email address";
  const target = data.newEmail ?? "";
  const intro = de
    ? `Für dein Axion-Konto wurde eine neue E-Mail-Adresse angegeben${target ? `: ${target}` : ""}. Bitte bestätige die Änderung auch von dieser Adresse aus.`
    : `A new email address was entered for your Axion account${target ? `: ${target}` : ""}. Please also confirm the change from this address.`;
  const warn = de
    ? "Du hast das nicht veranlasst? Dann klicke nicht auf den Link und ändere dein Passwort."
    : "Didn't request this? Don't click the link and change your password.";
  const cta = de ? "Änderung bestätigen" : "Confirm change";
  const body = [
    h1(subject),
    p(esc(intro)),
    button(cta, data.actionUrl),
    p(esc(warn), { muted: true, size: 13 }),
  ].join("\n");
  const text = [subject, "", intro, "", data.actionUrl, "", warn].join("\n");
  return {
    subject,
    html: layout({ locale: data.locale, subject, preheader: intro, body, shop }),
    text,
  };
}

export type SecurityKind =
  | "password_changed_notification"
  | "email_changed_notification"
  | "phone_changed_notification"
  | "identity_linked_notification"
  | "identity_unlinked_notification"
  | "mfa_factor_enrolled_notification"
  | "mfa_factor_unenrolled_notification";

/** Sicherheitshinweise von Supabase Auth (nur wenn im Dashboard aktiviert). */
export function securityNotice(
  data: { kind: string; locale: Locale; oldEmail?: string | null; newEmail?: string | null },
  shop: ShopInfo,
): EmailContent {
  const de = data.locale !== "en";
  const reset = `${shop.siteUrl}${prefixFor(data.locale)}/konto/passwort-vergessen`;
  let subject: string;
  let intro: string;
  if (data.kind === "password_changed_notification") {
    subject = de ? "Dein Passwort wurde geändert" : "Your password was changed";
    intro = de
      ? "Das Passwort deines Axion-Kontos wurde soeben geändert."
      : "The password of your Axion account has just been changed.";
  } else if (data.kind === "email_changed_notification") {
    subject = de ? "Deine E-Mail-Adresse wurde geändert" : "Your email address was changed";
    const change =
      data.oldEmail && data.newEmail
        ? de
          ? ` von ${data.oldEmail} auf ${data.newEmail}`
          : ` from ${data.oldEmail} to ${data.newEmail}`
        : "";
    intro = de
      ? `Die E-Mail-Adresse deines Axion-Kontos wurde${change} geändert.`
      : `The email address of your Axion account was changed${change}.`;
  } else {
    subject = de
      ? "Sicherheitshinweis zu deinem Axion-Konto"
      : "Security notice for your Axion account";
    intro = de
      ? "An den Anmeldeeinstellungen deines Axion-Kontos wurde soeben etwas geändert."
      : "The sign-in settings of your Axion account have just been changed.";
  }
  const contact = shop.contactEmail
    ? de
      ? ` oder schreib uns an ${shop.contactEmail}`
      : ` or write to us at ${shop.contactEmail}`
    : "";
  const warn = de
    ? `Warst du das nicht? Setze sofort ein neues Passwort${contact}.`
    : `Wasn't you? Set a new password right away${contact}.`;
  const ok = de
    ? "Warst du es selbst, musst du nichts tun."
    : "If it was you, there is nothing to do.";
  const body = [
    h1(subject),
    p(esc(intro)),
    p(esc(warn)),
    button(de ? "Neues Passwort setzen" : "Set new password", reset),
    p(esc(ok), { muted: true, size: 13 }),
  ].join("\n");
  const text = [subject, "", intro, "", warn, reset, "", ok].join("\n");
  return {
    subject,
    html: layout({ locale: data.locale, subject, preheader: intro, body, shop }),
    text,
  };
}
