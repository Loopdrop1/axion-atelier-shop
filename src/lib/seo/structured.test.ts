// Produkt-Markup: Bewertungen nur mit Schalter, nur mit echten, freigegebenen Bewertungen und nie für Muster.
import { describe, expect, it } from "vitest";
import { listProducts } from "@/lib/commerce";
import type { ProductReviews } from "@/lib/commerce/reviews";
import { shopConfig } from "@/config/shop";
import { productLd, reviewLd } from "./structured";

const reviews: ProductReviews = {
  count: 2,
  average: 4.5,
  items: [
    {
      id: "a",
      rating: 5,
      title: "Sitzt perfekt",
      body: "Schöner Stoff und gut verarbeitet.",
      displayName: "Anna M.",
      locale: "de",
      date: "2026-11-01T10:00:00Z",
    },
    {
      id: "b",
      rating: 4,
      title: null,
      body: "Great fabric, fits well.",
      displayName: "Tom K.",
      locale: "en",
      date: null,
    },
  ],
};

async function products() {
  const all = await listProducts({}, "de");
  const muster = all.find((p) => p.tags.includes("muster"))!;
  const real = { ...muster, tags: muster.tags.filter((t) => t !== "muster") };
  return { muster, real };
}

describe("productLd und Bewertungen", () => {
  it("Schalter ist standardmässig aus: keine Bewertungen im Markup", async () => {
    expect(shopConfig.features.reviews).toBe(false);
    const { real } = await products();
    const ld = productLd(real, "/produkt/x", "de", reviews);
    expect(ld).not.toHaveProperty("aggregateRating");
    expect(ld).not.toHaveProperty("review");
    expect(ld).toMatchObject({ "@type": "Product", offers: { "@type": "AggregateOffer" } });
  });

  it("mit Schalter, aber ohne freigegebene Bewertungen: nichts", async () => {
    const { real } = await products();
    expect(reviewLd(real, null, true)).toEqual({});
    expect(reviewLd(real, { count: 0, average: null, items: [] }, true)).toEqual({});
  });

  it("Muster-Produkte bekommen nie Bewertungen, auch mit Schalter und Daten", async () => {
    const { muster } = await products();
    expect(reviewLd(muster, reviews, true)).toEqual({});
    expect(productLd(muster, "/produkt/x", "de", reviews, true)).not.toHaveProperty(
      "aggregateRating",
    );
  });

  it("mit Schalter und echten Bewertungen: AggregateRating und Review", async () => {
    const { real } = await products();
    const ld = productLd(real, "/produkt/x", "en", reviews, true) as Record<string, unknown>;
    expect(ld["aggregateRating"]).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 2,
      bestRating: 5,
      worstRating: 1,
    });
    const list = ld["review"] as Record<string, unknown>[];
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      author: { "@type": "Person", name: "Anna M." },
      datePublished: "2026-11-01",
      name: "Sitzt perfekt",
      inLanguage: "de-CH",
    });
    expect(list[1]).not.toHaveProperty("datePublished");
    expect(list[1]).not.toHaveProperty("name");
  });
});
