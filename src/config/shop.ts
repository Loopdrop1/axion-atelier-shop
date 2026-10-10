export const shopConfig = {
  brand: 'Axion', launched: false, vatRegistered: false,
  contact: { company: '[Firmenname]', address: '[Adresse]', email: '[E-Mail-Adresse]', phone: '[Telefonnummer]', uid: '[UID]' },
  announcements: ['Gratisversand in der ganzen Schweiz', 'Lieferung in 2 bis 5 Arbeitstagen', 'Bezahlen mit TWINT, Karte, Apple Pay oder Klarna'],
  shipping: { country: 'CH', free: true, minDays: 2, maxDays: 5 },
  returnDays: 14, // Vom Kunden noch zu bestätigen.
  paymentMethods: ['TWINT', 'Visa', 'Mastercard', 'American Express', 'Apple Pay', 'Google Pay', 'Klarna'],
  features: { newsletter: false, pickup: false, reviews: false, customerAccounts: false, giftCards: false, backInStock: false },
} as const;
