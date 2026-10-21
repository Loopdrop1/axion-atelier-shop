// Woher die Shop-Daten kommen: Supabase, wenn eingerichtet, sonst der Beispielkatalog.
// Der Katalog wird 30 Sekunden zwischengespeichert (pro Browser bzw. pro Server-Instanz),
// damit eine Seite mit mehreren Abfragen nur einmal lädt. Änderungen im Admin sind spätestens dann sichtbar.
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { CATEGORY_SELECT, PRODUCT_SELECT, type CatalogData, type ProductRow } from "./rows";

// Beispielkatalog (Vorschau ohne Backend, Tests) als eigener Teil: Der Shop mit Backend lädt ihn nie mit.
const sampleCatalog = () => import("./sample-catalog").then((m) => m.sampleCatalog);

const TTL_MS = 30_000;
let cache: { at: number; data: Promise<CatalogData> } | null = null;

async function fetchCatalog(): Promise<CatalogData> {
  if (!backendConfigured) return sampleCatalog();
  const [categories, products, content] = await Promise.all([
    supabase.from("categories").select(CATEGORY_SELECT).order("sort").order("slug"),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("status", "active")
      .order("sort")
      .order("handle"),
    supabase.from("site_content").select("key, value"),
  ]);
  if (categories.error) throw categories.error;
  if (products.error) throw products.error;
  if (content.error) throw content.error;
  return {
    categories: categories.data,
    products: products.data as unknown as ProductRow[],
    content: Object.fromEntries(content.data.map((row) => [row.key, row.value])),
  };
}

export function loadCatalog(): Promise<CatalogData> {
  if (!backendConfigured) return sampleCatalog();
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const data = fetchCatalog();
  const entry = { at: now, data };
  cache = entry;
  data.catch(() => {
    if (cache === entry) cache = null;
  });
  return data;
}

/** Nach Änderungen im Admin: nächster Aufruf lädt frisch. */
export function invalidateCatalog() {
  cache = null;
}

export interface ShopSettings {
  shippingCents: number;
  freeShippingFromCents: number | null;
  giftCardMinCents: number;
  giftCardMaxCents: number;
  giftCardValidYears: number;
  /** Ausverkaufte Grössen ausblenden statt als ausverkauft zeigen */
  hideSoldOut: boolean;
}

export const DEFAULT_SETTINGS: ShopSettings = {
  shippingCents: 0,
  freeShippingFromCents: null,
  giftCardMinCents: 2500,
  giftCardMaxCents: 100000,
  giftCardValidYears: 5,
  hideSoldOut: false,
};

export async function loadSettings(): Promise<ShopSettings> {
  if (!backendConfigured) return DEFAULT_SETTINGS;
  const full = await supabase
    .from("shop_settings")
    .select(
      "shipping_cents, free_shipping_from_cents, gift_card_min_cents, gift_card_max_cents, gift_card_valid_years, hide_sold_out",
    )
    .eq("id", 1)
    .maybeSingle();
  let data = full.data;
  if (full.error) {
    // Z. B. Migration 0700 noch nicht ausgeführt (Spalte hide_sold_out fehlt): Versandkosten trotzdem richtig
    // anzeigen, statt still «Gratisversand» zu versprechen, während die Kasse Versand verrechnet.
    console.error("Shop-Einstellungen nicht vollständig lesbar:", full.error.message);
    const base = await supabase
      .from("shop_settings")
      .select(
        "shipping_cents, free_shipping_from_cents, gift_card_min_cents, gift_card_max_cents, gift_card_valid_years",
      )
      .eq("id", 1)
      .maybeSingle();
    if (base.error) console.error("Shop-Einstellungen nicht lesbar:", base.error.message);
    data = base.data ? { ...base.data, hide_sold_out: false } : null;
  }
  if (!data) return DEFAULT_SETTINGS;
  return {
    shippingCents: data.shipping_cents,
    freeShippingFromCents: data.free_shipping_from_cents,
    giftCardMinCents: data.gift_card_min_cents,
    giftCardMaxCents: data.gift_card_max_cents,
    giftCardValidYears: data.gift_card_valid_years,
    hideSoldOut: data.hide_sold_out,
  };
}

/** Versandkosten wie in reserve_checkout: gratis ab Schwelle (Betrag nach Rabatt), sonst Pauschale. */
export function shippingFor(afterDiscountCents: number, settings: ShopSettings): number {
  if (
    settings.freeShippingFromCents !== null &&
    afterDiscountCents >= settings.freeShippingFromCents
  )
    return 0;
  return settings.shippingCents;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  giftCardCents: number;
  totalCents: number;
}

/**
 * Vorschau der Beträge im Warenkorb, gleich gerechnet wie reserve_checkout in der Datenbank
 * (verbindlich rechnet immer der Server): Rabatt, dann Versand, dann Gutschein; bleibt ein Rest
 * unter CHF 0.50 (Stripe-Minimum), wird weniger vom Gutschein genommen.
 */
export function estimateTotals(
  subtotalCents: number,
  discountCents: number,
  giftCardBalanceCents: number,
  settings: ShopSettings,
): Totals {
  const discount = Math.min(Math.max(discountCents, 0), subtotalCents);
  const shipping = shippingFor(subtotalCents - discount, settings);
  const due = subtotalCents - discount + shipping;
  let gift = Math.min(Math.max(giftCardBalanceCents, 0), due);
  const rest = due - gift;
  if (rest >= 1 && rest <= 49) gift = Math.max(0, gift - (50 - rest));
  return {
    subtotalCents,
    discountCents: discount,
    shippingCents: shipping,
    giftCardCents: gift,
    totalCents: due - gift,
  };
}
