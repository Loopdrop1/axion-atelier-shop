import { describe, expect, it, vi } from "vitest";
import type { CategoryRow, ImageRow, ProductRow } from "./rows";

vi.mock("@/lib/backend", () => ({
  backendConfigured: true,
  supabaseUrl: "https://abc.supabase.co",
}));

const { mapHomeContent, mapProduct, toImage } = await import("./mapping");

const category: CategoryRow = {
  slug: "anzuege",
  name_de: "Anzüge",
  name_en: null,
  description_de: null,
  description_en: null,
  image_path: null,
  sort: 0,
};
const categories = new Map([["anzuege", category]]);

function product(images: ImageRow[]): ProductRow {
  return {
    id: "p1",
    handle: "anzug",
    model: "anzug",
    title_de: "Anzug Test",
    title_en: "Test suit",
    description_de: "",
    description_en: null,
    material_de: null,
    material_en: null,
    care_de: null,
    care_en: null,
    fit_note_de: null,
    fit_note_en: null,
    origin_de: null,
    origin_en: null,
    features_de: null,
    features_en: null,
    fit: null,
    color_name_de: null,
    color_name_en: null,
    color_hex: null,
    tags: [],
    occasions: [],
    outfit_handles: [],
    price_cents: 10000,
    compare_at_cents: null,
    sort: 0,
    created_at: "2026-10-06T07:00:00Z",
    category: { slug: "anzuege" },
    product_variants: [],
    product_images: images,
  } as unknown as ProductRow;
}

const base = "https://abc.supabase.co/storage/v1/object/public";
const img = (extra: Partial<ImageRow> & { path: string }): ImageRow => ({
  alt_de: "Bild",
  alt_en: null,
  width: 10,
  height: 10,
  sort: 0,
  ...extra,
});

describe("Bildfassungen im Mapping", () => {
  it("Produktbild mit Fassungen: URLs im Bucket, nach Breite sortiert", () => {
    const p = mapProduct(
      product([
        img({
          path: "anzug/a.webp",
          width: 2000,
          height: 2500,
          variants: [
            { w: 1200, path: "anzug/a-1200.webp" },
            { w: 640, path: "anzug/a-640.webp" },
          ],
        }),
      ]),
      "de",
      categories,
    )!;
    expect(p.images[0]!.url).toBe(`${base}/product-images/anzug/a.webp`);
    expect(p.images[0]!.variants).toEqual([
      { url: `${base}/product-images/anzug/a-640.webp`, width: 640 },
      { url: `${base}/product-images/anzug/a-1200.webp`, width: 1200 },
    ]);
  });

  it("ohne Fassungen (null, fehlend, ungültig, eingebaut) bleibt das Bild wie bisher", () => {
    const p = mapProduct(
      product([
        img({ path: "a.webp" }),
        img({ path: "b.webp", sort: 1, variants: null }),
        img({ path: "c.webp", sort: 2, variants: "x" }),
        img({ path: "asset:suit", sort: 3, variants: [{ w: 640, path: "x-640.webp" }] }),
      ]),
      "de",
      categories,
    )!;
    expect(p.images).toHaveLength(4);
    for (const image of p.images) expect("variants" in image).toBe(false);
  });

  it("Bildbeschreibung je Bild, leer: Produkttitel in der Sprache der Seite", () => {
    const images = [
      img({ path: "a.webp", alt_de: "Rückansicht", alt_en: "Back" }),
      img({ path: "b.webp", alt_de: "  ", sort: 1 }),
    ];
    const alts = (locale: "de" | "en") =>
      mapProduct(product(images), locale, categories)!.images.map((i) => i.altText);
    expect(alts("de")).toEqual(["Rückansicht", "Anzug Test"]);
    expect(alts("en")).toEqual(["Back", "Test suit"]);
  });

  it("Startseitenbild und Handy-Bild lesen ihre Fassungen aus dem Inhalt", () => {
    const home = mapHomeContent(
      {
        "home.hero": {
          image: "hero/a.webp",
          image_width: 2560,
          image_height: 1440,
          image_variants: [{ w: 640, path: "hero/a-640.webp" }],
          image_mobile: "hero/m.webp",
          image_mobile_width: 1200,
          image_mobile_height: 1800,
          image_mobile_variants: [{ w: 640, path: "hero/m-640.webp" }],
        },
      },
      "de",
    );
    expect(home.hero.image.variants).toEqual([
      { url: `${base}/site-media/hero/a-640.webp`, width: 640 },
    ]);
    expect(home.hero.image.mobile?.variants).toEqual([
      { url: `${base}/site-media/hero/m-640.webp`, width: 640 },
    ]);
  });

  it("toImage ohne Fassungen im Aufruf (z. B. Kategoriebild) liefert keine", () => {
    expect(toImage("kategorien/x.webp", "x", "site-media")).not.toHaveProperty("variants");
  });
});
