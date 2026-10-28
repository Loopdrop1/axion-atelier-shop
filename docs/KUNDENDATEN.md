# Kundendaten und Entscheide vor dem Livegang

Eine Checkliste für alles, was Axion (Kundschaft/Inhaberin) noch liefern oder entscheiden muss, bevor der Shop live geht.
Jede Zeile sagt, **wo** der Wert hineingehört und **was passiert, wenn er leer bleibt**. Die Reihenfolge der
Inbetriebnahme steht in `docs/DEPLOYMENT.md`; die Funktionen und Secrets in `supabase/functions/README.md`.
Betrieb und Überwachung: `docs/BETRIEB.md`; Testkauf: `docs/TESTKAUF.md`; iPhone-Prüfung: `docs/IPHONE-CHECK.md`.

Grundregel: Geheime Schlüssel (Stripe, Resend), Passwörter und die IBAN nie per Chat oder E-Mail schicken und nie ins
Git legen. Sie kommen nur in Cloud → Secrets.

Platzhalter in eckigen Klammern (`[…]`) in `src/config/shop.ts` und in den Rechtstexten erkennt der Shop selbst:
Er blendet die Angabe aus, markiert die Seite als Entwurf oder verhindert den Livegang (Test `launch-gate`).

## 1. Firmen- und Kontaktangaben

Datei `src/config/shop.ts`, Objekt `contact`. Dieselben Werte erscheinen im Impressum, in den Rechtstexten, im Footer
(Firma und Ort statt «© Axion»), in den Strukturierten Daten (Organization) und im Beleg.

| Feld                        | Wohin             | Wenn leer oder noch `[…]`                                                                                     |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Firmenname inkl. Rechtsform | `contact.company` | Footer zeigt nur «Axion», Impressum und Rechtstexte bleiben Entwurf, Livegang-Test schlägt an                 |
| Adresse (Strasse, PLZ Ort)  | `contact.address` | Footer zeigt keinen Ort (Format «Strasse 1, 8000 Zürich»), Impressum bleibt Entwurf, Livegang-Test schlägt an |
| E-Mail-Adresse              | `contact.email`   | Kontaktseite und Rechtstexte unvollständig, Livegang-Test schlägt an                                          |
| Telefon (freiwillig)        | `contact.phone`   | Leer lassen = keine Nummer im Shop. Ein `[…]`-Platzhalter blockiert den Livegang                              |
| Erreichbarkeit (freiwillig) | `contact.hours`   | Leer = ohne Zeiten                                                                                            |
| UID                         | `contact.uid`     | Pflicht bei MWST-Pflicht (Format `CHE-123.456.789`), sonst Livegang-Test rot                                  |

Zusätzlich als Secrets (Cloud → Secrets), damit die E-Mails dieselben Angaben tragen:

| Secret               | Inhalt                                                                     | Wenn leer                                              |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `SHOP_CONTACT_EMAIL` | Antwortadresse der Bestell-Mails, Empfänger des Kontaktformulars           | Kontaktformular und Antworten funktionieren nicht      |
| `SHOP_ADDRESS`       | Adresse im Fuss der E-Mails                                                | E-Mails ohne Absenderadresse (rechtlich ungenügend)    |
| `SHOP_NOTIFY_EMAIL`  | Empfänger der Meldung bei jeder Bestellung (auch im Admin → Einstellungen) | Keine Bestellmeldung; Adresse aus der Einrichtung gilt |
| `SHOP_NAME`          | Anzeigename in E-Mails (Standard «Axion»)                                  | Standard                                               |

## 2. Adresse des Shops, Livegang und Suchmaschinen

