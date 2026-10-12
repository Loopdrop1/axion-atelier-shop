# Axion Online-Shop: Eigenbau ohne Shopify (Spec)

Stand 12.10.2026. Grundlage: unterschriftsreifes Angebot «Umfang und Konditionen» (Axion_Checkliste_Online-Shop.pdf, Version 2) und Entscheide von Ben Schmidt (Flowrenix).

## Ziel

Der bestehende Lovable-Shop (TanStack Start, Beispieldaten) wird zu einem vollständigen, selbst betriebenen Online-Shop: eigene Datenbank, eigenes Admin, Kasse über das Stripe-Konto des Kunden, Kundenkonto, Geschenkgutscheine, Rabattcodes, Newsletter, Deutsch und Englisch. Alles wird lokal gebaut und geprüft und danach ohne Lovable-Credits über GitHub in Lovable übernommen.

## Entscheide (fix)

- Kein Shopify. Backend ist Supabase (Postgres, Auth, Storage, Edge Functions). Der Code funktioniert mit Lovable Cloud und mit einem eigenen Supabase-Projekt; empfohlen ist ein eigenes Projekt in der Region Zürich.
- Zahlungen: Stripe Checkout (gehostet) über das eigene Stripe-Konto des Kunden. TWINT, Karten, Apple Pay, Google Pay, Klarna werden im Stripe-Dashboard aktiviert, nicht im Code fest verdrahtet.
- E-Mails: Resend über Edge Functions. Auth-E-Mails (Bestätigung, Passwort) über den Supabase «Send Email Hook», damit alle E-Mails dieselben zweisprachigen Vorlagen nutzen.
- Sprachen: Deutsch ohne Präfix (`/produkt/x`), Englisch mit Präfix (`/en/produkt/x`). Admin nur Deutsch unter `/admin`.
- Preis CHF 2'000, Betreuung CHF 50 pro Monat (betrifft den Code nicht).

## Umfang (aus dem Angebot, Seite 10)

1. Shop-Design DE/EN: Startseite mit 3D-Logo, Kategorien, Produktseiten mit Grössenwahl und Grössentabelle, «Komplettes Outfit», Warenkorb, Suche, Merkliste, Über uns, Häufige Fragen mit Textentwurf, Kontakt, Rechtsseiten.
2. Kasse und E-Mails: Kasse über Stripe. E-Mails in Axion-Optik: Bestellbestätigung, Versandmeldung mit Sendungsnummer, Gutschein mit Code, Kundenkonto (Bestätigung, neues Passwort), Bestellmeldung an den Shop.
3. Für die Kundschaft: Kundenkonto mit Bestellübersicht, Bestellen als Gast, Geschenkgutscheine mit Code und Restguthaben, Rabattcodes, Newsletter-Anmeldung mit Einwilligung.
4. Admin mit Login (Computer und Handy): Übersicht über Bestellungen und Umsatz, Produkte mit Grössen, Farben, Bestand und Fotos, Bestellungen mit Status, Gutscheine, Rabattcodes, Newsletter-Liste, Texte und Bilder der Startseite, Verkauf vor Ort ausbuchen, Export für Excel, weitere Logins ohne Aufpreis.
5. Einrichtung: Kategorien, Grössen, Farben, Versand und Rückgabe nach Kundenangaben, Beispielprodukte, kurze Anleitung.
6. Rechtstexte: Entwürfe DE für Impressum, Datenschutz, AGB mit Versand, Rückgabe und Gutscheinen; englische Fassung liefert der Kunde (bis dahin zeigt die englische Seite die deutsche Fassung mit Hinweis).
7. Footer «Made by Flowrenix.com» in Shop und Admin.

## Fachliche Regeln

- Preise immer serverseitig aus der Datenbank. Beträge intern in Rappen (Ganzzahl).
- Bestand: Beim Start der Kasse wird reserviert (Bestand sinkt), bei Abbruch oder Ablauf kommt er zurück. Bestand wird nie negativ.
- Rabattcode: Prozent oder Betrag, optional Mindestbestellwert, Gültigkeit, maximale Einlösungen. Ein Code pro Bestellung.
- Geschenkgutschein: Code mit hoher Zufälligkeit, Restguthaben, Gültigkeit 5 Jahre (Standard, im Admin änderbar), kein Barauszahlen. Kauf über eigene Seite (Betrag, Empfänger, Nachricht). Einlösen im Warenkorb, auch teilweise. Deckt der Gutschein alles, läuft die Bestellung ohne Stripe.
- Newsletter: Double Opt-in, Abmeldelink in jeder E-Mail, Einwilligungstext wird gespeichert. Optional Willkommensrabatt (Einstellung, Standard aus).
- Kundenkonto: E-Mail und Passwort. Gastbestellungen mit derselben bestätigten E-Mail werden dem Konto zugeordnet. Konto löschen möglich; Bestellungen bleiben für die Buchhaltung ohne Kontoverknüpfung.
- Versand: nur Schweiz und Liechtenstein, gratis (Einstellung). Lieferzeit 2 bis 5 Arbeitstage.
- Rückerstattungen macht der Shop im Stripe-Dashboard; der Shop übernimmt den Status per Webhook. Retouren bucht das Admin von Hand ein.
- Admin-Rechte über Rollen-Tabelle; ein Admin kann weitere Admins per E-Mail freischalten.

## Nicht im Umfang

Kundenbewertungen, «Benachrichtigen, wenn wieder da», weitere Sprachen, Besucher-Messung, Google Shopping, Newsletter-Versand-Programm, POS-Kasse (nur Bestand ausbuchen).
