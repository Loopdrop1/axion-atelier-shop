// Kleine Produkte für Komponententests (nur die Felder, die die Ansichten brauchen).
import type { Product, Variant } from "@/lib/commerce/types";

export function testVariant(id: string, availableForSale = true, amount = 100): Variant {
  return {
    id,
    title: id.split("-").at(-1) ?? id,
    availableForSale,
    stock: availableForSale ? 3 : 0,
    price: { amount, currencyCode: "CHF" },
    selectedOptions: [],
  };
}

export function testProduct(
  handle: string,
  amount: number,
  variants: Variant[],
  extra: Partial<Product> = {},
): Product {
  return {
    id: handle,
    handle,
    title: handle,
    category: "anzuege",
    categoryTitle: "Anzüge",
    model: handle,
    color: { key: "marine", name: "Marine", hex: "#1E3A2F" },
    tags: [],
    occasions: [],
    description: "",
    details: { features: [] },
    images: [],
    options: [],
    variants,
    priceRange: {
      min: { amount, currencyCode: "CHF" },
      max: { amount, currencyCode: "CHF" },
    },
    outfitHandles: [],
    createdAt: "2026-10-01T00:00:00Z",
    ...extra,
  };
}
