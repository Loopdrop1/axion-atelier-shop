// «Benachrichtigen»: Ist nur eine echte Grösse ausverkauft, ist sie vorgewählt und wird genannt.
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { testProduct, testVariant } from "@/test/products";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/datenschutz">{children}</a>,
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

import { StockAlertForm } from "./stock-alert-form";

describe("StockAlertForm", () => {
  it("nennt die einzige ausverkaufte Grösse", () => {
    const shoe = testProduct("derby", 390, [
      { ...testVariant("derby-41", true, 390), title: "41" },
      { ...testVariant("derby-43", false, 390), title: "43" },
    ]);
    render(<StockAlertForm product={shoe} />);
    expect(screen.getByText("Grösse 43")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("mehrere ausverkauft: Auswahl statt fester Zeile", () => {
    const shoe = testProduct("derby", 390, [
      { ...testVariant("derby-42", false, 390), title: "42" },
      { ...testVariant("derby-43", false, 390), title: "43" },
    ]);
    render(<StockAlertForm product={shoe} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText("Grösse 43")).not.toBeInTheDocument();
  });

  it("Einheitsgrösse: keine Grössenzeile", () => {
    const tie = testProduct("krawatte", 89, [
      { ...testVariant("krawatte-os", false, 89), title: "One Size" },
    ]);
    render(<StockAlertForm product={tie} />);
    expect(screen.queryByText(/Grösse One Size/)).not.toBeInTheDocument();
  });
});
