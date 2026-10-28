# Betrieb und Überwachung

Für Ben (Betreuung). Ergänzt `docs/DEPLOYMENT.md` (Inbetriebnahme, Abschnitt 10 «Betrieb»). Alles hier funktioniert ohne bezahlte
Zusatzdienste. Geheime Schlüssel gehören nie in Chat, E-Mail oder Git, nur in Cloud → Secrets.

## 1. Erreichbarkeit überwachen (Uptime)

Der Shop hat eine Gesundheitsprüfung: `https://<shop-domain>/api/health` (vor dem Livegang die Vorschau-Adresse).

- Antwort `200` mit `{"ok":true,"catalogue":"ok","time":"…"}`, wenn Seite und Katalog (Datenbank) antworten.
- Antwort `503` mit `{"ok":false,"catalogue":"error",…}`, wenn der Katalog nicht innerhalb von 4 Sekunden antwortet
  (z. B. Datenbank pausiert, weil das Cloud-Guthaben leer ist).
- Die Antwort enthält keine Geheimnisse und keine Fehlerdetails, wird nie zwischengespeichert (`Cache-Control: no-store`) und ist
  für Suchmaschinen gesperrt (`robots.txt`, `X-Robots-Tag`). `HEAD` funktioniert ebenfalls.
- Der Katalog wird auf dem Server bis zu 30 Sekunden zwischengespeichert: Ein Datenbankausfall zeigt sich also mit bis zu
  30 Sekunden Verzögerung.

**Einrichten mit einem kostenlosen Dienst** (z. B. UptimeRobot, Better Stack oder Freshping; alle haben einen Gratisplan,
Stand und Bedingungen beim Anbieter prüfen):

1. Konto eröffnen (mit der E-Mail-Adresse von Ben, nicht mit Zugangsdaten des Shops).
2. Neuen Monitor anlegen: Typ «HTTP(s)», Adresse `https://<shop-domain>/api/health`, Intervall 5 Minuten.
3. Optional «Keyword»-Prüfung auf `"ok":true`. Dann meldet der Dienst auch, wenn die Seite zwar antwortet, aber der
   Katalog fehlt.
4. Benachrichtigung per E-Mail an Ben (und auf Wunsch per Push-App). Eine zweite Adresse von Axion ist sinnvoll.
5. Zweiten Monitor auf die Startseite `https://<shop-domain>/` anlegen (prüft die ganze Auslieferung).
6. Test: Monitor kurz pausieren und wieder starten, oder mit einer falschen Adresse prüfen, dass die Meldung ankommt.

Der Dienst sieht nur öffentliche Antworten. Er bekommt keinen Zugang zu Cloud, Stripe oder dem Admin.

## 2. Wo sehe ich was?

| Frage                                 | Wo                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Fehler im Browser der Kundschaft      | Admin → **Fehler** (`/admin/fehler`): nach Fehler gruppiert, mit Anzahl, Seite, letztem Auftreten und Stack    |
| Läuft alles für den Livegang?         | Admin → **Übersicht**, Kasten «Bereit für den Livegang» (Secrets gesetzt ja/nein, Stripe-Modus, Platzhalter)   |
| Fehler der Funktionen (Kasse, E-Mail) | Cloud → Edge functions → Funktion wählen → **Logs** (`checkout`, `stripe-webhook`, `contact`, `admin-actions`) |
| Zahlung angekommen, Webhook geklappt? | Stripe → Entwickler → Webhooks → Endpunkt → Zustellungen (fehlgeschlagene werden wiederholt)                   |
| E-Mail nicht angekommen               | Resend → Emails (Status «Delivered», «Bounced», «Complained»)                                                  |
| Bestellung hängt                      | Admin → Bestellungen, Ansicht **Prüfen** (Zahlung nach Ablauf der Reservierung u. ä.)                          |
| Guthaben von Cloud und AI             | Lovable → Workspace → Usage; bei 0 pausieren Datenbank, Speicher und Login                                     |

