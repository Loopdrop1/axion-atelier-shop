// Grössenfinder-Formular: Pflichtangabe, Empfehlung mit Begründung, Übernahme der Grösse, Speichern nur im Browser.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_LETTERS, sizeWithLetter } from "@/lib/commerce/sizes";
import type { FinderContext } from "@/lib/commerce/size-finder";

vi.mock("@/i18n", async (orig) => {
  const actual = (await orig()) as typeof import("@/i18n");
  return { ...actual, useLocale: () => "de", useT: () => actual.messages.de };
});

import { SizeFinder } from "./size-finder";

const context: FinderContext = {
  kind: "clothing",
  sizes: ["46", "48", "50", "52"].map((title) => ({ title, available: title !== "52" })),
  table: {
    columns: ["Grösse", "Brust (cm)"],
    rows: [
      ["46", "92"],
      ["48", "96"],
      ["50", "100"],
      ["52", "104"],
    ],
  },
  letters: DEFAULT_LETTERS,
};
// Standard: keine Zuordnung, die Empfehlung nennt nur die Zahl
const label = (size: string) => sizeWithLetter(size, DEFAULT_LETTERS[size]);
const KEY = "axion-size-profile";

describe("Grössenfinder", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("verlangt die Körpergrösse und meldet unsinnige Zahlen am Feld", () => {
    render(<SizeFinder context={context} label={label} />);
    fireEvent.click(screen.getByRole("button", { name: "Grösse finden" }));
    const height = screen.getByLabelText("Körpergrösse in cm");
    expect(height).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Bitte eine Zahl zwischen 100 und 250 eingeben.")).toBeInTheDocument();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("empfiehlt mit Begründung, Passformwunsch im Grenzfall, und übernimmt die Grösse", async () => {
    const onChoose = vi.fn();
    render(<SizeFinder context={context} label={label} onChoose={onChoose} />);
    fireEvent.change(screen.getByLabelText("Körpergrösse in cm"), { target: { value: "182" } });
    fireEvent.change(screen.getByLabelText("Brustumfang in cm (freiwillig)"), {
      target: { value: "98" },
    });
    fireEvent.click(screen.getByLabelText("Eng anliegend"));
    fireEvent.click(screen.getByRole("button", { name: "Grösse finden" }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Wir empfehlen 48");
    expect(status).toHaveTextContent("Nach deinem Brustumfang und der Grössentabelle.");
    expect(status).toHaveTextContent("Weil du es eng anliegend magst, eine Grösse kleiner.");
    fireEvent.click(screen.getByRole("button", { name: "Grösse 48 wählen" }));
    expect(onChoose).toHaveBeenCalledWith("48");
    // Nur im Browser gespeichert, ohne leere Felder
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}")).toEqual({
      height: 182,
      chest: 98,
      fit: "slim",
    });
    expect(
      screen.getByText(/Deine Angaben werden nur in deinem Browser gespeichert/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Angaben löschen" })).toBeVisible(),
    );
  });

  it("ausverkaufte Grösse: Hinweis statt Knopf; sehr gross: Hinweis zu den Längen", () => {
    render(<SizeFinder context={context} label={label} onChoose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Körpergrösse in cm"), { target: { value: "199" } });
    fireEvent.change(screen.getByLabelText("Brustumfang in cm (freiwillig)"), {
      target: { value: "104" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grösse finden" }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Wir empfehlen 52");
    expect(status).toHaveTextContent("im Moment ausverkauft");
    expect(status).toHaveTextContent("Ärmel- und Beinlänge");
    expect(screen.queryByRole("button", { name: /wählen$/ })).not.toBeInTheDocument();
  });

  it("übernimmt gespeicherte Angaben, rechnet gleich und löscht sie auf Wunsch", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ height: 180, usual: "50" }));
    render(<SizeFinder context={context} label={label} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Wir empfehlen 50"));
    expect(screen.getByLabelText("Diese Grösse trage ich sonst (freiwillig)")).toHaveValue("50");
    fireEvent.click(screen.getByRole("button", { name: "Angaben löschen" }));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(screen.getByLabelText("Körpergrösse in cm")).toHaveValue("");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("Schuhe: Fusslänge und EU-Grösse, ohne Körpergrösse und Passform", () => {
    render(
      <SizeFinder
        context={{
          kind: "shoes",
          sizes: ["42", "43"].map((title) => ({ title, available: true })),
          table: {
            columns: ["EU-Grösse", "Fusslänge (cm)"],
            rows: [
              ["42", "26.7"],
              ["43", "27.4"],
            ],
          },
          letters: DEFAULT_LETTERS,
        }}
        label={(s) => s}
      />,
    );
    expect(screen.queryByLabelText("Körpergrösse in cm")).not.toBeInTheDocument();
    expect(screen.queryByText("Wie soll es sitzen?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grösse finden" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Gib deine Fusslänge oder die EU-Grösse an",
    );
    fireEvent.change(screen.getByLabelText("Fusslänge in cm (freiwillig)"), {
      target: { value: "27,0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grösse finden" }));
    expect(screen.getByRole("status")).toHaveTextContent("Wir empfehlen 43");
  });
});
