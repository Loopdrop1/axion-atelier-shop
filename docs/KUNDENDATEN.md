# Kundendaten und Entscheide vor dem Livegang

Eine Checkliste für alles, was Axion (Kundschaft/Inhaberin) noch liefern oder entscheiden muss, bevor der Shop live geht.
Jede Zeile sagt, **wo** der Wert hineingehört und **was passiert, wenn er leer bleibt**. Die Reihenfolge der
Inbetriebnahme steht in `docs/DEPLOYMENT.md`; die Funktionen und Secrets in `supabase/functions/README.md`.
Betrieb und Überwachung: `docs/BETRIEB.md`; Testkauf: `docs/TESTKAUF.md`; iPhone-Prüfung: `docs/IPHONE-CHECK.md`.

Grundregel: Geheime Schlüssel (Stripe, Resend), Passwörter und die IBAN nie per Chat oder E-Mail schicken und nie ins
Git legen. Sie kommen nur in Cloud → Secrets.

Platzhalter in eckigen Klammern (`[…]`) in `src/config/shop.ts` und in den Rechtstexten erkennt der Shop selbst:
Er blendet die Angabe aus, markiert die Seite als Entwurf oder verhindert den Livegang (Test `launch-gate`).

## 0. Kundencheckliste vom 3.11.2026 (Unterschrift des Kunden ausstehend)

**In Cloud noch auszuführen** (in dieser Reihenfolge, je einmal): Migrationen `drizzle/migrations/0023_axion_size_details.sql`,
`0024_axion_sortiment_gift_newsletter.sql`, `0025_axion_checkout_shipping_returns.sql`, `0026_axion_reviews.sql`; danach
die Edge Functions `checkout`, `stripe-webhook`, `admin-actions`, `return-request`, `newsletter` und die neue `review`
deployen. `supabase/demo/sortiment-start.sql` erst kurz vor dem Livegang, nach `muster-entfernen.sql`.

**Entschieden und umgesetzt** (Code, Rechtstexte, Einstellungen):

- Nicht im Handelsregister, keine UID, nicht MWST-pflichtig (`vatRegistered: false`, Impressum und AGB ohne MWST)
- Kontakt nur per E-Mail: kein Telefon, keine Zeiten (`phone`, `hours` leer)
- Versand Montag bis Freitag, bis 14 Uhr am selben Tag, 2 bis 5 Arbeitstage (wie bisher)
- Rückgabe 14 Tage ab Erhalt, Rücksendung gratis, Etikett liegt dem Paket bei, Umtausch in eine andere Grösse gratis
  (solange verfügbar), Rückerstattung innert 7 Tagen nach Eingang, nach Wahl der Kundschaft aufs Zahlungsmittel oder
  als Gutschein (Retourenformular, Migration `0022`); mit Gutschein bezahlte Teile immer als Gutschein; ausgeschlossen:
  Sale-Artikel, getragene oder geänderte Artikel, Schuhe mit Gebrauchsspuren
- Hosen fertig gesäumt (FAQ; Schrittlänge in der Grössentabelle)
- Gutscheine: feste Beträge CHF 50, 100, 150, 200 und frei ab CHF 25, gültig 30 Jahre (Standard seit Migration
  `0024`, im Admin unter Einstellungen änderbar)
- Sortiment zum Start: Anzüge, Westen, Schuhe, Hosen, T-Shirts (neu); Sakkos, Hemden, Mäntel & Jacken, Strick und
  Accessoires ausgeblendet, nicht gelöscht (in Cloud mit `supabase/demo/sortiment-start.sql`); Anzug = Sakko (in
  «Anzüge») und Hose (in «Hosen») als eigene Produkte, gegenseitig verknüpft über «Komplettes Outfit»; Anzüge,
  Westen und Hosen nur in Zahlengrössen 46 bis 56; Schuhe ganze EU-Grössen
- «Benachrichtigen, wenn wieder da», Versandbestätigung und Warenkorb-Erinnerung: eingebaut
- Gast-Bestellung möglich, Rabattcodes ja, Kundenkonto vorhanden
- Messung: bleibt Plausible (ohne Cookies); Google Analytics nicht eingebaut
- Rechtstexte prüft eine Fachperson (Anwalt/Treuhand) vor dem Livegang
- Gewünschter Livegang 1.1.2027, Unterlagen komplett bis Ende November, Rückmeldung innert 3 Arbeitstagen
- Betreuung: CHF 550 pro Jahr

