// Datenzeilen im Format der Datenbank. Beispielkatalog und Supabase liefern dieselbe Form,
// beide laufen über dieselbe Umwandlung in mapping.ts.
import type { Database, Json } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type CategoryRow = Pick<
  Tables["categories"]["Row"],
  "slug" | "name_de" | "name_en" | "description_de" | "description_en" | "image_path" | "sort"
>;

export type VariantRow = Pick<
  Tables["product_variants"]["Row"],
  "id" | "size" | "price_cents" | "compare_at_cents" | "stock" | "sort" | "active"
> & {
  /** Artikelnummer und Barcode (für den Produktfeed); fehlen bei Beispieldaten */
  sku?: string | null | undefined;
  barcode?: string | null | undefined;
};

export type ImageRow = Pick<
  Tables["product_images"]["Row"],
  "path" | "alt_de" | "alt_en" | "width" | "height" | "sort"
> & {
  /** Fassungen [{w, path}]; fehlt bei Beispieldaten und Bildern ohne Fassungen */
  variants?: Json | null | undefined;
};

export type ProductRow = Pick<
  Tables["products"]["Row"],
  | "id"
  | "handle"
  | "model"
  | "title_de"
  | "title_en"
  | "description_de"
  | "description_en"
  | "material_de"
  | "material_en"
  | "care_de"
  | "care_en"
  | "fit_note_de"
  | "fit_note_en"
  | "origin_de"
  | "origin_en"
  | "features_de"
  | "features_en"
  | "fit"
  | "color_name_de"
  | "color_name_en"
  | "color_hex"
  | "tags"
  | "occasions"
  | "outfit_handles"
  | "price_cents"
  | "compare_at_cents"
  | "sort"
  | "created_at"
> & {
  /** Model-Angaben (Migration 20261103002400); fehlen in älteren Daten */
  model_height_cm?: number | null | undefined;
  model_size?: string | null | undefined;
  category: { slug: string } | null;
  product_variants: VariantRow[];
  product_images: ImageRow[];
};

export interface CatalogData {
  categories: CategoryRow[];
  products: ProductRow[];
  /** site_content: Schlüssel → JSON (Startseite, Laufband) */
  content: Record<string, Json>;
}

const PRODUCT_COLUMNS =
  "id, handle, model, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, fit_note_de, fit_note_en, origin_de, origin_en, features_de, features_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at";
const PRODUCT_RELATIONS =
  "category:categories(slug), product_variants(id, size, sku, barcode, price_cents, compare_at_cents, stock, sort, active), product_images(path, alt_de, alt_en, width, height, sort, variants)";

/** Spalten für die Supabase-Abfrage, passend zu ProductRow. */
export const PRODUCT_SELECT = `${PRODUCT_COLUMNS}, model_height_cm, model_size, ${PRODUCT_RELATIONS}`;

/** Ohne die Model-Angaben: solange Migration 0023 (size_details) in Cloud noch fehlt, lädt der Shop trotzdem. */
export const PRODUCT_SELECT_BASE = `${PRODUCT_COLUMNS}, ${PRODUCT_RELATIONS}`;

export const CATEGORY_SELECT =
  "slug, name_de, name_en, description_de, description_en, image_path, sort";
