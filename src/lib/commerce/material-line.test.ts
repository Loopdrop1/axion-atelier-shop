import { describe, expect, it } from "vitest";
import { materialLine, shortMaterial, shortOrigin } from "./material-line";

describe("Materialzeile", () => {
  it("kürzt auf die erste Materialangabe", () => {
    expect(shortMaterial("Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro")).toBe(
      "Schurwolle",
    );
    expect(shortMaterial("Baumwoll-Popeline (100 %)")).toBe("Baumwoll-Popeline");
    expect(shortMaterial("Kalbsleder, Futter aus Leder, Ledersohle")).toBe("Kalbsleder");
    expect(shortMaterial("Wool (Super 110’s) with a little stretch, cupro lining")).toBe("Wool");
  });

  it("behält einen Mischanteil in Prozent, wenn er passt", () => {
    expect(shortMaterial("Schurwolle mit 10 % Kaschmir, halb gefüttert")).toBe(
      "Schurwolle mit 10 % Kaschmir",
    );
    expect(shortMaterial("Wool with 10% cashmere, half lined")).toBe("Wool with 10% cashmere");
  });

  it("begrenzt die Länge", () => {
    const long = shortMaterial("Aussergewöhnlich feine extralange Merinowolle aus Südamerika");
    expect(long.length).toBeLessThanOrEqual(28);
    expect(long.endsWith("…")).toBe(true);
    expect(shortMaterial("Merinowolle mit Polyamid")).toBe("Merinowolle");
  });

  it("kürzt die Herkunft auf das Land", () => {
    expect(shortOrigin("Gefertigt in Italien")).toBe("Italien");
    expect(shortOrigin("Gestrickt in Italien")).toBe("Italien");
    expect(shortOrigin("Made in Portugal")).toBe("Portugal");
    expect(shortOrigin(undefined)).toBe("");
  });

  it("setzt die Zeile nur aus vorhandenen Angaben zusammen", () => {
    expect(
      materialLine({ material: "Schurwolle, Futter aus Cupro", origin: "Gefertigt in Italien" }),
    ).toBe("Schurwolle · Italien");
    expect(materialLine({ material: "Seide (100 %)" })).toBe("Seide");
    expect(materialLine({ origin: "Made in Spain" })).toBe("Spain");
    expect(materialLine({ material: "  ", origin: "" })).toBe("");
  });
});
