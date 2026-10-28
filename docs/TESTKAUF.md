# Testkauf im Stripe-Testmodus

Schritt für Schritt, damit vor dem Livegang jeder Teil der Kette einmal bewiesen ist: Reservierung, Zahlung, Webhook, Bestellung
im Admin, E-Mails, Rückerstattung, Gutschein, «Wieder da», Newsletter und Kontaktformular. Dauer: rund eine Stunde.
Hintergrund und Einrichtung: `docs/DEPLOYMENT.md` (Abschnitte 2, 3, 7), Funktionen: `supabase/functions/README.md`.

Grundregel: Im Testmodus **nur Stripe-Testkarten** verwenden, nie echte Karten. Geheime Schlüssel nie in Chat, E-Mail oder Git.

## 0. Voraussetzungen

**Secrets in Cloud → Secrets** (Bedeutung in `supabase/functions/README.md`, Liste in `docs/KUNDENDATEN.md`, Abschnitt 7):

| Secret                  | Für den Testkauf                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`     | **Test**-Schlüssel (`rk_test_…`, eingeschränkt: Checkout Sessions Schreiben, Coupons Schreiben, PaymentIntents Lesen)                |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` des **Test**-Webhooks (Schritt 1)                                                                                          |
| `RESEND_API_KEY`        | Resend-Schlüssel                                                                                                                     |
| `EMAIL_FROM`            | z. B. `Axion <bestellung@<domain>>` (Domain in Resend verifiziert). `onboarding@resend.dev` genügt nur für Tests und landet im Spam. |
| `SITE_URL`              | Adresse des Shops (in der Testphase die Vorschau-Adresse)                                                                            |
| `ALLOWED_ORIGINS`       | dieselbe Adresse                                                                                                                     |
| `SHOP_CONTACT_EMAIL`    | Postfach, das Kontaktformular und Antworten bekommt                                                                                  |
| `SHOP_NOTIFY_EMAIL`     | Postfach für die Bestellmeldung                                                                                                      |
| `SHOP_ADDRESS`          | Adresse im Fuss der E-Mails                                                                                                          |
| `LOVABLE_API_KEY`       | legt Lovable selbst an (nur nötig für KI-Suche und Übersetzung)                                                                      |

Kontrolle: Admin → **Übersicht** → Kasten «Bereit für den Livegang». Er zeigt ohne Werte, welche Secrets gesetzt sind und dass
Stripe im **Testmodus** läuft. Alle Zeilen zu Stripe, Resend und E-Mail sollten «OK» sein (die Zeile «Stripe im Live-Modus» bleibt
im Test «Offen»).

Weiter nötig: Migrationen eingespielt, alle Funktionen veröffentlicht (`verify_jwt = false`), ein Admin-Konto, mindestens ein
Produkt mit Bestand (Musterstücke genügen), ein Postfach, das du lesen kannst, für Kundenmails.

## 1. Webhook in Stripe (Testmodus)