**Fehlerberichte (Admin → Fehler):** Der Browser meldet Skriptfehler und nicht abgefangene Promises sowie die Fehlerseite
(höchstens 5 pro Seitenaufruf, nie in der Entwicklung, nie ohne Backend). Gespeichert werden Meldung, Pfad ohne
Query-String, Stack, Browser-Kennung (User-Agent), Version der Website und ein Zähler, **keine** IP, E-Mail oder Konto-ID.
Gleiche Fehler zählen innerhalb von 24 Stunden nur hoch; nach 30 Tagen löscht die Datenbank alte Einträge von selbst.
Gebremst wird pro IP (20 pro Stunde, nur als Hash gezählt) und gesamt (500 pro Tag). «Alle löschen» leert die Liste.
Hilfreich beim Lesen: viele Meldungen von einer einzigen Seite oder einer einzigen Version deuten auf einen Fehler im Shop,
einzelne Meldungen mit Erweiterungen oder sehr alten Browsern sind meist Rauschen.

## 3. Sicherung und Wiederherstellung (Lovable Cloud)

Lovable Cloud ist ein verwaltetes Supabase. Ob und wie lange Lovable eigene Sicherungen aufbewahrt, hängt vom Plan ab und
ändert sich: nicht darauf verlassen, sondern monatlich eine eigene Sicherung ziehen. Menünamen in Cloud können sich
ändern; massgebend ist der Zweck der Schritte.

**Was gesichert werden muss**

| Teil                       | Inhalt                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabellen (Schema `public`) | `orders`, `order_items`, `gift_cards`, `gift_card_transactions`, `discount_codes`, `newsletter_subscribers`, `products`, `product_variants`, `product_images`, `categories`, `shop_settings`, `site_content`, `profiles`, `user_roles`, `wishlist_items`, `stock_movements`, `stock_alerts`. `client_errors`, `stripe_events` und die Zähler müssen nicht gesichert werden. |
| Dateien                    | Buckets `product-images` und `site-media` (Fotos, Hero-Video). Die Originalfotos bewahrt Axion zusätzlich selbst auf.                                                                                                                                                                                                                                                       |
| Konten                     | Die Anmeldedaten (`auth.users`) lassen sich nicht ohne Weiteres exportieren. Wichtig ist deshalb die Liste der Admins (`user_roles` mit E-Mail), damit Zugänge neu vergeben werden können.                                                                                                                                                                                  |
| Code und Migrationen       | Liegen auf GitHub (`supabase/migrations`, `drizzle/migrations`). Das GitHub-Repository gehört ebenfalls zur Sicherung.                                                                                                                                                                                                                                                      |
| Secrets                    | Nicht exportierbar und nicht ins Git. Eine Liste der **Namen** steht in `docs/KUNDENDATEN.md`, Abschnitt 7; die Werte hat Axion bei Stripe, Resend usw. und im Passwort-Manager von Ben.                                                                                                                                                                                    |

**Monatliche Sicherung (ca. 20 Minuten)**

1. Cloud → Database → Tables: jede der oben genannten Tabellen als CSV exportieren (oder, wenn Cloud eine Datenbank-Verbindung
   anbietet, mit `pg_dump --schema=public --no-owner` in eine Datei). Zeilenzahl je Tabelle notieren.
2. Cloud → Storage: Buckets `product-images` und `site-media` herunterladen (nur wenn Axion die Originale nicht hat).
3. Dateien in einen verschlüsselten Ordner legen (z. B. ZIP mit Passwort oder verschlüsselte Festplatte), Dateiname mit Datum
   `axion-sicherung-JJJJ-MM-TT`. Mindestens die letzten drei Sicherungen behalten, eine davon ausserhalb des Computers von Ben.
   Die Dateien enthalten Kundendaten (Bestellungen, E-Mail-Adressen): nie per E-Mail oder Chat verschicken.
4. Im Kalender den nächsten Termin setzen.

**Wiederherstellung üben (einmal im Quartal, an einer Kopie, nie an der Live-Datenbank)**

Ziel: beweisen, dass die Sicherung brauchbar ist und wie lange es dauert.

1. Auf dem Computer von Ben im Projektordner: `bun run db:reset`. Das legt eine leere lokale Test-Datenbank mit dem aktuellen
   Schema an (`scripts/db/local-db.sh`, Verbindung `postgres://postgres@127.0.0.1:54329/axion`).
2. Tabellen in dieser Reihenfolge einlesen (Fremdschlüssel): `categories`, `products`, `product_variants`, `product_images`,
   `discount_codes`, `orders`, `order_items`, `gift_cards`, `gift_card_transactions`, `newsletter_subscribers`,
   `shop_settings`, `site_content`. Mit `psql`: `\copy public.products from 'products.csv' csv header`. Die Musterdaten
   aus `supabase/seed.sql` vorher löschen oder die Datenbank ohne Seed anlegen.
