// E-Mails zur Retoure: Bestätigung mit Hinweisen an die Kundschaft, Meldung an den Shop.
// Bewusst allgemein: Es wird kein Rücksendeetikett und keine Kostenübernahme versprochen (das regelt die Seite
// «Versand und Rückgabe»). Die Rücksendeadresse ist die Adresse des Shops (SHOP_ADDRESS), sonst ein Platzhalter.
import type { Locale } from "../money.ts";
import { reasonLabel, returnRef } from "../returns.ts";
import { sizeText } from "../size.ts";
import { orderNumber, type EmailContent } from "./templates.ts";
import { divider, esc, escLines, h1, label, layout, p, rows, type ShopInfo } from "./layout.ts";

export interface ReturnMailItem {
  title: string;
  size: string | null;
  color: string | null;
  quantity: number;
  reason: string;
}

export interface ReturnMailData {
  locale: Locale;
  returnNumber: number;
  orderNumber: number;
  email: string;
  items: ReturnMailItem[];
  comment: string | null;
}

const word = {
  de: { size: "Grösse", oneSize: "Einheitsgrösse" },
  en: { size: "Size", oneSize: "One size" },
} as const;

function detail(item: ReturnMailItem, locale: Locale): string {
  const w = word[locale];
  return [item.color, item.size ? sizeText(item.size, w.size, w.oneSize) : null]
    .filter(Boolean)
    .join(", ");
}

function itemRows(data: ReturnMailData): string {
  return rows(
    data.items.map((i) => ({
      left: `${esc(i.title)}<br><span style="color:#5F5F5F;font-size:13px;">${esc(detail(i, data.locale))}<br>${esc(reasonLabel(i.reason, data.locale))}</span>`,
      right: `${i.quantity} ×`,
    })),
  );
}

function itemLines(data: ReturnMailData): string {
  return data.items
    .map(
      (i) =>
        `${i.quantity} × ${i.title}${detail(i, data.locale) ? `, ${detail(i, data.locale)}` : ""} (${reasonLabel(i.reason, data.locale)})`,
    )
    .join("\n");
}

/** Bestätigung an die Kundschaft mit Hinweisen zur Rücksendung. */
export function returnConfirmation(data: ReturnMailData, shop: ShopInfo): EmailContent {
  const de = data.locale !== "en";
  const ref = returnRef(data.returnNumber);
  const order = orderNumber(data.orderNumber);
  const address = shop.address || (de ? "[Rücksendeadresse]" : "[return address]");
  const info = `${shop.siteUrl}${de ? "" : "/en"}/versand-und-rueckgabe`;
  const subject = de ? `Deine Retoure ${ref} ist angemeldet` : `Your return ${ref} is registered`;
  const intro = de
    ? `Danke, wir haben deine Retoure zur Bestellung ${order} notiert. So geht es weiter:`
    : `Thank you, we have noted your return for order ${order}. Here is what happens next:`;
  const steps = de
    ? [
        `Verpacke die Stücke ungetragen, mit allen Etiketten und möglichst in der Originalverpackung.`,
        `Lege einen Zettel mit der Bestellnummer ${order} und der Retourennummer ${ref} bei.`,
        `Schicke das Paket an: ${address}`,
        `Sobald die Rücksendung bei uns eingetroffen ist und wir sie geprüft haben, erstatten wir den Kaufpreis der zurückgegebenen Stücke auf das ursprüngliche Zahlungsmittel. Mit einem Gutschein bezahlte Beträge schreiben wir dem Gutschein gut.`,
      ]
    : [
        `Pack the pieces unworn, with all tags and preferably in the original packaging.`,
        `Include a note with the order number ${order} and the return number ${ref}.`,
        `Send the parcel to: ${address}`,
        `Once your return has arrived and we have checked it, we refund the price of the returned pieces to the original payment method. Amounts paid with a gift card are credited back to the gift card.`,
      ];
  const note = de
    ? `Details zu Frist, Rücksendekosten und Rückerstattung stehen unter ${info}`
    : `Details on the deadline, return shipping costs and refunds are at ${info}`;
  const questions = de
    ? "Fragen? Antworte einfach auf diese E-Mail."
    : "Questions? Just reply to this email.";
  const body = [
    h1(de ? "Deine Retoure ist angemeldet" : "Your return is registered"),
    p(esc(intro)),
    p(`${de ? "Retourennummer" : "Return number"}: <strong>${esc(ref)}</strong>`),
    label(de ? "Zurückgegebene Stücke" : "Returned pieces"),
    itemRows(data),
    data.comment
      ? `${divider()}${p(`<strong>${de ? "Dein Kommentar" : "Your comment"}</strong><br>${escLines(data.comment)}`)}`
      : "",
    divider(),
    label(de ? "So geht es weiter" : "Next steps"),
    `<ol style="margin:0 0 14px;padding-left:20px;font-family:Helvetica, Arial, sans-serif;font-size:15px;line-height:1.6;">${steps.map((s) => `<li style="margin:0 0 6px;">${esc(s)}</li>`).join("")}</ol>`,
    p(esc(note), { muted: true, size: 13 }),
    p(esc(questions), { muted: true, size: 13 }),
  ].join("\n");
  const text = [
    subject,
    "",
    intro,
    "",
    `${de ? "Retourennummer" : "Return number"}: ${ref}`,
    "",
    itemLines(data),
    ...(data.comment ? ["", `${de ? "Dein Kommentar" : "Your comment"}: ${data.comment}`] : []),
    "",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    note,
    questions,
  ].join("\n");
  return {
    subject,
    html: layout({ locale: data.locale, subject, preheader: subject, body, shop }),
    text,
  };
}

/** Meldung an den Shop (immer Deutsch). Antworten gehen per Reply-To an die Kundschaft. */
export function returnNotification(
  data: ReturnMailData,
  shop: ShopInfo,
  adminUrl: string,
): EmailContent {
  const ref = returnRef(data.returnNumber);
  const order = orderNumber(data.orderNumber);
  const subject = `Neue Retoure ${ref} zu ${order}`;
  const lang = data.locale === "en" ? " (Englisch)" : "";
  const body = [
    h1(`Neue Retoure ${ref}`),
    p(`Bestellung <strong>${esc(order)}</strong>, ${esc(data.email)}${lang}`),
    itemRows({ ...data, locale: "de" }),
    data.comment
      ? `${divider()}${p(`<strong>Kommentar</strong><br>${escLines(data.comment)}`)}`
      : "",
    divider(),
    p("Die Stücke sind noch nicht bei uns. Status und Erstattung im Admin unter Retouren.", {
      muted: true,
      size: 13,
    }),
    p(`<a href="${esc(adminUrl)}">${esc(adminUrl)}</a>`, { size: 13 }),
  ].join("\n");
  const text = [
    `Neue Retoure ${ref} zu ${order}`,
    `${data.email}${lang}`,
    "",
    itemLines({ ...data, locale: "de" }),
    ...(data.comment ? ["", `Kommentar: ${data.comment}`] : []),
    "",
    "Die Stücke sind noch nicht bei uns. Status und Erstattung im Admin unter Retouren.",
    adminUrl,
  ].join("\n");
  return { subject, html: layout({ locale: "de", subject, preheader: subject, body, shop }), text };
}
