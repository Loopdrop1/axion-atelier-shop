export type PageBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets" | "steps"; items: string[] }
  | { type: "definitions"; items: { label: string; value: string }[] }
  | { type: "questions"; items: { question: string; answer: string }[] };
export interface PageSection {
  heading?: string;
  blocks: PageBlock[];
}
export interface WrittenPage {
  title: string;
  sections: PageSection[];
}

// Kundentexte: wortgetreu; nur {{Variablen}} werden bei der Darstellung ersetzt.
export function structure(
  title: string,
  text: string,
  mode?: "questions" | "definitions" | "impressum",
): WrittenPage {
  const sections: PageSection[] = [];
  let section: PageSection = { blocks: [] };
  sections.push(section);
  for (const line of text.trim().split("\n")) {
    if (!line.trim()) {
      section.blocks.push({ type: "paragraph", text: "" });
      continue;
    }
    const heading =
      line.match(/^### (.+)$/) || (mode === "impressum" ? line.match(/^\*\*(.+)\*\*$/) : null);
    if (heading?.[1]) {
      section = { heading: heading[1], blocks: [] };
      sections.push(section);
      continue;
    }
    const last = section.blocks.at(-1);
    const question = mode === "questions" ? line.match(/^\*\*(.+)\*\*$/) : null;
    if (question?.[1]) {
      if (last?.type === "questions") last.items.push({ question: question[1], answer: "" });
      else
        section.blocks.push({ type: "questions", items: [{ question: question[1], answer: "" }] });
      continue;
    }
    if (mode === "questions" && last?.type === "questions") {
      const item = last.items.at(-1);
      if (item) item.answer += (item.answer ? "\n" : "") + line;
      continue;
    }
    const bullet = line.match(/^- (.+)$/);
    const step = line.match(/^\d+\. (.+)$/);
    if (bullet && mode === "definitions") {
      const pair = bullet[1]?.match(/^\*\*(.+?):\*\* (.+)$/);
      if (pair?.[1] && pair[2]) {
        const item = { label: pair[1] + ":", value: pair[2] };
        if (last?.type === "definitions") last.items.push(item);
        else section.blocks.push({ type: "definitions", items: [item] });
      }
    } else if (bullet || step) {
      const type = bullet ? "bullets" : "steps";
      const text = (bullet || step)?.[1] || "";
      if (last?.type === type) last.items.push(text);
      else section.blocks.push({ type, items: [text] });
    } else if (/^\s+/.test(line) && (last?.type === "bullets" || last?.type === "steps")) {
      const index = last.items.length - 1;
      last.items[index] += "\n" + line.trimStart();
    } else if (last?.type === "paragraph" && last.text) {
      last.text += "\n" + line;
    } else if (last?.type === "paragraph") {
      last.text = line;
    } else section.blocks.push({ type: "paragraph", text: line });
  }
  return {
    title,
    sections: sections
      .map((s) => ({
        ...s,
        blocks: s.blocks.filter((b) => b.type !== "paragraph" || Boolean(b.text)),
      }))
      .filter((s) => s.heading || s.blocks.length),
  };
}

export const pages = {
  impressum: structure(
    "Impressum",
    `
**Anbieterin dieses Online-Shops**
{{company}}
[Rechtsform]
{{address}}
Schweiz

**Kontakt**
E-Mail: {{email}}
Telefon: {{phone}}

**Vertretungsberechtigte Person**
[Vor- und Nachname, Funktion]

**Handelsregister**
[Eingetragen im Handelsregister des Kantons …, Unternehmens-Identifikationsnummer (UID) {{uid}}] oder [nicht im Handelsregister eingetragen]

**Mehrwertsteuer**
[MWST-Nummer CHE-… MWST] oder [Nicht mehrwertsteuerpflichtig]

**Haftung für Inhalte und Links**
Wir prüfen die Inhalte dieser Website sorgfältig. Für Inhalte externer Websites, auf die wir verlinken, sind ausschliesslich deren Betreiber verantwortlich.

**Urheberrechte**
Texte, Bilder, Logo und Gestaltung dieser Website gehören {{company}} oder den jeweiligen Rechteinhabern. Jede Verwendung ausserhalb des privaten Gebrauchs braucht unsere schriftliche Zustimmung.

**Gestaltung und Umsetzung**
Flowrenix, flowrenix.com
`,
    "impressum",
  ),
  datenschutz: structure(
    "Datenschutzerklärung",
    `
Stand: [Datum]

### 1. Wer für die Datenbearbeitung verantwortlich ist
Verantwortlich für die Bearbeitung deiner Personendaten auf dieser Website und im Online-Shop ist:
{{company}}, {{address}}, Schweiz
E-Mail für Datenschutzfragen: [Datenschutz-E-Mail, sonst {{email}}]

Diese Datenschutzerklärung richtet sich nach dem Schweizer Bundesgesetz über den Datenschutz (DSG).

### 2. Welche Daten wir bearbeiten
- **Bestelldaten:** E-Mail-Adresse, Vor- und Nachname, Lieferadresse, freiwillig Telefonnummer, bestellte Artikel, Grössen, Preise, eingelöste Rabattcodes und Gutscheine, Zahlungsart sowie Bestell- und Versandverlauf mit Sendungsnummer.
- **Zahlungsdaten:** Kartennummern und ähnliche Zahlungsdaten erhalten wir nicht. Du gibst sie direkt auf der Bezahlseite unseres Zahlungsdienstleisters Stripe ein (Ziffer 4). Wir sehen nur, ob, wann und womit bezahlt wurde.
- **Kundenkonto (freiwillig):** E-Mail-Adresse, Passwort (nur als verschlüsselter Prüfwert gespeichert, wir können es nicht lesen), Vor- und Nachname, Telefonnummer, Adresse, Sprache, deine Bestellungen und, wenn du angemeldet bist, deine Merkliste.
- **Geschenkgutscheine:** Code, Wert, Restguthaben und Ablaufdatum, E-Mail-Adresse der kaufenden Person und, falls angegeben, Name und E-Mail-Adresse der beschenkten Person, Absendername und Grussbotschaft.
- **Newsletter (freiwillig):** E-Mail-Adresse, Sprache, Wortlaut und Zeitpunkt deiner Einwilligung, Zeitpunkt der Bestätigung und einer allfälligen Abmeldung sowie, wenn wir einen Willkommensrabatt anbieten, dein persönlicher Rabattcode.
- **Benachrichtigung bei Wiederverfügbarkeit (freiwillig):** E-Mail-Adresse, Sprache, gewünschtes Stück und Grösse sowie Zeitpunkt von Anfrage und Bestätigung.
- **Retoure (auf Anfrage):** Bestellnummer, E-Mail-Adresse, zurückgegebene Stücke mit Menge und Grund, dein freiwilliger Kommentar sowie Zeitpunkt und Stand der Retoure.
- **Erinnerung an einen nicht abgeschlossenen Kauf (freiwillig):** Nur wenn du im Warenkorb das Kästchen «Erinnere mich per E-Mail, falls ich den Kauf nicht abschliesse» ankreuzt, schicken wir dir einmalig eine E-Mail mit deinen Artikeln und einem Link zum Warenkorb, falls die Zahlung nicht zustande kommt; wir speichern dazu deine Einwilligung bei der Bestellung, und ohne Häkchen erhältst du keine Erinnerung.
- **Kommunikation:** Name, E-Mail-Adresse, Inhalt und Zeitpunkt deiner Nachrichten, wenn du uns über das Kontaktformular, per E-Mail oder per Telefon kontaktierst.
- **Technische Daten:** Beim Besuch der Website fallen technische Daten an, etwa IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser und Gerät. Sie dienen dem Betrieb und der Sicherheit der Website, zum Beispiel dem Schutz der Formulare vor Missbrauch.
- **Technische Fehlerberichte:** Tritt in deinem Browser ein Fehler auf, schickt die Website einen kurzen Bericht an uns: Fehlermeldung, Pfad der Seite (ohne Teil nach dem Fragezeichen), technischer Ablauf des Fehlers (Stack), Browser- und Gerätetyp sowie die Version der Website. Der Bericht enthält keine Personendaten: keine IP-Adresse, keine E-Mail-Adresse, kein Konto und keine Eingaben. Wir brauchen ihn nur, um Fehler zu finden und zu beheben.
- **Daten auf deinem Gerät:** Warenkorb, Merkliste und, wenn du angemeldet bist, deine Anmeldung speichert dein Browser (Ziffer 6).

### 3. Wofür wir deine Daten bearbeiten
- um Bestellungen abzuwickeln: Vertragsschluss, Zahlung, Versand, Rückgabe, Umtausch und Gewährleistung;
- um dir E-Mails zu deiner Bestellung, zu deinem Kundenkonto und zu Gutscheinen zu senden, zum Beispiel die Bestellbestätigung und die Versandmeldung;
- um dein Kundenkonto zu führen, wenn du eines eröffnest;
- um Geschenkgutscheine auszustellen, einzulösen und das Restguthaben zu führen;
- um dir den Newsletter zu senden, wenn du dich angemeldet und die Anmeldung per E-Mail bestätigt hast;
- um dich einmalig per E-Mail zu informieren, wenn eine ausverkaufte Grösse wieder da ist, sofern du das angefordert und per E-Mail bestätigt hast;
- um deine Fragen zu beantworten;
- um die Website sicher und funktionsfähig zu betreiben und Missbrauch zu verhindern;
- um gesetzliche Pflichten zu erfüllen, insbesondere die Aufbewahrung von Geschäftsunterlagen.

Wir verkaufen deine Daten nicht. Werbung per E-Mail senden wir dir nur, wenn du dich für den Newsletter angemeldet hast. Du kannst ihn jederzeit über den Link in jeder Ausgabe abbestellen.

### 4. Wem wir Daten bekanntgeben
Wir arbeiten mit sorgfältig ausgewählten Dienstleistern zusammen. Sie erhalten nur die Daten, die sie für ihre Aufgabe brauchen, und bearbeiten sie in unserem Auftrag, soweit hier nichts anderes steht.

- **Website-Betrieb:** Diese Website wird mit Lovable betrieben (Lovable Labs Incorporated, USA, und Lovable Labs Sweden AB, Regeringsgatan 25, 111 53 Stockholm, Schweden) und über das weltweite Netzwerk von Cloudflare, Inc. (USA) ausgeliefert. Dabei fallen die technischen Daten aus Ziffer 2 an.
- **Datenbank und Kundenkonten:** Bestellungen, Kundenkonten, Gutscheine und Newsletter-Anmeldungen speichern wir in Lovable Cloud. Lovable betreibt die Datenbank mit Supabase, Inc. (USA) in einem Rechenzentrum in Europa ([Ort]).
- **Zahlung:** Die Bezahlung läuft über Stripe (Stripe Payments Europe, Limited, Irland, zusammen mit Stripe, Inc., USA). Stripe bearbeitet deine Daten für die Zahlung in unserem Auftrag und für eigene Zwecke, etwa zur Betrugsbekämpfung und zur Erfüllung gesetzlicher Pflichten, als eigene Verantwortliche. Bei TWINT, Apple Pay und Google Pay gelten zusätzlich die Datenschutzbestimmungen der jeweiligen Anbieter und deiner Bank. Datenschutzerklärung von Stripe: https://stripe.com/ch/privacy
- **Klarna:** Wenn du mit Klarna bezahlst, bearbeitet die Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Schweden, deine Daten als eigene Verantwortliche. Klarna kann dafür deine Kreditwürdigkeit prüfen, auch mit automatisierten Entscheidungen. Datenschutzhinweise von Klarna: https://cdn.klarna.com/1.0/shared/content/legal/terms/0/de_ch/privacy
- **E-Mail:** Bestellbestätigungen, Nachrichten aus dem Kontaktformular und die übrigen E-Mails des Shops versenden wir über Resend (Plus Five Five, Inc., San Francisco, USA). [Den Newsletter versenden wir mit: Newsletter-Programm, Sitz.]
- **KI-Suche:** Wenn du in der Suche einen längeren Satz eingibst, den die Suche im Browser nicht sicher versteht, senden wir diesen Suchtext zur Auswertung an unsere Funktion «search-assist». Sie reicht ihn über das Lovable AI Gateway an einen KI-Dienst weiter, der ihn in Suchfilter (zum Beispiel Kategorie, Farbe, Anlass) übersetzt. Betreiber des KI-Dienstes: [KI-Anbieter mit Sitz, von der Rechtsberatung zu bestätigen]. Der Suchtext wird dafür nur verarbeitet und von uns nicht gespeichert. Gegen Missbrauch zählen wir die Anfragen pro IP-Adresse, dabei speichern wir nur einen Prüfwert (Hash), nicht die Adresse selbst (Ziffer 7). Das Ergebnis merkt sich dein Browser bis zum Schliessen des Tabs (Ziffer 6). Der Dienst kann ausserhalb der Schweiz arbeiten (Ziffer 5). Gib in die Suche am besten keine Personendaten ein.
- **Versand:** Für die Zustellung geben wir Name, Lieferadresse und Sendungsdaten an die Schweizerische Post weiter (Post CH AG, Post CH Netz AG und Die Schweizerische Post AG, Wankdorfallee 4, 3030 Bern). Die Post bearbeitet diese Daten als eigene Verantwortliche, gemäss ihren Angaben in der Schweiz, in Liechtenstein und in Deutschland. Datenschutzhinweise der Post: https://www.post.ch/de/pages/footer/datenschutz-und-rechtliches
- **Technische Betreuung:** Flowrenix, Gibswil (Schweiz), betreibt und wartet den Shop in unserem Auftrag und kann dabei auf die Daten zugreifen, soweit das nötig ist.
- **Behörden:** wenn wir gesetzlich dazu verpflichtet sind.

### 5. Bekanntgabe ins Ausland
Einige der genannten Dienstleister bearbeiten Daten ausserhalb der Schweiz. Für die Länder der EU und des EWR (zum Beispiel Irland, Schweden und Deutschland) hat der Bundesrat einen angemessenen Datenschutz festgestellt. In die USA geben wir Daten an Unternehmen bekannt, die unter dem Swiss-U.S. Data Privacy Framework zertifiziert sind, oder gestützt auf von der Schweiz anerkannte Standardvertragsklauseln.

### 6. Cookies und Speicher im Browser
Wir verwenden nur, was für den Betrieb des Shops nötig ist:
- **Warenkorb und Merkliste** im Local Storage deines Browsers (Einträge \`axion-cart\` und \`axion-wishlist\`). Du kannst sie in den Browser-Einstellungen jederzeit löschen.
- **Zuletzt angesehene Stücke** im Local Storage (Eintrag \`axion-recent\`) und **letzte Suchen** (Eintrag \`axion-recent-searches\`, die letzten fünf Suchbegriffe). Beide bleiben auf deinem Gerät und werden nicht an uns übermittelt.
- **Zwischenspeicher der KI-Suche** im Session Storage (Eintrag \`axion-search-assist\`): die Antwort auf einen längeren Suchtext, damit dieselbe Frage nicht erneut gestellt wird. Er wird beim Schliessen des Tabs gelöscht.
- **Sprache:** Die gewählte Sprache steckt in der Adresse der Seite (zum Beispiel \`/en\`), der Shop speichert sie nicht zusätzlich.
- **Anmeldung:** Wenn du dich im Kundenkonto anmeldest, speichert dein Browser einen Anmeldeschlüssel, bis du dich abmeldest.
- **Cloudflare** setzt ein Cookie (\`__cf_bm\`), das automatisierte Angriffe abwehrt und nach 30 Minuten Inaktivität abläuft.
- **Bezahlseite:** Auf der Bezahlseite von Stripe setzt Stripe eigene Cookies, unter anderem zur Betrugsbekämpfung. Details stehen in der Datenschutzerklärung von Stripe.
- {{analytics}}**Besucherstatistik:** Wir messen die Nutzung der Website anonym mit Plausible Analytics (Plausible Insights OÜ, Estland; Datenverarbeitung in der EU). Plausible setzt keine Cookies und legt keine Profile einzelner Besucher an. Erfasst werden die aufgerufene Seite, die verweisende Seite, Browser, Gerät, grobes Herkunftsland sowie die Ereignisse «In den Warenkorb» und «Zur Kasse», ohne dass wir dich als Person erkennen. Rechtsgrundlage ist unser Interesse, die Website zu verbessern. Du kannst die Messung mit der Einstellung «Do Not Track» deines Browsers oder einem Werbeblocker verhindern. [Vor Livegang zu bestätigen: Angaben zum Anbieter und Auftragsbearbeitung]

Auf dieser Website setzen wir keine Analyse- oder Werbe-Cookies ein. Unsere E-Mails und der Newsletter enthalten kein Öffnungs- und Klicktracking. Du kannst Cookies und den Speicher deines Browsers jederzeit löschen. Ohne die nötigen Cookies funktioniert der Kaufvorgang aber nicht.

### 7. Wie lange wir Daten aufbewahren
Wir bewahren Personendaten so lange auf, wie wir sie für die genannten Zwecke brauchen:
- **Bestellungen und Belege:** zehn Jahre, wie es das Gesetz für Geschäftsunterlagen verlangt.
- **Kundenkonto:** bis du es löschst. Das kannst du jederzeit selbst im Kundenkonto tun. Deine Bestellungen bewahren wir danach ohne Verbindung zum Konto während der gesetzlichen Frist auf.
- **Newsletter:** bis du dich abmeldest. Den Nachweis deiner Einwilligung und Abmeldung bewahren wir auf, solange wir ihn als Beleg brauchen.
- **Benachrichtigung bei Wiederverfügbarkeit:** Nach dem Versand der Benachrichtigung löschen wir deine Adresse; unbestätigte Anfragen nach 30 Tagen.
- **Geschenkgutscheine:** bis zum Ablauf und danach während der gesetzlichen Frist für Geschäftsunterlagen.
- **Nachrichten über das Kontaktformular:** Der Shop speichert sie nicht, sie kommen als E-Mail in unser Postfach. Wir bewahren sie auf, solange wir sie für deine Anfrage brauchen.
- **Schutz vor Missbrauch:** Damit niemand Formulare, Kasse oder Gutscheinprüfung massenhaft benutzt, zählen wir Anfragen pro IP-Adresse und E-Mail-Adresse. Gespeichert wird dafür nur ein Prüfwert (Hash), nicht die Adresse selbst, zusammen mit der Anzahl und dem Zeitpunkt. Abgelaufene Zähler löschen wir laufend, in der Regel nach zwei Tagen.
- **Technische Fehlerberichte:** Wir löschen sie automatisch nach 30 Tagen. Gleiche Fehler fassen wir zu einem Eintrag mit Zähler zusammen.

### 8. Datensicherheit
Wir schützen deine Daten mit angemessenen technischen und organisatorischen Massnahmen. Die Verbindung zu unserer Website ist verschlüsselt, Passwörter speichern wir nur als verschlüsselten Prüfwert, und Zugriff auf die Daten haben nur wir und unsere Dienstleister im nötigen Umfang.

### 9. Deine Rechte
Du kannst jederzeit:
- Auskunft verlangen, ob und welche Daten wir über dich bearbeiten;
- die Berichtigung unrichtiger Daten verlangen;
- verlangen, dass wir deine Daten löschen oder nicht weiter bearbeiten, soweit keine gesetzliche Pflicht oder ein überwiegendes Interesse entgegensteht;
- die Herausgabe oder Übertragung deiner Daten in einem gängigen elektronischen Format verlangen;
- eine Einwilligung, zum Beispiel für den Newsletter, für die Zukunft widerrufen.

Schreib uns dafür an {{email}}. Wir können einen Identitätsnachweis verlangen. Du kannst dich zudem beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) beschweren: www.edoeb.admin.ch

### 10. Änderungen
Wir können diese Datenschutzerklärung anpassen. Es gilt die Version, die auf dieser Website veröffentlicht ist.
`,
  ),
  agb: structure(
    "Allgemeine Geschäftsbedingungen (AGB)",
    `
Stand: [Datum]

### 1. Geltungsbereich
Diese AGB gelten für alle Bestellungen und für den Kauf von Geschenkgutscheinen im Online-Shop {{brand}} unter [Domain]. Vertragspartnerin ist {{company}}, {{address}}, Schweiz, E-Mail {{email}} (nachfolgend «wir»). Wir liefern nur an Adressen in der Schweiz [und in Liechtenstein].

### 2. Bestellung und Vertragsschluss
Die Darstellung der Produkte im Shop ist kein verbindliches Angebot. So bestellst du:
1. Grösse wählen und Artikel in den Warenkorb legen.
2. Im Warenkorb deine E-Mail-Adresse eingeben und, falls vorhanden, einen Rabattcode oder Geschenkgutschein einlösen.
3. Auf «Zur Kasse» klicken. Du gelangst auf die Bezahlseite unseres Zahlungsdienstleisters Stripe.
4. Lieferadresse eingeben und Zahlungsart wählen.
5. Alle Angaben prüfen und bei Bedarf korrigieren.
6. Die Bestellung mit dem Bezahl-Button verbindlich absenden.

Bis zum Absenden kannst du alle Eingaben ändern oder den Kauf abbrechen. Während du bezahlst, reservieren wir die Artikel für kurze Zeit. Nach erfolgreicher Zahlung erhältst du eine Bestellbestätigung per E-Mail. Mit dieser Bestätigung kommt der Vertrag zustande. Ist ein Artikel trotz Bestätigung nicht mehr verfügbar, informieren wir dich sofort und erstatten bereits bezahlte Beträge umgehend zurück.

Du kannst als Gast bestellen oder ein Kundenkonto eröffnen. [Wer noch nicht 18 Jahre alt ist, braucht für eine Bestellung die Zustimmung der Eltern oder der gesetzlichen Vertretung.] oder [Bestellen kannst du ab 16 Jahren; bis 18 Jahre brauchst du die Zustimmung der Eltern oder der gesetzlichen Vertretung.]

### 3. Preise
Alle Preise sind Endpreise in Schweizer Franken (CHF). [Bei MWST-Pflicht: Sie enthalten die gesetzliche Mehrwertsteuer.] Allfällige Versandkosten siehst du im Warenkorb und auf der Bezahlseite, bevor du bestellst. Es gilt der Preis, der zum Zeitpunkt der Bestellung im Shop angezeigt wird.

### 4. Zahlung, Rabattcodes und Gutscheine
Du kannst mit TWINT, Kredit- oder Debitkarte (Visa, Mastercard, American Express), Apple Pay, Google Pay oder Klarna bezahlen. Welche Zahlungsarten erscheinen, hängt unter anderem von deinem Gerät und vom Betrag ab. Die Zahlung wird bei der Bestellung ausgelöst und über Stripe abgewickelt. Bei Klarna gelten zusätzlich die Bedingungen und Zahlungsfristen von Klarna. Einen eigenen Kauf auf Rechnung bieten wir nicht an.

Pro Bestellung kannst du einen Rabattcode und einen Geschenkgutschein einlösen. Rabatte gelten auf den Warenwert, nicht auf Versandkosten und nicht auf den Kauf von Geschenkgutscheinen. Rabattcodes gelten nur zu den angegebenen Bedingungen und sind nicht in bar auszahlbar.

### 5. Lieferung
Wir liefern mit der Schweizerischen Post. Die Lieferzeit beträgt in der Regel 2 bis 5 Arbeitstage nach Zahlungseingang. Sobald dein Paket unterwegs ist, erhältst du eine Versandmeldung mit Sendungsnummer. Teillieferungen sind möglich, ohne Mehrkosten für dich. Bis zur Übergabe der Ware an dich tragen wir das Risiko für Verlust und Beschädigung auf dem Transport.

### 6. Geschenkgutscheine
- Du erhältst den Gutschein per E-Mail mit einem persönlichen Code. Auf Wunsch senden wir ihn direkt an die beschenkte Person.
- Der Gutschein gilt ab Kauf so lange, wie auf dem Gutschein angegeben ([5 Jahre]). Das Restguthaben kannst du im Shop jederzeit prüfen.
- Du kannst den Gutschein in mehreren Bestellungen einlösen, bis das Guthaben aufgebraucht ist. Eine Barauszahlung ist nicht möglich. Geschenkgutscheine kannst du nicht mit Rabattcodes oder anderen Gutscheinen kaufen.
- Wer den Code kennt, kann ihn einlösen. Bewahre ihn deshalb sorgfältig auf. Ist ein Code verloren gegangen, melde dich sofort: Solange das Guthaben nicht eingelöst ist, sperren wir den Code und übertragen das Restguthaben auf einen neuen.
- Geschenkgutscheine sind vom freiwilligen Rückgaberecht ausgenommen. Gibst du Ware zurück, die du ganz oder teilweise mit einem Gutschein bezahlt hast, erstatten wir diesen Teil als Gutschein.

### 7. Freiwilliges Rückgaberecht
Das Schweizer Recht sieht für Online-Käufe kein Rückgaberecht vor. Wir gewähren dir freiwillig ein Rückgaberecht von {{returnDays}} Tagen ab Erhalt der Ware.
- **Voraussetzungen:** Die Ware ist ungetragen, ungewaschen, nicht geändert und vollständig, mit allen Etiketten und möglichst in der Originalverpackung. [Ausgeschlossen sind: …]
- **So gehst du vor:** Melde die Rückgabe per E-Mail an {{email}} mit deiner Bestellnummer. [Rücksendeetikett: liegt dem Paket bei / senden wir dir per E-Mail / du frankierst selbst.]
- **Kosten:** [Die Rücksendung ist für dich gratis.] oder [Die Rücksendekosten von CHF … trägst du.]
- **Rückerstattung:** Nach Eingang und Prüfung der Ware erstatten wir den Kaufpreis innert [Anzahl] Tagen auf das ursprüngliche Zahlungsmittel [oder als Gutschein, nach deiner Wahl].
- **Umtausch:** Eine andere Grösse kannst du [gratis] tauschen, solange sie verfügbar ist.

[Nur bei Lieferung nach Liechtenstein: Für Konsumentinnen und Konsumenten mit Wohnsitz in Liechtenstein gilt zusätzlich das gesetzliche Rücktrittsrecht bei Fernabsatzverträgen nach liechtensteinischem Recht. Fachperson beiziehen.]

### 8. Gewährleistung
Es gelten die gesetzlichen Bestimmungen. Die Gewährleistungsfrist beträgt zwei Jahre ab Lieferung. Bitte prüfe die Ware nach Erhalt und melde uns Mängel sofort nach ihrer Entdeckung per E-Mail an {{email}}. Bei einem Mangel kannst du nach Gesetz die Rückgängigmachung des Kaufs, eine Minderung des Preises oder eine mangelfreie Ersatzlieferung verlangen. Gerne bieten wir dir auch eine Reparatur an, wenn das für dich passt. Normale Abnutzung und Schäden durch unsachgemässe Pflege sind keine Mängel.

### 9. Kundenkonto und Newsletter
Das Kundenkonto ist freiwillig. Halte dein Passwort geheim. Du kannst dein Konto jederzeit selbst im Kundenkonto löschen. Den Newsletter erhältst du nur, wenn du dich angemeldet und die Anmeldung per E-Mail bestätigt hast. Du kannst ihn jederzeit über den Link in jeder Ausgabe abbestellen.

### 10. Haftung
Wir haften nach den gesetzlichen Bestimmungen. Für leichte Fahrlässigkeit haften wir nicht, soweit das Gesetz dies zulässt. Die Haftung für absichtlich oder grobfahrlässig verursachte Schäden und für Personenschäden bleibt unberührt.

### 11. Datenschutz
Wie wir deine Daten bearbeiten, steht in unserer Datenschutzerklärung.

### 12. Anwendbares Recht und Gerichtsstand
Es gilt Schweizer Recht unter Ausschluss des Wiener Kaufrechts (CISG). Für Streitigkeiten gelten die gesetzlichen Gerichtsstände. Als Konsumentin oder Konsument kannst du an deinem Wohnsitz oder an unserem Sitz klagen. [Nur bei Lieferung nach Liechtenstein: Für Konsumentinnen und Konsumenten mit Wohnsitz in Liechtenstein bleiben die zwingenden Bestimmungen ihres Wohnsitzrechts vorbehalten.]

### 13. Änderungen
Wir können diese AGB jederzeit ändern. Für deine Bestellung gilt die Version, die zum Zeitpunkt der Bestellung veröffentlicht war.
`,
  ),
  "versand-und-rueckgabe": structure(
    "Versand und Rückgabe",
    `
- **Liefergebiet:** Schweiz [und Liechtenstein]
- **Versand:** mit der Schweizerischen Post. {{shipping}}
- **Lieferzeit:** 2 bis 5 Arbeitstage nach Zahlungseingang, Sendungsnummer per E-Mail
- **Rückgabe:** innert {{returnDays}} Tagen ab Erhalt, ungetragen und mit Etiketten
- **Retoure anmelden:** online mit Bestellnummer und E-Mail-Adresse, danach schicken wir dir die Hinweise zur Rücksendung per E-Mail
- **Rücksendung:** [gratis / CHF …], [Etikett liegt bei / auf Anfrage]
- **Rückerstattung:** innert [Anzahl] Tagen nach Eingang der Rücksendung, auf das ursprüngliche Zahlungsmittel
- **Umtausch:** andere Grösse [gratis], solange verfügbar
- **Gutscheine:** vom Rückgaberecht ausgenommen
- **Mängel:** zwei Jahre Gewährleistung nach Gesetz, Meldung per E-Mail an {{email}}
Die verbindlichen Regeln stehen in den AGB.
`,
    "definitions",
  ),
  "haeufige-fragen": structure(
    "Häufige Fragen",
    `
### Grössen
**Welche Grösse passt mir?**
Miss Brust- und Taillenumfang und vergleiche die Werte mit unserer Grössentabelle. Bei Fragen helfen wir dir gerne per E-Mail an {{email}}.
**Was bedeuten die Zahlen 46 bis 56?**
Das sind die üblichen Konfektionsgrössen für Anzüge, Sakkos, Westen, Mäntel und Hosen. Hemden führen wir nach Kragenweite (38 bis 45), Strick von S bis XXL und Schuhe in EU-Grössen.
**Kann ich eine andere Grösse tauschen?**
Ja, innert {{returnDays}} Tagen, solange die Grösse verfügbar ist. Schreib uns an {{email}}.

### Bestellung und Konto
**Brauche ich ein Kundenkonto?**
Nein, du kannst als Gast bestellen. Mit einem Kundenkonto siehst du alle Bestellungen und den Versandstatus an einem Ort.
**Wo sehe ich, wo mein Paket ist?**
Sobald dein Paket unterwegs ist, bekommst du eine Versandmeldung mit der Sendungsnummer der Post. Mit Kundenkonto findest du sie auch dort.
**Kann ich meine Bestellung noch ändern?**
Schreib uns möglichst schnell an {{email}}. Solange das Paket noch nicht unterwegs ist, finden wir meist eine Lösung.

### Lieferung
**Wie lange dauert die Lieferung?**
In der Regel 2 bis 5 Arbeitstage nach Zahlungseingang.
**Was kostet der Versand?**
{{shipping}}. Den genauen Betrag siehst du im Warenkorb, bevor du bestellst.
**Liefert Axion ins Ausland?**
Zurzeit liefern wir nur in die Schweiz [und nach Liechtenstein].

### Rückgabe
**Kann ich etwas zurückgeben?**
Ja. Du kannst Artikel innert {{returnDays}} Tagen ab Erhalt zurückgeben, ungetragen und mit allen Etiketten. Melde die Rücksendung vorab online an, mit Bestellnummer und E-Mail-Adresse unter «Retoure anmelden» auf der Seite Versand und Rückgabe. Die Details stehen in den AGB.
**Wann bekomme ich mein Geld zurück?**
Innert [Anzahl] Tagen nach Eingang der Rücksendung, auf das ursprüngliche Zahlungsmittel.

### Zahlung, Gutscheine und Rabattcodes
**Wie kann ich bezahlen?**
Mit TWINT, Kredit- oder Debitkarte, Apple Pay, Google Pay oder Klarna.
**Kann ich auf Rechnung bezahlen?**
Mit Klarna kannst du je nach Prüfung durch Klarna später oder in Raten bezahlen. Einen eigenen Kauf auf Rechnung bieten wir nicht an.
**Wie löse ich einen Gutschein oder Rabattcode ein?**
Gib den Code im Warenkorb ein, bevor du zur Kasse gehst. Pro Bestellung kannst du einen Rabattcode und einen Gutschein einlösen.
**Wie lange gilt ein Geschenkgutschein?**
So lange, wie auf dem Gutschein steht. Das Restguthaben kannst du jederzeit auf der Gutschein-Seite prüfen.
**Kann ich einen Gutschein direkt verschenken?**
Ja. Gib beim Kauf Name und E-Mail-Adresse der beschenkten Person an, dann senden wir den Gutschein direkt an sie.

### Newsletter
**Wie melde ich mich vom Newsletter ab?**
Mit dem Link am Ende jeder Newsletter-E-Mail. Die Abmeldung gilt sofort.

### Pflege
**Wie pflege ich meinen Anzug?**
Häng den Anzug nach dem Tragen auf einen breiten Bügel und lass ihn auslüften. Reinige ihn nur, wenn nötig, und beachte immer das Pflegeetikett.
**Wie pflege ich Lederschuhe?**
Schuhspanner einsetzen, Schuhe nach dem Tragen einen Tag ruhen lassen und regelmässig mit passender Schuhcreme pflegen.
`,
    "questions",
  ),
} satisfies Record<string, WrittenPage>;
export type WrittenPageHandle = keyof typeof pages;
