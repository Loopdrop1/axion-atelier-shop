// Kundenbewertungen im Shop: Durchschnitt, Anzahl und freigegebene Bewertungen eines Produkts (RPC product_reviews).
// Zwei Schalter: shopConfig.features.reviews (hier, ohne ihn gibt es keinen einzigen Netzwerkaufruf) und
// shop_settings.reviews_enabled (prüft die Datenbank; aus = null). Muster-Produkte liefert die Datenbank nie.
import { shopConfig } from "@/config/shop";
import type { Locale } from "@/i18n/locale";
import { backendConfigured } from "@/lib/backend";
import { getSupabase } from "@/lib/supabase-client";

export interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  displayName: string;
  locale: Locale;
  /** Datum der Freigabe (ISO) */
  date: string | null;
}

export interface ProductReviews {
  count: number;
  /** Durchschnitt auf eine Stelle gerundet; null ohne Bewertungen */
  average: number | null;
  items: ProductReview[];
}

/** Bewertungen im Code eingeschaltet (und ein Backend da). Der zweite Schalter liegt in der Datenbank. */
export function reviewsFeatureOn(enabled: boolean = shopConfig.features.reviews): boolean {
  return enabled && backendConfigured;
}

/** Antwort der RPC → Vertrag; Unbrauchbares fällt weg. */
export function mapReviews(raw: unknown): ProductReviews | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r["items"]) ? (r["items"] as Record<string, unknown>[]) : [];
  const items = list.flatMap((i): ProductReview[] => {
    const rating = Number(i["rating"]);
    if (typeof i["body"] !== "string" || !Number.isInteger(rating) || rating < 1 || rating > 5)
      return [];
    return [
      {
        id: String(i["id"] ?? ""),
        rating,
        title: typeof i["title"] === "string" && i["title"] ? i["title"] : null,
        body: i["body"],
        displayName: typeof i["display_name"] === "string" ? i["display_name"] : "",
        locale: i["locale"] === "en" ? "en" : "de",
        date: typeof i["date"] === "string" ? i["date"] : null,
      },
    ];
  });
  const count = Math.max(0, Math.trunc(Number(r["count"]) || 0));
  const average = r["average"] === null || r["average"] === undefined ? null : Number(r["average"]);
  return {
    count,
    average: count > 0 && average !== null && Number.isFinite(average) ? average : null,
    items,
  };
}

/** Freigegebene Bewertungen eines Produkts; null = Bewertungen aus (Code oder Datenbank) oder Muster-Produkt. */
export async function loadProductReviews(
  handle: string,
  enabled: boolean = shopConfig.features.reviews,
): Promise<ProductReviews | null> {
  if (!reviewsFeatureOn(enabled)) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("product_reviews", { p_handle: handle, p_limit: 20 });
  // Migration 0026 fehlt oder Netzfehler: ohne Bewertungen weiter, die Produktseite bleibt heil
  if (error) {
    console.error("Bewertungen nicht lesbar:", error.message);
    return null;
  }
  return mapReviews(data);
}