3. Zeilenzahlen mit den notierten vergleichen: `select count(*) from public.orders;` usw.
4. Stichproben: eine Bestellung mit ihren Positionen, ein Produkt mit Grössen, ein Gutschein mit Restguthaben.
5. Ergebnis und Dauer in einer Zeile festhalten («Übung 2026-Q4: 12 Tabellen, alle Zahlen gleich, 35 Minuten»).
6. **Im Ernstfall** (Daten in Cloud verloren): zuerst Lovable-Support kontaktieren und fragen, ob eine Cloud-Sicherung
   zurückgespielt werden kann; sonst neues Cloud-Projekt, alle Migrationen `drizzle/migrations/0000` bis zur neusten der Reihe
   nach ausführen, Buckets neu anlegen (Policies kommen aus der Migration `0004`), Tabellen wie oben einspielen, Secrets neu
   setzen, Funktionen neu veröffentlichen (`verify_jwt = false` kontrollieren), Admin-Rolle vergeben
   (`docs/DEPLOYMENT.md`, Abschnitt 5), Stripe-Webhook auf die neue Adresse umstellen.

## 4. Störungs-Checkliste

Ruhig vorgehen, zuerst feststellen, dann beheben. Notizen mit Uhrzeit führen.

1. **Ist es wirklich down?** `/api/health` im Browser öffnen, Startseite öffnen, anderes Netz (Handy ohne WLAN) versuchen.
2. **Was ist betroffen?**
   - Alles weg, Seite lädt nicht: Lovable-Status und Veröffentlichung prüfen (Lovable → Projekt → Publish), DNS und Domain
     beim Registrar prüfen.
   - Seite lädt, aber keine Produkte oder kein Login (`/api/health` meldet `503`): **Guthaben von Cloud/AI prüfen**
     (bei 0 pausiert die Datenbank), danach Cloud-Status.
   - Kasse geht nicht: Cloud → Edge functions → `checkout` → Logs. Häufige Ursachen: `STRIPE_SECRET_KEY` fehlt oder ist
     abgelaufen/falscher Modus, `SITE_URL`/`ALLOWED_ORIGINS` passen nicht zur Domain, `verify_jwt` bei einer Funktion wieder
     eingeschaltet (Lovable hat das schon einmal verändert: `supabase/config.toml` prüfen und die Funktionen neu veröffentlichen).
   - Bezahlt, aber Bestellung nicht «bezahlt»: Stripe → Webhooks → Zustellungen ansehen. Fehlgeschlagene dort erneut senden;
     `STRIPE_WEBHOOK_SECRET` muss zum Endpunkt des richtigen Modus (Test/Live) passen.
   - E-Mails kommen nicht: Resend → Emails; `RESEND_API_KEY`, `EMAIL_FROM` (verifizierte Domain) und das Tageskontingent prüfen.
     Im Admin kann man Bestätigung, Versandmeldung und Gutschein erneut senden.
   - Viele Fehlermeldungen im Browser: Admin → Fehler; haben sie dieselbe Version? Dann letzten Push in GitHub/Lovable ansehen
     und bei Bedarf zur vorigen Version zurück (Lovable → Verlauf, **nie** Git-Verlauf umschreiben oder force-pushen).
3. **Kundschaft informieren**, wenn Bestellungen betroffen sind: Banner/Laufband im Admin (Startseite und Laufband) setzen,
   Kontakt-E-Mail im Auge behalten.
4. **Beheben und prüfen**: Fehler beheben, dann Testbestellung im Testmodus oder kleine echte Bestellung mit Rückerstattung
   (`docs/TESTKAUF.md`).
5. **Nacharbeiten**: Zahlungen und Bestellungen abgleichen (Admin → Bestellungen → «Prüfen», Stripe → Zahlungen),
   betroffene Kundschaft per E-Mail informieren, Ursache und Gegenmassnahme in zwei Sätzen festhalten.
6. **Sicherheitsvorfall** (Verdacht, dass ein Schlüssel oder Konto missbraucht wurde): betroffenen Schlüssel sofort bei Stripe/
   Resend widerrufen und neu erstellen, in Cloud → Secrets ersetzen, Passwörter und Zwei-Faktor-Anmeldung der betroffenen Konten
   erneuern, Admin-Zugänge prüfen (Admin → Zugänge). Bei Personendaten Axion und, falls nötig, die Rechtsberatung informieren
   (Meldepflicht nach DSG prüfen lassen).