1. Stripe-Dashboard, oben rechts auf **Testmodus** (Sandbox) umschalten.
2. Entwickler → Webhooks → Endpunkt hinzufügen: `<VITE_SUPABASE_URL>/functions/v1/stripe-webhook` (Adresse aus `.env`).
3. Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded`.
4. Signatur-Geheimnis (`whsec_…`) kopieren und als `STRIPE_WEBHOOK_SECRET` in Cloud → Secrets speichern. Die Funktion `stripe-webhook` muss dafür nicht neu veröffentlicht werden; Secrets gelten sofort.

## 2. Testkarten (Stripe-Dokumentation «Testing»)

Ablaufdatum beliebig in der Zukunft, Prüfziffer (CVC) beliebige drei Ziffern, PLZ beliebig.

| Karte                 | Wirkung                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `4242 4242 4242 4242` | Zahlung gelingt (Visa)                                             |
| `4000 0025 0000 3155` | verlangt 3-D-Secure-Bestätigung, im Test-Fenster «Complete» wählen |
| `4000 0000 0000 9995` | wird abgelehnt (zu wenig Guthaben)                                 |
| `4000 0000 0000 0002` | wird abgelehnt (allgemein)                                         |

Weitere Karten und Zahlungsarten: https://docs.stripe.com/testing. TWINT und Apple Pay lassen sich nicht mit echten Konten
testen; TWINT erst nach der Freischaltung durch Stripe im Livemodus.

## 3. Kauf, Reservierung, Webhook

1. Im Shop ein Produkt wählen, Grösse wählen, in den Warenkorb, zur Kasse. Als **Gast** mit einer E-Mail-Adresse, die du lesen
   kannst (am besten eine Adresse, die nicht dem Admin gehört).
2. **Reservierung prüfen:** Im Admin → Lager den Bestand dieser Grösse notieren, dann im Shop «Zur Kasse» drücken: Der Bestand
   sinkt sofort (Reservierung, rund 35 Minuten). Die Weiterleitung auf die Stripe-Kasse erscheint.
3. Mit `4242 4242 4242 4242` bezahlen. Rückkehr zur Bestätigungsseite im Shop.
4. **Abbruch prüfen:** zweiten Warenkorb starten, in Stripe «Zurück» wählen: Die Artikel sind sofort wieder verfügbar (Lager).
5. **Webhook prüfen:** Stripe → Webhooks → Endpunkt → Zustellungen: `checkout.session.completed` mit Status `200`. Bei `4xx/5xx`
   Antwort ansehen (Schritt 1, `STRIPE_WEBHOOK_SECRET` passt nicht zum Endpunkt?) und Cloud → Edge functions → `stripe-webhook` → Logs.

## 4. Bestellung im Admin und E-Mails

1. Admin → Bestellungen: Bestellung mit Status **bezahlt**, Betrag, Zahlungsart, Adresse korrekt. Bestand reduziert.
2. «Quittung drucken» öffnen: Firmendaten, Positionen, Summe (mit MWST, wenn `vatRegistered`).
3. E-Mails: **Bestellbestätigung** an die Kundenadresse (mit Rückgabehinweis, Absender `EMAIL_FROM`, Adresse im Fuss) und
   **Bestellmeldung** an `SHOP_NOTIFY_EMAIL`. Im Spam nachsehen und die Absenderdomain notieren (SPF/DKIM in Resend «verified»).
4. «Als versendet markieren» mit Sendungsnummer: **Versand-E-Mail** kommt an, Sendungslink funktioniert.
5. «Bestätigung erneut senden» an eine andere Adresse: kommt an.
6. Mit `4000 0000 0000 9995` eine Zahlung versuchen: Stripe lehnt ab, im Admin entsteht keine bezahlte Bestellung,
   die Reservierung läuft ab oder wird gelöst (Lager prüfen).

## 5. Rückerstattung

1. Im Admin die Bestellung öffnen → **Rückerstatten** (voll, mit Bestätigung); der Betrag erscheint nach wenigen Sekunden (Webhook).
   Alternativ in Stripe (Testmodus) → Zahlungen → die Testzahlung → **Zahlung rückerstatten**.
2. Webhook `charge.refunded` kommt an (Zustellungen prüfen). Im Admin zeigt die Bestellung die Rückerstattung (Status
   «zurückerstattet», Betrag).
3. Retoure einbuchen (Bestellung → «Retoure einbuchen»): der Bestand steigt wieder.
4. Teilrückerstattung an einer zweiten Bestellung: Admin zeigt den Teilbetrag.

## 6. Geschenkgutschein

1. Shop → Geschenkgutschein: Betrag wählen, Empfängeradresse (deine zweite Adresse) eintragen, bezahlen mit der Testkarte.
2. Gutschein-E-Mail kommt bei der beschenkten Person an. Admin → Gutscheine: Code und Betrag stimmen.
3. Neue Bestellung mit dem Gutscheincode (Warenkorb → Code): Betrag wird abgezogen, Restguthaben im Admin stimmt.
4. Bestellung mit Gutschein als Teilzahlung rückerstatten: den Gutscheinanteil im Admin gutschreiben.
5. Rabattcode (Admin → Rabattcodes anlegen) im Warenkorb einlösen.

## 7. Wieder-da-Benachrichtigung

1. Im Admin → Lager eine Grösse auf **0** setzen.
2. Im Shop auf der Produktseite bei der ausverkauften Grösse «Benachrichtigen» ausfüllen: Bestätigungs-E-Mail kommt an.
3. Link in der E-Mail anklicken, auf der Seite bestätigen (die Seite löst erst per Klick aus).
4. Im Admin die Grösse aufstocken: «Wieder da»-E-Mail kommt **einmal** an, die Adresse ist danach entfernt (nochmals aufstocken: keine
   zweite E-Mail).

## 8. Newsletter (Double Opt-in)

1. Shop → Fusszeile: Adresse eintragen, Einwilligung ankreuzen, anmelden. Die Antwort ist immer «gesendet».
2. E-Mail zur Bestätigung kommt an, Link anklicken, Bestätigungsseite: erst jetzt gilt die Anmeldung (Admin → Newsletter:
   Status «Bestätigt», Einwilligung mit Text und Zeitpunkt).
3. Wenn ein Willkommensrabatt eingestellt ist: Willkommens-E-Mail mit Code, Code im Warenkorb einlösen.
4. Abmelden über den Link in der E-Mail: Status «Abgemeldet».

## 9. Kontaktformular

1. Shop → Kontakt: Name, Adresse, Nachricht mit mindestens 10 Zeichen absenden.
2. E-Mail kommt bei `SHOP_CONTACT_EMAIL` an; «Antworten» geht direkt an die Absenderin (Reply-To).
3. Bremse prüfen (optional): fünfmal schnell hintereinander senden: Der Shop meldet danach «zu viele Anfragen».

## 10. Weiteres

- Konto anlegen (E-Mail bestätigen), Bestellung im Konto sehen, Passwort zurücksetzen, Konto löschen.
- Neues Produkt nur auf Deutsch anlegen: Englisch füllt sich automatisch (`/en/produkt/…`).
- Admin → Fehler: Während des Tests sollten keine neuen Fehler auftauchen. Wenn doch: Meldung und Stack ansehen.
- `/api/health` zeigt `{"ok":true,…}`.

## 11. Abschluss und Livegang

1. Alle Punkte oben sind abgehakt? Auffälligkeiten (Spam, falsche Beträge, fehlende Mails) zuerst beheben.
2. Zum Livegang (`docs/DEPLOYMENT.md`, Abschnitt 8): Live-Schlüssel (`rk_live_…`) und **Live-Webhook** mit eigenem `whsec_…` in die
   Secrets, `ALLOW_PREVIEW_ORIGINS` und `PREVIEW_ORIGINS` entfernen, Muster entfernen, `launched: true`.
3. Im Admin muss der Kasten «Bereit für den Livegang» danach vollständig auf «OK» stehen und Stripe im **Live-Modus** laufen.
4. **Echter Kauf** mit kleinem Betrag und sofortiger Rückerstattung; TWINT nach der Freischaltung testen.