**Bewusst anders als in der Checkliste** (vorsichtigste Lösung, bis die Fachperson oder Axion entscheidet):

1. **Mindestalter:** Axion wünschte «keines». In den AGB steht die Variante «Wer noch nicht 18 Jahre alt ist, braucht die
   Zustimmung der Eltern» (Minderjährige sind für teure Käufe nur beschränkt handlungsfähig). Die Fachperson entscheidet.
2. **Liechtenstein:** Axion wünscht CH und LI. Bleibt aus (`SHIPPING_COUNTRIES` nicht ändern), die LI-Klauseln stehen
   als Platzhalter in AGB, «Versand und Rückgabe» und FAQ. Dort gilt ein zwingendes Rücktrittsrecht (auch für
   Sale-Artikel); Belehrung und Muster-Formular ergänzt die Fachperson.
3. **Datenschutz-Kontakt:** Axion schrieb «Ben». Verantwortlich ist Axion, Flowrenix nur Auftragsbearbeiterin; der
   Platzhalter `[Datenschutz-E-Mail, sonst …]` bleibt, bis Axion eine eigene Adresse nennt.
4. **Grössen «beides»:** ohne Zuordnung geliefert; Anzüge, Westen und Hosen zeigen nur Zahlen. Die Zuordnung kann
   später im Admin gepflegt werden (Admin → Grössentabellen), standardmässig leer.
5. **Kostenpflichtige Optionen** (Priority-Versand, Bewertungen) sind technisch vorbereitet, aber standardmässig aus
   (Priority erscheint erst mit Preis in Admin → Einstellungen, Bewertungen erst mit `features.reviews`). Preis und
   Auftrag zuerst klären. Bewertungen brauchen beide Schalter: `features.reviews` in `src/config/shop.ts` (Code,
   Deploy) und danach Admin → Einstellungen → «Bewertungen» (Migration `0026` und Funktion `review`, beide in Cloud noch einzuspielen). Nur echte Käufe
   (Link in der Versandmeldung), Freigabe im Admin, keine Beispielbewertungen; Datenschutz-Absatz erscheint mit dem
   Schalter.

**Offen, Axion liefert oder entscheidet:**

1. **Rechtsform und Inhaber:** «Einzelunternehmen» mit zwei Personen ist nicht möglich. Auf Bens Anweisung vom
   3.11.2026 vorerst **Vasilis Soufis als Inhaber** eingetragen (Firma «Axion, Vasilis Soufis»). Mit Axion
   bestätigen: Schreibweise und ob Andrea Loris Spasari Mitinhaber ist (dann einfache Gesellschaft bzw.
   Kollektivgesellschaft, Texte anpassen).
2. **Adresse:** nur «8620 Wetzikon»; Strasse und Nummer fehlen (`contact.address`, Secret `SHOP_ADDRESS`).
3. **Domain und E-Mail:** `axion.ch` gehört Axion nicht. Gewünscht: axiion.ch, axionss.ch, axion-mode.ch. Erst Domain,
   dann `info@<domain>` (Kontakt, Bestellmeldungen, Datenschutz, Stripe, Resend).
4. **Newsletter «10 / 14 Tage»:** gelesen als 10 % Willkommensrabatt mit 14 Tagen Gültigkeit; beides im Admin
   einstellbar (Admin → Einstellungen: Willkommens-Rabatt in % und Gültigkeit des Codes in Tagen, Standard 90 bis
   Axion bestätigt; die Willkommens-E-Mail nennt die eingestellten Tage). Von Axion bestätigen lassen.
5. **Produkte, Fotos, Grössentabellen mit Massen (inkl. Schrittlänge), Brand Story, Logo-Datei**: bis Ende November.
6. **Gratis-Rücksendung mit beiliegendem Etikett** kostet Axion pro Retoure rund CHF 7.50 bis 10.50 (Post, Stand
   Oktober 2026); bei Anzügen ohne Anprobe häufig. Bewusst entscheiden lassen.
