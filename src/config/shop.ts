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
  returnDays: 14, // Vom Kunden noch zu bestätigen.
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
