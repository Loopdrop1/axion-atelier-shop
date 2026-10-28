import { describe, expect, it } from "vitest";
import {
  easterSunday,
  estimateDelivery,
  formatDelivery,
  isWorkingDay,
  swissHolidays,
  type DeliveryConfig,
} from "./delivery";

const config: DeliveryConfig = {
  dispatchCutoff: "14:00",
  processingDays: 0,
  transitDays: { min: 1, max: 2 },
};
// Zürcher Ortszeit als Instant; ab 25.10.2026 gilt Winterzeit (UTC+1), im Sommer UTC+2
const at = (iso: string, offset = "+01:00") => new Date(`${iso}${offset}`);

describe("Lieferschätzung", () => {
  it("versendet vor dem Annahmeschluss am selben Arbeitstag", () => {
    // Mittwoch 28.10.2026, 10:00
    expect(estimateDelivery(at("2026-10-28T10:00:00"), config)).toEqual({
      dispatch: "2026-10-28",
      min: "2026-10-29",
      max: "2026-10-30",
    });
  });

  it("versendet nach dem Annahmeschluss am nächsten Arbeitstag", () => {
    expect(estimateDelivery(at("2026-10-28T14:00:00"), config).dispatch).toBe("2026-10-29");
    expect(estimateDelivery(at("2026-10-28T13:59:00"), config).dispatch).toBe("2026-10-28");
  });

  it("rechnet in Zürcher Zeit, nicht in UTC", () => {
    // Winterzeit: 13:30 UTC = 14:30 in Zürich, 12:30 UTC = 13:30
    expect(estimateDelivery(new Date("2026-10-28T13:30:00Z"), config).dispatch).toBe("2026-10-29");
    expect(estimateDelivery(new Date("2026-10-28T12:30:00Z"), config).dispatch).toBe("2026-10-28");
    // Sommerzeit: 12:30 UTC = 14:30 in Zürich, 11:30 UTC = 13:30
    expect(estimateDelivery(new Date("2026-07-14T12:30:00Z"), config).dispatch).toBe("2026-07-15");
    expect(estimateDelivery(new Date("2026-07-14T11:30:00Z"), config).dispatch).toBe("2026-07-14");
    // 23:30 UTC ist in Zürich schon der nächste Kalendertag (Samstag)
    expect(estimateDelivery(new Date("2026-10-30T23:30:00Z"), config).dispatch).toBe("2026-11-02");
  });

  it("überspringt das Wochenende", () => {
    // Freitag 30.10.2026 nach 14 Uhr: Versand Montag, Lieferung Dienstag bis Mittwoch
    expect(estimateDelivery(at("2026-10-30T15:00:00"), config)).toEqual({
      dispatch: "2026-11-02",
      min: "2026-11-03",
      max: "2026-11-04",
    });
    // Freitag vor 14 Uhr: Versand heute, Zustellung Montag bis Dienstag
    expect(estimateDelivery(at("2026-10-30T09:00:00"), config)).toEqual({
      dispatch: "2026-10-30",
      min: "2026-11-02",
      max: "2026-11-03",
    });
  });

  it("versendet Bestellungen vom Wochenende am Montag", () => {
    for (const day of ["2026-10-31", "2026-11-01"])
      expect(estimateDelivery(at(`${day}T09:00:00`), config).dispatch).toBe("2026-11-02");
  });

  it("zählt Feiertage nicht als Arbeitstage", () => {
    // Donnerstag 24.12.2026 nach 14 Uhr: 25. und 26. Dez. und Wochenende frei, Versand Montag 28.12.
    expect(estimateDelivery(at("2026-12-24T15:00:00", "+01:00"), config)).toEqual({
      dispatch: "2026-12-28",
      min: "2026-12-29",
      max: "2026-12-30",
    });
    // Am Feiertag selbst (1. August 2025, Freitag) wird nicht versendet
    expect(estimateDelivery(at("2025-08-01T08:00:00", "+02:00"), config).dispatch).toBe(
      "2025-08-04",
    );
    // Ostermontag 2026 ist der 6. April
    expect(estimateDelivery(at("2026-04-02T15:00:00", "+02:00"), config).dispatch).toBe(
      "2026-04-07",
    );
  });

  it("berücksichtigt Bearbeitungstage und die Transportspanne aus der Konfiguration", () => {
    const slow: DeliveryConfig = {
      dispatchCutoff: "12:00",
      processingDays: 1,
      transitDays: { min: 2, max: 2 },
    };
    // Montag 26.10. 13:00: Versand Di 27., plus 1 Tag Bearbeitung = Mi 28., Lieferung Fr 30.
    expect(estimateDelivery(at("2026-10-26T13:00:00"), slow)).toEqual({
      dispatch: "2026-10-28",
      min: "2026-10-30",
      max: "2026-10-30",
    });
  });

  it("nutzt ohne Angabe die Werte aus shopConfig", () => {
    const e = estimateDelivery(at("2026-10-28T10:00:00"));
    expect(e.dispatch).toBe("2026-10-28");
    expect(e.min <= e.max).toBe(true);
  });
});

describe("Feiertage", () => {
  it("berechnet Ostern", () => {
    const iso = (c: number) => new Date(c).toISOString().slice(0, 10);
    expect(iso(easterSunday(2024))).toBe("2024-03-31");
    expect(iso(easterSunday(2025))).toBe("2025-04-20");
    expect(iso(easterSunday(2026))).toBe("2026-04-05");
    expect(iso(easterSunday(2027))).toBe("2027-03-28");
  });

  it("listet feste und bewegliche Feiertage 2026", () => {
    expect(swissHolidays(2026)).toEqual([
      "2026-01-01",
      "2026-04-03", // Karfreitag
      "2026-04-06", // Ostermontag
      "2026-05-14", // Auffahrt
      "2026-05-25", // Pfingstmontag
      "2026-08-01",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("kennt Berchtoldstag nicht als Feiertag", () => {
    expect(isWorkingDay(Date.UTC(2026, 0, 2))).toBe(true); // Freitag
    expect(isWorkingDay(Date.UTC(2026, 3, 3))).toBe(false); // Karfreitag
    expect(isWorkingDay(Date.UTC(2026, 9, 31))).toBe(false); // Samstag
  });
});

describe("Anzeige", () => {
  it("formatiert einen einzelnen Tag", () => {
    const e = { dispatch: "2026-10-29", min: "2026-10-30", max: "2026-10-30" };
    expect(formatDelivery(e, "de")).toBe("Lieferung bis Fr., 30. Oktober");
    expect(formatDelivery(e, "en")).toBe("Delivered by Fri, 30 October");
  });

  it("formatiert eine Spanne im selben Monat", () => {
    const e = { dispatch: "2026-10-28", min: "2026-10-29", max: "2026-10-30" };
    expect(formatDelivery(e, "de")).toBe("Lieferung zwischen Do., 29. und Fr., 30. Oktober");
    expect(formatDelivery(e, "en")).toBe("Delivered between Thu, 29 and Fri, 30 October");
  });

  it("nennt bei einer Spanne über den Monatswechsel beide Monate", () => {
    const e = { dispatch: "2026-10-30", min: "2026-10-31", max: "2026-11-02" };
    expect(formatDelivery(e, "de")).toBe("Lieferung zwischen Sa., 31. Okt. und Mo., 2. Nov.");
    expect(formatDelivery(e, "en")).toBe("Delivered between Sat, 31 Oct and Mon, 2 Nov");
  });
});
