// Tagesgrenzen in Zürcher Zeit (für Umsatz «heute», «7 Tage», Exporte).

/** Abstand Zürich zu UTC in Minuten zu einem Zeitpunkt (+60 im Winter, +120 im Sommer). */
export function zurichOffsetMinutes(date: Date): number {
  const text = date.toLocaleString("en-US", {
    timeZone: "Europe/Zurich",
    timeZoneName: "shortOffset",
  });
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(text);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

/** Mitternacht in Zürich vor `daysAgo` Tagen (0 = heute), als Zeitpunkt. */
export function zurichMidnight(daysAgo = 0, now = new Date()): Date {
  const [y, mo, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(y, mo - 1, d - daysAgo);
  // Offset am Zieltag (Sommer-/Winterzeit), zweimal angenähert für Tage mit Umstellung
  let result = new Date(utcMidnight - zurichOffsetMinutes(new Date(utcMidnight)) * 60_000);
  result = new Date(utcMidnight - zurichOffsetMinutes(result) * 60_000);
  return result;
}

/** «2026-10-12» aus einem Eingabefeld → Mitternacht Zürich an diesem Tag. */
export function zurichDate(isoDay: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!m) return null;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  let result = new Date(utcMidnight - zurichOffsetMinutes(new Date(utcMidnight)) * 60_000);
  result = new Date(utcMidnight - zurichOffsetMinutes(result) * 60_000);
  return result;
}
