// Lieferschätzung: reine Funktionen, rechnen in der Zeitzone Europe/Zurich.
// Werte (Annahmeschluss, Bearbeitungs- und Transporttage) stehen in shopConfig.delivery.
// Samstag, Sonntag und die gesamtschweizerischen Feiertage zählen nicht als Arbeitstage.
import { shopConfig } from "@/config/shop";
import type { Locale } from "@/i18n/locale";

export interface DeliveryConfig {
  /** Uhrzeit «HH:MM» (Europe/Zurich), bis zu der bestellt am selben Arbeitstag versendet wird */
  dispatchCutoff: string;
  /** Zusätzliche Arbeitstage bis zum Versand */
  processingDays: number;
  /** Arbeitstage zwischen Versand und Zustellung */
  transitDays: { min: number; max: number };
}

export interface DeliveryEstimate {
  /** Versandtag, «YYYY-MM-DD» */
  dispatch: string;
  /** Frühestens / spätestens zugestellt, «YYYY-MM-DD» */
  min: string;
  max: string;
}

const ZONE = "Europe/Zurich";
const DAY = 86_400_000;

/** Kalendertag ohne Zeitzone, als UTC-Mitternacht gerechnet. */
type Civil = number;
const civil = (y: number, m: number, d: number): Civil => Date.UTC(y, m - 1, d);
const parts = (c: Civil) => {
  const d = new Date(c);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() };
};
const iso = (c: Civil) => new Date(c).toISOString().slice(0, 10);
const fromIso = (s: string): Civil => {
  const [y, m, d] = s.split("-").map(Number);
  return civil(y as number, m as number, d as number);
};

/** Ostersonntag (Gauss/«Anonymous Gregorian»), als Kalendertag. */
export function easterSunday(year: number): Civil {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return civil(year, month, day);
}

/**
 * Gesamtschweizerisch arbeitsfreie Tage: Neujahr, Karfreitag, Ostermontag, Auffahrt,
 * Pfingstmontag, 1. August, 25. und 26. Dezember. Der 2. Januar (Berchtoldstag) und
 * kantonale Feiertage zählen bewusst nicht.
 */
export function swissHolidays(year: number): string[] {
  const easter = easterSunday(year);
  return [
    civil(year, 1, 1),
    easter - 2 * DAY,
    easter + 1 * DAY,
    easter + 39 * DAY,
    easter + 50 * DAY,
    civil(year, 8, 1),
    civil(year, 12, 25),
    civil(year, 12, 26),
  ].map(iso);
}

const holidayCache = new Map<number, Set<string>>();
function holidaySet(year: number) {
  let set = holidayCache.get(year);
  if (!set) holidayCache.set(year, (set = new Set(swissHolidays(year))));
  return set;
}

export function isWorkingDay(c: Civil): boolean {
  const { y, wd } = parts(c);
  return wd !== 0 && wd !== 6 && !holidaySet(y).has(iso(c));
}

function addWorkingDays(c: Civil, n: number): Civil {
  let out = c;
  for (let left = n; left > 0;) {
    out += DAY;
    if (isWorkingDay(out)) left -= 1;
  }
  return out;
}

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Datum und Uhrzeit in Zürich. */
function zurichNow(now: Date) {
  const p: Record<string, string> = Object.fromEntries(
    formatter.formatToParts(now).map((x) => [x.type, x.value]),
  );
  return {
    day: civil(Number(p["year"]), Number(p["month"]), Number(p["day"])),
    minutes: Number(p["hour"]) * 60 + Number(p["minute"]),
  };
}

function cutoffMinutes(cutoff: string) {
  const [h, m] = cutoff.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Voraussichtliche Lieferung für eine Bestellung zum Zeitpunkt `now`.
 * Vor dem Annahmeschluss an einem Arbeitstag wird heute versendet, sonst am nächsten Arbeitstag.
 */
export function estimateDelivery(
  now: Date,
  config: DeliveryConfig = shopConfig.delivery,
): DeliveryEstimate {
  const { day, minutes } = zurichNow(now);
  const sameDay = isWorkingDay(day) && minutes < cutoffMinutes(config.dispatchCutoff);
  const first = sameDay ? day : addWorkingDays(day, 1);
  const dispatch = addWorkingDays(first, config.processingDays);
  return {
    dispatch: iso(dispatch),
    min: iso(addWorkingDays(dispatch, config.transitDays.min)),
    max: iso(addWorkingDays(dispatch, config.transitDays.max)),
  };
}

const WEEKDAYS: Record<Locale, string[]> = {
  de: ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const MONTHS: Record<Locale, string[]> = {
  de: [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

const SHORT_MONTHS: Record<Locale, string[]> = {
  de: [
    "Jan.",
    "Feb.",
    "März",
    "Apr.",
    "Mai",
    "Juni",
    "Juli",
    "Aug.",
    "Sept.",
    "Okt.",
    "Nov.",
    "Dez.",
  ],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function dayLabel(c: Civil, locale: Locale, withMonth: boolean, short = false) {
  const { m, d, wd } = parts(c);
  const month = (short ? SHORT_MONTHS : MONTHS)[locale][m - 1];
  return locale === "de"
    ? `${WEEKDAYS.de[wd]}, ${d}.${withMonth ? ` ${month}` : ""}`
    : `${WEEKDAYS.en[wd]}, ${d}${withMonth ? ` ${month}` : ""}`;
}

/**
 * Text für die Anzeige: «Lieferung bis Do., 30. Oktober» bzw. bei einer Spanne
 * «Lieferung zwischen Mi., 29. und Do., 30. Oktober» (EN: «Delivered by Thu, 30 October» /
 * «Delivered between Wed, 29 and Thu, 30 October»).
 */
export function formatDelivery(estimate: DeliveryEstimate, locale: Locale): string {
  const min = fromIso(estimate.min);
  const max = fromIso(estimate.max);
  if (min === max) {
    return locale === "de"
      ? `Lieferung bis ${dayLabel(max, "de", true)}`
      : `Delivered by ${dayLabel(max, "en", true)}`;
  }
  const sameMonth = parts(min).m === parts(max).m;
  // Über den Monatswechsel mit gekürzten Monatsnamen, damit die Zeile kurz bleibt
  const from = dayLabel(min, locale, !sameMonth, true);
  const to = dayLabel(max, locale, true, !sameMonth);
  return locale === "de"
    ? `Lieferung zwischen ${from} und ${to}`
    : `Delivered between ${from} and ${to}`;
}
