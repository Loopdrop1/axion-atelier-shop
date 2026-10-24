// Newsletter-Einwilligung: Wortlaut und Version legt der Server fest, nie der Client.
// Der Client schickt nur consent:true und die Sprache; gespeichert wird «[Version] Text».
// Bei jeder inhaltlichen Änderung des Textes CONSENT_VERSION erhöhen und
// src/i18n/messages (newsletter.consent) angleichen (Parity-Test: consent.test.ts).
import type { Locale } from "./money.ts";

export const CONSENT_VERSION = "newsletter-v2";

export const NEWSLETTER_CONSENT: Record<Locale, string> = {
  de: "Ja, ich möchte den Newsletter von Axion mit Neuheiten und Angeboten per E-Mail erhalten. Meine Einwilligung gilt auch als Gegenleistung für einen allfälligen Willkommensrabatt. Die Abmeldung ist jederzeit über den Link in jeder E-Mail möglich.",
  en: "Yes, I would like to receive the Axion newsletter with new arrivals and offers by email. My consent also applies in return for any welcome discount. I can unsubscribe at any time using the link in every email.",
};

/** Text für die Datenbank: Version vorangestellt, auf 1000 Zeichen (Spaltengrenze) begrenzt. */
export function consentRecord(locale: Locale): string {
  return `[${CONSENT_VERSION}] ${NEWSLETTER_CONSENT[locale]}`.slice(0, 1000);
}
