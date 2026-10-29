// «Zurück» im Browser aus der Stripe-Kasse: Die Seite muss das Token der offenen Kasse kennen,
// um die Reservierung sofort freizugeben (Bestand, Gutschein, Rabattcode).
import { beforeEach, describe, expect, it, vi } from "vitest";

const callFunction = vi.fn();
vi.mock("@/integrations/supabase/functions", () => ({
  callFunction: (...args: unknown[]) => callFunction(...args),
}));

import { forgetCheckout, rememberCheckout, startCheckout, takePendingCheckout } from "./checkout";

const TOKEN = "0c6b2b9a-0000-4000-8000-000000000002";

describe("offene Kasse merken und freigeben", () => {
  beforeEach(() => {
    takePendingCheckout();
    sessionStorage.clear();
    callFunction.mockReset();
  });

  it("startCheckout merkt sich das Status-Token der neuen Kasse", async () => {
    callFunction.mockResolvedValue({
      ok: true,
      data: { url: "https://checkout.stripe.test/x", orderNumber: 10042, statusToken: TOKEN },
    });
    const result = await startCheckout({ kind: "gift_card", amountCents: 5000, locale: "de" });
    expect(result).toMatchObject({ ok: true, statusToken: TOKEN });
    expect(takePendingCheckout()).toBe(TOKEN);
    // Einmal geholt, ist es vergessen: keine doppelte Freigabe
    expect(takePendingCheckout()).toBeNull();
  });

  it("überlebt ein Neuladen der Seite über sessionStorage", () => {
    rememberCheckout(TOKEN);
    // Speicher der Seite leeren, sessionStorage bleibt
    expect(takePendingCheckout()).toBe(TOKEN);
    sessionStorage.setItem("axion.checkout.pending", TOKEN);
    expect(takePendingCheckout()).toBe(TOKEN);
    expect(sessionStorage.getItem("axion.checkout.pending")).toBeNull();
  });

  it("nach der Zahlung (Danke-Seite) wird nichts mehr freigegeben", () => {
    rememberCheckout(TOKEN);
    forgetCheckout("11111111-0000-4000-8000-000000000000");
    rememberCheckout(TOKEN);
    forgetCheckout(TOKEN);
    expect(takePendingCheckout()).toBeNull();
  });

  it("ohne Token in der Antwort wird nichts gemerkt", async () => {
    callFunction.mockResolvedValue({
      ok: true,
      data: { url: "https://checkout.stripe.test/x", orderNumber: 10042 },
    });
    await startCheckout({ kind: "gift_card", amountCents: 5000, locale: "de" });
    expect(takePendingCheckout()).toBeNull();
  });
});