7. **Unterschrift** unter Checkliste und Konditionen.

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
| Liefergebiet                  | Secret `SHIPPING_COUNTRIES` (Standard `CH`; Axion: `CH,LI`)                                                                | Nur Schweiz. Liechtenstein-Klauseln stehen in `pages.ts` und `pages-en.ts` (Belehrung ergänzt die Fachperson)                                                                 |
| Gutscheinbeträge, Gültigkeit  | Admin → Einstellungen (Axion: ab CHF 25, 30 Jahre; AGB nennen 30 Jahre)                                                    | Standard 5 Jahre widerspricht den AGB                                                                                                                                         |

## 4. Newsletter und Willkommensrabatt

| Entscheid                      | Wohin                                                                                                  | Wenn leer                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Prozent des Willkommensrabatts | Admin → Einstellungen → Newsletter (ganze Zahl 1 bis 50)                                               | Kein Rabatt: Footer und Konto zeigen keinen Hinweis, die Willkommens-Mail enthält keinen Code |
| Newsletter-Programm und Sitz   | Datenschutz, Ziffer 4 (Platzhalter «Den Newsletter versenden wir mit …»), `pages.ts` und `pages-en.ts` | Datenschutz bleibt Entwurf                                                                    |

Der Text im Footer («{n} % auf deine nächste Bestellung») kommt automatisch aus diesem Wert. Der Einwilligungstext
(`supabase/functions/_shared/consent.ts`, Version `newsletter-v2`) erwähnt den Rabatt als Gegenleistung; ändert sich
der Wortlaut, `CONSENT_VERSION` erhöhen und `src/i18n/messages` angleichen. Newsletter und Bestell-Mails enthalten
keine Öffnungs- oder Klickverfolgung im Code. **Kontrollieren:** In Resend → Domains darf «Open tracking» und «Click
tracking» für die Absender-Domain nicht eingeschaltet sein, sonst stimmt die Aussage in der Datenschutzerklärung nicht.

## 5. Social-Kanäle

`src/config/shop.ts` → `social`: `instagram`, `facebook`, `linkedin`, `tiktok`, `pinterest`, jeweils die vollständige
`https://`-Adresse des Profils.

Leer = der Kanal erscheint weder im Footer noch in den Strukturierten Daten (`sameAs`). Es werden keine Skripte
Dritter geladen, nur Links.

Marketing (optional, ohne Konto lauffähig): Produktfeed für Google Merchant Center und Meta, Search-Console-/Bing-Bestätigung und
cookiefreie Statistik mit Plausible. Entscheide des Kunden und Schritte stehen in [`docs/MARKETING.md`](MARKETING.md); die Werte
(`analytics`, `verification`) gehören nach `src/config/shop.ts`. Leer gelassen bleibt alles aus.

## 6. Rechtstexte: Platzhalter in `[…]`

Deutsch in `src/content/pages.ts`, Englisch in `src/content/pages-en.ts` (gleiche Stellen, gleicher Aufbau; massgebend
ist Deutsch). Solange ein Platzhalter steht, zeigt der Shop die Seite als Entwurf. Die Rechtsberatung gibt die Texte
frei; Ben ersetzt die Platzhalter in beiden Sprachen.

**Impressum**

- Adresse: `[Strasse und Nummer]` in `contact.address` (Ort 8620 Wetzikon steht)
- Rechtsform und Inhaber vorläufig: Einzelunternehmen, Vasilis Soufis (Abschnitt 0, Punkt 1)

**Datenschutzerklärung**

- `Stand: [Datum]`
- `[Datenschutz-E-Mail, sonst {{email}}]` (Abschnitt 0, «Bewusst anders», Punkt 3)
- `[Ort]` des Rechenzentrums von Lovable Cloud (Region Europa; Ort bei Lovable bestätigen)
- `[Den Newsletter versenden wir mit: Newsletter-Programm, Sitz.]`
- `[KI-Anbieter mit Sitz, von der Rechtsberatung zu bestätigen]` für die KI-Suche (`search-assist` über das Lovable AI
  Gateway): Anbieter des KI-Modells und Sitz laut Lovable-Angaben, dazu Auslandsbekanntgabe in Ziffer 5 prüfen
- Besucherstatistik: `[Vor Livegang zu bestätigen: …]` (nur sichtbar mit Plausible-Domain)

**Allgemeine Geschäftsbedingungen (AGB)**

- `Stand: [Datum]`, `[Domain]`, `[und in Liechtenstein]`
- Liechtenstein (nur bei Lieferung dorthin): Rücktrittsrecht und zwingendes Wohnsitzrecht (zwei Absätze, Fachperson)

