# Axion-Shop: Inbetriebnahme

Anleitung für Ben (Flowrenix). Reihenfolge einhalten: zuerst alles im **Testmodus**, erst am Schluss live.
Stand 12.10.2026. Datenbank: **Lovable Cloud** (Entscheid Ben), Code-Übertragung über **GitHub**.

**Grundregel:** Passwörter, geheime Schlüssel (Stripe `rk_`/`sk_`, Webhook-Geheimnisse, Resend) und die IBAN gehören
nie in einen Chat, eine E-Mail oder ins Git. Sie kommen nur in die Secrets von Lovable Cloud (Cloud → Secrets).

## Überblick

| Teil                                  | Wo                                                                      | Wem gehört das Konto                       |
| ------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Shop und Admin (TanStack Start)       | Lovable-Projekt `81384fd7-77a8-4809-b8c3-48b5a9ee05e8`, Code auf GitHub | Flowrenix                                  |
| Datenbank, Login, Bilder, Funktionen  | Lovable Cloud im selben Projekt, Region Europa                          | Flowrenix (Lovable-Workspace)              |
| Automatische Übersetzung              | Lovable AI (Schlüssel legt Lovable selbst an)                           | Flowrenix (AI-Guthaben des Workspaces)     |
| Zahlung                               | Stripe Checkout im Konto von Axion                                      | Axion (Konto-E-Mail), Ben als Teammitglied |
| Bestell- und Kontaktformular-E-Mails  | Resend mit der Domain von Axion                                         | Axion (Konto-E-Mail), Ben als Teammitglied |
| Konto-E-Mails (Bestätigung, Passwort) | Lovable Cloud, eigene Vorlagen, Absender per DNS                        | Flowrenix (bezahlter Lovable-Plan)         |
| Domain                                | Registrar auf Axion, DNS mit NS-Einträgen für Subdomains                | Axion als Halter, Kosten Ben (Betreuung)   |
| E-Mail-Postfächer                     | Anbieter nach Wahl von Axion                                            | Axion (zahlt Axion)                        |

Konten richtet Ben mit der **Konto-E-Mail** von Axion ein (Angebot, Teil 6). Bei der Übergabe setzt Axion eigene
Passwörter und die Zwei-Faktor-Anmeldung; Ben behält dort, wo er für die Betreuung Zugang braucht, einen eigenen
Zugang als Teammitglied.

**Wichtig zu Lovable Cloud:** Die Nutzung läuft über das Guthaben des Workspaces (Cloud und AI). Ist es leer,
pausieren Datenbank, Speicher und Login (die Seiten bleiben erreichbar, aber niemand kann bestellen), und die
Übersetzung meldet «nicht verfügbar». Deshalb immer genug Guthaben halten und, wo möglich, automatisches Nachladen
einschalten.

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

1. In Lovable: **Cloud aktivieren**, Region **Europa** wählen. Die Region lässt sich danach nicht mehr ändern, und
   das Angebot sagt Axion ein Rechenzentrum in Europa zu. Lovable legt dabei `.env` mit `VITE_SUPABASE_URL` und
   `VITE_SUPABASE_PUBLISHABLE_KEY` an; der Shop liest genau diese.
2. Datenbank: Lovable führt Migrationen aus Git **nicht** aus. Die sieben Dateien in `supabase/migrations/` werden der
   Reihe nach ausgeführt (macht Claude über die Datenbank-Verbindung, sonst im SQL-Editor von Cloud). Danach prüfen:
   16 Tabellen im Schema `public`, Buckets `product-images` und `site-media`, Funktion `contact_guard`.
   `supabase/seed.sql` **nicht** ausführen: Er enthält Platzhalterprodukte und Beispielwerte für die Vorschau.
3. Funktionen veröffentlichen: im **Lovable-Chat** einfügen (kostet wenige Credits):

   > Deploy the edge functions checkout, stripe-webhook, newsletter, admin-actions, contact and account-delete
   > exactly as they are in supabase/functions, with verify_jwt = false as in supabase/config.toml. Do not change
   > their code. The function admin-actions uses LOVABLE_API_KEY and the Lovable AI gateway with the model
   > google/gemini-2.5-flash; if that model is not available in the gateway, tell me the current default Gemini Flash
   > model id instead of changing the code.

   Kontrolle unter Cloud → Edge functions. `auth-email-hook` wird nicht gebraucht: Konto-E-Mails verschickt Lovable
   Cloud selbst. Nennt Lovable ein anderes Modell, dieses als Secret `TRANSLATE_MODEL` speichern.

