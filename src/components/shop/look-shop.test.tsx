// Startseite: Look direkt kaufen. Grössen wählen, Stücke abwählen, ganzer Look oder Auswahl in den Warenkorb.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useCart, useShopUI } from "@/lib/commerce/stores";
import { DEFAULT_SETTINGS } from "@/lib/commerce/source";
import { testProduct, testVariant } from "@/test/products";

const settings = vi.hoisted(() => ({ hideSoldOut: false }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    tabIndex,
    className,
  }: {
    children: ReactNode;
    params?: { handle?: string };
    tabIndex?: number;
    className?: string;
  }) => (
    <a href={`/produkt/${params?.handle ?? ""}`} tabIndex={tabIndex} className={className}>
      {children}
    </a>
  ),
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
vi.mock("@/lib/commerce/use-settings", () => ({
  useShopSettings: () => ({ ...DEFAULT_SETTINGS, hideSoldOut: settings.hideSoldOut }),
}));

import { LookShop } from "./look-shop";

const suit = testProduct("anzug-limmat-marine", 489, [
  testVariant("anzug-46", true, 489),
  testVariant("anzug-48", false, 489),
]);
suit.title = "Anzug «Limmat»";
const vest = testProduct("weste-limmat-marine", 129, [testVariant("weste-m", true, 129)]);
vest.title = "Weste «Limmat»";
const shoes = testProduct("oxford-nero-schwarz", 239, [testVariant("oxford-42", true, 239)], {
  category: "schuhe",
  color: { name: "Schwarz", hex: "#000000" },
});
shoes.title = "Oxford «Nero»";

const check = (name: string) => screen.getByRole("checkbox", { name: `${name} auswählen` });
const size = (name: string) => screen.getByRole("combobox", { name: `Grösse für ${name}` });
const SUIT = "Anzug «Limmat», Marine";
const VEST = "Weste «Limmat», Marine";
const SHOES = "Oxford «Nero», Schwarz";

