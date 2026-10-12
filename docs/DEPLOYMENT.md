# Axion-Shop: Inbetriebnahme

Anleitung für Ben (Flowrenix). Reihenfolge einhalten: zuerst alles im **Testmodus**, erst am Schluss live.
Stand 12.10.2026. Datenbank: **Lovable Cloud** (Entscheid Ben), Code-Übertragung über **GitHub**.

**Grundregel:** Passwörter, geheime Schlüssel (Stripe `rk_`/`sk_`, Webhook-Geheimnisse, Resend) und die IBAN gehören
nie in einen Chat, eine E-Mail oder ins Git. Sie kommen nur in die Secrets von Lovable Cloud (Cloud → Secrets).

## Überblick

| Teil                                  | Wo                                                                      | Wem gehört das Konto            |
| ------------------------------------- | ----------------------------------------------------------------------- | ------------------------------- |
| Shop und Admin (TanStack Start)       | Lovable-Projekt `81384fd7-77a8-4809-b8c3-48b5a9ee05e8`, Code auf GitHub | Flowrenix                       |
| Datenbank, Login, Bilder, Funktionen  | Lovable Cloud im selben Projekt, Region Europa                          | Flowrenix (Lovable-Workspace)   |
| Zahlung                               | Stripe Checkout im Konto von Axion                                      | Axion, Ben als Teammitglied     |
| Bestell-E-Mails                       | Resend mit der Domain von Axion                                         | Flowrenix oder Axion            |
| Konto-E-Mails (Bestätigung, Passwort) | Lovable Cloud (eigene Vorlagen, Absender-Domain per DNS)                | Flowrenix                       |
| Domain                                | Registrar nach Wahl, auf Axion                                          | Axion (Kosten in der Betreuung) |

**Wichtig zu Lovable Cloud:** Die Nutzung läuft über die Credits des Workspaces. Ist das Guthaben leer, pausieren
Datenbank, Speicher und Login (die Seiten bleiben erreichbar, aber niemand kann bestellen). Deshalb immer genug
Guthaben halten und, wo möglich, automatisches Nachladen einschalten.

## 1. Code nach Lovable bringen (GitHub, ohne Credits)

1. In Lovable: Projekt-Einstellungen → Git → **Connect GitHub**. Lovable legt ein neues Repository mit dem aktuellen
   Stand an (Commit `e3800b2`, genau die Basis des Lieferpakets).
2. Im Terminal auf deinem Computer (Ordner frei wählbar, Pfad zum Patch anpassen):
   ```bash
   git clone https://github.com/<dein-konto>/<repository>.git axion-shop
   cd axion-shop
   git am --3way /pfad/zu/axion.patch
   git push
   ```
   `git am` übernimmt alle Commits mit ihren Beschreibungen. Lovable zeigt die Änderung danach im Editor und baut die
   Vorschau neu. **Nie force-pushen** (Lovable verliert sonst den Verlauf).
3. Erst jetzt Lovable Cloud aktivieren (Abschnitt 2). Umgekehrt gäbe es Konflikte beim Einspielen.

## 2. Lovable Cloud

1. In Lovable: **Cloud aktivieren**, Region **Europa** wählen. Die Region lässt sich danach nicht mehr ändern.
   Lovable legt dabei `.env` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` an; der Shop liest genau diese.
2. Datenbank: Lovable führt Migrationen aus Git **nicht** aus. Die Dateien in `supabase/migrations/` werden der Reihe
   nach ausgeführt (macht Claude über die Datenbank-Verbindung, sonst im SQL-Editor von Cloud). Danach prüfen:
   16 Tabellen im Schema `public`, Buckets `product-images` und `site-media`.
3. Funktionen veröffentlichen: im Lovable-Chat «Deploy the edge functions checkout, stripe-webhook, newsletter,
   admin-actions and account-delete. Do not change their code.» (kostet wenige Credits). Kontrolle unter
   Cloud → Edge functions. `auth-email-hook` wird nicht gebraucht: Konto-E-Mails verschickt Lovable Cloud selbst.
4. Secrets (Cloud → Secrets), Bedeutung in `supabase/functions/README.md`, Abschnitt «Secrets»:
   - Testphase: `SITE_URL` = `https://id-preview--81384fd7-77a8-4809-b8c3-48b5a9ee05e8.lovable.app`,
     `ALLOWED_ORIGINS` = dieselbe Adresse (genau diese, kein `ALLOW_PREVIEW_ORIGINS`).
   - `STRIPE_SECRET_KEY` (Test-Schlüssel `rk_test_…`), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
     `SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL`, `SHOP_ADDRESS`. Optional `STRIPE_REQUIRE_TERMS=1`,
     `SHIPPING_COUNTRIES` (Standard `CH`; `CH,LI` erst, wenn Axion Liechtenstein beliefern will und die
     Liechtenstein-Klauseln in den Rechtstexten stehen).