4. Secrets (Cloud → Secrets), Bedeutung in `supabase/functions/README.md`, Abschnitt «Secrets»:
   - Testphase: `SITE_URL` = `https://id-preview--81384fd7-77a8-4809-b8c3-48b5a9ee05e8.lovable.app`,
     `ALLOWED_ORIGINS` = dieselbe Adresse (genau diese, kein `ALLOW_PREVIEW_ORIGINS`).
   - `STRIPE_SECRET_KEY` (Test-Schlüssel `rk_test_…`), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
     `SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL` (bekommt auch die Nachrichten aus dem Kontaktformular),
     `SHOP_ADDRESS`. Optional `STRIPE_REQUIRE_TERMS=1`, `SHIPPING_COUNTRIES` (Standard `CH`; `CH,LI` erst, wenn Axion
     Liechtenstein beliefern will und die Liechtenstein-Klauseln in den Rechtstexten stehen), `TRANSLATE_MODEL`.
   - `LOVABLE_API_KEY` legt Lovable selbst an; nicht von Hand setzen.
5. Authentifizierung (Cloud → Users → Einstellungen):
   - **«Auto-confirm email» aus**, **«Secure email change» ein.** Gastbestellungen werden einem Konto über die
     E-Mail-Adresse zugeordnet; ohne Bestätigung könnte jemand mit einer fremden Adresse ein Konto eröffnen und deren
     Bestellungen sehen.
   - Email OTP expiration: **3600** Sekunden. Password HIBP check: ein.
   - Site URL: die Shop-Adresse. Redirect URLs: `<shop>/konto`, `<shop>/konto/passwort-neu`, `<shop>/konto/daten`
     und dieselben mit `/en` davor. In der Testphase mit der Vorschau-Adresse, vor dem Livegang mit der Domain.
6. Konto-E-Mails in Axion-Optik (Cloud → Emails, nur mit bezahltem Lovable-Plan):
   - Absender-Domain hinzufügen. Lovable legt eine Subdomain an (Standard `notify`) und verlangt dafür `NS`-Einträge
     und einen `TXT`-Eintrag beim DNS der Domain. Der DNS-Anbieter muss `NS`-Einträge für Subdomains erlauben
     (laut Lovable können Hostinger und Wix das nicht; dann den DNS zu Cloudflare umziehen). Die Bestätigung dauert
     einige Stunden, höchstens 72.
   - «Customize auth emails» wählen, dann im **Lovable-Chat** einfügen:

     > Make the six auth email templates bilingual: German first, then the same text in English below a thin
     > line. Use the Axion look from supabase/functions/\_shared/email/layout.ts (colours, logo text AXION, footer
     > with company address) and keep all variables and links unchanged.

     Lovable-Vorlagen kennen keine Sprache pro Person, deshalb beide Sprachen in einer E-Mail. Danach unter
     «Send test» beide Fassungen prüfen. Bis dahin kommen die Standard-E-Mails von Lovable.
7. Sicherheit: den Sicherheits-Check von Lovable ausführen; keine Warnungen der Stufe «Error».

## 3. Stripe (Konto von Axion)

1. Ben eröffnet das Konto mit der Konto-E-Mail von Axion. Axion ergänzt Firma, verantwortliche Person und
   Geschäftskonto direkt bei Stripe (Stripe prüft die Identität). Ben bleibt als Teammitglied dabei (Rolle
   Administrator oder Entwickler). Zwei-Faktor-Anmeldung für alle einschalten.
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
6. Benachrichtigungen: unter den persönlichen Einstellungen von Ben Meldungen zu fehlgeschlagenen Webhooks und zu
   Streitfällen einschalten.

## 4. Resend (Bestell- und Kontaktformular-E-Mails)

1. Konto mit der Konto-E-Mail von Axion eröffnen, Ben als Teammitglied. Domain von Axion hinzufügen und die
   DNS-Einträge (SPF, DKIM) setzen, warten bis «verified».
2. `EMAIL_FROM` z. B. `Axion <bestellung@<domain>>`. Antworten auf Bestell-E-Mails gehen an `SHOP_CONTACT_EMAIL`,
   Antworten auf Nachrichten aus dem Kontaktformular direkt an die Kundschaft.
3. Auftragsbearbeitungsvertrag (DPA) von Resend abschliessen: Resend (Plus Five Five, Inc.) bearbeitet in den USA;
   die Datenschutzerklärung stützt sich dafür auf Standardvertragsklauseln.
4. Vor dem Livegang Axion per E-Mail um die Genehmigung für Resend bitten (Angebot, «Rechte, Daten und Haftung»).

## 5. Erster Admin

