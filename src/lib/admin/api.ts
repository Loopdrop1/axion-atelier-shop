// Daten fürs Admin. Rechte prüft die Datenbank (RLS, require_admin in den RPCs); hier nur Abfragen und Fehlertexte.
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { callFunction } from "@/integrations/supabase/functions";
import type {
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import { prepareImage } from "./image";

export type OrderStatus = Enums<"order_status">;
export type StockReason = "sale_store" | "return" | "correction";

function db() {
  if (!supabase) throw new AdminError("NOT_CONFIGURED");
  return supabase;
}

/** Fehler mit Code (aus Postgres/RPC oder Edge Function), damit die Seiten verständliche Texte zeigen. */
export class AdminError extends Error {
  constructor(
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

function fail(error: PostgrestError | null): void {
  if (!error) return;
  // Eigene Fehler aus den RPCs kommen als message (z. B. LAST_ADMIN), Postgres-Fehler als code (z. B. 23505).
  const own = /^[A-Z_]+$/.test(error.message) ? error.message : null;
  let detail: unknown = error.details;
  try {
    detail = error.details ? JSON.parse(error.details) : undefined;
  } catch {
    /* Text bleibt Text */
  }
  throw new AdminError(own ?? error.code ?? "UNKNOWN", detail);
}

/** Deutsche Meldung zu einem Fehler im Admin. */
export function adminErrorText(error: unknown): string {
  const code =
    error instanceof AdminError ? error.code : error instanceof Error ? error.message : "";
  const texts: Record<string, string> = {
    NOT_CONFIGURED: "Das Backend ist noch nicht verbunden.",
    FORBIDDEN: "Dafür fehlen die Admin-Rechte.",
    "42501": "Dafür fehlen die Rechte.",
    "23505": "Diesen Wert gibt es schon (Adresse, Code oder Artikelnummer müssen eindeutig sein).",
    "23503": "Der Eintrag wird noch verwendet und kann nicht gelöscht werden.",
    "23514": "Ein Wert ist nicht erlaubt. Bitte Eingaben prüfen.",
    "22P02": "Ein Wert hat das falsche Format.",
    LAST_ADMIN: "Es muss mindestens ein Admin bleiben.",
    CANNOT_REVOKE_SELF: "Du kannst dir die Admin-Rechte nicht selbst entziehen.",
    USER_NOT_FOUND:
      "Zu dieser E-Mail-Adresse gibt es kein Konto. Die Person muss sich zuerst im Shop registrieren.",
    INSUFFICIENT_STOCK: "So viel ist nicht an Lager.",
    INVALID_DELTA: "Bitte eine Menge zwischen 1 und 10'000 angeben.",
    INVALID_REASON: "Bitte einen Grund wählen.",
    VARIANT_NOT_FOUND: "Diese Grösse gibt es nicht mehr.",
    INVALID_ITEMS: "Diese Menge kann nicht zurückgebucht werden.",
    ORDER_NOT_FOUND: "Bestellung nicht gefunden.",
    ORDER_NOT_SHIPPABLE: "Nur bezahlte Bestellungen können als versendet markiert werden.",
    ORDER_NOT_SHIPPED: "Die Bestellung ist noch nicht versendet.",
    ORDER_NOT_PAID: "Die Bestellung ist noch nicht bezahlt.",
    INVALID_TRACKING: "Die Sendungsnummer ist ungültig.",
    INVALID_AMOUNT: "Der Betrag ist ungültig.",
    INVALID_EMAIL: "Die E-Mail-Adresse ist ungültig.",
    GIFT_CARD_NOT_FOUND: "Gutschein nicht gefunden.",
    EMAIL_FAILED: "Die E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.",
    NETWORK: "Keine Verbindung. Bitte Internet prüfen und erneut versuchen.",
    UNSUPPORTED_TYPE: "Bitte ein Bild im Format JPEG, PNG, WebP oder AVIF wählen.",
    UNREADABLE_IMAGE: "Dieses Bild konnte nicht gelesen werden.",
    UPLOAD_FAILED: "Das Bild konnte nicht hochgeladen werden. Bitte erneut versuchen.",
    INVALID_SIZE: "Bitte eine Grösse angeben.",
    INVALID_RANGE: "Bitte gültige Daten wählen.",
    SPOT_WITHOUT_PRODUCT: "Jeder Punkt braucht ein Produkt.",
    TRANSLATION_UNAVAILABLE: "Die Übersetzung ist gerade nicht verfügbar.",
    TRANSLATION_FAILED: "Die Übersetzung hat nicht geklappt.",
    RATE_LIMITED: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
    TOO_MANY_TEXTS: "Zu viele Texte auf einmal.",
    TEXT_TOO_LONG: "Der Text ist zu lang für die automatische Übersetzung.",
    DAILY_LIMIT:
      "Das Tageslimit der automatischen Übersetzung ist erreicht (500 Anfragen). Morgen geht es wieder; Englisch bis dahin von Hand.",
  };
  return texts[code] ?? "Das hat nicht geklappt. Bitte erneut versuchen.";
}

async function action<T>(body: Record<string, unknown>): Promise<T> {
  const result = await callFunction<T>("admin-actions", body);
  if (!result.ok) throw new AdminError(result.error, result.body);
  return result.data;
}

// Übersetzung ----------------------------------------------------------------------------------------

/** Pakete für die Edge Function: höchstens 40 Texte und 12'000 Zeichen pro Anfrage (Grenze dort: 60 und 16'000). */
export function translationBatches(
  texts: string[],
  maxTexts = 40,
  maxChars = 12_000,
): { start: number; texts: string[] }[] {
  const batches: { start: number; texts: string[] }[] = [];
  let current: { start: number; texts: string[] } = { start: 0, texts: [] };
  let chars = 0;
  texts.forEach((text, i) => {
    if (
      current.texts.length &&
      (current.texts.length >= maxTexts || chars + text.length > maxChars)
    ) {
      batches.push(current);
      current = { start: i, texts: [] };
      chars = 0;
    }
    current.texts.push(text);
    chars += text.length;
  });
  if (current.texts.length) batches.push(current);
  return batches;
}

/** Deutsch → Englisch über die Edge Function (Schlüssel bleibt auf dem Server). Leere Texte bleiben leer.
 *  Viele Texte gehen in mehreren Paketen; Fehler kommen mit Code (AdminError), z. B. TRANSLATION_UNAVAILABLE. */
export async function translateTexts(texts: string[]): Promise<string[]> {
  const out = texts.map(() => "");
  const todo = texts.flatMap((t, i) => (t.trim() ? [i] : []));
  for (const batch of translationBatches(todo.map((i) => texts[i]!))) {
    const { translations } = await action<{ translations: string[] }>({
      action: "translate",
      texts: batch.texts,
    });
    if (!Array.isArray(translations) || translations.length !== batch.texts.length)
      throw new AdminError("TRANSLATION_FAILED");
    translations.forEach((t, k) => {
      out[todo[batch.start + k]!] = typeof t === "string" ? t : "";
    });
  }
  return out;
}

// Zugang --------------------------------------------------------------------------------------------

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await db().from("user_roles").select("role").eq("user_id", userId);
  fail(error);
  return (data ?? []).some((r) => r.role === "admin");
}

// Übersicht -----------------------------------------------------------------------------------------

export interface DashboardStats {
  orders: number;
  revenue_cents: number;
  gift_cards_sold_cents: number;
  open_to_ship: number;
  needs_attention: number;
  newsletter_confirmed: number;
  daily: { day: string; revenue_cents: number; orders: number }[];
  top_products: { title: string; handle: string; quantity: number; revenue_cents: number }[];
  low_stock: {
    variant_id: string;
    handle: string;
    title: string;
    color: string;
    size: string;
    stock: number;
  }[];
}

export async function dashboard(from: Date, to: Date): Promise<DashboardStats> {
  const { data, error } = await db().rpc("admin_dashboard", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  fail(error);
  return data as unknown as DashboardStats;
}

// Bestellungen --------------------------------------------------------------------------------------

const ORDER_LIST =
  "id, number, kind, status, email, total_cents, refunded_cents, created_at, paid_at, shipped_at, needs_attention, shipping_name, tracking_number, payment_method";

export type OrderListRow = Pick<
  Tables<"orders">,
  | "id"
  | "number"
  | "kind"
  | "status"
  | "email"
  | "total_cents"
  | "refunded_cents"
  | "created_at"
  | "paid_at"
  | "shipped_at"
  | "needs_attention"
  | "shipping_name"
  | "tracking_number"
  | "payment_method"
>;

export interface OrderFilter {
  view: "open" | "all" | "attention" | OrderStatus;
  search: string;
  page: number;
}

export const PAGE_SIZE = 50;

export async function listOrders(
  filter: OrderFilter,
): Promise<{ rows: OrderListRow[]; count: number }> {
  let query = db().from("orders").select(ORDER_LIST, { count: "exact" });
  if (filter.view === "open") query = query.eq("status", "paid").eq("kind", "cart");
  else if (filter.view === "attention") query = query.eq("needs_attention", true);
  else if (filter.view !== "all") query = query.eq("status", filter.view);
  else query = query.neq("status", "pending");
  const search = filter.search.trim().replace(/^AX-?/i, "");
  if (/^\d+$/.test(search)) query = query.eq("number", Number(search));
  else if (search) query = query.ilike("email", `%${search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const from = filter.page * PAGE_SIZE;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  fail(error);
  return { rows: (data ?? []) as OrderListRow[], count: count ?? 0 };
}

export interface AdminOrderItem {
  id: string;
  variant_id: string | null;
  product_id: string | null;
  handle: string | null;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  restocked_quantity: number;
}

export interface AdminOrder {
  id: string;
  number: number;
  kind: "cart" | "gift_card";
  status: OrderStatus;
  status_token: string;
  email: string;
  locale: "de" | "en";
  user_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  discount_code: string | null;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  refunded_cents: number;
  shipping_name: string | null;
  shipping_address: {
    line1?: string;
    line2?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  } | null;
  phone: string | null;
  payment_method: string | null;
  tracking_number: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  needs_attention: boolean;
  admin_note: string | null;
  gift_card_purchase: {
    amount_cents?: number;
    recipient_name?: string | null;
    recipient_email?: string | null;
    sender_name?: string | null;
    message?: string | null;
  } | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  confirmation_sent_at: string | null;
  shipping_sent_at: string | null;
  gift_card_sent_at: string | null;
  issued_gift_card: { id: string; code: string; balance_cents: number; expires_at: string } | null;
  items: AdminOrderItem[];
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  const { data, error } = await db().rpc("admin_get_order", { p_order_id: id });
  fail(error);
  return (data as unknown as AdminOrder | null) ?? null;
}

export async function updateOrderNote(
  id: string,
  note: string,
  needsAttention: boolean,
): Promise<void> {
  const { error } = await db()
    .from("orders")
    .update({ admin_note: note.trim() || null, needs_attention: needsAttention })
    .eq("id", id);
  fail(error);
}

export function shipOrder(orderId: string, trackingNumber: string, notify: boolean) {
  return action<{
    status: string;
    trackingNumber: string | null;
    emailed: boolean;
    emailError?: string;
  }>({
    action: "ship",
    orderId,
    trackingNumber: trackingNumber.trim() || undefined,
    notify,
  });
}

export function resendOrderEmail(orderId: string, kind: "confirmation" | "shipping", to?: string) {
  return action<{ emailed: boolean; to: string }>(
    kind === "shipping"
      ? { action: "resend_shipping", orderId }
      : { action: "resend_confirmation", orderId, ...(to ? { to } : {}) },
  );
}

export async function restockOrder(
  orderId: string,
  items: { order_item_id: string; quantity: number }[],
) {
  const { data, error } = await db().rpc("admin_restock_order", {
    p_order_id: orderId,
    p_items: items as unknown as Json,
  });
  fail(error);
  return data as unknown as { restocked: number };
}

/** Bestellungen mit Positionen für den Export (Zeitraum nach Bezahlung). */
export async function exportOrders(from: Date, to: Date) {
  const { data, error } = await db()
    .from("orders")
    .select(
      `number, kind, status, email, created_at, paid_at, shipped_at, subtotal_cents, discount_cents, discount_code,
       gift_card_cents, shipping_cents, total_cents, refunded_cents, shipping_name, shipping_address, payment_method,
       tracking_number, order_items(title, size, color, quantity, unit_price_cents, line_total_cents)`,
    )
    .in("status", ["paid", "shipped", "refunded"])
    .gte("paid_at", from.toISOString())
    .lt("paid_at", to.toISOString())
    .order("paid_at", { ascending: true })
    .limit(5000);
  fail(error);
  return data ?? [];
}

// Katalog -------------------------------------------------------------------------------------------

export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type Variant = Tables<"product_variants">;
export type ProductImage = Tables<"product_images">;

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await db().from("categories").select("*").order("sort").order("slug");
  fail(error);
  return data ?? [];
}

export async function saveCategory(
  input: TablesInsert<"categories"> & { id?: string },
): Promise<Category> {
  const { id, ...values } = input;
  const query = id
    ? db().from("categories").update(values).eq("id", id).select("*").single()
    : db().from("categories").insert(values).select("*").single();
  const { data, error } = await query;
  fail(error);
  return data as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db().from("categories").delete().eq("id", id);
  fail(error);
}

export type ProductListRow = Product & {
  category: { slug: string; name_de: string } | null;
  product_variants: Pick<Variant, "id" | "size" | "stock" | "active">[];
  product_images: Pick<ProductImage, "path" | "sort">[];
};

export async function listProducts(): Promise<ProductListRow[]> {
  const { data, error } = await db()
    .from("products")
    .select(
      "*, category:categories(slug, name_de), product_variants(id, size, stock, active), product_images(path, sort)",
    )
    .order("sort")
    .order("handle");
  fail(error);
  return (data ?? []) as unknown as ProductListRow[];
}

export type ProductDetail = Product & {
  product_variants: Variant[];
  product_images: ProductImage[];
};

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const { data, error } = await db()
    .from("products")
    .select("*, product_variants(*), product_images(*)")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  const product = data as unknown as ProductDetail;
  product.product_variants.sort(
    (a, b) => a.sort - b.sort || a.size.localeCompare(b.size, "de", { numeric: true }),
  );
  product.product_images.sort((a, b) => a.sort - b.sort);
  return product;
}

export async function saveProduct(
  input: TablesInsert<"products"> & { id?: string },
): Promise<Product> {
  const { id, ...values } = input;
  const query = id
    ? db().from("products").update(values).eq("id", id).select("*").single()
    : db().from("products").insert(values).select("*").single();
  const { data, error } = await query;
  fail(error);
  return data as Product;
}

export async function deleteProduct(id: string, imagePaths: string[]): Promise<void> {
  const { error } = await db().from("products").delete().eq("id", id);
  fail(error);
  if (imagePaths.length) await db().storage.from("product-images").remove(imagePaths);
}

/** Neue Grösse; Anfangsbestand als Lagerbewegung «Korrektur: Anfangsbestand». */
export async function addVariant(
  input: Omit<TablesInsert<"product_variants">, "stock">,
  initialStock: number,
): Promise<Variant> {
  const { data, error } = await db().from("product_variants").insert(input).select("*").single();
  fail(error);
  const variant = data as Variant;
  if (initialStock > 0) {
    variant.stock = await adjustStock(variant.id, initialStock, "correction", "Anfangsbestand");
  }
  return variant;
}

export async function updateVariant(
  id: string,
  values: Omit<TablesUpdate<"product_variants">, "stock">,
) {
  const { error } = await db().from("product_variants").update(values).eq("id", id);
  fail(error);
}

export async function deleteVariant(id: string): Promise<void> {
  const { error } = await db().from("product_variants").delete().eq("id", id);
  fail(error);
}

export async function adjustStock(
  variantId: string,
  delta: number,
  reason: StockReason,
  note?: string,
) {
  const { data, error } = await db().rpc("admin_adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    ...(note ? { p_note: note } : {}),
  });
  fail(error);
  return data as number;
}

/** Bild verkleinern, hochladen und als letztes Bild anhängen. */
export async function uploadProductImage(
  product: Pick<Product, "id" | "handle" | "title_de" | "title_en" | "en_auto">,
  file: File,
  sort: number,
): Promise<ProductImage> {
  const image = await prepareImage(file);
  const path = `${product.handle}/${crypto.randomUUID()}.${image.extension}`;
  const upload = await db().storage.from("product-images").upload(path, image.blob, {
    contentType: image.blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) throw new AdminError("UPLOAD_FAILED", upload.error.message);
  const { data, error } = await db()
    .from("product_images")
    .insert({
      product_id: product.id,
      path,
      alt_de: product.title_de,
      alt_en: product.title_en,
      // Übernommener englischer Titel: maschinell, wenn der Titel es ist (folgt dann dem Deutschen)
      en_auto: product.title_en && (product.en_auto ?? []).includes("title") ? ["alt"] : [],
      width: image.width,
      height: image.height,
      sort,
    })
    .select("*")
    .single();
  if (error) {
    await db().storage.from("product-images").remove([path]);
    fail(error);
  }
  return data as ProductImage;
}

export async function updateImage(id: string, values: TablesUpdate<"product_images">) {
  const { error } = await db().from("product_images").update(values).eq("id", id);
  fail(error);
}

export async function deleteImage(image: Pick<ProductImage, "id" | "path">) {
  const { error } = await db().from("product_images").delete().eq("id", image.id);
  fail(error);
  if (!image.path.startsWith("asset:"))
    await db().storage.from("product-images").remove([image.path]);
}

/** Bild für Startseite oder Kategorie (Bucket site-media). Gibt den Pfad zurück. */
export async function uploadSiteImage(file: File, folder: string) {
  const image = await prepareImage(file);
  const path = `${folder}/${crypto.randomUUID()}.${image.extension}`;
  const upload = await db()
    .storage.from("site-media")
    .upload(path, image.blob, { contentType: image.blob.type, cacheControl: "31536000" });
  if (upload.error) throw new AdminError("UPLOAD_FAILED", upload.error.message);
  return { path, width: image.width, height: image.height };
}

// Lager ---------------------------------------------------------------------------------------------

export type StockRow = Pick<
  Variant,
  "id" | "size" | "stock" | "active" | "sku" | "barcode" | "sort"
> & {
  product: Pick<Product, "id" | "handle" | "title_de" | "color_name_de" | "status"> | null;
};

export async function listStock(): Promise<StockRow[]> {
  const { data, error } = await db()
    .from("product_variants")
    .select(
      "id, size, stock, active, sku, barcode, sort, product:products(id, handle, title_de, color_name_de, status)",
    )
    .limit(2000);
  fail(error);
  return ((data ?? []) as unknown as StockRow[]).sort(
    (a, b) =>
      (a.product?.title_de ?? "").localeCompare(b.product?.title_de ?? "", "de") ||
      (a.product?.color_name_de ?? "").localeCompare(b.product?.color_name_de ?? "", "de") ||
      a.sort - b.sort ||
      a.size.localeCompare(b.size, "de", { numeric: true }),
  );
}

export type MovementRow = Tables<"stock_movements"> & {
  variant:
    | (Pick<Variant, "size"> & { product: Pick<Product, "title_de" | "color_name_de"> | null })
    | null;
  order: Pick<Tables<"orders">, "number"> | null;
};

export async function listMovements(limit = 200): Promise<MovementRow[]> {
  const { data, error } = await db()
    .from("stock_movements")
    .select(
      "*, variant:product_variants(size, product:products(title_de, color_name_de)), order:orders(number)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []) as unknown as MovementRow[];
}

// Rabattcodes ---------------------------------------------------------------------------------------

export type DiscountCode = Tables<"discount_codes">;

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  const { data, error } = await db()
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });
  fail(error);
  return data ?? [];
}

export async function saveDiscountCode(input: TablesInsert<"discount_codes"> & { id?: string }) {
  const { id, ...values } = input;
  const { error } = id
    ? await db().from("discount_codes").update(values).eq("id", id)
    : await db().from("discount_codes").insert(values);
  fail(error);
}

export async function deleteDiscountCode(id: string) {
  const { error } = await db().from("discount_codes").delete().eq("id", id);
  fail(error);
}

// Gutscheine ----------------------------------------------------------------------------------------

export type GiftCard = Tables<"gift_cards">;

export async function listGiftCards(search: string): Promise<GiftCard[]> {
  let query = db()
    .from("gift_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const term = search.trim();
  if (term) {
    const safe = term.replace(/[%_\\,()]/g, "");
    query = query.or(
      `code.ilike.%${safe}%,recipient_email.ilike.%${safe}%,purchaser_email.ilike.%${safe}%`,
    );
  }
  const { data, error } = await query;
  fail(error);
  return data ?? [];
}

export async function listGiftCardTransactions(giftCardId: string) {
  const { data, error } = await db()
    .from("gift_card_transactions")
    .select("*, order:orders(number)")
    .eq("gift_card_id", giftCardId)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as unknown as (Tables<"gift_card_transactions"> & {
    order: { number: number } | null;
  })[];
}

export function issueGiftCard(input: {
  amountCents: number;
  locale: "de" | "en";
  recipientEmail?: string | undefined;
  recipientName?: string | undefined;
  senderName?: string | undefined;
  message?: string | undefined;
  note?: string | undefined;
  send: boolean;
}) {
  return action<{ giftCard: { id: string; code: string }; emailed: boolean; emailError?: string }>({
    action: "issue_gift_card",
    ...input,
  });
}

export function resendGiftCard(giftCardId: string, to?: string) {
  return action<{ emailed: boolean; to: string }>({
    action: "resend_gift_card",
    giftCardId,
    ...(to ? { to } : {}),
  });
}

export async function updateGiftCard(
  id: string,
  values: Pick<TablesUpdate<"gift_cards">, "status" | "expires_at" | "note">,
) {
  const { error } = await db().from("gift_cards").update(values).eq("id", id);
  fail(error);
}

// Newsletter ----------------------------------------------------------------------------------------

export type Subscriber = Tables<"newsletter_subscribers">;

export async function listSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await db()
    .from("newsletter_subscribers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000);
  fail(error);
  return data ?? [];
}

export async function deleteSubscriber(id: string) {
  const { error } = await db().from("newsletter_subscribers").delete().eq("id", id);
  fail(error);
}

// Inhalte -------------------------------------------------------------------------------------------

export async function getContent(): Promise<Record<string, Json>> {
  const { data, error } = await db().from("site_content").select("key, value");
  fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export async function saveContent(key: string, value: Json, userId: string) {
  const { error } = await db()
    .from("site_content")
    .upsert({ key, value, updated_by: userId }, { onConflict: "key" });
  fail(error);
}

// Zugänge -------------------------------------------------------------------------------------------

export async function listAdmins() {
  const { data, error } = await db().rpc("admin_list_admins");
  fail(error);
  return data ?? [];
}

export async function grantAdmin(email: string) {
  const { error } = await db().rpc("admin_grant_admin", { p_email: email });
  fail(error);
}

export async function revokeAdmin(userId: string) {
  const { error } = await db().rpc("admin_revoke_admin", { p_user_id: userId });
  fail(error);
}

// Einstellungen -------------------------------------------------------------------------------------

export type Settings = Tables<"shop_settings">;

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().rpc("admin_get_settings");
  fail(error);
  return data as unknown as Settings;
}

export async function saveSettings(
  values: Omit<TablesUpdate<"shop_settings">, "id" | "updated_at">,
) {
  const { error } = await db().from("shop_settings").update(values).eq("id", 1);
  fail(error);
}