5. Authentifizierung (Cloud → Users → Einstellungen):
   - **«Auto-confirm email» aus**, **«Secure email change» ein.** Gastbestellungen werden einem Konto über die
     E-Mail-Adresse zugeordnet; ohne Bestätigung könnte jemand mit einer fremden Adresse ein Konto eröffnen und deren
     Bestellungen sehen.
   - Email OTP expiration: **3600** Sekunden. Password HIBP check: ein.
   - Site URL: die Shop-Adresse. Redirect URLs: `<shop>/konto`, `<shop>/konto/passwort-neu`, `<shop>/konto/daten`
     und dieselben mit `/en` davor. In der Testphase mit der Vorschau-Adresse, vor dem Livegang mit der Domain.
6. Konto-E-Mails (Cloud → Emails): Vorlagen in Axion-Optik erstellen lassen und die Absender-Domain per DNS
   bestätigen (Lovable setzt SPF, DKIM und DMARC). Bis dahin kommen die Standard-E-Mails von Lovable.
7. Sicherheit: den Sicherheits-Check von Lovable ausführen; keine Warnungen der Stufe «Error».

## 3. Stripe (Konto von Axion)

1. Axion eröffnet das Konto und lädt Ben als Teammitglied ein (Rolle Administrator oder Entwickler).
   Zwei-Faktor-Anmeldung einschalten.
2. Eingeschränkten Schlüssel (`rk_…`) erstellen, nur mit diesen Rechten: Checkout Sessions **Schreiben**,
   Coupons **Schreiben**, PaymentIntents **Lesen**. Der Schlüssel kommt nur in die Secrets von Lovable Cloud.
3. Zahlungsarten im Dashboard einschalten (die Kasse zeigt sie automatisch): Karten, Apple Pay, Google Pay,
   Klarna, TWINT (TWINT erst nach Prüfung durch Stripe, Shop muss öffentlich erreichbar sein, Impressum vollständig).
4. Webhook: Endpunkt `<VITE_SUPABASE_URL>/functions/v1/stripe-webhook` (Adresse aus der `.env`), Ereignisse
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Das Signatur-Geheimnis (`whsec_…`) als `STRIPE_WEBHOOK_SECRET` speichern.
5. Öffentliche Angaben: Name auf der Kartenabrechnung (z. B. AXION), Support-E-Mail. Mit
   `STRIPE_REQUIRE_TERMS=1` verlangt die Kasse das AGB-Häkchen; dafür in Stripe die Adresse der AGB hinterlegen.

## 4. Resend (Bestell-E-Mails)

1. Domain von Axion hinzufügen und die DNS-Einträge (SPF, DKIM) beim Registrar setzen, warten bis «verified».
2. `EMAIL_FROM` z. B. `Axion <bestellung@<domain>>`. Antworten gehen an `SHOP_CONTACT_EMAIL`.
3. Auftragsbearbeitungsvertrag (DPA) von Resend abschliessen: Resend (Plus Five Five, Inc.) bearbeitet in den USA;
   die Datenschutzerklärung stützt sich dafür auf Standardvertragsklauseln.

## 5. Erster Admin

