// Einheitsgrösse: am Namen der Grösse erkannt, nicht an der Anzahl der Grössen.
import { describe, expect, it } from "vitest";
import { testProduct, testVariant } from "@/test/products";
// Gleiche Regel in den Edge Functions (Mails, Stripe); läuft hier mit, damit beide gleich entscheiden
import { sizeText as functionSizeText } from "../../../supabase/functions/_shared/size";
import { isOneSizeTitle, oneSizeVariant, sizeText } from "./one-size";

const named = (id: string, title: string, available = true) => ({
  ...testVariant(id, available, 89),
  title,
});

describe("Einheitsgrösse", () => {
  it("erkennt die üblichen Namen", () => {
    for (const title of [
      "One Size",
      "one-size",
      "Onesize",
      "Einheitsgrösse",
      "Einheitsgröße",
      "Einheitsgroesse",
      "OS",
      " o/s ",
    ]) {
      expect(isOneSizeTitle(title), title).toBe(true);
    }
  });

  it("echte Grössen und Farbangaben sind keine Einheitsgrösse", () => {
    for (const title of ["42", "S", "M", "XL", "Uni", "One", "39–42", ""]) {
      expect(isOneSizeTitle(title), title).toBe(false);
    }
  });

  it("nur wenn es genau diese eine Grösse gibt", () => {
    const tie = testProduct("krawatte", 89, [named("krawatte-os", "One Size")]);
    expect(oneSizeVariant(tie)?.id).toBe("krawatte-os");
    // Schuh nur noch in 42: echte Grösse, die man selbst wählt
    expect(oneSizeVariant(testProduct("schuh", 239, [testVariant("schuh-42")]))).toBeUndefined();
    const mixed = testProduct("x", 89, [named("x-os", "One Size"), testVariant("x-42")]);
    expect(oneSizeVariant(mixed)).toBeUndefined();
    expect(oneSizeVariant(testProduct("leer", 89, []))).toBeUndefined();
  });

  it("Anzeige: «Grösse 48», bei Einheitsgrösse das Wort der Seite, auch für «OS»", () => {
    expect(sizeText("48", "Grösse", "Einheitsgrösse")).toBe("Grösse 48");
    expect(sizeText("One Size", "Grösse", "Einheitsgrösse")).toBe("Einheitsgrösse");
    expect(sizeText("OS", "Size", "One size")).toBe("One size");
  });

  it("Shop und Edge Functions entscheiden gleich", () => {
    for (const size of [
      "48",
      "M",
      "39–42",
      "One Size",
      "one-size",
      "Onesize",
      "Einheitsgröße",
      "OS",
      "o/s",
      "Uni",
      "",
    ]) {
      expect(functionSizeText(size, "Grösse", "Einheitsgrösse"), size).toBe(
        sizeText(size, "Grösse", "Einheitsgrösse"),
      );
    }
  });
});