## 5. Regelmässige Aufgaben

| Wann          | Was                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| täglich       | Admin → Übersicht («Zu versenden», «Prüfen»), Postfach `SHOP_CONTACT_EMAIL`                                       |
| wöchentlich   | Admin → Fehler ansehen, Stripe → Webhooks (fehlgeschlagene Zustellungen), Resend (Bounces), Guthaben von Cloud/AI |
| monatlich     | Sicherung (Abschnitt 3), Uptime-Monitor kontrollieren (Testmeldung)                                               |
| quartalsweise | Wiederherstellung üben, Pakete aktualisieren (`docs/DEPLOYMENT.md`, Abschnitt 10), Zugänge im Admin prüfen        |

## 6. Post-Etiketten und Bestandsmeldung

**Post-Etiketten (optional, noch nicht mit der echten Post getestet).** Admin → Bestellung → «Versenden» → «Etikett (Post) erstellen»
lädt das A6-Etikett als PDF (Digital Commerce API «Barcode») und trägt die Sendungsnummer ein; erst «Als versendet markieren»
informiert die Kundschaft. Voraussetzung: Geschäftskundenkonto bei der Post, API-Zugang und Frankierlizenz, Secrets
`POST_CLIENT_ID`, `POST_CLIENT_SECRET`, `POST_FRANKING_LICENSE` (siehe `supabase/functions/README.md`). Jeder Klick erzeugt ein
neues Etikett (kostenpflichtig). Erster Einsatz: mit einer Testbestellung nach Zürich prüfen, ob Adresse, Absender und Produkt
(B-Post `ECO` / A-Post `PRI`) auf dem Etikett stimmen. Fehlermeldungen im Admin nennen die Ursache (Anmeldung, Lizenz, Adresse,
Post nicht erreichbar); technische Codes der Post stehen im Funktionsprotokoll von `admin-actions` (nie Adresse oder Etikett).
Geht es nicht, das Etikett wie bisher bei der Post erstellen und die Nummer von Hand eintragen.

**Bestandsmeldung.** Fällt der Bestand einer Grösse mit einer bezahlten Bestellung auf `LOW_STOCK_THRESHOLD` (Standard 2) oder
darunter, kommt eine E-Mail «Bestand knapp: …» bzw. «Ausverkauft: …» an die Bestelladresse (Admin → Einstellungen,
sonst `SHOP_NOTIFY_EMAIL`). Pro Bestellung eine Meldung, nur für Grössen, die die Schwelle neu erreicht haben.

## 7. Retouren

Die Kundschaft meldet Rücksendungen unter `/retoure` an (Bestellnummer + E-Mail der Bestellung, Stücke, Menge, Grund). Du bekommst eine E-Mail «Neue Retoure R-…» an die Bestelladresse (Reply-To = Kundschaft); die Kundschaft bekommt Hinweise zur Rücksendung an die Adresse aus `SHOP_ADDRESS` (kein Etikett, keine Kostenübernahme versprochen: das regelt die Seite «Versand und Rückgabe»).

1. Admin → **Retouren** (Ansicht «Angemeldet» ist die Arbeitsliste). Status: **Angemeldet** (unterwegs), **Eingegangen**, **Erstattet**, **Abgelehnt** (gibt die Menge für eine neue Anmeldung frei).
2. Ist das Paket da: prüfen, in der Bestellung «Retoure einbuchen» (Bestand) und, wenn es passt, erstatten (Karte über Stripe, Gutscheinanteil als Guthaben). Danach hier den Status setzen und bei Bedarf eine interne Notiz schreiben. Der Status löst nichts automatisch aus.
3. Frist: `returnDays` ab Versand (sonst ab Zahlung). Abgelaufene oder falsche Angaben zeigt das Formular ohne Hinweis, ob die Bestellung existiert. Fälle ausserhalb der Frist per Kontaktformular klären.
4. Kam die Bestätigungs-E-Mail nicht an (Resend → Emails), steht die Retoure trotzdem in der Liste: der Kundschaft kurz selbst schreiben.

## Marketing-Anbindungen

Produktfeed (`/feeds/google.xml`), Search Console, Bing und Plausible: Einrichtung Schritt für Schritt in
[`docs/MARKETING.md`](MARKETING.md). Fällt der Feed im Merchant Center oder Meta aus, zuerst die Adresse im Browser öffnen und
Abschnitt 1 (Gesundheitsprüfung) prüfen.
