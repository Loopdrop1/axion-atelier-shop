# Marketing-Anbindungen: Produktfeed, Suchmaschinen, Besucherstatistik

Für Ben (Einrichtung) und Axion (Konten). Alles ist im Code vorbereitet und **aus**, bis die Werte in `src/config/shop.ts`
stehen. Es braucht kein externes Konto, damit der Shop läuft. Vor dem Livegang (`launched: false`) liefert nichts davon etwas
an Suchmaschinen aus: der Feed antwortet mit 404, das Statistik-Skript wird nicht geladen, und die Seiten bleiben `noindex`.
Siehe `docs/KUNDENDATEN.md` Abschnitt 2 für den Livegang.

**Vom Kunden zu bestätigen** sind die Wahl der Kanäle, die Kategoriezuordnung (Abschnitt 1) und der Datenschutztext zur Statistik (Abschnitt 4).

## 1. Produktfeed (Google Merchant Center und Meta/Instagram)

Adresse nach dem Livegang: `https://<shop-domain>/feeds/google.xml` (RSS 2.0 mit `g:`-Feldern, Zwischenspeicher eine Stunde).

Was drinsteht:

- ein Eintrag pro Grösse (`g:id` = Artikelnummer der Grösse, sonst Varianten-ID), gruppiert über `g:item_group_id` (Modell, also alle
  Farben und Grössen eines Modells);
- Titel mit Farbe und Grösse, Beschreibung als reiner Text, Link auf die Produktseite (ohne Grössenvorauswahl, die Seite
  unterstützt keinen `size`-Parameter), Hauptbild und weitere Bilder als absolute Adressen;
- `in_stock` / `out_of_stock` nach Bestand der Grösse; Preis als `123.00 CHF`, bei Streichpreis `price` = Streichpreis und `sale_price` = Preis;
- Marke aus `shopConfig.brand`, Zustand neu, Geschlecht männlich, Altersgruppe Erwachsene, Material, Highlights aus der Ausstattung;
- `g:gtin` nur, wenn der Barcode der Grösse (Admin → Produkt → Grössen) eine gültige GTIN/EAN ist (Prüfziffer); sonst
  `identifier_exists` = `no` und `mpn` = Artikelnummer;
- Versand Schweiz mit den Kosten aus Admin → Einstellungen (0.00 CHF bei Gratisversand oder ab der Schwelle «Gratisversand ab»);
- **nicht** enthalten: das Muster-Sortiment (Kennzeichen `muster`), Produkte ohne Bild, inaktive Produkte.

Google-Produktkategorien (Datei `src/lib/feeds/google.ts`, `GOOGLE_CATEGORIES`; unbekannte Kategorien fallen auf «Clothing» zurück):

| Kategorie im Shop | Google-Kategorie                                               |
| ----------------- | -------------------------------------------------------------- |
| Anzüge            | Apparel & Accessories > Clothing > Suits                       |
| Sakkos            | Apparel & Accessories > Clothing > Outerwear > Coats & Jackets |
| Hosen             | Apparel & Accessories > Clothing > Pants                       |
| Hemden            | Apparel & Accessories > Clothing > Shirts & Tops               |
| Westen            | Apparel & Accessories > Clothing > Outerwear > Vests           |
| Mäntel & Jacken   | Apparel & Accessories > Clothing > Outerwear > Coats & Jackets |
| Strick            | Apparel & Accessories > Clothing > Shirts & Tops               |
| Schuhe            | Apparel & Accessories > Shoes                                  |
| Accessoires       | Apparel & Accessories > Clothing Accessories                   |

Die Pfade sind bewusst grob gewählt. Zeigt das Merchant Center bei der Prüfung «Ungültige Produktkategorie», den Pfad mit der
aktuellen Taxonomie von Google abgleichen (https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt) und die Zeile
anpassen. `size_system` wird absichtlich nicht gesetzt (Schweizer Grössen sind nicht eindeutig einer Norm zuzuordnen).

### Vor dem Einrichten prüfen