1. Im Shop ein Konto registrieren (`/konto/registrieren`) und die E-Mail bestätigen.
2. Einmalig in der Datenbank (macht Claude, sonst SQL-Editor von Cloud):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'adresse@example.ch' and email_confirmed_at is not null;
   ```
3. Weitere Personen danach im Admin unter «Zugänge». Der letzte Admin kann sich nicht selbst löschen.

## 6. Inhalte und Einstellungen

- `src/config/shop.ts`: Firma, Adresse, E-Mail, Telefon, UID, `siteUrl`, `returnDays` (Werte aus der Checkliste).
- Admin → Einstellungen: Versandkosten und Gratisversand ab, Gültigkeit der Gutscheine (Standard 5 Jahre),
  Willkommens-Rabatt für den Newsletter, Adresse für Bestellmeldungen.
- Admin → Kategorien, Produkte, Inhalte (Startseite, Laufband).
- Rechtstexte in `src/content/pages.ts`: Platzhalter in eckigen Klammern ersetzen, sobald Axion die Prüfung per
  E-Mail bestätigt hat (auch den Ort des Rechenzentrums von Lovable Cloud). Solange Platzhalter drin sind, markiert der
  Shop die Seite als Entwurf. Englische Rechtstexte liefert Axion; bis dahin zeigt `/en` die deutsche Fassung mit
  Hinweis.

## 7. Testkauf (Testmodus)

1. Karte `4242 4242 4242 4242`, beliebiges künftiges Datum, beliebige Prüfziffer.
2. Prüfen: Bestellbestätigung an die Kundschaft, Bestellmeldung an `SHOP_NOTIFY_EMAIL`, Bestellung im Admin,
   Bestand reduziert, Versand melden mit Sendungsnummer (E-Mail kommt), Rückerstattung in Stripe (Admin zeigt sie).
3. Gutschein kaufen und einlösen, Rabattcode einlösen, Newsletter anmelden und bestätigen, Konto anlegen und löschen,
   Passwort zurücksetzen.
4. Abgebrochene Zahlung: Artikel sind sofort wieder verfügbar.

## 8. Livegang

1. Stripe live: Live-Schlüssel (`rk_live_…`) und Live-Webhook mit eigenem `whsec_…` in die Secrets.
2. Domain in Lovable verbinden. `SITE_URL` und `ALLOWED_ORIGINS` (Secrets), Site URL und Redirect URLs (Cloud → Users)
   sowie `siteUrl` in `src/config/shop.ts` auf die Domain umstellen. Die Vorschau-Adresse aus `ALLOWED_ORIGINS`
   entfernen.
3. `launched: true` in `src/config/shop.ts`, dann `bun scripts/sync-robots.ts` (robots.txt erlaubt Suchmaschinen und
   nennt `/sitemap.xml`). Commit, push, in Lovable veröffentlichen.
4. Echter Kauf mit kleinem Betrag und Rückerstattung. TWINT nach der Freischaltung durch Stripe testen.

## 9. Lieferpaket bauen

```bash
scripts/package-delivery.sh            # Standard: alles seit dem Lovable-Stand ec0da66
```

Ergebnis in `.local/delivery/`: `axion.patch` (alle Commits, für `git am`), `dateien/` (geänderte und neue
Dateien), `LOESCHEN.txt` (zu löschende Dateien) und ein ZIP mit allem.

## 10. Betrieb (Betreuung)

- Sicherung: Lovable Cloud (Database → Backups wiederherstellen). Zusätzlich monatlich die Daten exportieren
  (Cloud → erweiterte Einstellungen → Export) und verschlüsselt ablegen.
- Guthaben im Lovable-Workspace im Auge behalten (bei 0 pausieren Datenbank und Login).
- Überwachen: Logs der Funktionen (Cloud → Edge functions), Stripe → Webhooks (fehlgeschlagene Zustellungen),
  Resend (Bounces).
- Admin → Bestellungen, Ansicht «Prüfen»: Zahlungen nach Ablauf der Reservierung, die von Hand geprüft werden müssen,
  und zurückerstattete Gutscheinkäufe, deren Gutschein schon benutzt war.
- Streitfälle (Disputes) bearbeitest du im Stripe-Dashboard. Betrifft es einen Gutscheinkauf, den Gutschein im Admin
  unter «Gutscheine» sperren.
- Die Kasse begrenzt Missbrauch: pro IP 20 Kassen in 30 Minuten, pro E-Mail 10, höchstens 3 gleichzeitig offen
  (Antwort `429`, die Kundschaft sieht «Zu viele Versuche»).
