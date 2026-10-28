// Ratgeber (Deutsch, massgebend). Die englische Fassung in guides-en.ts hat denselben Aufbau (ein Test prüft das).
// Links im Text: [Beschriftung](/pfad) auf bestehende Seiten (Kollektionen, Anlässe, Grössenberatung, Fragen).
// Keine Angaben zu Lieferanten, Herkunft oder Preisen: Produktdaten stehen im Shop.
import type { GuideSlug } from "./guides-meta";

export type GuideBlock = { type: "paragraph"; text: string } | { type: "bullets"; items: string[] };
export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}
export interface Guide {
  intro: string;
  sections: GuideSection[];
  /** «Kurz gesagt»: drei bis fünf Merksätze. */
  summary: string[];
  faq: { question: string; answer: string }[];
  /** Weiterführende Seiten im Shop: Beschriftung und Pfad ohne Sprachpräfix. */
  related: { label: string; path: string }[];
}

export const guides: Record<GuideSlug, Guide> = {
  "anzug-hochzeit": {
    intro:
      "Eine Hochzeit ist ein Anlass, bei dem du gesehen wirst, aber nicht im Mittelpunkt stehen sollst. Als Gast wählst du einen Anzug, der zum Dresscode, zur Tageszeit und zur Jahreszeit passt. Als Bräutigam trägst du ihn einen ganzen Tag lang, vom Jawort bis zum Tanz. Dieser Ratgeber hilft bei beiden Rollen.",
    sections: [
      {
        heading: "Zuerst den Dresscode klären",
        blocks: [
          {
            type: "paragraph",
            text: "Lies die Einladung genau. Steht dort «festlich» oder «Cocktail», ist ein dunkler Anzug mit Krawatte richtig. «Black Tie» verlangt einen Smoking oder zumindest einen sehr dunklen, schlichten Anzug mit Fliege; mehr dazu findest du unter [Anlass Gala](/kollektion/alle?anlass=gala). Fehlt jede Angabe, orientierst du dich an Ort und Tageszeit: Eine standesamtliche Trauung am Vormittag mit anschliessendem Apéro darf etwas leichter ausfallen als ein Abendfest in einem Hotel.",
          },
          {
            type: "paragraph",
            text: "Im Zweifel gilt: lieber einen Schritt formeller als einen Schritt zu leger. Das Sakko kannst du am Abend ausziehen, eine fehlende Krawatte lässt sich dagegen nicht nachreichen. Wenn du unsicher bist, frag das Brautpaar oder die Trauzeugen.",
          },
        ],
      },
      {
        heading: "Farben nach Jahreszeit",
        blocks: [
          {
            type: "paragraph",
            text: "Die Jahreszeit bestimmt Farbton und Stoffgewicht. Als Faustregel gilt: Je heller und wärmer der Tag, desto heller der Anzug, und je kälter, desto dunkler und dichter.",
          },
          {
            type: "bullets",
            items: [
              "**Frühling und Sommer:** Hellgrau, mittleres Blau oder Sand wirken frisch. Leichtere Stoffe sind bei Wärme angenehmer, besonders bei einer Feier im Freien.",
              "**Herbst:** Anthrazit, Marineblau und gedeckte Erdtöne passen zu Laub und Kerzenlicht. Eine Krawatte in Bordeaux oder Waldgrün setzt einen ruhigen Akzent.",
              "**Winter:** Dunkles Marineblau und Anthrazit sind erste Wahl. Ein Dreiteiler mit Weste hält warm, und darüber trägst du bei Bedarf einen Mantel.",
            ],
          },
          {
            type: "paragraph",
            text: "Meide Weiss und Creme, diese Farben gehören traditionell der Braut. Ein ganz schwarzer Anzug gilt tagsüber vielen als streng; am Abend ist er dagegen stimmig. Marineblau und Anthrazit funktionieren fast immer. Eine Auswahl findest du bei den [Anzügen](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "Als Bräutigam: ein Anzug für den ganzen Tag",
        blocks: [
          {
            type: "paragraph",
            text: "Du sitzt, stehst, umarmst und tanzt in diesem Anzug. Achte deshalb auf Bewegungsfreiheit an Schultern und Armen und auf einen Stoff, der sich nicht schnell zerknittert. Ein Dreiteiler mit [Weste](/kollektion/westen) wirkt festlicher; die Weste kannst du in der Hitze des Abends einfach ablegen. Stimme Farbe und Stil mit der Braut ab, damit ihr auf den Fotos zusammenpasst, ohne identisch zu wirken.",
          },
          {
            type: "paragraph",
            text: "Bestelle den Anzug früh und probiere ihn in Ruhe zu Hause an, mit den Schuhen und dem Hemd, die du tragen willst. So bleibt genug Zeit, falls du eine andere Grösse brauchst. Wie das funktioniert, steht unter [Versand und Rückgabe](/versand-und-rueckgabe). Wie du die richtige Grösse bestimmst, erklärt die [Grössenberatung](/groessenberatung).",
          },
        ],
      },
      {
        heading: "Hemd und Krawatte oder Fliege",
        blocks: [
          {
            type: "paragraph",
            text: "Ein weisses oder hellblaues [Hemd](/kollektion/hemden) mit festem Kragen ist die sichere Wahl. Die Krawatte darf ruhig etwas mehr Farbe zeigen, solange sie zum Anzug passt: Zu Marineblau stehen Bordeaux, Grün oder Silbergrau gut. Eine Fliege wirkt festlicher und passt besonders zum Abend. Ein [Einstecktuch](/kollektion/accessoires) in einem Ton der Krawatte, aber nicht im identischen Muster, rundet das Bild ab.",
          },
        ],
      },
      {
        heading: "Schuhe, Gürtel und Accessoires",
        blocks: [
          {
            type: "paragraph",
            text: "Bei den [Schuhen](/kollektion/schuhe) sind Oxford und Derby aus Glattleder die klassische Wahl. Schwarz passt zu Anthrazit, Grau und abends zu allem Dunklen. Dunkelbraun harmoniert tagsüber mit Marineblau und Mittelgrau, wirkt aber etwas weniger formell. Gürtel und Schuhe sollten im selben Farbton sein, die Socken in der Farbe der Hose oder leicht dunkler, damit beim Sitzen keine nackte Haut aufblitzt.",
          },
          {
            type: "paragraph",
            text: "Bei Uhr, Manschettenknöpfen und Krawattennadel gilt: weniger ist mehr. Ein einziges gut gewähltes Stück genügt. Poliere die Schuhe am Vorabend, bürste den Anzug ab und hänge ihn auf, damit er am Morgen glatt ist.",
          },
        ],
      },
    ],
    summary: [
      "Dresscode und Tageszeit zuerst klären; im Zweifel etwas formeller kleiden.",
      "Marineblau und Anthrazit passen zu jeder Jahreszeit, hellere Töne eher im Sommer.",
      "Weiss und Creme meiden; ganz Schwarz eher für den Abend.",
      "Als Bräutigam früh bestellen, in Ruhe anprobieren und auf Bewegungsfreiheit achten.",
      "Schuhe und Gürtel im gleichen Farbton, Accessoires dezent.",
    ],
    faq: [
      {
        question: "Darf ich als Gast einen schwarzen Anzug tragen?",
        answer:
          "Ja, am Abend ist ein schwarzer Anzug stimmig, vor allem bei festlichem Dresscode. Tagsüber wirkt Marineblau oder Anthrazit meist weicher. Wichtig ist, dass der Anzug schlicht bleibt und du ihn mit einem hellen Hemd und einer Krawatte in Farbe aufhellst.",
      },
      {
        question: "Krawatte oder Fliege zur Hochzeit?",
        answer:
          "Beides ist möglich. Die Krawatte passt zu fast jedem Dresscode. Die Fliege wirkt festlicher und ist bei «Black Tie» die richtige Wahl. Trage sie nur, wenn du dich damit wohlfühlst.",
      },
      {
        question: "Passen braune Schuhe zu einem Marineanzug?",
        answer:
          "Ja, dunkelbraune Schuhe aus Glattleder passen tagsüber gut zu Marineblau und Mittelgrau. Am Abend und bei strengem Dresscode sind schwarze Schuhe die formellere Wahl.",
      },
      {
        question: "Wie früh sollte ich den Hochzeitsanzug bestellen?",
        answer:
          "Plane einige Wochen Puffer vor der Feier ein. So kannst du den Anzug ohne Zeitdruck anprobieren und bei Bedarf eine andere Grösse bestellen.",
      },
    ],
    related: [
      { label: "Anzüge", path: "/kollektion/anzuege" },
      { label: "Anlass Hochzeit", path: "/kollektion/alle?anlass=hochzeit" },
      { label: "Hemden", path: "/kollektion/hemden" },
      { label: "Schuhe", path: "/kollektion/schuhe" },
      { label: "Accessoires", path: "/kollektion/accessoires" },
      { label: "Grössenberatung", path: "/groessenberatung" },
    ],
  },

  "slim-fit-oder-regular-fit": {
    intro:
      "Beim Kauf eines Anzugs fällt die Wahl oft zwischen Slim Fit und Regular Fit. Beide Schnitte sind gut, aber nicht für jeden Körper gleich geeignet. Entscheidend ist, dass der Anzug an den Schultern passt und du dich darin bewegen kannst. Dieser Ratgeber erklärt die Unterschiede und zeigt, woran du erkennst, dass ein Anzug richtig sitzt.",
    sections: [
      {
        heading: "Was Slim Fit und Regular Fit unterscheidet",
        blocks: [
          {
            type: "paragraph",
            text: "Ein Slim Fit ist körpernäher geschnitten: Die Taille ist stärker betont, die Ärmel und Hosenbeine sind schmaler. Ein Regular Fit lässt mehr Raum an Brust, Bauch und Oberschenkeln und fällt gerader. Der Unterschied zeigt sich vor allem im Oberkörper und im Hosenbein, nicht in der Schulter, die in beiden Schnitten gleich gut sitzen muss.",
          },
          {
            type: "paragraph",
            text: "Welche Passform ein Stück hat, steht im Shop bei den Produktdetails unter «Passform». Eine Übersicht findest du bei den [Anzügen](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "Welcher Schnitt passt zu welchem Körperbau?",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Schlanker oder sportlicher Oberkörper:** Slim Fit folgt der Linie und wirkt ohne zusätzlichen Stoff ruhig. Bei sehr schmalem Körperbau verhindert er, dass das Sakko an den Seiten absteht.",
              "**Kräftige Oberschenkel oder Schultern:** Regular Fit lässt mehr Bewegungsraum. Ein zu enger Schnitt zieht Falten quer über Rücken oder Oberschenkel.",
              "**Rundlicher Bauch:** Regular Fit sitzt meist angenehmer. Wichtig ist, dass der Knopf bei stehender Haltung ohne Zug schliesst.",
              "**Viel Bewegung im Alltag:** Wer den Anzug lange trägt, zum Beispiel im Büro oder an einer Feier, fährt mit etwas mehr Raum besser.",
            ],
          },
          {
            type: "paragraph",
            text: "Das ist eine Orientierung, keine Regel. Probiere im Zweifel beide Schnitte an. Die Rückgabe ist dafür da; die Bedingungen stehen unter [Versand und Rückgabe](/versand-und-rueckgabe).",
          },
        ],
      },
      {
        heading: "Die richtige Grösse finden",
        blocks: [
          {
            type: "paragraph",
            text: "Die Grösse kommt vor dem Schnitt. Miss Brustumfang, Taille und Hüfte mit einem Massband über dem Hemd und vergleiche die Werte mit der Tabelle in der [Grössenberatung](/groessenberatung). Liegt dein Brustumfang zwischen zwei Grössen, nimm die grössere, wenn du den Anzug über einem Hemd und gelegentlich über einem dünnen Strickpullover trägst, und die kleinere, wenn du einen sehr körpernahen Look willst.",
          },
          {
            type: "paragraph",
            text: "Sakko und Hose müssen nicht dieselbe Grösse haben. Wo Anzüge als Set verkauft werden, prüfe bei den Produktdetails, welche Grössen verfügbar sind, und lies die Hinweise zur Passform. Bei einer Kombination aus [Sakko](/kollektion/sakkos) und [Hose](/kollektion/hosen) wählst du beide Teile einzeln.",
          },
        ],
      },
      {
        heading: "Woran du erkennst, dass ein Anzug richtig sitzt",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Schultern:** Die Naht liegt genau am Schulterknochen. Steht sie ab oder rutscht sie über die Schulter, ist das Sakko zu gross oder zu klein.",
              "**Brust und Knopf:** Der geschlossene Knopf zieht keine X-förmigen Falten. Du kannst die Hand flach zwischen Sakko und Hemd legen.",
              "**Kragen:** Der Sakkokragen liegt am Hemdkragen an, ohne abzustehen.",
              "**Ärmel:** Das Sakko endet etwa am Handgelenk, sodass ein bis eineinhalb Zentimeter vom Hemdsärmel sichtbar sind.",
              "**Länge:** Das Sakko bedeckt in der Regel das Gesäss. Hängen die Arme locker, liegen die Fingerspitzen etwa am unteren Saum.",
              "**Hose:** Der Bund sitzt ohne Gürtelzwang auf der Taille, im Sitzen drückt nichts, und der Stoff fällt gerade ohne Querfalten.",
            ],
          },
          {
            type: "paragraph",
            text: "Bewege dich beim Anprobieren: Arme heben, nach vorn greifen, hinsetzen. Ein guter Anzug schränkt dich dabei nicht ein.",
          },
        ],
      },
      {
        heading: "Zwischen zwei Schnitten: so entscheidest du",
        blocks: [
          {
            type: "paragraph",
            text: "Frage dich, wo du den Anzug trägst. Für lange Tage im Büro lohnt sich ein Schnitt mit etwas Bewegungsraum. Für Abende und kürzere Anlässe darf es körpernäher sein. Passt dir der Slim Fit an Schultern und Brust, aber nicht an den Oberschenkeln, ist der Regular Fit für die Hose oft die bessere Lösung. Wichtig ist am Ende nicht das Etikett, sondern wie du dich im Spiegel und in der Bewegung fühlst.",
          },
        ],
      },
    ],
    summary: [
      "Slim Fit liegt körpernah an, Regular Fit gibt mehr Raum an Brust, Bauch und Oberschenkeln.",
      "Zuerst die Grösse bestimmen, dann den Schnitt wählen.",
      "Schulternaht, Kragen, Ärmellänge und Knopf zeigen, ob das Sakko sitzt.",
      "Beim Anprobieren bewegen: Arme heben, hinsetzen, nach vorn greifen.",
      "Im Zweifel beide Schnitte anprobieren und den bequemeren behalten.",
    ],
    faq: [
      {
        question: "Ist Slim Fit nur etwas für schlanke Männer?",
        answer:
          "Nicht ausschliesslich, aber er braucht Platz an Brust und Oberschenkeln, den ein kräftiger Körperbau oft nicht lässt. Entscheidend ist, dass Schultern und Knopf ohne Zug sitzen. Ist das nicht der Fall, ist der Regular Fit die bessere Wahl.",
      },
      {
        question: "Welche Grösse nehme ich, wenn ich zwischen zwei liege?",
        answer:
          "Orientiere dich am Brustumfang und an den Schultern, denn beides lässt sich nicht kaschieren. Willst du den Anzug auch über einem Pullover tragen, nimm die grössere Grösse. Die Tabelle in der Grössenberatung hilft beim Vergleich.",
      },
      {
        question: "Wie lang soll die Anzughose sein?",
        answer:
          "Die Hose soll vorn leicht auf dem Schuh aufliegen oder knapp darüber enden, ohne sich zu stauchen. Prüfe die Produktdetails und die Grössentabelle und trage beim Anprobieren die Schuhe, die du zum Anzug tragen willst.",
      },
      {
        question: "Kann ich einen Anzug zurückgeben, wenn er nicht sitzt?",
        answer:
          "Ja, innerhalb der Rückgabefrist. Die Bedingungen stehen unter «Versand und Rückgabe». Probiere den Anzug dafür möglichst bald nach Erhalt an.",
      },
    ],
    related: [
      { label: "Anzüge", path: "/kollektion/anzuege" },
      { label: "Sakkos", path: "/kollektion/sakkos" },
      { label: "Hosen", path: "/kollektion/hosen" },
      { label: "Grössenberatung", path: "/groessenberatung" },
      { label: "Häufige Fragen", path: "/haeufige-fragen" },
    ],
  },

  "business-dresscode-schweiz": {
    intro:
      "Wie man sich im Büro kleidet, hängt in der Schweiz stark von Branche, Unternehmen und Kundenkontakt ab. In einer Bank oder Kanzlei gelten andere Regeln als in einer Agentur oder einem Technologieunternehmen. Dieser Ratgeber erklärt die beiden gängigen Stufen, Business formal und Business casual, und zeigt, wie du Farben, Hemden und Krawatten kombinierst.",
    sections: [
      {
        heading: "Business formal: der klassische Auftritt",
        blocks: [
          {
            type: "paragraph",
            text: "Business formal bedeutet Anzug aus einem Stoff, Hemd mit festem Kragen, Krawatte und geschlossene Lederschuhe. Das ist der Standard bei Kundenbesuchen in Banken, Versicherungen, Beratungen und Kanzleien, bei Verhandlungen und bei Vorstellungsgesprächen in konservativen Branchen. Die Farben sind ruhig: Marineblau, Anthrazit und Mittelgrau. Als Muster passen feine Nadelstreifen oder ein dezentes Fischgrat, solange sie nicht dominieren.",
          },
          {
            type: "paragraph",
            text: "Beim Hemd ist Weiss die sicherste Wahl, Hellblau die zweite. Wähle die Krawatte etwas dunkler als das Hemd. Die Schuhe sind schwarz zu Anthrazit und Grau, dunkelbraun zu Marineblau; der Gürtel entspricht den Schuhen. Eine Auswahl findest du unter [Anlass Business](/kollektion/alle?anlass=business).",
          },
        ],
      },
      {
        heading: "Business casual: lockerer, aber gepflegt",
        blocks: [
          {
            type: "paragraph",
            text: "Business casual verzichtet auf mindestens ein Element des formellen Auftritts. Das kann das Sakko in einer anderen Farbe als die Hose sein, das Hemd ohne Krawatte oder ein feiner Pullover anstelle des Sakkos. Wichtig bleibt, dass alles sauber, gebügelt und passend geschnitten ist. Jeans ohne Risse in dunklem Blau sind je nach Firma möglich, Turnschuhe nur, wenn die Unternehmenskultur es klar zulässt.",
          },
          {
            type: "bullets",
            items: [
              "**Sakko und Hose einzeln:** Ein [Sakko](/kollektion/sakkos) in Marineblau passt zu grauer oder beiger [Hose](/kollektion/hosen).",
              "**Hemd ohne Krawatte:** Der oberste Knopf bleibt offen, der Kragen steht stabil und fällt nicht ein.",
              "**Strick statt Sakko:** Ein dünner Pullover im V-Ausschnitt über dem Hemd wirkt ordentlich; mehr dazu bei [Strick](/kollektion/strick).",
              "**Schuhe:** Derby oder Loafer aus Leder statt Sportschuhe.",
            ],
          },
        ],
      },
      {
        heading: "Wie du dich für die Stufe entscheidest",
        blocks: [
          {
            type: "paragraph",
            text: "Beobachte, was Kolleginnen und Kollegen tragen, und schau, was in Stelleninseraten oder auf der Firmenwebsite zu sehen ist. Für ein Vorstellungsgespräch gilt: eine Stufe formeller als das, was im Alltag üblich ist. Wer in einem Betrieb ohne Krawatte arbeitet, erscheint trotzdem im Gespräch mit Sakko und gepflegtem Hemd. Kundenbesuche richten sich nach dem Kunden: Im Zweifel formell erscheinen und das Sakko bei Bedarf über den Stuhl hängen.",
          },
        ],
      },
      {
        heading: "Farben und Kombinationen",
        blocks: [
          {
            type: "paragraph",
            text: "Marineblau ist der vielseitigste Büroton und lässt sich mit Weiss, Hellblau und feinen Streifen kombinieren. Anthrazit wirkt etwas strenger und eignet sich für wichtige Gespräche. Mittelgrau ist leichter und im Sommer angenehm. Braun- und Olivtöne gehören eher zu Business casual.",
          },
          {
            type: "bullets",
            items: [
              "**Weisses Hemd:** passt zu jeder Anzugfarbe, mit Krawatte in Bordeaux, Marineblau oder dezent gemustert.",
              "**Hellblaues Hemd:** wirkt zu Anthrazit und Marineblau frisch; die Krawatte darf dunkel und einfarbig sein.",
              "**Gestreiftes Hemd:** nur mit einfarbiger oder fein gemusterter Krawatte, nie mit gleich breiten Streifen.",
              "**Gemusterter Anzug:** Hemd und Krawatte schlicht halten.",
            ],
          },
          {
            type: "paragraph",
            text: "Die Grundregel lautet: Nur ein Element im Outfit darf auffallen. Mehr zu [Hemden](/kollektion/hemden) und [Accessoires](/kollektion/accessoires) wie Krawatten und Gürteln findest du in den Kollektionen.",
          },
        ],
      },
      {
        heading: "Kleine Details, die den Unterschied machen",
        blocks: [
          {
            type: "paragraph",
            text: "Gepflegte Schuhe, ein gebügeltes Hemd und ein sauber sitzender Anzug wirken mehr als ein teures Stück. Die Krawatte reicht bis zum Gürtel. Socken sind in der Farbe der Hose und lang genug, dass beim Sitzen keine Haut zu sehen ist. Das Sakko wird im Stehen geschlossen, im Sitzen geöffnet; bei einem Zweiknopf-Sakko bleibt der untere Knopf immer offen. Wie ein Anzug sitzen soll, erklärt der Ratgeber [Slim Fit oder Regular Fit](/ratgeber/slim-fit-oder-regular-fit).",
          },
        ],
      },
    ],
    summary: [
      "Business formal: Anzug, Hemd mit Krawatte, schwarze oder dunkelbraune Lederschuhe.",
      "Business casual: ein Element weglassen, aber gepflegt und passend bleiben.",
      "Marineblau, Anthrazit und Mittelgrau sind die sichersten Büro-Farben.",
      "Für Vorstellungsgespräche eine Stufe formeller kleiden als im Alltag üblich.",
      "Nur ein Element im Outfit darf auffallen.",
    ],
    faq: [
      {
        question: "Muss ich im Büro immer eine Krawatte tragen?",
        answer:
          "Nein. In vielen Betrieben ist die Krawatte nur bei Kundenbesuchen oder besonderen Anlässen üblich. Beobachte, was im Team getragen wird, und halte für wichtige Gespräche eine Krawatte bereit.",
      },
      {
        question: "Welche Farbe eignet sich für den ersten Büroanzug?",
        answer:
          "Marineblau ist am vielseitigsten, weil es zu Weiss, Hellblau und fast allen Krawatten passt. Anthrazit ist die formellere Alternative.",
      },
      {
        question: "Darf ich im Büro Sneaker zum Sakko tragen?",
        answer:
          "Das hängt von der Firmenkultur ab. In kreativen Berufen ist es oft üblich, in Banken und Kanzleien eher nicht. Schlichte Sneaker in dunklem Leder wirken noch am ehesten ordentlich.",
      },
      {
        question: "Schwarzer Anzug im Büro: ja oder nein?",
        answer:
          "Ein schwarzer Anzug gilt vielen als Abendkleidung. Im Büro sind Marineblau, Anthrazit und Mittelgrau passender und lassen sich besser kombinieren.",
      },
    ],
    related: [
      { label: "Anlass Business", path: "/kollektion/alle?anlass=business" },
      { label: "Anzüge", path: "/kollektion/anzuege" },
      { label: "Hemden", path: "/kollektion/hemden" },
      { label: "Accessoires", path: "/kollektion/accessoires" },
      { label: "Schuhe", path: "/kollektion/schuhe" },
    ],
  },

  "abschlussfeier-outfit": {
    intro:
      "Ob Matura am Gymnasium, Diplomfeier an der Fachhochschule oder Abschluss einer Lehre: Die Feier ist ein Moment, an dem Familie, Freunde und Lehrpersonen zusammenkommen und Fotos entstehen. Das Outfit darf festlich sein, ohne verkleidet zu wirken. Dieser Ratgeber zeigt, was je nach Rahmen passt.",
    sections: [
      {
        heading: "Den Rahmen einschätzen",
        blocks: [
          {
            type: "paragraph",
            text: "Schau, was die Schule oder Hochschule mitteilt. Eine förmliche Zeremonie in der Aula mit Reden und Zeugnisübergabe verlangt mehr als ein Apéro im Garten. Gibt es keinen Hinweis, ist ein Anzug oder eine gut gewählte Kombination aus Sakko und Hose die sichere Wahl. Es ist besser, ein wenig zu elegant zu erscheinen, als im Freizeitlook zwischen Eltern und Gästen aufzufallen.",
          },
          {
            type: "paragraph",
            text: "Viele Feiern bestehen aus mehreren Teilen: der Zeremonie am Nachmittag, einem Essen mit der Familie und einer Party am Abend. Plane ein Outfit, das alle drei übersteht, und nimm bei Bedarf ein zweites Hemd oder andere Schuhe mit. Eine Übersicht findest du unter [Anlass Abschlussfeier](/kollektion/alle?anlass=abschlussfeier).",
          },
        ],
      },
      {
        heading: "Der Anzug: sicher und vielseitig",
        blocks: [
          {
            type: "paragraph",
            text: "Ein Anzug in Marineblau oder Anthrazit passt zu fast jedem Rahmen und lässt sich später im Berufsleben weiterverwenden: beim ersten Vorstellungsgespräch, im Büro oder an einer Hochzeit. Das macht ihn zu einer Anschaffung, die über den Tag hinaus nützlich ist. Welcher Schnitt dir liegt, erklärt der Ratgeber [Slim Fit oder Regular Fit](/ratgeber/slim-fit-oder-regular-fit). Passende Modelle findest du bei den [Anzügen](/kollektion/anzuege).",
          },
          {
            type: "paragraph",
            text: "Dazu gehört ein weisses oder hellblaues [Hemd](/kollektion/hemden), eine Krawatte in einer ruhigen Farbe und dunkle Lederschuhe. Eine Krawatte ist kein Muss, wenn der Rahmen locker ist; ein offener Kragen mit gepflegtem Hemd wirkt ebenso ordentlich.",
          },
        ],
      },
      {
        heading: "Die Kombination: locker, aber gepflegt",
        blocks: [
          {
            type: "paragraph",
            text: "Wenn ein Anzug zu förmlich scheint, ist eine Kombination eine gute Alternative. Ein Sakko in Marineblau passt zu einer grauen oder beigen [Hose](/kollektion/hosen). Dazu ein Hemd oder ein feines Polohemd, je nach Rahmen. So wirkst du festlich und bleibst beweglich, auch wenn der Tag lang wird. Achte darauf, dass die Teile bewusst zusammengehören und nicht nach einem zufällig zusammengestellten Outfit aussehen: Ist die Hose farblich fast gleich wie das Sakko, wirkt es wie ein misslungener Anzug. Wähle die Teile entweder gleich oder klar verschieden.",
          },
        ],
      },
      {
        heading: "Farben, Hemd und Schuhe",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Farben:** Marineblau, Anthrazit und Mittelgrau sind sicher. Im Sommer wirken hellere Töne frisch, im Winter dunkle.",
              "**Hemd:** Weiss oder Hellblau, gebügelt und im richtigen Kragenmass.",
              "**Schuhe:** Oxford oder Derby aus Leder, geputzt. Sneaker passen nur zu einer sehr lockeren Feier und dann in Leder, ohne auffällige Farben.",
              "**Accessoires:** Ein Einstecktuch oder eine Krawatte in einer Farbe, die dir gefällt, bringt Persönlichkeit ins Bild.",
            ],
          },
          {
            type: "paragraph",
            text: "Muster und Farben sind erlaubt, wenn nur ein Teil davon auffällt. Mehr Auswahl bieten [Schuhe](/kollektion/schuhe) und [Accessoires](/kollektion/accessoires).",
          },
        ],
      },
      {
        heading: "Praktisch denken",
        blocks: [
          {
            type: "paragraph",
            text: "Bestelle das Outfit einige Wochen vor der Feier und probiere es mit den Schuhen an, die du tragen willst. Ist etwas nicht richtig, bleibt so Zeit zum Umtauschen; die Bedingungen stehen unter [Versand und Rückgabe](/versand-und-rueckgabe). Die richtige Grösse findest du mit der [Grössenberatung](/groessenberatung). Trage die Schuhe vor der Feier ein paar Stunden ein, damit sie nicht drücken, und häng den Anzug am Vorabend auf, damit sich Falten ausgleichen. Wie du ihn danach pflegst, steht im Ratgeber [Anzug pflegen](/ratgeber/anzug-pflegen).",
          },
        ],
      },
    ],
    summary: [
      "Rahmen und Hinweise der Schule oder Hochschule beachten; im Zweifel etwas eleganter erscheinen.",
      "Ein Anzug in Marineblau oder Anthrazit ist sicher und später weiter nutzbar.",
      "Eine Kombination aus Sakko und Hose ist die lockere Alternative.",
      "Hemd gebügelt, Schuhe geputzt, Accessoires dezent.",
      "Das Outfit früh bestellen und in Ruhe anprobieren.",
    ],
    faq: [
      {
        question: "Muss ich zur Matura einen Anzug tragen?",
        answer:
          "Pflicht ist es nicht, aber es ist weit verbreitet und eine sichere Wahl. Eine Kombination aus Sakko, Hose und Hemd wirkt ebenfalls festlich. Frag im Zweifel bei der Schule nach, ob ein Dresscode gilt.",
      },
      {
        question: "Krawatte ja oder nein?",
        answer:
          "Bei einer förmlichen Zeremonie ist die Krawatte passend. Bei einer lockeren Feier genügt ein gepflegtes Hemd mit offenem Kragen. Eine Krawatte kannst du jederzeit einstecken und bei Bedarf umbinden.",
      },
      {
        question: "Welche Farbe ist am besten?",
        answer:
          "Marineblau und Anthrazit sind am vielseitigsten. Sie wirken auf Fotos ruhig und lassen sich später im Berufsleben weiter tragen. Im Sommer passt auch Mittelgrau oder ein helleres Blau.",
      },
      {
        question: "Kann ich zu Hause anprobieren und zurückgeben?",
        answer:
          "Ja, innerhalb der Rückgabefrist. Die Bedingungen findest du unter «Versand und Rückgabe». Bestelle das Outfit deshalb nicht erst in letzter Minute.",
      },
    ],
    related: [
      { label: "Anlass Abschlussfeier", path: "/kollektion/alle?anlass=abschlussfeier" },
      { label: "Anzüge", path: "/kollektion/anzuege" },
      { label: "Sakkos", path: "/kollektion/sakkos" },
      { label: "Hemden", path: "/kollektion/hemden" },
      { label: "Schuhe", path: "/kollektion/schuhe" },
      { label: "Grössenberatung", path: "/groessenberatung" },
    ],
  },

  "anzug-pflegen": {
    intro:
      "Ein Anzug hält Jahre, wenn du ihn richtig behandelst. Die meiste Pflege kostet wenig Aufwand: lüften, bürsten und auf einem guten Bügel aufhängen. Die Reinigung ist dagegen die Ausnahme, nicht die Regel. Dieser Ratgeber zeigt, wie du vorgehst. Die Pflegehinweise im Etikett und in den Produktdetails gehen immer vor.",
    sections: [
      {
        heading: "Nach dem Tragen: lüften",
        blocks: [
          {
            type: "paragraph",
            text: "Hänge den Anzug nach jedem Tragen auf einen Bügel und lass ihn einige Stunden an der frischen Luft hängen, am besten in einem gut belüfteten Raum, nicht in direkter Sonne. Wolle nimmt Gerüche und Feuchtigkeit auf und gibt sie beim Lüften wieder ab. Leere die Taschen, damit sie sich nicht ausbeulen, und öffne Knöpfe und Reissverschlüsse.",
          },
          {
            type: "paragraph",
            text: "Trage denselben Anzug nicht an zwei Tagen hintereinander. Zwischen zwei Einsätzen braucht der Stoff Zeit, sich zu erholen und die Form wiederzufinden. Wer im Büro regelmässig Anzug trägt, hat deshalb am besten mindestens zwei zum Wechseln.",
          },
        ],
      },
      {
        heading: "Bürsten statt waschen",
        blocks: [
          {
            type: "paragraph",
            text: "Mit einer weichen Kleiderbürste entfernst du Staub und Fusseln. Bürste in Richtung des Gewebes, von oben nach unten, und achte auf Kragen, Schultern und Taschenklappen. Das dauert eine Minute und hält den Stoff sauber, ohne ihn zu belasten. Bei dunklen Anzügen siehst du den Unterschied sofort.",
          },
        ],
      },
      {
        heading: "Aufhängen und aufbewahren",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Bügel:** Nimm einen breiten, geformten Holzbügel, der die Schultern stützt. Dünne Drahtbügel drücken Dellen in den Stoff.",
              "**Hose:** Hänge sie an einem Hosenbügel an der Bügelfalte auf, damit diese erhalten bleibt.",
              "**Kleidersack:** Lagere den Anzug in einem atmungsaktiven Kleidersack aus Baumwolle oder Vlies. Plastikhüllen halten Feuchtigkeit fest.",
              "**Platz:** Gib dem Anzug Raum im Schrank, damit er nicht gequetscht wird.",
              "**Motten:** Wollsachen sind für Motten attraktiv. Zedernholz oder Lavendel im Schrank helfen, ersetzen aber nicht die saubere Lagerung. Reinige den Anzug vor längerem Wegpacken.",
            ],
          },
        ],
      },
      {
        heading: "Falten und Flecken",
        blocks: [
          {
            type: "paragraph",
            text: "Leichte Falten verschwinden oft von selbst, wenn du den Anzug im Badezimmer aufhängst, während du warm duschst; der Dampf entspannt die Fasern. Zum Bügeln stellst du eine niedrige bis mittlere Temperatur ein und legst ein feuchtes Tuch zwischen Bügeleisen und Stoff, damit keine glänzenden Stellen entstehen.",
          },
          {
            type: "paragraph",
            text: "Flecken tupfst du so schnell wie möglich mit einem sauberen, leicht feuchten Tuch von aussen nach innen ab. Reibe nicht, denn das drückt den Fleck tiefer ins Gewebe. Bei Fett, Wein oder Kaffee hilft es, den Fleck vorsichtig aufzusaugen und den Anzug rasch zur Reinigung zu bringen, statt selbst mit Mitteln zu experimentieren.",
          },
        ],
      },
      {
        heading: "Wann die Reinigung sinnvoll ist",
        blocks: [
          {
            type: "paragraph",
            text: "Reinige einen Anzug nur, wenn es nötig ist: bei sichtbaren Flecken, Geruch, der sich nicht auslüften lässt, oder vor der Lagerung über den Sommer. Jede Reinigung belastet das Gewebe. Als Faustregel reichen für einen regelmässig getragenen Anzug ein bis zwei Reinigungen pro Jahr. Gib ihn in eine Reinigung, die mit Wollstoffen vertraut ist, und lass Sakko und Hose gemeinsam reinigen, damit die Farbe gleich bleibt.",
          },
          {
            type: "paragraph",
            text: "Die Pflegesymbole im Etikett zeigen, was erlaubt ist. Weitere Antworten stehen unter [Häufige Fragen](/haeufige-fragen) im Abschnitt Pflege. Zum Wechseln gehören auch mehrere [Hemden](/kollektion/hemden) und eine Auswahl an [Anzügen](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "Schuhe und Zubehör nicht vergessen",
        blocks: [
          {
            type: "paragraph",
            text: "Auch [Schuhe](/kollektion/schuhe) halten länger mit Pflege: Schuhspanner aus Holz bewahren die Form, Leder wird regelmässig gebürstet und mit Creme genährt. Krawatten hängst du nach dem Tragen aufgeknotet auf oder rollst sie locker ein. Mehr zum Zusammenspiel von Anzug und Zubehör findest du unter [Business-Dresscode in der Schweiz](/ratgeber/business-dresscode-schweiz).",
          },
        ],
      },
    ],
    summary: [
      "Nach jedem Tragen lüften und auf einen breiten Bügel hängen.",
      "Regelmässig bürsten; das schont den Stoff mehr als jede Reinigung.",
      "Den Anzug nicht zwei Tage hintereinander tragen.",
      "Nur reinigen, wenn es nötig ist, etwa ein- bis zweimal pro Jahr.",
      "Atmungsaktiven Kleidersack statt Plastik verwenden.",
    ],
    faq: [
      {
        question: "Wie oft sollte ich einen Anzug reinigen lassen?",
        answer:
          "So selten wie möglich, bei regelmässigem Tragen ein- bis zweimal im Jahr oder bei sichtbaren Flecken. Lüften und Bürsten halten ihn zwischendurch frisch.",
      },
      {
        question: "Kann ich einen Anzug in die Waschmaschine geben?",
        answer:
          "In der Regel nicht. Prüfe das Pflegeetikett: Die meisten Anzüge aus Wolle sind für die chemische Reinigung vorgesehen. Wasche sie nicht auf eigene Faust.",
      },
      {
        question: "Wie entferne ich Falten ohne Bügeleisen?",
        answer:
          "Hänge den Anzug an einen Ort mit warmem Dampf, zum Beispiel ins Badezimmer. Ein Dampfglätter eignet sich ebenfalls, wenn du Abstand zum Stoff hältst.",
      },
      {
        question: "Wie bewahre ich einen Anzug im Sommer auf?",
        answer:
          "Reinige ihn vorher, hänge ihn auf einen breiten Bügel und verwende einen atmungsaktiven Kleidersack. Lagere ihn trocken und nicht in direkter Sonne.",
      },
    ],
    related: [
      { label: "Anzüge", path: "/kollektion/anzuege" },
      { label: "Hemden", path: "/kollektion/hemden" },
      { label: "Schuhe", path: "/kollektion/schuhe" },
      { label: "Häufige Fragen", path: "/haeufige-fragen" },
    ],
  },
  "stoffe-und-qualitaet": {
    intro:
      "Hinter «Schurwolle», «Super 120’s» oder «Baumwoll-Popeline» steckt mehr, als die Etikette auf den ersten Blick verrät. Wer die wichtigsten Begriffe kennt, liest die Materialangabe eines Stücks wie eine Zutatenliste: Sie sagt, wie sich der Stoff trägt, wann er passt und wie du ihn pflegst. Dieser Ratgeber erklärt die gängigen Stoffe sachlich und ohne Versprechen, die kein Etikett halten kann.",
    sections: [
      {
        heading: "Schurwolle und Merino",
        blocks: [
          {
            type: "paragraph",
            text: "Schurwolle ist Wolle von lebenden Schafen, die zum ersten Mal verarbeitet wird. Sie ist der klassische Anzugstoff, weil sie Feuchtigkeit aufnimmt und wieder abgibt, Wärme reguliert und nach dem Tragen von selbst aus der Falte fällt. Merinowolle stammt von der Merinorasse und hat besonders feine, weiche Fasern. Deshalb kratzt sie weniger und eignet sich auch für Strick auf der Haut.",
          },
          {
            type: "paragraph",
            text: "Steht auf dem Etikett nur «Wolle» oder «Schurwolle» ohne Zusatz, ist das kein Mangel. Entscheidend sind Faserfeinheit, Garn, Gewebe und Verarbeitung zusammen, nicht ein einzelner Begriff.",
          },
        ],
      },
      {
        heading: "Super 100’s bis 150’s: was die Zahl wirklich sagt",
        blocks: [
          {
            type: "paragraph",
            text: "Die Super-Zahl beschreibt die Feinheit der Wollfaser: Je höher die Zahl, desto dünner ist die Faser im Durchschnitt. Grob gerechnet liegt Super 100’s bei etwa 18,5 und Super 150’s bei etwa 16 Mikrometern, einem Mikrometer entspricht ein Tausendstel Millimeter.",
          },
          {
            type: "paragraph",
            text: "Feinere Fasern machen den Stoff weicher und geschmeidiger, oft auch mit einem leichten Glanz. Sie sind aber nicht automatisch besser. Sehr feine Gewebe scheuern schneller durch und knittern leichter, ein etwas gröberer Stoff ist dafür oft robuster und für den täglichen Einsatz im Büro die vernünftigere Wahl. Die Zahl sagt nichts darüber, wie gut ein Stoff gewebt, ausgerüstet und verarbeitet ist. Sie ist eine Angabe zur Faser, kein Qualitätsversprechen.",
          },
        ],
      },
      {
        heading: "Tuchgewicht und Jahreszeit",
        blocks: [
          {
            type: "paragraph",
            text: "Das Tuchgewicht, auch Grammatur genannt, wird in Gramm pro Quadratmeter angegeben. Es verrät, wie dicht und schwer ein Stoff ist. Als grobe Richtwerte, die sich je nach Messung unterscheiden, gilt:",
          },
          {
            type: "bullets",
            items: [
              "**Leicht (unter etwa 250 g/m²):** luftig und für warme Tage gedacht, fällt weich, knittert aber schneller.",
              "**Mittel (etwa 250 bis 320 g/m²):** der Allrounder für die meisten Monate im Jahr und für Büro und Feier gleichermassen.",
              "**Schwer (über etwa 320 g/m²):** warm, stabil im Fall und für Herbst und Winter.",
            ],
          },
          {
            type: "paragraph",
            text: "Ein leichter Stoff ist nicht zwingend kühler: Auch die Bindung und die Faser bestimmen, wie viel Luft durchkommt. Wer nur einen Anzug für das ganze Jahr sucht, fährt mit einem mittleren Gewicht in Marineblau oder Anthrazit am besten. Eine Auswahl findest du bei den [Anzügen](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "Leinen und Baumwolle",
        blocks: [
          {
            type: "paragraph",
            text: "Leinen wird aus Flachs gewonnen. Es ist luftig, nimmt Feuchtigkeit gut auf und fühlt sich bei Hitze kühl an. Es knittert, und das gehört zu seinem Charakter. Mischungen mit Wolle oder Baumwolle behalten die Frische, fallen aber ruhiger.",
          },
          {
            type: "paragraph",
            text: "Bei Baumwolle zählt vor allem die Webart, die bei [Hemden](/kollektion/hemden) den Ton angibt:",
          },
          {
            type: "bullets",
            items: [
              "**Popeline:** dicht und glatt gewebt, leicht glänzend und fein. Der Klassiker fürs Businesshemd.",
              "**Oxford:** gröbere Struktur mit sichtbarer Körnung, robust und etwas lässiger. Typisch für Hemden mit Button-down-Kragen.",
              "**Twill:** diagonale Rippe, weicher Fall und weniger Knitter. Häufig bei Hosen und Hemden.",
            ],
          },
        ],
      },
      {
        heading: "Kaschmir",
        blocks: [
          {
            type: "paragraph",
            text: "Kaschmir ist das feine Unterhaar der Kaschmirziege. Der Stoff ist sehr weich und wärmt bei geringem Gewicht, besonders im [Strick](/kollektion/strick). Er ist aber empfindlicher gegen Abrieb und bildet an stark beanspruchten Stellen leichter Knötchen. Mischungen mit einem Anteil Kaschmir geben Wolle zusätzliche Weichheit und bleiben dabei strapazierfähiger als reines Kaschmir. Behandle Kaschmir schonend, trage ihn nicht jeden Tag und lass ihn zwischen den Einsätzen ruhen.",
          },
        ],
      },
      {
        heading: "Futter: ganz, halb oder ungefüttert",
        blocks: [
          {
            type: "paragraph",
            text: "Das Futter im Inneren eines Sakkos beeinflusst Tragekomfort und Fall. Ein vollständig gefüttertes Sakko gleitet leicht über das Hemd, hält die Form und wärmt etwas mehr. Bei halb gefütterten Sakkos deckt das Futter nur einen Teil des Rückens ab, das Sakko wird leichter und luftiger. Ungefütterte Modelle sind am leichtesten, haben aber weniger Struktur.",
          },
          {
            type: "paragraph",
            text: "Als Futtermaterial begegnen dir oft Cupro und Viskose. Beide werden aus Zellulose gewonnen und gelten als angenehm atmungsaktiv.",
          },
        ],
      },
      {
        heading: "Pflege nach Stoff",
        blocks: [
          {
            type: "paragraph",
            text: "Wolle lüftest und bürstest du, Leinen und Baumwolle lassen sich je nach Etikett einfacher waschen, Kaschmir braucht besondere Rücksicht. Die Pflegesymbole auf dem Etikett und die Angaben bei den Produktdetails gehen immer vor. Die Handgriffe für Anzüge findest du im Ratgeber [Anzug pflegen](/ratgeber/anzug-pflegen), weitere Antworten unter [Häufige Fragen](/haeufige-fragen).",
          },
        ],
      },
    ],
    summary: [
      "Die Super-Zahl beschreibt die Faserfeinheit der Wolle, nicht die Qualität des fertigen Stoffs.",
      "Das Tuchgewicht bestimmt die Jahreszeit: leicht für Wärme, mittel fürs ganze Jahr, schwer für den Winter.",
      "Leinen knittert von Natur aus, Popeline ist glatt, Oxford robust, Twill weich fallend.",
      "Kaschmir ist weich und empfindlich; Mischungen mit Wolle sind strapazierfähiger.",
      "Halb gefütterte Sakkos sind leichter und luftiger als voll gefütterte.",
    ],
    faq: [
      {
        question: "Ist Super 150’s besser als Super 110’s?",
        answer:
          "Nicht automatisch. Die Zahl sagt, wie fein die Wollfaser ist. Feinere Stoffe fühlen sich weicher an, sind aber oft empfindlicher. Für den Alltag zählt auch, wie der Stoff gewebt und verarbeitet ist.",
      },
      {
        question: "Welches Tuchgewicht passt für ein ganzes Jahr?",
        answer:
          "Ein mittleres Gewicht von ungefähr 250 bis 320 Gramm pro Quadratmeter ist der übliche Kompromiss. Es ist im Sommer nicht zu warm und im Winter mit einem Mantel gut tragbar.",
      },
      {
        question: "Was ist der Unterschied zwischen Popeline und Oxford?",
        answer:
          "Popeline ist dicht, glatt und fein, Oxford hat eine gröbere, sichtbare Struktur und wirkt lässiger. Beide bestehen aus Baumwolle, nur die Webart unterscheidet sich.",
      },
      {
        question: "Warum bildet Kaschmir Knötchen?",
        answer:
          "Die feinen, kurzen Fasern verhaken sich an Reibungsstellen und bilden kleine Knötchen. Das ist normal. Mit einem Kamm für Strick lassen sie sich vorsichtig entfernen.",
      },
    ],
    related: [
      { label: "Anzüge", path: "/kollektion/anzuege" },
      { label: "Hemden", path: "/kollektion/hemden" },
      { label: "Strick", path: "/kollektion/strick" },
      { label: "Anzug pflegen", path: "/ratgeber/anzug-pflegen" },
    ],
  },
};
