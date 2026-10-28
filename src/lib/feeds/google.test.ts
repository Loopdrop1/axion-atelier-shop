import { describe, expect, it } from "vitest";
import { listProducts } from "@/lib/commerce";
import type { Product } from "@/lib/commerce/types";
import {
  buildGoogleFeed,
  feedPrice,
  GOOGLE_CATEGORIES,
  googleCategory,
  googleFeedResponse,
  isValidGtin,
} from "./google";

const free = { shippingCents: 0, freeShippingFromCents: null };

async function real(handle: string, patch: Partial<Product> = {}): Promise<Product> {
  const all = await listProducts();
  const p = all.find((x) => x.handle === handle) ?? all[0]!;
  return { ...p, tags: p.tags.filter((t) => t !== "muster"), ...patch };
}

describe("Google-Feed", () => {
  it("bildet jede Kategorie auf einen Pfad der Google-Taxonomie ab, unbekannte auf Clothing", () => {
    expect(googleCategory("anzuege")).toBe("Apparel & Accessories > Clothing > Suits");
    expect(googleCategory("hosen")).toBe("Apparel & Accessories > Clothing > Pants");
    expect(googleCategory("hemden")).toBe("Apparel & Accessories > Clothing > Shirts & Tops");
    expect(googleCategory("maentel-jacken")).toBe(
      "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    );
    expect(googleCategory("schuhe")).toBe("Apparel & Accessories > Shoes");
    expect(googleCategory("accessoires")).toBe("Apparel & Accessories > Clothing Accessories");
    expect(googleCategory("neu-erfunden")).toBe("Apparel & Accessories > Clothing");
    expect(Object.keys(GOOGLE_CATEGORIES)).toHaveLength(9);
  });

  it("prüft GTIN mit Prüfziffer", () => {
    expect(isValidGtin("4006381333931")).toBe(true); // EAN-13
    expect(isValidGtin("96385074")).toBe(true); // EAN-8
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("abc")).toBe(false);
    expect(isValidGtin(undefined)).toBe(false);
  });

  it("formatiert Preise als «123.00 CHF»", () => {
    expect(feedPrice(123)).toBe("123.00 CHF");
    expect(feedPrice(0.5)).toBe("0.50 CHF");
  });

  it("schliesst das Muster-Sortiment aus", async () => {
    const muster = (await listProducts()).slice(0, 3);
    expect(muster.every((p) => p.tags.includes("muster"))).toBe(true);
    const xml = buildGoogleFeed(muster, free);
    expect(xml).not.toContain("<item>");
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
  });

  it("führt einen Eintrag pro Grösse mit Gruppe, Kategorie, Versand und absoluten Bildern", async () => {
    const p = await real("anzug-limmat-marine");
    const xml = buildGoogleFeed([p], { shippingCents: 900, freeShippingFromCents: null });
    expect(xml.match(/<item>/g)).toHaveLength(p.variants.length);
    expect(xml).toContain(`<g:item_group_id>${p.model}</g:item_group_id>`);
    expect(xml).toContain(
      "<g:google_product_category>Apparel &amp; Accessories &gt; Clothing &gt; Suits",
    );
    expect(xml).toContain(
      `<g:title>${p.title}, ${p.color.name}, Grösse ${p.variants[0]!.title}</g:title>`,
    );
    expect(xml).toMatch(/<g:image_link>https:\/\/www\.axion-shop\.ch\/\S+<\/g:image_link>/);
    expect(xml).toContain("<g:price>900".replace("900", "9.00") + " CHF</g:price>");
    expect(xml).toContain("<g:gender>male</g:gender>");
    expect(xml).toContain("<g:condition>new</g:condition>");
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(xml).toContain(`<g:link>https://www.axion-shop.ch/produkt/${p.handle}</g:link>`);
  });

  it("setzt Verfügbarkeit, Streichpreis, gültige GTIN und Gratisversand ab Schwelle", async () => {
    const base = await real("anzug-limmat-marine");
    const [a, b] = base.variants as [Product["variants"][number], Product["variants"][number]];
    const p: Product = {
      ...base,
      variants: [
        {
          ...a,
          availableForSale: true,
          price: { amount: 400, currencyCode: "CHF" },
          compareAtPrice: { amount: 500, currencyCode: "CHF" },
          sku: "AX-1",
          barcode: "4006381333931",
        },
        {
          ...b,
          availableForSale: false,
          price: { amount: 100, currencyCode: "CHF" },
          compareAtPrice: undefined,
          barcode: "123",
        },
      ],
    };
    const xml = buildGoogleFeed([p], { shippingCents: 900, freeShippingFromCents: 30000 });
    const [first, second] = xml.split("<item>").slice(1) as [string, string];
    expect(first).toContain("<g:id>AX-1</g:id>");
    expect(first).toContain("<g:availability>in_stock</g:availability>");
    expect(first).toContain("<g:price>500.00 CHF</g:price>");
    expect(first).toContain("<g:sale_price>400.00 CHF</g:sale_price>");
    expect(first).toContain("<g:gtin>4006381333931</g:gtin>");
    expect(first).not.toContain("identifier_exists");
    expect(first).toContain("<g:price>0.00 CHF</g:price>\n      </g:shipping>");
    expect(second).toContain(`<g:id>${b.id}</g:id>`);
    expect(second).toContain("<g:availability>out_of_stock</g:availability>");
    expect(second).not.toContain("sale_price");
    expect(second).not.toContain("<g:gtin>");
    expect(second).toContain("<g:price>9.00 CHF</g:price>\n      </g:shipping>");
  });

  it("lässt Einheitsgrösse im Titel weg und maskiert Sonderzeichen", async () => {
    const base = await real("anzug-limmat-marine");
    const v = { ...base.variants[0]!, title: "OS" };
    const p: Product = {
      ...base,
      title: "Tom & <Jerry>",
      description: "**Fett**\n<b>Text</b>",
      variants: [v],
    };
    const xml = buildGoogleFeed([p], free);
    expect(xml).toContain(`<g:title>Tom &amp; &lt;Jerry&gt;, ${p.color.name}</g:title>`);
    expect(xml).toContain("<g:size>One Size</g:size>");
    expect(xml).toContain("<g:description>Fett Text</g:description>");
  });

  it("antwortet vor dem Livegang mit 404, danach mit XML und Zwischenspeicher", async () => {
    let loaded = false;
    const load = async () => {
      loaded = true;
      return { products: [await real("anzug-limmat-marine")], settings: free };
    };
    const before = await googleFeedResponse(false, load);
    expect(before.status).toBe(404);
    expect(loaded).toBe(false);
    const after = await googleFeedResponse(true, load);
    expect(after.status).toBe(200);
    expect(after.headers.get("Content-Type")).toContain("application/xml");
    expect(after.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(await after.text()).toContain("<item>");
  });
});
