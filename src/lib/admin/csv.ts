// CSV-Export für Excel in der Schweiz: Semikolon, UTF-8 mit BOM (sonst falsche Umlaute), CRLF.

/** Ein Feld: Anführungszeichen bei Bedarf; Formeln (=, +, -, @) werden entschärft (CSV-Injection). */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Byte Order Mark: Excel erkennt damit UTF-8. Als Escape, damit kein unsichtbares Zeichen im Code steht. */
const BOM = "\uFEFF";

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return `${BOM}${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/** Datei im Browser herunterladen. */
export function downloadCsv(
  filename: string,
  rows: (string | number | boolean | null | undefined)[][],
) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
