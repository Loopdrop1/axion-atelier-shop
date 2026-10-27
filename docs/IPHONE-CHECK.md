# iPhone-Check (Safari, 15 Minuten)

Klick-Liste für ein echtes iPhone mit Safari (aktuelles iOS). Vor jedem Livegang und nach grösseren Änderungen durchgehen.
Zum Notieren: Gerät und iOS-Version, Datum, Adresse (Vorschau oder Domain). Befund bei jedem Punkt: OK oder was nicht stimmt
(Screenshot, Seite).

Vorbereitung: Safari → Einstellungen → Safari → «Verlauf und Websitedaten löschen» (frischer Start), Privat-Tab ist nicht nötig.
Der Energiesparmodus darf **ein** Durchgang an sein (Video darf dann nicht laufen), einer aus.

## Startseite

- [ ] Hero: Foto erscheint sofort ohne Sprung. Mit Video: läuft stumm in Schleife, Pause-/Play-Knopf funktioniert. Ohne
      Handy-Video bleibt das Foto stehen.
- [ ] Im Energiesparmodus läuft kein Video, nur das Foto.
- [ ] Neuheiten, Kategorien-Reihe (seitlich wischen), Look («Look kaufen»: Grösse wählen, in den Warenkorb), Anlässe, Markenbereich,
      Vorteile, Geschichte: nichts ragt über den Rand, kein seitliches Scrollen der ganzen Seite.
- [ ] Bilder scharf, kein Layoutsprung beim Laden, Schrift lädt ohne Flackern.

## Menü, Suche, Filter

- [ ] Menü (Hamburger) öffnet, alle Punkte erreichbar, schliesst mit «X» und mit Tippen daneben; Seite dahinter scrollt nicht.
- [ ] Suche öffnen, Tastatur erscheint (kein Zoomen beim Tippen), Begriff wie «Anzug» liefert Treffer, ein ganzer Satz
      («heller Leinenanzug unter 800 Franken») zeigt verstandene Filter, Suchverlauf erscheint.
- [ ] Kategorie öffnen, Filter (Grösse, Farbe, Preis, Anlass) öffnen, setzen, zurücksetzen. Ergebnisse ändern sich, Zurück-Taste
      von Safari führt zur vorigen Ansicht.

## Produktseite

- [ ] Galerie: seitlich wischen, Bildzähler stimmt. Tippen öffnet die Grossansicht; Zoomen mit zwei Fingern, Schliessen funktioniert.
- [ ] Grösse wählen (nicht verfügbare sind erkennbar), bei «One Size» ist nichts zu wählen.
- [ ] «In den Warenkorb»: Rückmeldung erscheint, Zähler am Warenkorb steigt. Hinweis bei 2 oder weniger Stück.
- [ ] Ausverkaufte Grösse: «Benachrichtigen» öffnet das Formular (Tastatur verdeckt den Knopf nicht).
- [ ] Teilen: Teilen-Knopf öffnet das Teilen-Blatt von iOS, Link stimmt.
- [ ] Merkliste: Herz antippen, in `/merkliste` erscheint das Stück.
- [ ] Vervollständigen («Das ganze Outfit»): Grössen wählen, Auswahl in den Warenkorb.

## Warenkorb und Kasse

- [ ] Warenkorb öffnen: Menge ändern, entfernen, Zwischensumme und Versandhinweis stimmen, «Gratisversand ab» zeigt den richtigen Betrag.
- [ ] Rabatt- und Gutscheincode-Feld funktioniert (Tastatur, Fehlermeldung bei falschem Code).
- [ ] «Zur Kasse»: Weiterleitung auf Stripe klappt, Seite lädt, Karten-/Apple-Pay-Auswahl erscheint. Im Testmodus mit Testkarte
      (`docs/TESTKAUF.md`) bis zur Bestätigung durchgehen; «Zurück» in Stripe führt in den Shop, Artikel sind wieder verfügbar.

## Konto, Merkliste, Sprache

- [ ] Registrieren: Formular, Passwort-Manager von iOS schlägt ein Passwort vor, Bestätigungs-E-Mail kommt an, Link in der
      Mail-App öffnet Safari und bestätigt.
- [ ] Anmelden, Abmelden, «Passwort vergessen» (E-Mail kommt an).
- [ ] Merkliste bleibt nach Neuladen (angemeldet und als Gast).
- [ ] Sprachwechsel DE ↔ EN: gleiche Seite bleibt offen, Texte, Preise und Menü wechseln; `/en` bleibt beim Navigieren erhalten.

## Rechtstexte und Formulare

- [ ] Impressum, Datenschutz, AGB, Versand und Rückgabe, Häufige Fragen: lesbar, keine Platzhalter in `[…]` (ausser im Entwurf), Links
      funktionieren, Ankerlinks springen richtig.
- [ ] Kontaktformular senden (Fehlermeldung bei zu kurzer Nachricht, Erfolgsmeldung danach).
- [ ] Newsletter in der Fusszeile (Einwilligungs-Häkchen, Bestätigungs-E-Mail).
- [ ] Cookie-/Hinweis-Banner: keiner nötig (keine Analyse-Cookies); es darf keiner erscheinen, der den Inhalt verdeckt.

## Bedienung und Darstellung

- [ ] **Reduzierte Bewegung:** Einstellungen → Bedienungshilfen → Bewegung → «Bewegung reduzieren» ein. Startseite neu laden: Einblendungen
      und Parallaxe sind aus, kein Video, Seite bleibt vollständig sichtbar. Danach wieder ausschalten.
- [ ] **Querformat:** Gerät drehen auf Startseite, Produktseite, Warenkorb, Kasse: Kopfzeile verdeckt keine Inhalte, Notch/Dynamic Island
      schneiden nichts ab (Seiten-Ränder), Menü lässt sich bedienen. Zurückdrehen: kein Layout-Rest.
- [ ] **Schriftgrösse:** Einstellungen → Anzeige → Textgrösse grösser: Texte laufen nicht über, Knöpfe bleiben bedienbar.
- [ ] **Dunkelmodus** des Systems: Shop bleibt lesbar (oder bleibt hell).
- [ ] Zurück-Geste von links: führt sinnvoll zur vorigen Seite, auch aus Menü und Grossansicht.
- [ ] Adressleiste: Seite verspringt beim Scrollen nicht (Höhe der Leiste), Fusszeile ist erreichbar.
- [ ] Offline kurz testen (Flugmodus): Fehlermeldung statt weisser Seite.

## Auswertung

- [ ] Jede Abweichung mit Seite, Schritt, Gerät, iOS-Version notieren. Technische Fehler zusätzlich unter Admin → **Fehler** nachsehen
      (`/admin/fehler`): neue Meldungen während des Durchgangs gehören zu den notierten Schritten.
- [ ] Kritisch (Kasse, Warenkorb, Login, Menü nicht bedienbar) vor dem Livegang beheben; Kosmetik in die Liste für später.
