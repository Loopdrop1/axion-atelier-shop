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
  announcements: [
    "Gratisversand in der ganzen Schweiz",
    "Lieferung in 2 bis 5 Arbeitstagen",
    "Bezahlen mit TWINT, Karte, Apple Pay, Google Pay oder Klarna",
  ],
  shipping: { country: "CH", free: true, minDays: 2, maxDays: 5 },
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
    pickup: false,
    reviews: false,
    customerAccounts: true,
    giftCards: true,
    backInStock: false,
  },
} as const;
