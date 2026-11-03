import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/i18n", async (orig) => {
  const actual = (await orig()) as typeof import("@/i18n");
  return {
    ...actual,
    useLocale: () => "de",
    useT: () => actual.messages.de,
    useLocaleParam: () => undefined,
  };
});

import { normalizeGiftCode, ShippingChoice } from "./checkout-summary";
import { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/commerce/source";
import type { ShippingMethod } from "@/lib/commerce/shipping-method";

describe("Gutscheincode eingeben", () => {
  it("bringt Codes mit Leerzeichen, Kleinbuchstaben oder ohne Striche in die Form AXN-XXXX-XXXX-XXXX", () => {
    expect(normalizeGiftCode("axn-ab12-cd34-ef56")).toBe("AXN-AB12-CD34-EF56");
    expect(normalizeGiftCode(" AXN AB12 CD34 EF56 ")).toBe("AXN-AB12-CD34-EF56");
    expect(normalizeGiftCode("axnab12cd34ef56")).toBe("AXN-AB12-CD34-EF56");
  });

  it("lässt andere Eingaben fast unverändert (Prüfung macht der Server)", () => {
    expect(normalizeGiftCode(" sommer10 ")).toBe("SOMMER10");
    expect(normalizeGiftCode("AXN-123")).toBe("AXN-123");
  });
});

function Choice({ settings, subtotal = 10000 }: { settings: ShopSettings; subtotal?: number }) {
  const [method, setMethod] = useState<ShippingMethod>("economy");
  return (
    <>
      <ShippingChoice
        value={method}
        onChange={setMethod}
        subtotalCents={subtotal}
        discountCents={0}
        giftCardCents={0}
        settings={settings}
      />
      <output>{method}</output>
    </>
  );
}

describe("Versandart im Warenkorb", () => {
  it("ohne Priority-Preis keine Wahl (Kasse wie bisher)", () => {
    const { container } = render(<Choice settings={DEFAULT_SETTINGS} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(container.querySelector("fieldset")).toBeNull();
  });

  it("mit Preis: Radio-Gruppe mit Legende, Preisen und Lieferzeit; Wahl wechselt", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      shippingCents: 900,
      freeShippingFromCents: 20000,
      priorityShippingCents: 1500,
    };
    render(<Choice settings={settings} subtotal={25000} />);
    const group = screen.getByRole("group", { name: "Versandart" });
    expect(group.tagName).toBe("FIELDSET");
    const economy = screen.getByRole("radio", { name: "Post Economy" });
    const priority = screen.getByRole("radio", { name: "Post Priority" });
    expect(economy).toBeChecked();
    // Über der Schwelle: Economy gratis, Priority kostet trotzdem
    expect(screen.getByText("Gratis")).toBeInTheDocument();
    expect(screen.getByText(/CHF\s15\.00/)).toBeInTheDocument();
    expect(priority).toHaveAccessibleDescription(
      "Versand am selben Arbeitstag bei Bestellung bis 14 Uhr, Zustellung in der Regel am nächsten Arbeitstag",
    );
    expect(economy).toHaveAccessibleDescription("Lieferung in 2 bis 5 Arbeitstagen");
    fireEvent.click(priority);
    expect(priority).toBeChecked();
    expect(screen.getByText("priority", { selector: "output" })).toBeInTheDocument();
  });
});