1. Im Shop ein Konto registrieren (`/konto/registrieren`) und die E-Mail bestätigen.
2. Einmalig in der Datenbank (macht Claude, sonst SQL-Editor von Cloud):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'adresse@example.ch' and email_confirmed_at is not null;
   ```
3. Weitere Personen danach im Admin unter «Zugänge». Der letzte Admin kann sich nicht selbst löschen.

## 6. Inhalte und Einstellungen (nach den Antworten in der Checkliste)

- `src/config/shop.ts`: Firma, Adresse, E-Mail, Telefon (leer = keine Nummer im Shop), Erreichbarkeit (leer = ohne),
  UID, `vatRegistered` (mit MWST-Pflicht: Quittung mit MWST-Nummer, Satz und Betrag), `siteUrl`, `returnDays`.
- Admin → Einstellungen: Versandkosten und «Gratisversand ab», ausverkaufte Grössen ausblenden, Gutscheinbeträge und
  Gültigkeit (Standard 5 Jahre; wählt Axion «unbegrenzt», 30 Jahre eintragen und die AGB anpassen),
  Willkommens-Rabatt für den Newsletter (leer = keiner), Adresse für Bestellmeldungen.
- Admin → Kategorien (erscheinen in dieser Reihenfolge in den Menüs; am Computer höchstens fünf, die übrigen über
  «Alle Stücke»), Produkte (die drei Beispielprodukte mit echten Angaben und Fotos), Grössentabellen (Masse von Axion,
  pro Kategorie), Startseite und Laufband (Texte, Bild der Geschichte quer und fürs Handy hoch). Englisch entsteht beim
  Speichern automatisch; Ben prüft die Übersetzungen zum Start einmal durch.
- Verlangt Axion Versandkosten oder «gratis ab»: Produktseiten und Startseite passen sich an. Laufband und Einstieg
  der Startseite (Admin) sowie die Texte für Suchmaschinen (`src/i18n/messages/de.ts` und `en.ts`, Abschnitt `seo`)
  von Hand anpassen.
- Rechtstexte Deutsch in `src/content/pages.ts`, Englisch in `src/content/pages-en.ts` (Übersetzung von Ben,
  massgebend ist Deutsch, der Shop zeigt das auf Englisch an). Platzhalter in eckigen Klammern in beiden Sprachen
  ersetzen, sobald Axion die Prüfung per E-Mail bestätigt hat (auch den Ort des Rechenzentrums von Lovable Cloud).
  Solange Platzhalter drin sind, markiert der Shop die Seite als Entwurf. Ein Test prüft, dass beide Sprachen den
  gleichen Aufbau haben.
- Wählt Axion «Bestellen nur mit Kundenkonto»: kleiner Umbau (Kasse, Warenkorb, AGB, Häufige Fragen), rund eine
  Stunde. Economy oder Priority zur Wahl und Lieferung in die EU sind nicht eingebaut (laut Checkliste Aufpreis).

## 7. Testkauf (Testmodus)

1. Karte `4242 4242 4242 4242`, beliebiges künftiges Datum, beliebige Prüfziffer.
2. Prüfen: Bestellbestätigung an die Kundschaft (mit Hinweis zur Rückgabe), Bestellmeldung an `SHOP_NOTIFY_EMAIL`,
   Bestellung im Admin, «Quittung drucken», Bestand reduziert, Versand melden mit Sendungsnummer (E-Mail kommt),
   Rückerstattung in Stripe (Admin zeigt sie).
3. Gutschein kaufen und einlösen, Rabattcode einlösen, Newsletter anmelden und bestätigen, Konto anlegen und löschen,
   Passwort zurücksetzen, Kontaktformular abschicken (E-Mail an `SHOP_CONTACT_EMAIL`, Antworten gehen an die
   Absenderin).
4. Produkt im Admin auf Deutsch ändern und speichern: Die englischen Felder füllen sich, `/en/produkt/…` zeigt sie.
5. Abgebrochene Zahlung: Artikel sind sofort wieder verfügbar.

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

- Sicherung, monatlich: Daten aus Lovable Cloud exportieren und verschlüsselt ablegen. Die Bilder im Shop sind
  verkleinerte Kopien; die Originalfotos bewahrt Axion auf. Einmal im Quartal die Wiederherstellung an einer Kopie
  ausprobieren.
- Guthaben im Lovable-Workspace im Auge behalten (Cloud und AI; bei 0 pausieren Datenbank und Login, die Übersetzung
  meldet «nicht verfügbar»).
- Überwachen: Logs der Funktionen (Cloud → Edge functions), Stripe → Webhooks (fehlgeschlagene Zustellungen, Meldung
  per E-Mail an Ben), Resend (Bounces). Empfohlen: kostenlose Erreichbarkeits-Überwachung der Startseite mit
  Meldung an Ben.
- Updates: Sicherheitsmeldungen von GitHub (Dependabot) für das Repository einschalten; Pakete bei Meldungen oder
  einmal im Quartal aktualisieren, prüfen (Tests, Build) und per Push einspielen.
- Admin → Bestellungen, Ansicht «Prüfen»: Zahlungen nach Ablauf der Reservierung, die von Hand geprüft werden müssen,
  und zurückerstattete Gutscheinkäufe, deren Gutschein schon benutzt war.
- Streitfälle (Disputes) bearbeitest du im Stripe-Dashboard. Betrifft es einen Gutscheinkauf, den Gutschein im Admin
  unter «Gutscheine» sperren.
- Missbrauchsbremsen: Kasse pro IP 20 in 30 Minuten, pro E-Mail 10, höchstens 3 gleichzeitig offen; Kontaktformular
  pro IP 5 pro Stunde, pro Adresse 3, insgesamt 60 (Antwort `429`, die Kundschaft sieht einen Hinweis).
