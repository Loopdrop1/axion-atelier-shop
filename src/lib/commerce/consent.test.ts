// Der Einwilligungstext im Formular muss dem Text entsprechen, den der Server speichert.
import { describe, expect, it } from "vitest";
import { de } from "@/i18n/messages/de";
import { en } from "@/i18n/messages/en";
import {
  CONSENT_VERSION,
  NEWSLETTER_CONSENT,
  consentRecord,
} from "../../../supabase/functions/_shared/consent";

describe("Newsletter-Einwilligung", () => {
  it("Formulartext entspricht dem Servertext (DE und EN)", () => {
    expect(de.newsletter.consent).toBe(NEWSLETTER_CONSENT.de);
    expect(en.newsletter.consent).toBe(NEWSLETTER_CONSENT.en);
  });

  it("gespeicherter Text trägt die Version", () => {
    expect(consentRecord("de")).toMatch(new RegExp(`^\\[${CONSENT_VERSION}\\] Ja,`));
    expect(consentRecord("en").length).toBeLessThanOrEqual(1000);
  });
});
