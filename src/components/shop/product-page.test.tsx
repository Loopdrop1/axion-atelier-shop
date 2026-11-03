// Produktseite in Einheitsgrösse: nichts zu wählen, auch nicht in der Leiste unten auf dem Handy.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCart } from "@/lib/commerce/stores";
import { DEFAULT_SETTINGS } from "@/lib/commerce/source";
import { testProduct, testVariant } from "@/test/products";

class NoObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", NoObserver);
vi.stubGlobal("ResizeObserver", NoObserver);

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/produkt" className={className}>
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
vi.mock("@/lib/commerce/use-settings", () => ({ useShopSettings: () => DEFAULT_SETTINGS }));
// Die Grössentabelle lädt Daten und ist in diesen Tests nie offen
vi.mock("./size-guide", () => ({ SizeGuide: () => null }));
// Grössenfinder: eigener Test (size-finder.test.tsx); hier nur der Einstieg und «Deine Grösse»
const suggested = vi.hoisted(() => ({ size: undefined as string | undefined }));
vi.mock("./size-finder", () => ({
  ProductSizeFinder: () => null,
  useSuggestedSize: () => suggested.size,
}));

import { ProductPage } from "./product";

function tie(available: boolean) {
  const p = testProduct("krawatte-morcote-bordeaux", 89, [
    { ...testVariant("krawatte-os", available, 89), title: "One Size" },
  ]);
  p.title = "Seidenkrawatte «Morcote»";
  p.color = { key: "bordeaux", name: "Bordeaux", hex: "#6B1E2E" };
  return p;
}

// Ohne Layout (jsdom) liegt der Kaufbereich «oberhalb» des Bildschirms: die Leiste unten erscheint.
describe("Produktseite: Einheitsgrösse", () => {
  beforeEach(() => {
    useCart.setState({ lines: [] });
  });

  it("lieferbar: «Einheitsgrösse», ohne Grössenwahl direkt in den Warenkorb, auch über die Leiste unten", async () => {
    render(<ProductPage product={tie(true)} siblings={[]} outfit={[]} recommendations={[]} />);
    expect(screen.getByText("Einheitsgrösse")).toBeInTheDocument();
    expect(screen.queryByText("Bitte Grösse wählen")).not.toBeInTheDocument();
    const leiste = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(".mobile-add-bar");
      if (!el) throw new Error("Leiste fehlt");
      return el;
    });
    const button = leiste.querySelector("button")!;
    expect(button).toHaveTextContent("In den Warenkorb");
    fireEvent.click(button);
    expect(useCart.getState().lines).toEqual([{ variantId: "krawatte-os", quantity: 1 }]);
  });

  it("ausverkauft: Knopf gesperrt, Leiste unten zeigt «ausverkauft» statt «Grösse wählen»", async () => {
    render(<ProductPage product={tie(false)} siblings={[]} outfit={[]} recommendations={[]} />);
    expect(screen.getByText("Einheitsgrösse · ausverkauft")).toBeInTheDocument();
    // Auch der Kaufknopf in der Kaufbox ist gesperrt und sagt es
    const main = document.querySelector<HTMLElement>(".add-row button")!;
    expect(main).toHaveTextContent("ausverkauft");
    expect(main).toBeDisabled();
    const leiste = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(".mobile-add-bar");
      if (!el) throw new Error("Leiste fehlt");
      return el;
    });
    const button = leiste.querySelector("button")!;
    expect(button).toHaveTextContent("ausverkauft");
    expect(button).toBeDisabled();
    expect(leiste).not.toHaveTextContent("Grösse wählen");
  });
});

describe("Produktseite: Grössen mit Buchstaben, Grössenfinder und Model", () => {
  function suit() {
    const p = testProduct("anzug-limmat-marine", 489, [
      { ...testVariant("anzug-48", true, 489), letter: "M" },
      { ...testVariant("anzug-50", true, 489), letter: "L" },
      { ...testVariant("anzug-52", false, 489), letter: "XL" },
    ]);
    p.fitModel = { heightCm: 186, size: "50", letter: "L" };
    return p;
  }
  beforeEach(() => {
    suggested.size = undefined;
  });

  it("Knöpfe zeigen Zahl und Buchstabe, die Model-Zeile die getragene Grösse", () => {
    render(<ProductPage product={suit()} siblings={[]} outfit={[]} recommendations={[]} />);
    const grid = document.querySelector<HTMLElement>(".size-grid")!;
    expect(screen.getByRole("button", { name: "48 (M)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "52 (XL), ausverkauft" })).toBeDisabled();
    expect(grid.querySelector(".size-letter")).toHaveTextContent("M");
    expect(
      screen.getByText("Das Model ist 1,86 m gross und trägt Grösse 50 (L)."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Welche Grösse passt mir?" })).toBeInTheDocument();
  });

  it("«Deine Grösse»: Einstieg nennt sie, der Knopf ist dezent markiert", () => {
    suggested.size = "50";
    render(<ProductPage product={suit()} siblings={[]} outfit={[]} recommendations={[]} />);
    expect(screen.getByRole("button", { name: "Deine Grösse: 50 (L)" })).toBeInTheDocument();
    const mark = screen.getByRole("button", {
      name: "50 (L), deine Grösse laut Grössenfinder",
    });
    expect(mark).toHaveClass("is-suggested");
    // Markiert, aber nicht gewählt: die Wahl bleibt bei der Kundschaft
    expect(mark).toHaveAttribute("aria-pressed", "false");
  });

  it("ohne Model-Angaben keine Zeile; Accessoires ohne Grössenfinder", () => {
    const plain = { ...suit(), fitModel: undefined };
    const { unmount } = render(
      <ProductPage product={plain} siblings={[]} outfit={[]} recommendations={[]} />,
    );
    expect(document.querySelector(".model-line")).toBeNull();
    unmount();
    render(
      <ProductPage
        product={{ ...plain, category: "accessoires" }}
        siblings={[]}
        outfit={[]}
        recommendations={[]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Welche Grösse passt mir?" })).toBeNull();
  });
});