| Entscheid                       | Wohin                                                                             | Wenn offen                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Domain des Shops                | `src/config/shop.ts` → `siteUrl` (jetzt `https://www.axion-shop.ch`, Platzhalter) | Canonical, Sitemap, Strukturierte Daten und Teilen-Links zeigen auf die falsche Adresse        |
| Domain für Funktionen und Login | Secrets `SITE_URL`, `ALLOWED_ORIGINS`; Cloud → Users: Site URL und Redirect URLs  | Kasse, Konto-Links und CORS funktionieren nur auf der Vorschau                                 |
| Vorschau-Freigaben entfernen    | Secrets `ALLOW_PREVIEW_ORIGINS` und `PREVIEW_ORIGINS` löschen                     | Funktionen bleiben von Vorschau- und localhost-Seiten aufrufbar (Sicherheitsrisiko)            |
| Livegang                        | `src/config/shop.ts` → `launched: true`, danach `bun scripts/sync-robots.ts`      | Shop bleibt für Suchmaschinen gesperrt (`noindex`, `robots.txt` sperrt alles, `/llms.txt` 404) |

`launched` und `public/robots.txt` müssen zusammenpassen; der Test `launch-gate` prüft das. Danach Commit, Push und
in Lovable veröffentlichen.

## 3. MWST, Rückgabe, Zahlungsarten, Versand

| Entscheid                     | Wohin                                                                                                                      | Wenn offen                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MWST-pflichtig? Satz          | `shop.ts` → `vatRegistered` (`true`/`false`) und `vatRate` (Normalsatz, z. B. `8.1`); Secret `SHOP_VAT_RATE` gleich setzen | Ohne MWST-Pflicht bleibt `false`: Belege und Preise ohne MWST-Ausweis. `vatRate` und Secret müssen übereinstimmen                                                             |
| Rückgabefrist in Tagen        | `shop.ts` → `returnDays` (Standard 14) und Secret `SHOP_RETURN_DAYS` gleich                                                | E-Mails und Shop können verschiedene Fristen nennen; AGB und «Versand und Rückgabe» passend halten                                                                            |
| Lieferzeit und Annahmeschluss | `shop.ts` → `delivery` (Annahmeschluss 14:00, 2 bis 5 Arbeitstage)                                                         | Das Lieferdatum auf Produktseite und im Warenkorb stimmt nicht; AGB, «Versand und Rückgabe» und `de.ts`/`en.ts` («Lieferung in 2 bis 5 Arbeitstagen») gemeinsam anpassen      |
| Zahlungsarten                 | `shop.ts` → `paymentMethods` (Footer-Badges); Zahlungsarten selbst im Stripe-Dashboard einschalten                         | Eine hier genannte, in Stripe nicht aktive Art täuscht Kundschaft. «Klarna» in der Liste zeigt den Klarna-Hinweis auf der Produktseite; TWINT erst nach Freigabe durch Stripe |
| Versandkosten, «Gratis ab»    | Admin → Einstellungen                                                                                                      | Standard: Versand kostenlos, kein Schwellenwert                                                                                                                               |
| Liefergebiet                  | Secret `SHIPPING_COUNTRIES` (Standard `CH`)                                                                                | Nur Schweiz. `CH,LI` erst, wenn die Liechtenstein-Klauseln in `pages.ts` und `pages-en.ts` stehen                                                                             |
| Gutscheinbeträge, Gültigkeit  | Admin → Einstellungen (Standard 5 Jahre)                                                                                   | Standardwerte                                                                                                                                                                 |

## 4. Newsletter und Willkommensrabatt

| Entscheid                      | Wohin                                                                                                  | Wenn leer                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Prozent des Willkommensrabatts | Admin → Einstellungen → Newsletter (ganze Zahl 1 bis 50)                                               | Kein Rabatt: Footer und Konto zeigen keinen Hinweis, die Willkommens-Mail enthält keinen Code |
| Newsletter-Programm und Sitz   | Datenschutz, Ziffer 4 (Platzhalter «Den Newsletter versenden wir mit …»), `pages.ts` und `pages-en.ts` | Datenschutz bleibt Entwurf                                                                    |

Der Text im Footer («{n} % auf deine erste Bestellung») kommt automatisch aus diesem Wert. Der Einwilligungstext
(`supabase/functions/_shared/consent.ts`, Version `newsletter-v2`) erwähnt den Rabatt als Gegenleistung; ändert sich
der Wortlaut, `CONSENT_VERSION` erhöhen und `src/i18n/messages` angleichen. Newsletter und Bestell-Mails enthalten
keine Öffnungs- oder Klickverfolgung im Code. **Kontrollieren:** In Resend → Domains darf «Open tracking» und «Click
tracking» für die Absender-Domain nicht eingeschaltet sein, sonst stimmt die Aussage in der Datenschutzerklärung nicht.

