// Kompakte Material- und Herkunftszeile für Produktkarten («Schurwolle · Italien»).
// Aus den vorhandenen Produktdaten abgeleitet, ohne eigene Felder.

const MAX_MATERIAL = 28;

/** Erste Materialangabe: bis zum ersten Komma, ohne Klammern, ohne Zusätze nach «mit»/«with». */
export function shortMaterial(material: string | undefined, max = MAX_MATERIAL): string {
  let text = (material ?? "")
    .split(",")[0]!
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > max || !/\d\s?%/.test(text)) {
    // Mischanteile in Prozent («mit 10 % Kaschmir») bleiben, wenn sie noch passen
    const cut = text.search(/\s(?:mit|with)\s/i);
    if (cut > 0) text = text.slice(0, cut);
  }
  if (text.length > max) {
    const words = text.slice(0, max - 1).split(" ");
    text = (words.length > 1 ? words.slice(0, -1).join(" ") : words[0]!).replace(/[\s,.;-]+$/, "");
    text += "…";
  }
  return text;
}

/** Land bzw. Ort aus «Gefertigt in Italien» / «Made in Italy». */
export function shortOrigin(origin: string | undefined): string {
  return (origin ?? "")
    .trim()
    .replace(
      /^(?:gefertigt|gestrickt|hergestellt|produziert|genäht|made|knitted|manufactured|produced)\s+in\s+/i,
      "",
    )
    .replace(/\.$/, "");
}

/** «Schurwolle · Italien»; leer, wenn weder Material noch Herkunft vorhanden sind. */
export function materialLine(details: {
  material?: string | undefined;
  origin?: string | undefined;
}) {
  return [shortMaterial(details.material), shortOrigin(details.origin)].filter(Boolean).join(" · ");
}