describe("Startseite: Look direkt kaufen", () => {
  beforeEach(() => {
    settings.hideSoldOut = false;
    useCart.setState({ lines: [] });
    useShopUI.setState({ cartOpen: false });
  });

  it("alle Stücke vorausgewählt: Summe des ganzen Looks, Knopf für den ganzen Look", () => {
    render(<LookShop products={[suit, vest, shoes]} total="Ganzes Outfit" />);
    expect(check(SUIT)).toBeChecked();
    expect(check(VEST)).toBeChecked();
    expect(check(SHOES)).toBeChecked();
    expect(screen.getByText("Ganzes Outfit")).toBeInTheDocument();
    expect(screen.getByText("CHF 857.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ganzen Look in den Warenkorb" })).toBeEnabled();
    // Schuhe mit EU-Grössen, ausverkaufte Grösse sichtbar, aber nicht wählbar
    expect(screen.getByRole("option", { name: "Grösse wählen · EU" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "48 – ausverkauft" })).toBeDisabled();
  });

  it("ohne Grösse: nichts im Warenkorb, Hinweis und Sprung zur ersten fehlenden Grösse", () => {
    render(<LookShop products={[suit, vest, shoes]} total="Ganzes Outfit" />);
    fireEvent.change(size(SUIT), { target: { value: "anzug-46" } });
    fireEvent.click(screen.getByRole("button", { name: "Ganzen Look in den Warenkorb" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bitte wähle eine Grösse für jedes ausgewählte Stück.",
    );
    expect(useCart.getState().lines).toEqual([]);
    expect(useShopUI.getState().cartOpen).toBe(false);
    expect(size(SUIT)).not.toHaveAttribute("aria-invalid");
    expect(size(VEST)).toHaveAttribute("aria-invalid", "true");
    expect(size(SHOES)).toHaveAttribute("aria-invalid", "true");
    expect(size(VEST)).toHaveFocus();
    // Grösse nachtragen: Markierung verschwindet für dieses Stück
    fireEvent.change(size(VEST), { target: { value: "weste-m" } });
    expect(size(VEST)).not.toHaveAttribute("aria-invalid");
  });

  it("ganzer Look: alle drei Stücke in der gewählten Grösse, Warenkorb geht auf", () => {
    render(<LookShop products={[suit, vest, shoes]} total="Ganzes Outfit" />);
    fireEvent.change(size(SUIT), { target: { value: "anzug-46" } });
    fireEvent.change(size(VEST), { target: { value: "weste-m" } });
    fireEvent.change(size(SHOES), { target: { value: "oxford-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Ganzen Look in den Warenkorb" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useCart.getState().lines).toEqual([
      { variantId: "anzug-46", quantity: 1 },
      { variantId: "weste-m", quantity: 1 },
      { variantId: "oxford-42", quantity: 1 },
    ]);
    expect(useShopUI.getState().cartOpen).toBe(true);
  });

  it("Auswahl: abgewähltes Stück zählt nicht und braucht keine Grösse", () => {
    render(<LookShop products={[suit, vest, shoes]} total="Ganzes Outfit" />);
    fireEvent.click(check(VEST));
    expect(screen.getByText("Auswahl: 2 von 3 Stücken")).toBeInTheDocument();
    expect(screen.getByText("CHF 728.00")).toBeInTheDocument();
    fireEvent.change(size(SUIT), { target: { value: "anzug-46" } });
    fireEvent.change(size(SHOES), { target: { value: "oxford-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Auswahl in den Warenkorb" }));
    expect(useCart.getState().lines).toEqual([
      { variantId: "anzug-46", quantity: 1 },
      { variantId: "oxford-42", quantity: 1 },
    ]);
  });

  it("nichts ausgewählt: Knopf gesperrt", () => {
    render(<LookShop products={[suit, vest]} total="Ganzes Outfit" />);
    fireEvent.click(check(SUIT));
    fireEvent.click(check(VEST));
    expect(screen.getByText("Auswahl: 0 von 2 Stücken")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auswahl in den Warenkorb" })).toBeDisabled();
  });

  it("ausverkauftes Stück: nicht vorausgewählt, nicht wählbar, kein «ganzer Look»", () => {
    const soldOut = testProduct("weste-limmat-marine", 129, [testVariant("weste-m", false, 129)]);
    soldOut.title = "Weste «Limmat»";
    render(<LookShop products={[suit, soldOut]} total="Ganzes Outfit" />);
    expect(check(VEST)).not.toBeChecked();
    expect(check(VEST)).toBeDisabled();
    expect(size(VEST)).toBeDisabled();
    expect(screen.getByRole("option", { name: "Ausverkauft" })).toBeInTheDocument();
    expect(screen.getByText("Auswahl: 1 von 2 Stücken")).toBeInTheDocument();
    fireEvent.change(size(SUIT), { target: { value: "anzug-46" } });
    fireEvent.click(screen.getByRole("button", { name: "Auswahl in den Warenkorb" }));
    expect(useCart.getState().lines).toEqual([{ variantId: "anzug-46", quantity: 1 }]);
  });

  it("Stück ist nach dem Neuladen ausverkauft: zählt nicht mehr mit, Rest lässt sich kaufen", () => {
    const { rerender } = render(<LookShop products={[suit, vest]} total="Ganzes Outfit" />);
    fireEvent.change(size(SUIT), { target: { value: "anzug-46" } });
    expect(check(VEST)).toBeChecked();
    const vestGone = { ...vest, variants: [testVariant("weste-m", false, 129)] };
    rerender(<LookShop products={[suit, vestGone]} total="Ganzes Outfit" />);
    expect(check(VEST)).not.toBeChecked();
    expect(check(VEST)).toBeDisabled();
    expect(size(SUIT)).toHaveValue("anzug-46");
    expect(screen.getByText("Auswahl: 1 von 2 Stücken")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auswahl in den Warenkorb" }));
    expect(useCart.getState().lines).toEqual([{ variantId: "anzug-46", quantity: 1 }]);
  });

  it("Einstellung «ausverkaufte Grössen ausblenden» gilt auch hier", () => {
    settings.hideSoldOut = true;
    render(<LookShop products={[suit]} total="Ganzes Outfit" />);
    expect(screen.queryByRole("option", { name: /48/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "46" })).toBeInTheDocument();
  });
});
