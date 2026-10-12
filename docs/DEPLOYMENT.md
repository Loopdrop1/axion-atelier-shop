# Axion-Shop: Inbetriebnahme

Anleitung für Ben (Flowrenix). Reihenfolge einhalten: zuerst alles im **Testmodus**, erst am Schluss live.
Stand 12.10.2026.

**Grundregel:** Passwörter, geheime Schlüssel (Stripe `sk_`/`rk_`, Supabase Secret Key, Resend) und die IBAN gehören
nie in einen Chat, eine E-Mail oder ins Git. Sie kommen nur in die Secrets von Supabase. Öffentlich und damit
unkritisch sind nur die Supabase-URL und der Publishable Key (`sb_publishable_…`).

## Überblick

| Teil                                 | Wo                                                                      | Wem gehört das Konto            |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------- |
| Shop und Admin (TanStack Start)      | Lovable-Projekt `81384fd7-77a8-4809-b8c3-48b5a9ee05e8`, Code auf GitHub | Flowrenix                       |
| Datenbank, Login, Bilder, Funktionen | eigenes Supabase-Projekt, Region Zürich                                 | Flowrenix (Betreuung)           |
| Zahlung                              | Stripe Checkout im Konto von Axion                                      | Axion, Ben als Teammitglied     |
| E-Mails                              | Resend mit der Domain von Axion                                         | Flowrenix oder Axion            |
| Domain                               | Registrar nach Wahl, auf Axion                                          | Axion (Kosten in der Betreuung) |

## 1. Code nach Lovable bringen

1. In Lovable das Projekt mit GitHub verbinden. Lovable legt ein Repository mit dem aktuellen Stand an.
2. Repository lokal klonen und das Lieferpaket einspielen (siehe Abschnitt 9):
   ```bash
   git checkout -b eigenbau
   git am --3way /pfad/zu/axion.patch     # alle Commits seit dem Lovable-Stand
   ```
   Klappt `git am` nicht (Lovable hat inzwischen etwas geändert), die Dateien aus `dateien/` darüberkopieren und
   die Dateien aus `LOESCHEN.txt` entfernen, dann einen Commit machen.
3. Datei `.env` anlegen (darf ins Git, enthält nur öffentliche Werte):
   ```
   VITE_SUPABASE_URL=https://<projekt-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```
4. Branch auf `main` zusammenführen und pushen. **Nie force-pushen** (Lovable verliert sonst den Verlauf).
   Lovable übernimmt die Änderung ohne Credits und baut die Vorschau neu.
5. Lokal prüfen, bevor gepusht wird: `bun install`, `bun run lint`, `bunx tsc --noEmit`, `bun run test`, `bun run build`.

## 2. Supabase-Projekt

1. Neues Projekt in der Region **Zürich**. Plan **Pro** (ab USD 25 pro Monat): Gratisprojekte werden nach einer
   Woche ohne Aktivität pausiert und haben keine automatischen Sicherungen; Pro sichert täglich und bewahrt 7 Tage
   auf (supabase.com/pricing, 12.10.2026).
2. Datenbank einrichten mit der Supabase CLI (verlangt das Datenbank-Passwort, das gibst nur du ein):
   ```bash
   supabase link --project-ref <projekt-ref>
   supabase db push          # spielt supabase/migrations/ ein
   ```
3. Funktionen veröffentlichen (Einstellungen kommen aus `supabase/config.toml`, alle mit `verify_jwt = false`,
   sie prüfen den Aufrufer selbst):
   ```bash
   supabase functions deploy checkout stripe-webhook newsletter admin-actions account-delete auth-email-hook
   ```
4. Secrets setzen (Dashboard → Edge Functions → Secrets oder `supabase secrets set`). Liste und Bedeutung:
   `supabase/functions/README.md`, Abschnitt «Secrets». Zum Start: `SITE_URL` (Testadresse von Lovable),
   `STRIPE_SECRET_KEY` (Test-Schlüssel), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL`, `SHOP_ADDRESS`, `SEND_EMAIL_HOOK_SECRET`. Optional
   `ALLOWED_ORIGINS` (weitere Domains, Komma-getrennt), `STRIPE_REQUIRE_TERMS=1`, `SHIPPING_COUNTRIES`
   (Standard `CH`; `CH,LI` erst, wenn Axion Liechtenstein beliefern will und die Liechtenstein-Klauseln in den
   Rechtstexten stehen).
5. Authentication einstellen:
   - Site URL: die Shop-Adresse. Redirect URLs: `<shop>/konto`, `<shop>/konto/passwort-neu`, `<shop>/konto/daten`
     und dieselben mit `/en` davor (z. B. `<shop>/en/konto`). Vor dem Livegang auch für die echte Domain.
   - Ablauf der E-Mail-Codes (Email OTP Expiration): **3600 Sekunden** (1 Stunde).
   - Hook «Send Email» (HTTPS): URL `https://<projekt-ref>.supabase.co/functions/v1/auth-email-hook`. Das dort
     erzeugte Geheimnis als `SEND_EMAIL_HOOK_SECRET` speichern. Danach kommen alle Konto-E-Mails in Axion-Optik.