## 5. Social-Kanäle

`src/config/shop.ts` → `social`: `instagram`, `facebook`, `linkedin`, `tiktok`, `pinterest`, jeweils die vollständige
`https://`-Adresse des Profils.

Leer = der Kanal erscheint weder im Footer noch in den Strukturierten Daten (`sameAs`). Es werden keine Skripte
Dritter geladen, nur Links.

## 6. Rechtstexte: Platzhalter in `[…]`

Deutsch in `src/content/pages.ts`, Englisch in `src/content/pages-en.ts` (gleiche Stellen, gleicher Aufbau; massgebend
ist Deutsch). Solange ein Platzhalter steht, zeigt der Shop die Seite als Entwurf. Die Rechtsberatung gibt die Texte
frei; Ben ersetzt die Platzhalter in beiden Sprachen.

**Impressum**

- `[Rechtsform]`
- `[Vor- und Nachname, Funktion]` der vertretungsberechtigten Person
- Handelsregister: `[Eingetragen im Handelsregister des Kantons …, UID …]` oder `[nicht im Handelsregister eingetragen]` (eines streichen)
- Mehrwertsteuer: `[MWST-Nummer CHE-… MWST]` oder `[Nicht mehrwertsteuerpflichtig]` (eines streichen)

**Datenschutzerklärung**

- `Stand: [Datum]`
- `[Datenschutz-E-Mail, sonst {{email}}]`
- `[Ort]` des Rechenzentrums von Lovable Cloud (Region Europa; Ort bei Lovable bestätigen)
- `[Den Newsletter versenden wir mit: Newsletter-Programm, Sitz.]`
- `[KI-Anbieter mit Sitz, von der Rechtsberatung zu bestätigen]` für die KI-Suche (`search-assist` über das Lovable AI
  Gateway): Anbieter des KI-Modells und Sitz laut Lovable-Angaben, dazu Auslandsbekanntgabe in Ziffer 5 prüfen

**Allgemeine Geschäftsbedingungen (AGB)**

- `Stand: [Datum]`, `[Domain]`, `[und in Liechtenstein]` (nur bei Liechtenstein-Lieferung)
- Mindestalter: zwei Varianten (`[Wer noch nicht 18 Jahre alt ist …]` oder `[Bestellen kannst du ab 16 Jahren …]`), eine wählen
- Preise: `[Bei MWST-Pflicht: Sie enthalten die gesetzliche Mehrwertsteuer.]`
- Geschenkgutscheine: `[5 Jahre]` (Gültigkeit, gleich wie in Admin → Einstellungen)
- Freiwilliges Rückgaberecht: `[Ausgeschlossen sind: …]`, Rücksendeetikett `[liegt dem Paket bei / senden wir dir per E-Mail / du frankierst selbst]`,
  Rücksendekosten `[Die Rücksendung ist für dich gratis.]` oder `[Die Rücksendekosten von CHF … trägst du.]`,
  Rückerstattung `[Anzahl]` Tage, `[oder als Gutschein, nach deiner Wahl]`, `[gratis]`
- Nur bei Lieferung nach Liechtenstein: Rücktrittsrecht und zwingendes Wohnsitzrecht (zwei Absätze, Fachperson beiziehen)

**Versand und Rückgabe**

- `[und Liechtenstein]`, Versandkosten `[gratis / CHF …]`, Retoure `[Etikett liegt bei / auf Anfrage]`, `[Anzahl]` Tage, `[gratis]`

**Häufige Fragen**

- `[und nach Liechtenstein]`, `[Anzahl]` Tage Rückerstattung

Nicht ersetzte Platzhalter sind unschädlich für die Technik, aber die betroffene Seite bleibt Entwurf, und Fragen
mit Platzhaltern fehlen in den Strukturierten Daten (FAQ). Mit `launched: true` schlägt der Test an, wenn Kontaktdaten
noch Platzhalter sind. Liste jederzeit neu erzeugen: `grep -n "\[[^]]*\]" src/content/pages.ts`.