1. `launched: true` setzen, `bun scripts/sync-robots.ts` ausführen, veröffentlichen (`docs/KUNDENDATEN.md` Abschnitt 2).
2. `https://<shop-domain>/feeds/google.xml` im Browser öffnen: XML mit `<item>`-Einträgen, keine Muster-Stücke.
3. Barcodes (EAN) der Grössen im Admin eintragen, falls vorhanden. Ohne GTIN akzeptiert Google Bekleidung, wenn Marke und `mpn` stimmen; die Warnung «Fehlende GTIN» ist dann normal.
4. Im Merchant Center braucht es Impressum, Versand- und Rückgabeseite: sie sind unter `/impressum` und `/versand-und-rueckgabe` (Platzhalter vorher ersetzen).

### Google Merchant Center

1. Mit dem Google-Konto von Axion auf https://merchants.google.com anmelden und ein Konto eröffnen (Land Schweiz, Name, Website `https://<shop-domain>`).
2. Website-Inhaberschaft bestätigen und beanspruchen: Abschnitt 3 (Search Console) erledigt das am einfachsten über den Meta-Tag.
3. Versand und Rückgabe angeben (Merchant Center → Versand und Rückgabe): Lieferland Schweiz, Kosten wie im Admin, Rückgabe `shopConfig.returnDays` Tage. Der Feed enthält die Versandkosten zusätzlich je Eintrag.
4. Produkte → Feeds → **Primären Feed hinzufügen**: Land Schweiz, Sprache Deutsch, Ziele «Kostenlose Einträge» und «Shopping-Anzeigen» wählen.
5. Eingabemethode **Geplanter Abruf**, Feed-Name «Axion», URL `https://<shop-domain>/feeds/google.xml`, täglich abrufen (Zeitzone Europe/Zurich).
6. «Jetzt abrufen» drücken. Unter Produkte → Diagnose die Hinweise lesen. Typisch am Anfang: fehlende GTIN (Warnung), Kategorie (Abschnitt oben).
7. Kostenlose Einträge erscheinen nach der Prüfung (meist einige Tage). Für bezahlte Shopping-Anzeigen zusätzlich ein Google-Ads-Konto verknüpfen (optional, kostet Werbebudget).

### Meta (Facebook und Instagram): Katalog

Meta liest dasselbe RSS-Format; ein eigener Feed ist nicht nötig.

