import { describe, expect, it } from "vitest";
import type { SystemStatus } from "@/lib/admin/api";
import { clientChecks, serverChecks } from "./readiness";

const status = (over: Partial<SystemStatus> = {}): SystemStatus => ({
  required: { STRIPE_SECRET_KEY: true, RESEND_API_KEY: false },
  optional: { LOVABLE_API_KEY: true },
  stripeMode: "test",
  emailFromIsOnboarding: false,
  previewOriginsAllowed: true,
  ...over,
});

describe("serverChecks", () => {
  it("macht aus jedem Secret eine Prüfung, Testmodus und Vorschau-Freigabe sind offen", () => {
    const checks = serverChecks(status());
    expect(checks.find((c) => c.id === "STRIPE_SECRET_KEY")?.ok).toBe(true);
    expect(checks.find((c) => c.id === "RESEND_API_KEY")?.ok).toBe(false);
    expect(checks.find((c) => c.id === "stripe-mode")?.ok).toBe(false);
    expect(checks.find((c) => c.id === "preview-origins")?.ok).toBe(false);
  });

  it("Live-Modus ohne Vorschau-Freigabe ist in Ordnung", () => {
    const checks = serverChecks(status({ stripeMode: "live", previewOriginsAllowed: false }));
    expect(checks.find((c) => c.id === "stripe-mode")?.ok).toBe(true);
    expect(checks.find((c) => c.id === "preview-origins")?.ok).toBe(true);
  });
});

describe("Stripe-Modus", () => {
  it("beschriftet fehlenden Schlüssel und unbekannten Modus verschieden", () => {
    const label = (mode: SystemStatus["stripeMode"]) =>
      serverChecks(status({ stripeMode: mode })).find((c) => c.id === "stripe-mode")?.label;
    expect(label("missing")).toBe("Stripe-Schlüssel fehlt");
    expect(label("unknown")).toBe("Stripe-Modus unbekannt");
  });
});

describe("clientChecks", () => {
  it("meldet Platzhalter, Entwurfsseiten und Musterstücke", () => {
    const checks = clientChecks({
      contactPlaceholders: ["company"],
      draftPages: ["impressum"],
      sampleProducts: 52,
    });
    expect(checks.map((c) => [c.id, c.ok])).toEqual([
      ["contact", false],
      ["legal", false],
      ["muster", false],
      ["launched", false],
    ]);
    expect(checks.find((c) => c.id === "muster")?.hint).toContain("52");
  });

  it("lässt Prüfungen weg, deren Daten noch fehlen", () => {
    const ids = clientChecks({
      contactPlaceholders: [],
      draftPages: null,
      sampleProducts: null,
    }).map((c) => c.id);
    expect(ids).toEqual(["contact", "launched"]);
  });
});