## 7. Zugänge und Secrets

Alle unter Cloud → Secrets; Bedeutung in `supabase/functions/README.md`. Vollständige Liste aus
`supabase/functions/_shared/env.ts`:

| Secret                                                                 | Inhalt                                                                        | Wenn leer                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                                                    | Eingeschränkter Schlüssel `rk_live_…` (Test: `rk_test_…`)                     | Keine Bezahlung möglich                                                                   |
| `STRIPE_WEBHOOK_SECRET`                                                | `whsec_…` des Webhooks auf `<Cloud-URL>/functions/v1/stripe-webhook`          | Bestellungen werden nie als bezahlt gebucht                                               |
| `STRIPE_REQUIRE_TERMS`                                                 | `1` = AGB-Häkchen in der Kasse (AGB-Adresse in Stripe hinterlegen)            | Kein Häkchen                                                                              |
| `RESEND_API_KEY`                                                       | Resend-Schlüssel                                                              | Keine E-Mails (Bestätigung, Versand, Newsletter, Kontaktformular)                         |
| `EMAIL_FROM`                                                           | Absender, z. B. `Axion <bestellung@domain.ch>` (Domain in Resend verifiziert) | Absender `onboarding@resend.dev`: nur für Tests, landet im Spam                           |
| `SITE_URL`                                                             | Adresse des Shops                                                             | Links in E-Mails zeigen auf `localhost`                                                   |
| `ALLOWED_ORIGINS`                                                      | Weitere erlaubte Domains, kommagetrennt                                       | Nur `SITE_URL` ist erlaubt                                                                |
| `ALLOW_PREVIEW_ORIGINS` / `PREVIEW_ORIGINS`                            | Nur Testphase                                                                 | Vor dem Livegang entfernen (siehe Abschnitt 2)                                            |
| `SHIPPING_COUNTRIES`                                                   | Liefergebiet                                                                  | `CH`                                                                                      |
| `SHOP_VAT_RATE`, `SHOP_RETURN_DAYS`                                    | siehe Abschnitt 3                                                             | Beleg ohne MWST, Rückgabefrist 14 Tage                                                    |
| `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_CONTACT_EMAIL`, `SHOP_NOTIFY_EMAIL` | siehe Abschnitt 1                                                             | siehe Abschnitt 1                                                                         |
| `LOVABLE_API_KEY`                                                      | Legt Lovable selbst an (nicht von Hand setzen); Guthaben des Workspaces nötig | KI-Suche und automatische Übersetzung fallen aus: lokale Suche und deutsche Texte bleiben |
| `TRANSLATE_MODEL`, `TRANSLATE_API_BASE`, `TRANSLATE_API_KEY`           | Nur bei anderem KI-Modell oder -Dienst                                        | Standardmodell `google/gemini-2.5-flash`                                                  |
| `SEND_EMAIL_HOOK_SECRET`                                               | Nur bei eigenem Supabase-Projekt (Konto-E-Mails)                              | Standard-E-Mails von Lovable                                                              |

Konten, die Axion besitzt oder anlegt: Stripe (Firma, verantwortliche Person, Geschäftskonto), Resend (Domain, SPF/DKIM,
Auftragsbearbeitungsvertrag), Domain-Registrar (DNS). Zwei-Faktor-Anmeldung überall.

**Erster Admin:** Konto im Shop registrieren, E-Mail bestätigen, dann einmal in der Datenbank die Rolle `admin` setzen
(SQL in `docs/DEPLOYMENT.md`, Punkt 5). Weitere Personen im Admin unter «Zugänge». Ohne Admin ist der Shop nicht
bedienbar.

## 8. Inhalte, Fotos und Produkte

Alles im Admin (`/admin`); Englisch entsteht beim Speichern automatisch.

