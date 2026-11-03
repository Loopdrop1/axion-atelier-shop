import { describe, expect, it, vi } from "vitest";
import { REVIEW_LIMITS, REVIEW_TOKEN, reviewErrors, reviewProblem } from "./reviews";
// Gleiche Regeln in der Edge Function; läuft hier mit, damit Formular und Server gleich entscheiden
import {
  REVIEW_LIMITS as SERVER_LIMITS,
  REVIEW_TOKEN as SERVER_TOKEN,
  parseReview,
} from "../../supabase/functions/_shared/reviews";
import { loadProductReviews, mapReviews, reviewsFeatureOn } from "./commerce/reviews";
import { shopConfig } from "@/config/shop";

const ok = { rating: 4, title: "", body: "Schöner Stoff, gute Passform.", displayName: "Anna M." };

describe("Bewertungsformular", () => {
  it("Grenzen und Link-Format wie in der Edge Function", () => {
    expect(REVIEW_LIMITS).toEqual(SERVER_LIMITS);
    expect(REVIEW_TOKEN.source).toBe(SERVER_TOKEN.source);
  });

  it("prüft wie der Server", () => {
    const cases = [
      ok,
      { ...ok, rating: 0 },
      { ...ok, rating: 6 },
      { ...ok, body: "kurz" },
      { ...ok, body: "x".repeat(REVIEW_LIMITS.body + 1) },
      { ...ok, displayName: "   " },
      { ...ok, displayName: "x".repeat(41) },
      { ...ok, title: "x".repeat(81) },
    ];
    for (const draft of cases)
      expect(reviewErrors(draft).length === 0, JSON.stringify(draft)).toBe(
        parseReview(draft) !== null,
      );
    expect(reviewErrors({ ...ok, rating: 0, body: "" })).toEqual(["rating", "body"]);
  });

  it("Fehlercodes → Anzeige", () => {
    expect(reviewProblem("NOT_FOUND", 404)).toBe("invalid");
    expect(reviewProblem("REVIEWS_DISABLED", 409)).toBe("disabled");
    expect(reviewProblem("ALREADY_REVIEWED", 409)).toBe("duplicate");
    expect(reviewProblem("RATE_LIMITED", 429)).toBe("rateLimited");
    expect(reviewProblem("NETWORK", 0)).toBe("network");
    expect(reviewProblem("INTERNAL", 500)).toBe("other");
  });
});

describe("Bewertungen im Shop", () => {
  it("ohne Schalter kein Aufruf und keine Daten", async () => {
    expect(shopConfig.features.reviews).toBe(false);
    expect(reviewsFeatureOn()).toBe(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await loadProductReviews("irgendwas")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("mapReviews: Antwort der RPC → Vertrag, Unbrauchbares fällt weg", () => {
    expect(mapReviews(null)).toBeNull();
    expect(mapReviews({ count: 0, average: null, items: [] })).toEqual({
      count: 0,
      average: null,
      items: [],
    });
    const mapped = mapReviews({
      count: 2,
      average: "4.5",
      items: [
        {
          id: "a",
          rating: 5,
          title: "Top",
          body: "Sehr schöner Anzug.",
          display_name: "Anna M.",
          locale: "en",
          date: "2026-11-01T10:00:00Z",
        },
        { id: "b", rating: 9, body: "kaputt" },
      ],
    });
    expect(mapped).toEqual({
      count: 2,
      average: 4.5,
      items: [
        {
          id: "a",
          rating: 5,
          title: "Top",
          body: "Sehr schöner Anzug.",
          displayName: "Anna M.",
          locale: "en",
          date: "2026-11-01T10:00:00Z",
        },
      ],
    });
  });
});
