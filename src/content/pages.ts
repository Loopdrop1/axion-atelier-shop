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
function structure(
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
- **Bestelldaten:** Vor- und Nachname, Liefer- und Rechnungsadresse, E-Mail-Adresse, freiwillig Telefonnummer, bestellte Artikel, Grössen, Preise, Zahlungsart und Bestellverlauf.
- **Zahlungsdaten:** Kartennummern und ähnliche Zahlungsdaten erhalten wir nicht. Sie werden direkt vom Zahlungsdienstleister bearbeitet (Ziffer 4). Wir sehen nur, ob und womit bezahlt wurde.
- **Kommunikation:** Inhalt und Zeitpunkt deiner Nachrichten, wenn du uns per E-Mail oder Telefon kontaktierst.
- **Technische Daten:** Beim Besuch der Website fallen technische Daten an, etwa IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser und Gerät. Sie dienen dem Betrieb und der Sicherheit der Website.
- **Daten auf deinem Gerät:** Warenkorb und Merkliste speichern wir im Speicher deines Browsers (Local Storage), nicht bei uns (Ziffer 6).

### 3. Wofür wir deine Daten bearbeiten
- um Bestellungen abzuwickeln: Vertragsschluss, Zahlung, Versand, Rückgabe, Umtausch und Gewährleistung;
- um deine Fragen zu beantworten;
- um die Website sicher und funktionsfähig zu betreiben;
- um gesetzliche Pflichten zu erfüllen, insbesondere die Aufbewahrung von Geschäftsunterlagen.

Wir verkaufen deine Daten nicht. Werbung per E-Mail senden wir dir nur, wenn du dich dafür angemeldet hast.

### 4. Wem wir Daten bekanntgeben
Wir arbeiten mit sorgfältig ausgewählten Dienstleistern zusammen. Sie erhalten nur die Daten, die sie für ihre Aufgabe brauchen.

- **Shop-System und Kasse:** Unser Shop und die Kasse laufen auf Shopify. Vertragspartnerin ist die Shopify International Limited, The Sidings, 4th Floor, Grand Canal Quay, Dublin D02 E7K8, Irland. Shopify bearbeitet die Bestelldaten in unserem Auftrag und kann sie in weiteren Ländern bearbeiten, in denen Shopify oder seine Dienstleister tätig sind, insbesondere Kanada, USA und Singapur. Datenschutzerklärung: https://www.shopify.com/legal/privacy
  Wenn du in der Kasse Shop Pay nutzt, bearbeitet Shopify deine Daten zusätzlich als eigene Verantwortliche: https://www.shopify.com/legal/privacy/consumers
- **Zahlung:** Zahlungen laufen über Shopify Payments. Die Zahlungen wickeln je nach Zahlungsart Zahlungsdienstleister von Shopify ab (gemäss Shopify derzeit Stripe Payments Europe Ltd., Irland, Adyen N.V., Niederlande, und PayPal Pte. Ltd., Singapur). Bei TWINT, Apple Pay und Google Pay gelten zusätzlich die Datenschutzbestimmungen der jeweiligen Anbieter und deiner Bank.
- **Klarna:** Wenn du mit Klarna bezahlst, bearbeitet die Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Schweden, deine Daten als eigene Verantwortliche. Klarna kann dafür deine Kreditwürdigkeit prüfen, auch mit automatisierten Entscheidungen. Datenschutzhinweise von Klarna: https://cdn.klarna.com/1.0/shared/content/legal/terms/0/de_ch/privacy
- **Versand:** Für die Zustellung geben wir Name, Lieferadresse und Sendungsdaten an die Schweizerische Post weiter (Post CH AG, Post CH Netz AG und Die Schweizerische Post AG, Wankdorfallee 4, 3030 Bern). Die Post bearbeitet diese Daten als eigene Verantwortliche, gemäss ihren Angaben in der Schweiz, in Liechtenstein und in Deutschland. Datenschutzhinweise der Post: https://www.post.ch/de/pages/footer/datenschutz-und-rechtliches
- **Website-Betrieb:** Diese Website wird mit Lovable betrieben (Lovable Labs Incorporated, USA, und Lovable Labs Sweden AB, Regeringsgatan 25, 111 53 Stockholm, Schweden) und über das weltweite Netzwerk von Cloudflare, Inc. (USA) ausgeliefert. Dabei fallen die technischen Daten aus Ziffer 2 an.
- **E-Mail:** Unsere E-Mails laufen über [E-Mail-Anbieter, Sitz].
- **Behörden:** wenn wir gesetzlich dazu verpflichtet sind.

### 5. Bekanntgabe ins Ausland
Einige der genannten Dienstleister bearbeiten Daten ausserhalb der Schweiz. Für Länder der EU und des EWR (zum Beispiel Irland, Schweden, Niederlande) sowie für Kanada (für private Unternehmen) hat der Bundesrat einen angemessenen Datenschutz festgestellt. In die USA geben wir Daten an Unternehmen bekannt, die unter dem Swiss-U.S. Data Privacy Framework zertifiziert sind, oder gestützt auf von der Schweiz anerkannte Standardvertragsklauseln. Für andere Länder ohne angemessenen Datenschutz, etwa Singapur, stützen wir uns auf Standardvertragsklauseln oder verbindliche unternehmensinterne Datenschutzvorschriften der Dienstleister, oder die Bekanntgabe ist für die Abwicklung deines Vertrags nötig.

### 6. Cookies und Speicher im Browser
Wir verwenden nur, was für den Betrieb des Shops nötig ist:
- **Warenkorb und Merkliste** im Local Storage deines Browsers. Du kannst sie in den Browser-Einstellungen jederzeit löschen.
- **Cloudflare** setzt ein Cookie (\`__cf_bm\`), das automatisierte Angriffe abwehrt und nach 30 Minuten Inaktivität abläuft.
- **Kasse:** In der Kasse setzt Shopify die für den Kaufvorgang nötigen Cookies, zum Beispiel für den Warenkorb und die Sitzung. Details: https://www.shopify.com/legal/cookies

Auf dieser Website setzen wir keine Analyse- oder Werbe-Cookies ein. Soweit Shopify in der Kasse zusätzlich Cookies für Statistik oder Marketing setzt (zum Beispiel \`_shopify_analytics\` oder \`_shopify_marketing\`), kannst du sie über den Cookie-Hinweis der Kasse oder in deinem Browser ablehnen. Du kannst Cookies in deinem Browser jederzeit blockieren oder löschen. Ohne die nötigen Cookies funktioniert der Kaufvorgang aber nicht.

### 7. Wie lange wir Daten aufbewahren
Wir bewahren Personendaten so lange auf, wie wir sie für die genannten Zwecke brauchen. Geschäftsunterlagen wie Bestellungen und Belege bewahren wir während der gesetzlichen Frist von zehn Jahren auf.

### 8. Datensicherheit
Wir schützen deine Daten mit angemessenen technischen und organisatorischen Massnahmen. Die Verbindung zu unserer Website ist verschlüsselt.

### 9. Deine Rechte
Du kannst jederzeit:
- Auskunft verlangen, ob und welche Daten wir über dich bearbeiten;
- die Berichtigung unrichtiger Daten verlangen;
- verlangen, dass wir deine Daten löschen oder nicht weiter bearbeiten, soweit keine gesetzliche Pflicht oder ein überwiegendes Interesse entgegensteht;
- die Herausgabe oder Übertragung deiner Daten in einem gängigen elektronischen Format verlangen.

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
Diese AGB gelten für alle Bestellungen im Online-Shop {{brand}} unter [Domain]. Vertragspartnerin ist {{company}}, {{address}}, Schweiz, E-Mail {{email}} (nachfolgend «wir»). Wir liefern nur an Adressen in [der Schweiz].

### 2. Bestellung und Vertragsschluss
Die Darstellung der Produkte im Shop ist kein verbindliches Angebot. So bestellst du:
1. Grösse wählen und Artikel in den Warenkorb legen.
2. Im Warenkorb auf «Zur Kasse» klicken.
3. E-Mail-Adresse, Liefer- und Rechnungsadresse eingeben.
4. Zahlungsart wählen.
5. Alle Angaben in der Übersicht prüfen und bei Bedarf korrigieren.
6. Die Bestellung mit dem Bestell-Button verbindlich absenden.

Bis zum Absenden kannst du alle Eingaben ändern. Nach dem Absenden erhältst du sofort eine Bestellbestätigung per E-Mail. Mit dieser Bestätigung kommt der Vertrag zustande. Ist ein Artikel trotz Bestätigung nicht mehr verfügbar, informieren wir dich sofort und erstatten bereits bezahlte Beträge umgehend zurück.

Wer noch nicht 18 Jahre alt ist, braucht für eine Bestellung die Zustimmung der Eltern oder der gesetzlichen Vertretung.

### 3. Preise
Alle Preise sind Endpreise in Schweizer Franken (CHF). [Bei MWST-Pflicht: Sie enthalten die gesetzliche Mehrwertsteuer.] Der Versand innerhalb der Schweiz ist gratis. Es gilt der Preis, der zum Zeitpunkt der Bestellung im Shop angezeigt wird.

### 4. Zahlung
Du kannst mit TWINT, Kredit- oder Debitkarte (Visa, Mastercard, American Express), Apple Pay, Google Pay oder Klarna bezahlen. Die Zahlung wird bei der Bestellung ausgelöst. Bei Klarna gelten zusätzlich die Bedingungen und Zahlungsfristen von Klarna. Einen eigenen Kauf auf Rechnung bieten wir nicht an.

### 5. Lieferung
Wir liefern mit der Schweizerischen Post. Die Lieferzeit beträgt in der Regel 2 bis 5 Arbeitstage nach Zahlungseingang. Teillieferungen sind möglich, ohne Mehrkosten für dich. Bis zur Übergabe der Ware an dich tragen wir das Risiko für Verlust und Beschädigung auf dem Transport.

### 6. Freiwilliges Rückgaberecht
Das Gesetz sieht für Online-Käufe kein Rückgaberecht vor. Wir gewähren dir freiwillig ein Rückgaberecht von {{returnDays}} Tagen ab Erhalt der Ware.
- **Voraussetzungen:** Die Ware ist ungetragen, ungewaschen, nicht geändert und vollständig, mit allen Etiketten und möglichst in der Originalverpackung. [Ausgeschlossen sind: …]
- **So gehst du vor:** Melde die Rückgabe per E-Mail an {{email}} mit deiner Bestellnummer. [Rücksendeetikett: liegt dem Paket bei / senden wir dir per E-Mail / du frankierst selbst.]
- **Kosten:** [Die Rücksendung ist für dich gratis.] oder [Die Rücksendekosten von CHF … trägst du.]
- **Rückerstattung:** Nach Eingang und Prüfung der Ware erstatten wir den Kaufpreis innert [Anzahl] Tagen auf das ursprüngliche Zahlungsmittel [oder als Gutschein, nach deiner Wahl].
- **Umtausch:** Eine andere Grösse kannst du [gratis] tauschen, solange sie verfügbar ist.

### 7. Gewährleistung
Es gelten die gesetzlichen Bestimmungen. Die Gewährleistungsfrist beträgt zwei Jahre ab Lieferung. Bitte prüfe die Ware nach Erhalt und melde uns Mängel sofort nach ihrer Entdeckung per E-Mail an {{email}}. Bei einem Mangel kannst du nach Gesetz die Rückgängigmachung des Kaufs, eine Minderung des Preises oder eine mangelfreie Ersatzlieferung verlangen. Gerne bieten wir dir auch eine Reparatur an, wenn das für dich passt. Normale Abnutzung und Schäden durch unsachgemässe Pflege sind keine Mängel.

### 8. Haftung
Wir haften nach den gesetzlichen Bestimmungen. Für leichte Fahrlässigkeit haften wir nicht, soweit das Gesetz dies zulässt. Die Haftung für absichtlich oder grobfahrlässig verursachte Schäden und für Personenschäden bleibt unberührt.

### 9. Datenschutz
Wie wir deine Daten bearbeiten, steht in unserer Datenschutzerklärung.

### 10. Anwendbares Recht und Gerichtsstand
Es gilt Schweizer Recht unter Ausschluss des Wiener Kaufrechts (CISG). Für Streitigkeiten gelten die gesetzlichen Gerichtsstände. Als Konsumentin oder Konsument kannst du an deinem Wohnsitz oder an unserem Sitz klagen.

### 11. Änderungen
Wir können diese AGB jederzeit ändern. Für deine Bestellung gilt die Version, die zum Zeitpunkt der Bestellung veröffentlicht war.
`,
  ),
  "versand-und-rueckgabe": structure(
    "Versand und Rückgabe",
    `
- **Liefergebiet:** [nur Schweiz]
- **Versand:** gratis, mit der Schweizerischen Post
- **Lieferzeit:** 2 bis 5 Arbeitstage nach Zahlungseingang
- **Rückgabe:** innert {{returnDays}} Tagen ab Erhalt, ungetragen und mit Etiketten
- **Rücksendung:** [gratis / CHF …], [Etikett liegt bei / auf Anfrage]
- **Rückerstattung:** innert [Anzahl] Tagen nach Eingang der Rücksendung, auf das ursprüngliche Zahlungsmittel
- **Umtausch:** andere Grösse [gratis], solange verfügbar
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
Das sind die üblichen Konfektionsgrössen für Anzüge und Westen. Schuhe führen wir in EU-Grössen.
**Kann ich eine andere Grösse tauschen?**
Ja, innert {{returnDays}} Tagen, solange die Grösse verfügbar ist. Schreib uns an {{email}}.

### Lieferung
**Wie lange dauert die Lieferung?**
In der Regel 2 bis 5 Arbeitstage nach Zahlungseingang.
**Was kostet der Versand?**
Innerhalb der Schweiz ist der Versand gratis.
**Liefert ihr ins Ausland?**
Zurzeit liefern wir nur in die Schweiz.

### Rückgabe
**Kann ich etwas zurückgeben?**
Ja. Du kannst Artikel innert {{returnDays}} Tagen ab Erhalt zurückgeben, ungetragen und mit allen Etiketten. Die Details stehen in den AGB.
**Wann bekomme ich mein Geld zurück?**
Innert [Anzahl] Tagen nach Eingang der Rücksendung, auf das ursprüngliche Zahlungsmittel.

### Zahlung
**Wie kann ich bezahlen?**
Mit TWINT, Kredit- oder Debitkarte, Apple Pay, Google Pay oder Klarna.
**Kann ich auf Rechnung bezahlen?**
Mit Klarna kannst du je nach Prüfung durch Klarna später oder in Raten bezahlen. Einen eigenen Kauf auf Rechnung bieten wir nicht an.

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
