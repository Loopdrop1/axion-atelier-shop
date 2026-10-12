// Kurzanleitung fürs Admin: Produkte erfassen und die häufigsten Abläufe.
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/hilfe")({
  component: HelpPage,
});

function HelpPage() {
  return (
    <>
      <PageHeader
        title="Anleitung"
        description="Die wichtigsten Abläufe in Kürze. Fragen jederzeit im AXION CHAT auf WhatsApp oder über das Flowrenix-Onboarding-Portal."
      />
      <Panel title="Produkt erfassen">
        <ol className="admin-steps">
          <li>
            <Link to="/admin/produkte/$id" params={{ id: "neu" }} className="admin-link">
              Neues Produkt
            </Link>{" "}
            öffnen. Ein Produkt ist ein Modell in einer Farbe mit allen Grössen.
          </li>
          <li>
            Titel, Farbname, Kategorie und Preis in Franken (inkl. MWST) eintragen. Status zuerst
            «Entwurf» lassen, dann «Produkt anlegen».
          </li>
          <li>
            Texte auf Deutsch ergänzen: Beschreibung in zwei bis vier Sätzen, Material in Prozent,
            Pflege, Hinweis zur Passform. Die englischen Felder füllt das Admin beim Speichern
            automatisch aus und übersetzt sie neu, wenn sich das Deutsch ändert. Kurz prüfen, bei
            Bedarf anpassen: Englisch, das ihr selbst schreibt oder ändert, bleibt immer stehen;
            ändert sich danach das Deutsch, erscheint der Hinweis «bitte prüfen». Soll das Admin ein
            Feld wieder selbst übersetzen, das englische Feld leeren und speichern.
          </li>
          <li>
            Unter «Grössen und Bestand» jede Grösse mit Anfangsbestand hinzufügen, auf Wunsch mit
            Artikelnummer und Barcode.
          </li>
          <li>
            Bilder hochladen: Hochformat 4:5, mindestens 2000 Pixel hoch, alle mit gleichem
            Hintergrund und Licht. Das Admin verkleinert sie automatisch. Mit den Pfeilen die
            Reihenfolge festlegen, das erste Bild erscheint in der Übersicht.
          </li>
          <li>
            Unter «Komplettes Outfit» passende Stücke wählen, zum Beispiel Weste und Schuhe zum
            Anzug. «Neu» und «Sale» setzen, wo es passt.
          </li>
          <li>
            Status auf «Aktiv (im Shop)» stellen und speichern. Nach spätestens 30 Sekunden ist es
            im Shop.
          </li>
        </ol>
        <ul className="admin-tips">
          <li>
            Gleiches Modell in einer anderen Farbe: neues Produkt mit demselben Eintrag im Feld
            «Modell». Auf der Produktseite erscheint dann die Farbauswahl.
          </li>
          <li>
            Streichpreis nur, wenn das Stück vorher wirklich zu diesem Preis angeboten wurde
            (Preisbekanntgabeverordnung).
          </li>
          <li>
            Ein Produkt nicht löschen, sondern «Archiviert» setzen: Es verschwindet aus dem Shop,
            die Auswertungen bleiben.
          </li>
        </ul>
      </Panel>
      <Panel title="Bestellungen">
        <ul className="admin-tips">
          <li>
            Neue Bestellung: Unter{" "}
            <Link to="/admin/bestellungen" className="admin-link">
              Bestellungen
            </Link>{" "}
            öffnen, Paket packen, mit «Quittung drucken» den Beleg fürs Paket ausdrucken.
          </li>
          <li>
            Nach der Aufgabe bei der Post die Sendungsnummer eintragen und «Kundschaft per E-Mail
            informieren» angehakt lassen. Die Kundschaft bekommt die Versandmeldung mit Link zur
            Sendungsverfolgung.
          </li>
          <li>
            Rückgabe: Bei der Bestellung unter «Retoure einbuchen» die Stücke wieder an Lager
            nehmen. Das Geld erstattest du im Stripe-Konto (Zahlungen → Zahlung öffnen →
            Rückerstattung).
          </li>
        </ul>
      </Panel>
      <Panel title="Lager und Verkauf im Laden">
        <ul className="admin-tips">
          <li>
            Unter{" "}
            <Link to="/admin/lager" className="admin-link">
              Lager
            </Link>{" "}
            beim verkauften Stück «Verkauf im Laden −1» drücken. So stimmt der Bestand im Shop.
          </li>
          <li>
            Neue Ware oder Korrekturen: Menge mit Grund eintragen. Jede Änderung steht unter «Letzte
            Bewegungen».
          </li>
        </ul>
      </Panel>
      <Panel title="Aktionen, Gutscheine und Inhalte">
        <ul className="admin-tips">
          <li>
            <Link to="/admin/rabattcodes" className="admin-link">
              Rabattcodes
            </Link>
            : Code, Prozent oder Franken, Start und Ende, auf Wunsch Mindestbetrag und Anzahl
            Einlösungen.
          </li>
          <li>
            <Link to="/admin/gutscheine" className="admin-link">
              Gutscheine
            </Link>
            : Gutscheine für den Laden ausstellen, verlorene Codes sperren und das Restguthaben auf
            einen neuen Gutschein übertragen.
          </li>
          <li>
            <Link to="/admin/inhalte" className="admin-link">
              Startseite und Laufband
            </Link>{" "}
            sowie{" "}
            <Link to="/admin/groessen" className="admin-link">
              Grössentabellen
            </Link>
            : Texte auf Deutsch ändern und speichern, Englisch entsteht automatisch.
          </li>
        </ul>
      </Panel>
    </>
  );
}
