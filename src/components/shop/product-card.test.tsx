// Produktkarte: Schnellauswahl beim Darüberfahren. Einheitsgrösse direkt in den Warenkorb, sonst Grösse wählen.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useCart, useShopUI } from "@/lib/commerce/stores";
import { testProduct, testVariant } from "@/test/products";
import { DEFAULT_SETTINGS } from "@/lib/commerce/source";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    "aria-label": label,
  }: {
    children: ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href="/produkt" className={className} aria-label={label}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/commerce/use-settings", () => ({ useShopSettings: () => DEFAULT_SETTINGS }));
vi.mock("@/i18n", async (orig) => {
  const actual = (await orig()) as typeof import("@/i18n");
  return {
    ...actual,
    useLocale: () => "de",
    useT: () => actual.messages.de,
    useLocaleParam: () => undefined,
  };
});

import { ProductCard } from "./product-card";

function tie(available: boolean) {
  const p = testProduct("krawatte-morcote-bordeaux", 89, [
    { ...testVariant("krawatte-os", available, 89), title: "One Size" },
  ]);
  p.title = "Seidenkrawatte «Morcote»";
  p.color = { key: "bordeaux", name: "Bordeaux", hex: "#6B1E2E" };
  return p;
}

describe("Produktkarte: Schnellauswahl", () => {
  beforeEach(() => {
    useCart.setState({ lines: [] });
    useShopUI.setState({ cartOpen: false });
  });

  it("Einheitsgrösse: ein Knopf «In den Warenkorb», sein Name enthält den sichtbaren Text", () => {
    render(<ProductCard product={tie(true)} />);
    expect(screen.queryByText("Grösse wählen")).not.toBeInTheDocument();
    const add = screen.getByRole("button", {
      name: "In den Warenkorb: Seidenkrawatte «Morcote», Bordeaux",
    });
    expect(add).toHaveTextContent("In den Warenkorb");
    fireEvent.click(add);
    expect(useCart.getState().lines).toEqual([{ variantId: "krawatte-os", quantity: 1 }]);
    expect(useShopUI.getState().cartOpen).toBe(true);
  });

  it("Einheitsgrösse ausverkauft: «Ausverkauft» statt Knopf, nirgends «Grösse One Size»", () => {
    render(<ProductCard product={tie(false)} />);
    expect(screen.getByText("Ausverkauft")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Warenkorb|One Size/ })).not.toBeInTheDocument();
    expect(useCart.getState().lines).toEqual([]);
  });

  it("mehrere Grössen: «Grösse wählen», eine Taste pro Grösse, ausverkaufte gesperrt", () => {
    const suit = testProduct("anzug-limmat-marine", 489, [
      testVariant("anzug-46", true, 489),
      testVariant("anzug-48", false, 489),
    ]);
    suit.title = "Anzug «Limmat»";
    render(<ProductCard product={suit} />);
    expect(screen.getByText("Grösse wählen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anzug «Limmat», Marine, Grösse 48, ausverkauft" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Anzug «Limmat», Marine, Grösse 46 hinzufügen" }),
    );
    expect(useCart.getState().lines).toEqual([{ variantId: "anzug-46", quantity: 1 }]);
  });
});

describe("Produktkarte: ausverkauft", () => {
  it("zeigt das Kennzeichen «Ausverkauft», wenn keine Grösse lieferbar ist", () => {
    const p = testProduct("hemd-x", 120, [
      { ...testVariant("hemd-x-m", false, 120), title: "M" },
      { ...testVariant("hemd-x-l", false, 120), title: "L" },
    ]);
    render(<ProductCard product={p} />);
    expect(document.querySelector(".product-badge")).toHaveTextContent(/ausverkauft/i);
  });
});
