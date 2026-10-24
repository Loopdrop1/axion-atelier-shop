// Warenkorb: Menge gegen den Bestand begrenzen, zu grosse Mengen kürzen, Entfernen mit Rückgängig.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCart } from "@/lib/commerce/stores";
import { DEFAULT_SETTINGS } from "@/lib/commerce/source";
import type { Cart } from "@/lib/commerce";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/i18n", async (orig) => {
  const actual = (await orig()) as typeof import("@/i18n");
  return {
    ...actual,
    useLocale: () => "de",
    useT: () => actual.messages.de,
    useLocaleParam: () => undefined,
  };
});
vi.mock("@/lib/commerce/use-settings", () => ({ useShopSettings: () => DEFAULT_SETTINGS }));

const stock = vi.hoisted(() => ({ value: 1 }));
vi.mock("@/lib/commerce", async (orig) => {
  const actual = (await orig()) as typeof import("@/lib/commerce");
  const { testProduct: product, testVariant: variant } = await import("@/test/products");
  return {
    ...actual,
    listProducts: async () => [],
    resolveCart: async (lines: { variantId: string; quantity: number }[]): Promise<Cart> => {
      const v = { ...variant("anzug-48", true, 100), stock: stock.value };
      const p = product("anzug", 100, [v]);
      return {
        lines: lines.map((l) => ({ ...l, product: p, variant: v })),
        subtotal: { amount: 100, currencyCode: "CHF" },
        checkoutUrl: null,
      };
    },
  };
});

import { CartContents } from "./cart";

describe("Warenkorb", () => {
  beforeEach(() => {
    stock.value = 1;
    useCart.setState({ lines: [{ variantId: "anzug-48", quantity: 1 }] });
    useCart.persist.rehydrate();
  });

  it("Plus gesperrt am Bestand, Hinweis «Nur noch 1 an Lager», Minus bei 1 gesperrt", async () => {
    render(<CartContents />);
    const plus = await screen.findByRole("button", { name: "Anzahl erhöhen" });
    expect(plus).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anzahl reduzieren" })).toBeDisabled();
    expect(document.querySelector(".line-limit")).toHaveTextContent("Nur noch 1 an Lager.");
  });

  it("kürzt eine Menge über dem Bestand einmalig und sagt es", async () => {
    stock.value = 2;
    useCart.setState({ lines: [{ variantId: "anzug-48", quantity: 5 }] });
    render(<CartContents />);
    await waitFor(() => expect(useCart.getState().lines[0]?.quantity).toBe(2));
    expect(await screen.findByText("Mengen wurden an den Lagerbestand angepasst.")).toBeVisible();
  });

  it("Entfernen zeigt «Rückgängig» und stellt die Menge wieder her", async () => {
    stock.value = 5;
    useCart.setState({ lines: [{ variantId: "anzug-48", quantity: 3 }] });
    render(<CartContents />);
    const remove = await screen.findByRole("button", { name: /entfernen/ });
    await act(async () => fireEvent.click(remove));
    const undo = await screen.findByRole("button", { name: "Rückgängig" });
    expect(useCart.getState().lines).toEqual([]);
    await act(async () => fireEvent.click(undo));
    expect(useCart.getState().lines).toEqual([{ variantId: "anzug-48", quantity: 3 }]);
  });
});
