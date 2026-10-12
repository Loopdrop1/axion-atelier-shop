import { describe, expect, it } from "vitest";
import { mapAnnouncements, mapHomeContent, mapProduct, pick } from "./mapping";
import { media } from "./media";
import type { CategoryRow, ProductRow } from "./rows";
import { estimateTotals, DEFAULT_SETTINGS } from "./source";

const category: CategoryRow = {
  slug: "anzuege",
  name_de: "Anzüge",
  name_en: "Suits",
  description_de: null,
  description_en: null,
  image_path: null,
  sort: 0,
};
const categories = new Map([["anzuege", category]]);

function row(extra: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "p1",
    handle: "anzug-test",
    model: "anzug-test",
    title_de: "Anzug «Test»",
    title_en: null,
    description_de: "Beschreibung",
    description_en: "  ",
    material_de: "Schurwolle",
    material_en: null,
    care_de: null,
    care_en: null,
    fit_note_de: null,
    fit_note_en: null,
    fit: "Slim Fit",
    color_name_de: "Marine",
    color_name_en: "Navy",
    color_hex: "#243448",
    tags: ["neu"],
    occasions: ["hochzeit", "unbekannt"],
    outfit_handles: [],
    price_cents: 54900,
    compare_at_cents: null,
    sort: 0,
    created_at: "2026-10-06T07:00:00Z",
    category: { slug: "anzuege" },
    product_variants: [
      {
        id: "v2",
        size: "50",
        price_cents: null,
        compare_at_cents: null,
        stock: 0,
        sort: 20,
        active: true,
      },
      {
        id: "v1",
        size: "48",
        price_cents: 59900,
        compare_at_cents: null,
        stock: 2,
        sort: 10,
        active: true,
      },
      {
        id: "v3",
        size: "52",
        price_cents: null,
        compare_at_cents: null,
        stock: 5,
        sort: 30,
        active: false,
      },
    ],
    product_images: [
      {
        path: "asset:modelSuit",
        alt_de: "Am Modell",
        alt_en: "On a model",
        width: 1024,
        height: 1280,
        sort: 10,
      },
      { path: "asset:suit", alt_de: "Von vorne", alt_en: null, width: 1024, height: 1280, sort: 0 },
      {
        path: "storage/ohne-url.webp",
        alt_de: "Ohne Supabase",
        alt_en: null,
        width: 800,
        height: 1000,
        sort: 20,
      },
    ],
    ...extra,
  };
}

describe("mapProduct", () => {
  it("fehlende oder leere englische Angaben fallen auf Deutsch zurück", () => {
    const p = mapProduct(row(), "en", categories)!;
    expect(p.title).toBe("Anzug «Test»");
    expect(p.description).toBe("Beschreibung");
    expect(p.details.material).toBe("Schurwolle");
    expect(p.color.name).toBe("Navy");
    expect(p.categoryTitle).toBe("Suits");
    expect(pick("Deutsch", "English", "de")).toBe("Deutsch");
  });

  it("Preise in Franken, Preisspanne aus aktiven Varianten, Verfügbarkeit aus dem Bestand", () => {
    const p = mapProduct(row(), "de", categories)!;
    expect(p.variants.map((v) => [v.title, v.price.amount, v.availableForSale])).toEqual([
      ["48", 599, true],
      ["50", 549, false],
    ]);
    expect(p.priceRange).toEqual({
      min: { amount: 549, currencyCode: "CHF" },
      max: { amount: 599, currencyCode: "CHF" },
    });
    expect(p.options[0]).toEqual({ name: "size", values: ["48", "50"] });
    expect(p.occasions).toEqual(["hochzeit"]);
  });

  it("Bilder sortiert, eingebaute Bilder über media.ts, Storage-Bilder nur mit Supabase-URL", () => {
    const p = mapProduct(row(), "en", categories)!;
    expect(p.images.map((i) => i.url)).toEqual([media.suit.url, media.modelSuit.url]);
    expect(p.images.map((i) => i.altText)).toEqual(["Von vorne", "On a model"]);
  });

  it("ohne aktive Kategorie gibt es kein Produkt", () => {
    expect(mapProduct(row({ category: null }), "de", categories)).toBeNull();
    expect(mapProduct(row({ category: { slug: "gesperrt" } }), "de", categories)).toBeNull();
  });
});

describe("Startseite und Laufband", () => {
  it("nimmt Inhalte aus site_content, englische Lücken aus dem Deutschen, sonst die Standardtexte", () => {
    const home = mapHomeContent(
      {
        "home.hero": { de: { title: "Titel DE", text: "Text DE" }, en: { title: "Title EN" } },
        "home.look": {
          image: "asset:look",
          hotspots: [
            { handle: "a", key: "sakko", label: { de: "Sakko", en: "Jacket" }, x: 37, y: 25 },
            { handle: "kaputt" },
          ],
        },
      },
      "en",
    );
    expect(home.hero.title).toBe("Title EN");
    expect(home.hero.text).toBe("Text DE");
    expect(home.hero.primary).toBe("Discover the collection");
    expect(home.look.hotspots).toEqual([
      { handle: "a", key: "sakko", label: "Jacket", x: 37, y: 25 },
    ]);
    expect(home.look.ctaHandle).toBe("a");
    expect(home.look.image.url).toBe(media.look.url);
    expect(home.story.image.url).toBe(media.fabric.url);
  });

  it("Laufband: leere Einträge fallen weg, ganz leer gibt die Standardtexte", () => {
    expect(
      mapAnnouncements({ announcements: { items: [{ de: "Eins", en: "One" }, { de: "" }] } }, "en"),
    ).toEqual(["One"]);
    expect(mapAnnouncements({}, "de")[0]).toBe("Gratisversand in der ganzen Schweiz");
  });
});

describe("Beträge im Warenkorb (wie reserve_checkout)", () => {
  it("10 % Rabatt und Gutschein auf CHF 738.00", () => {
    expect(estimateTotals(73800, 7380, 10000, DEFAULT_SETTINGS)).toEqual({
      subtotalCents: 73800,
      discountCents: 7380,
      shippingCents: 0,
      giftCardCents: 10000,
      totalCents: 56420,
    });
  });

  it("Gutschein deckt alles: Total 0", () => {
    expect(estimateTotals(12900, 0, 20000, DEFAULT_SETTINGS).totalCents).toBe(0);
  });

  it("Rest unter CHF 0.50: weniger vom Gutschein, damit Stripe mindestens 0.50 abbucht", () => {
    const t = estimateTotals(10000, 0, 9980, DEFAULT_SETTINGS);
    expect(t.totalCents).toBe(50);
    expect(t.giftCardCents).toBe(9950);
  });

  it("Versand: Pauschale unter der Gratis-Schwelle (nach Rabatt)", () => {
    const settings = { ...DEFAULT_SETTINGS, shippingCents: 900, freeShippingFromCents: 20000 };
    expect(estimateTotals(21000, 2000, 0, settings).shippingCents).toBe(900);
    expect(estimateTotals(21000, 0, 0, settings).shippingCents).toBe(0);
  });
});