**Versand und Rückgabe, Häufige Fragen:** `[und Liechtenstein]` bzw. `[und nach Liechtenstein]`

Erledigt mit der Checkliste vom 3.11.2026: Handelsregister, MWST, Mindestalter (vorsichtige Variante, Fachperson
entscheidet), Gutschein-Gültigkeit, Rückgabe (Ausschlüsse, Etikett, Kosten, Frist, Wahl der Rückerstattung, Umtausch),
Bestellablauf mit den echten Button-Namen, Hosen fertig gesäumt.

Nicht ersetzte Platzhalter sind unschädlich für die Technik, aber die betroffene Seite bleibt Entwurf, und Fragen
mit Platzhaltern fehlen in den Strukturierten Daten (FAQ). Mit `launched: true` schlägt der Test an, wenn Kontaktdaten
noch Platzhalter sind. Liste jederzeit neu erzeugen: `grep -n "\[[^]]*\]" src/content/pages.ts`.

## 7. Zugänge und Secrets

Alle unter Cloud → Secrets; Bedeutung in `supabase/functions/README.md`. Vollständige Liste aus
`supabase/functions/_shared/env.ts`:

| Secret                                                                 | Inhalt                                                                                           | Wenn leer                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                                                    | Eingeschränkter Schlüssel `rk_live_…` (Test: `rk_test_…`)                                        | Keine Bezahlung möglich                                                                   |
| `STRIPE_WEBHOOK_SECRET`                                                | `whsec_…` des Webhooks auf `<Cloud-URL>/functions/v1/stripe-webhook`                             | Bestellungen werden nie als bezahlt gebucht                                               |
| `STRIPE_REQUIRE_TERMS`                                                 | **Pflicht für den Livegang:** `1` = AGB-Häkchen in der Kasse (AGB-Adresse in Stripe hinterlegen) | Kein Häkchen; Admin-Checkliste «Bereit für den Livegang» bleibt rot                       |
| `RESEND_API_KEY`                                                       | Resend-Schlüssel                                                                                 | Keine E-Mails (Bestätigung, Versand, Newsletter, Kontaktformular)                         |
| `EMAIL_FROM`                                                           | Absender, z. B. `Axion <bestellung@domain.ch>` (Domain in Resend verifiziert)                    | Absender `onboarding@resend.dev`: nur für Tests, landet im Spam                           |
| `SITE_URL`                                                             | Adresse des Shops                                                                                | Links in E-Mails zeigen auf `localhost`                                                   |
| `ALLOWED_ORIGINS`                                                      | Weitere erlaubte Domains, kommagetrennt                                                          | Nur `SITE_URL` ist erlaubt                                                                |
| `ALLOW_PREVIEW_ORIGINS` / `PREVIEW_ORIGINS`                            | Nur Testphase                                                                                    | Vor dem Livegang entfernen (siehe Abschnitt 2)                                            |
| `SHIPPING_COUNTRIES`                                                   | Liefergebiet                                                                                     | `CH`                                                                                      |
| `SHOP_VAT_RATE`, `SHOP_RETURN_DAYS`                                    | siehe Abschnitt 3                                                                                | Beleg ohne MWST, Rückgabefrist 14 Tage                                                    |
| `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_CONTACT_EMAIL`, `SHOP_NOTIFY_EMAIL` | siehe Abschnitt 1                                                                                | siehe Abschnitt 1                                                                         |
| `LOVABLE_API_KEY`                                                      | Legt Lovable selbst an (nicht von Hand setzen); Guthaben des Workspaces nötig                    | KI-Suche und automatische Übersetzung fallen aus: lokale Suche und deutsche Texte bleiben |
| `TRANSLATE_MODEL`, `TRANSLATE_API_BASE`, `TRANSLATE_API_KEY`           | Nur bei anderem KI-Modell oder -Dienst                                                           | Standardmodell `google/gemini-2.5-flash`                                                  |
| `SEND_EMAIL_HOOK_SECRET`                                               | Nur bei eigenem Supabase-Projekt (Konto-E-Mails)                                                 | Standard-E-Mails von Lovable                                                              |

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
   in `docs/DEPLOYMENT.md`, Punkt 2.3). Kontrolle: Cloud → Edge functions, **alle zwölf mit `verify_jwt = false`**.
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
