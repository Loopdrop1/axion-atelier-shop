// Druckdokumente im Admin: Quittung (Standard), Lieferschein und Adressetikette hängen alle als `.admin-printdoc` an <body>.
// Welches davon gedruckt wird, steuert <body data-print="…"> (Regeln in styles.css); ohne Wert gilt die Quittung.
export type PrintKind = "receipt" | "slip" | "label";

export function printDoc(kind: PrintKind): void {
  const body = document.body;
  if (kind === "receipt") delete body.dataset["print"];
  else body.dataset["print"] = kind;
  const done = () => {
    delete body.dataset["print"];
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
