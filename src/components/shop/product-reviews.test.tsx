// Abschnitt «Bewertungen»: Sterne mit Text für Screenreader, nichts ohne Daten (Schalter aus oder Muster).
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProductReviews } from "@/lib/commerce/reviews";

vi.mock("@/i18n", async (orig) => {
  const actual = (await orig()) as typeof import("@/i18n");
  return { ...actual, useLocale: () => "de", useT: () => actual.messages.de };
});

import { ProductReviewsSection } from "./product-reviews";

function show(initial: ProductReviews | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProductReviewsSection handle="anzug" initial={initial} />
    </QueryClientProvider>,
  );
}

describe("ProductReviewsSection", () => {
  it("ohne Daten (Schalter aus): nichts", () => {
    const { container } = show(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("zeigt Durchschnitt und Bewertungen mit zugänglichen Sternen", () => {
    show({
      count: 1,
      average: 4,
      items: [
        {
          id: "a",
          rating: 4,
          title: "Gute Qualität",
          body: "Der Stoff fühlt sich hochwertig an.",
          displayName: "Marco R.",
          locale: "en",
          date: "2026-11-01T10:00:00Z",
        },
      ],
    });
    expect(screen.getByRole("heading", { name: "Bewertungen" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4,0 von 5 Sternen, 1 Bewertung" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4 von 5 Sternen" })).toBeInTheDocument();
    expect(screen.getByText(/Marco R\./)).toHaveTextContent("Auf Englisch verfasst");
  });

  it("ohne freigegebene Bewertungen: Hinweis statt erfundener Sterne", () => {
    show({ count: 0, average: null, items: [] });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/Noch keine Bewertungen/)).toBeInTheDocument();
  });
});
