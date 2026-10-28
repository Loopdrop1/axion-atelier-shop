export const shopConfig = {
  brand: "Axion",
  siteUrl: "https://www.axion-shop.ch", // Platzhalter, vor Livegang bestätigen.
  launched: false,
  vatRegistered: false,
  vatRate: 8.1, // Normalsatz in Prozent (Kleider, Schuhe), gilt nur mit vatRegistered
  contact: {
    company: "[Firmenname]",
    address: "[Adresse]",
    email: "[E-Mail-Adresse]",
    phone: "[Telefonnummer]", // freiwillig: leer lassen, wenn keine Nummer erscheinen soll
    hours: "[Erreichbarkeit, z. B. Montag bis Freitag, 9 bis 17 Uhr]", // freiwillig, leer = ohne
    uid: "[UID]",
  },
  // Social-Kanäle: vollständige https-URL eintragen. Leer = Kanal erscheint weder im Footer noch in der Organization-Auszeichnung.
  social: {
    instagram: "",
    facebook: "",
    linkedin: "",
    tiktok: "",
    pinterest: "",
  },
  // Besucherstatistik ohne Cookies (Plausible Analytics, https://plausible.io). Domain wie in Plausible angelegt,
  // z. B. «www.axion-shop.ch». Leer = aus. Läuft erst nach dem Livegang, nie im Admin; gleichzeitig erscheint der
  // Absatz «Besucherstatistik» in der Datenschutzerklärung. Vom Kunden zu bestätigen (docs/MARKETING.md).
  analytics: {
    plausibleDomain: "",
  },
  // Inhaberschaftsnachweise für Suchmaschinen: nur den Wert aus «content» der Meta-Angabe eintragen (nicht das ganze Tag).
  // Leer = kein Tag. Vom Kunden zu bestätigen (docs/MARKETING.md).
  verification: {
    google: "", // Google Search Console, google-site-verification
    bing: "", // Bing Webmaster Tools, msvalidate.01
  },
  returnDays: 14, // Vom Kunden noch zu bestätigen.
  // Lieferschätzung (Europe/Zurich): Bestellungen vor dem Annahmeschluss gehen am selben Arbeitstag raus.
  // Vom Kunden zu bestätigen.
  delivery: {
    dispatchCutoff: "14:00",
    processingDays: 0, // zusätzliche Arbeitstage bis zum Versand
    // Gleich wie die Lieferzeit in den AGB und auf «Versand und Rückgabe» (2 bis 5 Arbeitstage); nur gemeinsam ändern.
    transitDays: { min: 2, max: 5 }, // Arbeitstage Versand bis Zustellung
  },
  paymentMethods: [
    "TWINT",
    "Visa",
    "Mastercard",
    "American Express",
    "Apple Pay",
    "Google Pay",
    "Klarna",
  ],
  // Schalter für Bereiche, die das Backend (Supabase) brauchen. Ohne Backend zeigen die Seiten «wird beim Livegang aktiviert».
  features: {
    newsletter: true,
    customerAccounts: true,
    giftCards: true,
  },
} as const;