1. Mit dem Facebook-Konto von Axion auf https://business.facebook.com ein Business-Portfolio anlegen (falls noch keins besteht), Facebook-Seite und Instagram-Konto verbinden.
2. Commerce Manager (https://business.facebook.com/commerce) → **Katalog erstellen** → Typ «E-Commerce» → Datenquelle «Datenfeed».
3. «Geplanter Feed», URL `https://<shop-domain>/feeds/google.xml`, Währung CHF, Abruf täglich.
4. Nach dem ersten Abruf Diagnose öffnen. Meta verlangt je Eintrag Titel, Beschreibung, Link, Bild, Preis und Verfügbarkeit: alles vorhanden.
5. Für den Verkauf über Instagram-Shopping die Instagram-Handelsbedingungen akzeptieren und das Konto prüfen lassen (dauert einige Tage; Verfügbarkeit von Instagram-Shopping in der Schweiz bei Meta prüfen, Kunden kaufen in jedem Fall im Shop).

## 2. Beim Livegang: wiederkehrende Pflege

- Preise, Bestand und neue Stücke ändern sich im Admin; der Feed wird bei jedem Abruf neu erzeugt (Katalog bis 30 Sekunden, Feed bis eine Stunde zwischengespeichert). Es ist nichts zu synchronisieren.
- Neue Kategorie im Admin: Zuordnung in `GOOGLE_CATEGORIES` ergänzen, sonst gilt «Clothing».
- Läuft der Abruf nicht (Merchant Center zeigt «Feed konnte nicht abgerufen werden»): `https://<shop-domain>/feeds/google.xml` im Browser prüfen und `docs/BETRIEB.md` Abschnitt 1 (Gesundheitsprüfung) ansehen.

## 3. Google Search Console und Bing: Bestätigung und Sitemap

Vorher `launched: true` setzen und veröffentlichen, sonst findet die Suche nichts. Die Bestätigung selbst darf auch vorher erfolgen.

**Google Search Console**

1. https://search.google.com/search-console öffnen, **Property hinzufügen** → «URL-Präfix» → `https://<shop-domain>/`.
2. Bestätigungsmethode «HTML-Tag» wählen. Google zeigt `<meta name="google-site-verification" content="XXXX…">`.
3. Nur den Wert aus `content` (ohne Anführungszeichen) in `src/config/shop.ts` bei `verification.google` eintragen, veröffentlichen, dann in der Search Console auf **Bestätigen** klicken.
4. Sitemaps → neue Sitemap `sitemap.xml` eingeben (`https://<shop-domain>/sitemap.xml`) → Senden. Status sollte «Erfolgreich» zeigen.
5. Mit «URL-Prüfung» die Startseite prüfen und «Indexierung beantragen».

**Bing Webmaster Tools**

1. https://www.bing.com/webmasters öffnen, Website hinzufügen (alternativ «Aus Google Search Console importieren»).
2. Bestätigung per Meta-Tag: `<meta name="msvalidate.01" content="XXXX…">`. Wert aus `content` bei `verification.bing` eintragen, veröffentlichen, bestätigen.
3. Sitemaps → `https://<shop-domain>/sitemap.xml` einreichen.

Die Tags erscheinen im `<head>` jeder Seite, sobald ein Wert eingetragen ist (leer = kein Tag). `robots.txt` verweist nach dem Livegang selbst auf die Sitemap.

## 4. Besucherstatistik mit Plausible (ohne Cookies)

Plausible Analytics (https://plausible.io) ist cookiefrei und braucht nach Datenschutzrecht in der Regel keinen Cookie-Banner;
das bleibt **vom Kunden zu bestätigen**. Es ist kostenpflichtig (Testphase vorhanden); Alternative ist die eigene Installation (Self-Hosting).

1. Konto bei Plausible eröffnen, **Add a website**, Domain genau so eintragen, wie sie im Browser steht (z. B. `www.axion-shop.ch`, ohne `https://`).
2. In `src/config/shop.ts` den Wert bei `analytics.plausibleDomain` eintragen, genau dieselbe Domain.
3. Im Datenschutztext (`src/content/pages.ts` und `pages-en.ts`, Ziffer 6, Punkt «Besucherstatistik») erscheint nun automatisch ein Absatz. Er enthält eine Klammer `[Vor Livegang zu bestätigen: …]`: Angaben prüfen (Anbieter, Auftragsbearbeitung), die Klammer entfernen und beide Sprachen im Gleichschritt halten.
4. Veröffentlichen. Das Skript lädt nur mit `launched: true`, nie im Admin und nie in der Entwicklung, mit `defer` (blockiert nichts).
5. Ausgenommen sind Seiten mit Zugangs-Token im Pfad (Bestellstatus, Warenkorb-Link aus der Erinnerung), Bestätigungsseiten und das Kundenkonto (`ANALYTICS_EXCLUDE` in `src/lib/marketing.ts`, Skript `script.exclusions.js`). Wird im Plausible-Konto später das neue, seitenbezogene Skript angeboten, diese Ausnahmen dort genauso eintragen.
6. Eigene Ereignisse: «Add to Cart» (Stück in den Warenkorb) und «Begin Checkout» (Weiterleitung zur Kasse). Unter Plausible → Settings → Goals → **Add goal** → «Custom event» mit genau diesen Namen anlegen, dann erscheinen sie im Bericht.
7. Test: Shop mit der echten Adresse öffnen (nicht über die Vorschau-Adresse), in Plausible sollte nach wenigen Sekunden «Current visitors» 1 zeigen. Werbeblocker können die Messung verhindern (gewollt).

Ausschalten: `plausibleDomain` wieder leeren; Skript und Datenschutz-Absatz verschwinden.

## 5. Dateien (für Ben)

| Datei                              | Zweck                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `src/config/shop.ts`               | `analytics.plausibleDomain`, `verification.google`, `verification.bing` |
| `src/lib/feeds/google.ts`          | Feed-Aufbau, Kategorien, GTIN-Prüfung, 404 vor dem Livegang             |
| `src/routes/feeds/google[.]xml.ts` | Route `/feeds/google.xml`                                               |
| `src/lib/marketing.ts`             | Skript und Meta-Tags im `<head>` (`__root.tsx`)                         |
| `src/lib/analytics.ts`             | `trackEvent` für Plausible-Ereignisse                                   |