| Inhalt                                                 | Wo                                                                                                                          | Wenn offen                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Echte Produkte mit Fotos, Preis, Herkunft, Ausstattung | Admin → Produkte (erstes Bild freigestellt, zweites Rückseite, dann am Modell)                                              | Nur Musterstücke mit Zeichnungen; `launch:check` meldet sie                                  |
| Kategorien mit Foto                                    | Admin → Kategorien                                                                                                          | Kategorien ohne Foto erscheinen nicht in der Reihe der Startseite; `launch:check` meldet sie |
| Grössentabellen                                        | Admin → Grössentabellen (Masse von Axion, pro Kategorie)                                                                    | Mustertabellen bleiben stehen                                                                |
| Einstieg (Hero): Foto, Video, Handy-Video              | Admin → Inhalte → «Einstieg» (Foto Pflicht, Video MP4 ohne Ton, 8 bis 15 s, höchstens 25 MB, fürs Handy eigenes Hochformat) | Ohne Foto leerer Einstieg; ohne Video zeigt der Shop das Foto                                |
| Startseite, Laufband, Look, Anlässe, Geschichte        | Admin → Inhalte                                                                                                             | Standardtexte und Musterlook                                                                 |
| Stückzahlen (Bestand) je Grösse                        | Admin → Lager                                                                                                               | Alles ausverkauft                                                                            |
| Versandtext, Rabattcodes, Gutscheine                   | Admin → Einstellungen, Rabattcodes, Gutscheine                                                                              | Standard                                                                                     |

## 9. Technische Schritte vor dem Livegang (Ben)

1. **Muster entfernen:** `supabase/demo/muster-entfernen.sql` in Cloud ausführen (löscht alle Produkte mit Tag
   «muster», entfernt Zeichnungen als Kategoriebild, schaltet Kategorien ohne aktive Produkte aus). Vorher echte
   Produkte anlegen. Kategorien danach mit Foto wieder einschalten.
2. **Edge Functions neu veröffentlichen**, wenn Code der Funktionen oder `supabase/config.toml` geändert wurde (Text
   in `docs/DEPLOYMENT.md`, Punkt 2.3). Kontrolle: Cloud → Edge functions, **alle zehn mit `verify_jwt = false`**.
3. **Stripe live:** Live-Schlüssel und Live-Webhook mit eigenem `whsec_…`; TWINT nach Freigabe testen.
4. **Livegang-Prüfungen:**
   - `bun run test` (Test `launch-gate`: `robots.txt` passt zu `launched`, keine Platzhalter in Kontaktdaten bei
     `launched: true`, UID-Format bei MWST-Pflicht)
   - `bun run launch:check` (liest Cloud mit `SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY`: keine aktiven
     Muster-Produkte, keine aktiven Kategorien ohne Bild, keine Look- oder Outfit-Handles ohne aktives Produkt)
5. `launched: true`, `bun scripts/sync-robots.ts`, Commit, Push, in Lovable veröffentlichen.
6. Echter Kauf mit kleinem Betrag und Rückerstattung. Davor den Testkauf (`docs/TESTKAUF.md`) und den iPhone-Check
   (`docs/IPHONE-CHECK.md`) durchgehen; im Admin zeigt der Kasten «Bereit für den Livegang» (Übersicht), was noch offen ist.
7. Überwachung einrichten (`docs/BETRIEB.md`): Uptime-Monitor auf `/api/health`.

## 10. Entscheide, die nur Axion treffen kann (Kurzliste)

- Firmenangaben, Rechtsform, vertretungsberechtigte Person, Handelsregister, UID
- MWST-Pflicht (ja/nein) und Satz
- Rückgabefrist, Rückgabebedingungen, Kosten und Art der Rücksendung, Ausschlüsse
- Versandkosten, «Gratis ab», Liefergebiet (nur Schweiz oder auch Liechtenstein)
- Zahlungsarten (Klarna, TWINT)
- Mindestalter für Bestellungen
- Prozentsatz des Willkommensrabatts (oder keiner)
- Social-Kanäle
- Newsletter-Programm
- Fotos, Produkte, Preise, Grössentabellen, Hero-Foto und -Video
- Absenderadresse der E-Mails und Postfach für Bestell- und Kontaktmeldungen
- Freigabe der Rechtstexte durch die Rechtsberatung, insbesondere KI-Anbieter und Auslandsbekanntgabe
