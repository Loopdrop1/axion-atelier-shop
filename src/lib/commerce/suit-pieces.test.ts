// Anzug = Sakko und Hose als eigene Produkte (Kundencheckliste 3.11.2026): Sakko in «Anzüge», Hose in «Hosen»,
// gegenseitig unter «Komplettes Outfit» verknüpft. Kollektionen, Outfit (Produktseite und Home-Look teilen
// outfit.ts) und Google-Feed müssen damit funktionieren.
import { describe, expect, it } from "vitest";
import { defaultSelection, planOutfit } from "@/components/shop/outfit";
import { buildGoogleFeed } from "@/lib/feeds/google";
import { filterProducts } from "./index";
import { mapProduct } from "./mapping";
import type { CategoryRow, ProductRow } from "./rows";

const category = (slug: string, name_de: string): CategoryRow => ({
  slug,
  name_de,
  name_en: null,
  description_de: null,
  description_en: null,
  image_path: null,
  sort: 0,
});
const categories = new Map([
  ["anzuege", category("anzuege", "Anzüge")],
  ["hosen", category("hosen", "Hosen")],
]);

function piece(
  handle: string,
  slug: "anzuege" | "hosen",
  outfit: string[],
  price: number,
  image: string,
): ProductRow {
  return {
    id: `p-${handle}`,
    handle,
    model: handle,
    title_de: slug === "anzuege" ? "Sakko «Limmat»" : "Hose «Limmat»",
    title_en: null,
    description_de: "Teil des Anzugs «Limmat».",
    description_en: null,
    material_de: "Schurwolle",
    material_en: null,
    care_de: null,
    care_en: null,
    fit_note_de: null,
    fit_note_en: null,
    origin_de: null,
    origin_en: null,
    features_de: null,
    features_en: null,
    fit: "Slim Fit",
    color_name_de: "Marine",
    color_name_en: "Navy",
    color_hex: "#243448",
    tags: ["neu"],
    occasions: ["hochzeit"],
    outfit_handles: outfit,
    price_cents: price,
    compare_at_cents: null,
    sort: 0,
    created_at: "2026-11-03T08:00:00Z",
    category: { slug },
    product_variants: ["46", "48", "50", "52", "54", "56"].map((size, i) => ({
      id: `${handle}-${size}`,
      size,
      sku: `${handle}-${size}`.toUpperCase(),
      price_cents: null,
      compare_at_cents: null,
      stock: size === "56" ? 0 : 2,
      sort: i * 10,
      active: true,
    })),
    product_images: [
      { path: image, alt_de: "Vorderansicht", alt_en: null, width: 1024, height: 1280, sort: 0 },
    ],
  };
}

const jacket = mapProduct(
  piece(
    "sakko-limmat-marine",
    "anzuege",
    ["hose-limmat-marine"],
    34900,
    "asset:muster/sakko-engadin-marine-1",
  ),
  "de",
  categories,
)!;
const trousers = mapProduct(
  piece(
    "hose-limmat-marine",
    "hosen",
    ["sakko-limmat-marine"],
    14900,
    "asset:muster/hose-sihl-anthrazit-1",
  ),
  "de",
  categories,
)!;
const all = [jacket, trousers];

describe("Anzug aus Sakko (Anzüge) und Hose (Hosen)", () => {
  it("beide Stücke erscheinen im Shop, je in ihrer Kategorie, mit Zahlengrössen 46 bis 56", () => {
    expect(jacket.category).toBe("anzuege");
    expect(trousers.category).toBe("hosen");
    expect(jacket.outfitHandles).toEqual(["hose-limmat-marine"]);
    expect(trousers.outfitHandles).toEqual(["sakko-limmat-marine"]);
    for (const p of all) {
      expect(p.variants.map((v) => v.title)).toEqual(["46", "48", "50", "52", "54", "56"]);
      // Ohne Zuordnung im Admin keine Buchstaben
      expect(p.variants.every((v) => !("letter" in v))).toBe(true);
    }
  });

  it("Kollektionsfilter: Sakko unter «Anzüge», Hose unter «Hosen», beide unter «Alle» und «Neu»", () => {
    const handles = (collection: string) =>
      filterProducts(all, { collection }).map((p) => p.handle);
    expect(handles("anzuege")).toEqual(["sakko-limmat-marine"]);
    expect(handles("hosen")).toEqual(["hose-limmat-marine"]);
    expect(handles("alle").sort()).toEqual(["hose-limmat-marine", "sakko-limmat-marine"]);
    expect(handles("neu")).toHaveLength(2);
    // Grössenfilter findet beide Stücke über dieselbe Zahl
    expect(filterProducts(all, { sizes: ["50"] })).toHaveLength(2);
  });

  it("Komplettes Outfit: der Partner ist vorausgewählt, beide Grössen einzeln wählbar", () => {
    // Produktseite des Sakkos: Outfit = verknüpfte Hose (gleiche Logik im Home-Look)
    const outfit = all.filter((p) => jacket.outfitHandles.includes(p.handle));
    expect(outfit.map((p) => p.handle)).toEqual(["hose-limmat-marine"]);
    expect(defaultSelection(outfit)).toEqual(["hose-limmat-marine"]);
    // Ganzer Anzug als Look: Sakko 50, Hose 48 (Sakko und Hose dürfen verschiedene Grössen haben)
    const look = [jacket, trousers];
    expect(
      planOutfit(look, defaultSelection(look), {
        "sakko-limmat-marine": "sakko-limmat-marine-50",
        "hose-limmat-marine": "hose-limmat-marine-48",
      }),
    ).toEqual({ ok: true, variantIds: ["sakko-limmat-marine-50", "hose-limmat-marine-48"] });
    // Fehlt die Grösse der Hose, kommt nichts in den Warenkorb
    expect(
      planOutfit(look, defaultSelection(look), {
        "sakko-limmat-marine": "sakko-limmat-marine-50",
      }),
    ).toEqual({ ok: false, missing: ["hose-limmat-marine"] });
  });

  it("Google-Feed: Sakko als Suits, Hose als Pants, je ein Eintrag pro Grösse", () => {
    const xml = buildGoogleFeed(all, { shippingCents: 0, freeShippingFromCents: null });
    expect(xml.match(/<item>/g)).toHaveLength(12);
    const items = xml.split("<item>").slice(1);
    const category = (sku: string) =>
      items
        .find((i) => i.includes(`<g:id>${sku}</g:id>`))
        ?.match(/<g:google_product_category>(.*)<\/g:google_product_category>/)?.[1];
    expect(category("SAKKO-LIMMAT-MARINE-50")).toBe(
      "Apparel &amp; Accessories &gt; Clothing &gt; Suits",
    );
    expect(category("HOSE-LIMMAT-MARINE-48")).toBe(
      "Apparel &amp; Accessories &gt; Clothing &gt; Pants",
    );
    expect(xml).toContain("<g:product_type>Anzüge</g:product_type>");
    expect(xml).toContain("<g:product_type>Hosen</g:product_type>");
  });
});