6. Speicher: Die Buckets `product-images` und `site-media` legt die Migration an (öffentlich lesbar, schreiben nur
   Admins). Nichts weiter zu tun.
7. Sicherheit prüfen: Dashboard → Advisors (Security und Performance) ohne Warnungen der Stufe «Error».

## 3. Stripe (Konto von Axion)

1. Axion eröffnet das Konto und lädt Ben als Teammitglied ein (Rolle Administrator oder Entwickler).
   Zwei-Faktor-Anmeldung einschalten.
2. Eingeschränkten Schlüssel (`rk_…`) erstellen, nur mit diesen Rechten: Checkout Sessions **Schreiben**,
   Coupons **Schreiben**, PaymentIntents **Lesen**. Der Schlüssel kommt nur in die Supabase-Secrets.
3. Zahlungsarten im Dashboard einschalten (die Kasse zeigt sie automatisch): Karten, Apple Pay, Google Pay,
   Klarna, TWINT (TWINT erst nach Prüfung durch Stripe, Shop muss öffentlich erreichbar sein, Impressum vollständig).
4. Webhook: Endpunkt `https://<projekt-ref>.supabase.co/functions/v1/stripe-webhook`, Ereignisse
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Das Signatur-Geheimnis (`whsec_…`) als `STRIPE_WEBHOOK_SECRET` speichern.
5. Öffentliche Angaben: Name auf der Kartenabrechnung (z. B. AXION), Support-E-Mail. Mit
   `STRIPE_REQUIRE_TERMS=1` verlangt die Kasse das AGB-Häkchen; dafür in Stripe die Adresse der AGB hinterlegen.

## 4. Resend (E-Mails)

1. Domain von Axion hinzufügen und die DNS-Einträge (SPF, DKIM) beim Registrar setzen, warten bis «verified».
2. `EMAIL_FROM` z. B. `Axion <bestellung@<domain>>`. Antworten gehen an `SHOP_CONTACT_EMAIL`.
3. Auftragsbearbeitungsvertrag (DPA) von Resend abschliessen: Resend (Plus Five Five, Inc.) bearbeitet in den USA;
   die Datenschutzerklärung stützt sich dafür auf Standardvertragsklauseln.

## 5. Erster Admin

1. Im Shop ein Konto registrieren (`/konto/registrieren`) und die E-Mail bestätigen.
2. Im SQL-Editor von Supabase einmalig:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'adresse@example.ch';
   ```
3. Weitere Personen danach im Admin unter «Zugänge». Der letzte Admin kann sich nicht selbst löschen.

## 6. Inhalte und Einstellungen

- `src/config/shop.ts`: Firma, Adresse, E-Mail, Telefon, UID, `siteUrl`, `returnDays` (Werte aus der Checkliste).
- Admin → Einstellungen: Versandkosten und Gratisversand ab, Gültigkeit der Gutscheine (Standard 5 Jahre),
  Willkommens-Rabatt für den Newsletter, Adresse für Bestellmeldungen.
- Admin → Kategorien, Produkte, Inhalte (Startseite, Laufband).
- Rechtstexte in `src/content/pages.ts`: Platzhalter in eckigen Klammern ersetzen, sobald Axion die Prüfung per
  E-Mail bestätigt hat. Solange Platzhalter drin sind, markiert der Shop die Seite als Entwurf. Englische
  Rechtstexte liefert Axion; bis dahin zeigt `/en` die deutsche Fassung mit Hinweis.

## 7. Testkauf (Testmodus)

1. Karte `4242 4242 4242 4242`, beliebiges künftiges Datum, beliebige Prüfziffer.
2. Prüfen: Bestellbestätigung an die Kundschaft, Bestellmeldung an `SHOP_NOTIFY_EMAIL`, Bestellung im Admin,
   Bestand reduziert, Versand melden mit Sendungsnummer (E-Mail kommt), Rückerstattung in Stripe (Admin zeigt sie).
3. Gutschein kaufen und einlösen, Rabattcode einlösen, Newsletter anmelden und bestätigen, Konto anlegen und löschen.
4. Abgebrochene Zahlung: Artikel sind sofort wieder verfügbar.

## 8. Livegang

1. Stripe live: Live-Schlüssel (`rk_live_…`) und Live-Webhook mit eigenem `whsec_…` in die Secrets.
2. Domain in Lovable verbinden. `SITE_URL`, Redirect URLs in Supabase und `siteUrl` in `src/config/shop.ts` auf die
   Domain umstellen.
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

- Sicherung: Supabase Pro täglich (7 Tage). Zusätzlich monatlich `supabase db dump` verschlüsselt ablegen.
- Überwachen: Supabase Logs der Funktionen, Stripe → Webhooks (fehlgeschlagene Zustellungen), Resend (Bounces).
- Admin → Bestellungen, Ansicht «Prüfen»: Zahlungen nach Ablauf der Reservierung, die von Hand geprüft werden müssen.
