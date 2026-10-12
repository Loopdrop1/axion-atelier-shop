// Nachbau von Supabase (Auth, REST, RPC, Storage, Edge Functions) für die Browser-Tests in e2e/.
// Er ersetzt NICHT die echten Prüfungen: Datenbanklogik und RLS testen supabase/tests gegen Postgres,
// die Edge Functions ihre eigenen Tests. Hier geht es nur darum, ob Shop und Admin im Browser richtig fragen
// und richtig auf Antworten reagieren. Die Rechte sind grob nachgebildet (Kundschaft, Admin, anonym).
// Start: bun e2e/fake-supabase.ts (Port 54400, sonst FAKE_SUPABASE_PORT). Zurücksetzen: POST /__reset
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { sampleCatalog } from "../src/lib/commerce/sample-catalog";

const PORT = Number(process.env["FAKE_SUPABASE_PORT"] ?? 54400);

export const FIXTURES = {
  email: "kunde@example.ch",
  password: "richtig-passwort-123",
  userId: "0b7f8c1e-6f2a-4d4b-9a51-2f4b6c7d8e01",
  adminEmail: "admin@example.ch",
  adminPassword: "admin-passwort-123",
  adminId: "0b7f8c1e-6f2a-4d4b-9a51-2f4b6c7d8e02",
  discountCode: "AXION10",
  giftCard: "AXN-TEST-0000-0001",
  emptyGiftCard: "AXN-TEST-0000-0002",
  validOtp: "gueltig",
  outOfStockEmail: "ausverkauft@example.ch",
  newsletterConfirm: "a".repeat(48),
  newsletterInvalid: "b".repeat(48),
  newsletterUnsubscribe: "c".repeat(48),
  statusTokens: {
    paid: "11111111-1111-4111-8111-111111111111",
    shipped: "22222222-2222-4222-8222-222222222222",
    cancelled: "33333333-3333-4333-8333-333333333333",
    giftPaid: "44444444-4444-4444-8444-444444444444",
    pendingForever: "55555555-5555-4555-8555-555555555555",
  },
} as const;

type Row = Record<string, unknown>;

interface User {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  newEmail: string | null;
  metadata: Row;
}

interface Ctx {
  user: User | null;
  admin: boolean;
}

// Daten ---------------------------------------------------------------------------------------------

const now = () => new Date().toISOString();

const item = (
  orderId: string,
  n: number,
  title: string,
  size: string,
  color: string,
  image: string,
  cents: number,
  qty: number,
  variantId: string | null = null,
): Row => ({
  id: `item-${n}`,
  order_id: orderId,
  variant_id: variantId,
  product_id: null,
  title,
  size,
  color,
  image,
  handle: title.toLowerCase().replace(/\s+/g, "-"),
  unit_price_cents: cents,
  quantity: qty,
  line_total_cents: cents * qty,
  restocked_quantity: 0,
  created_at: "2026-09-01T00:00:00Z",
});

function orderRow(values: Row): Row {
  return {
    discount_cents: 0,
    discount_code: null,
    gift_card_cents: 0,
    shipping_cents: 0,
    refunded_cents: 0,
    shipping_name: "Lena Muster",
    shipping_address: {
      line1: "Bahnhofstrasse 1",
      postal_code: "8001",
      city: "Zürich",
      country: "CH",
    },
    phone: null,
    gift_card_purchase: null,
    locale: "de",
    needs_attention: false,
    admin_note: null,
    stripe_session_id: "cs_test_fake",
    stripe_payment_intent_id: "pi_fake",
    issued_gift_card_id: null,
    confirmation_sent_at: "2026-09-01T00:00:00Z",
    notification_sent_at: "2026-09-01T00:00:00Z",
    shipping_sent_at: null,
    gift_card_sent_at: null,
    cancelled_at: null,
    cancel_reason: null,
    polls: 0,
    ...values,
  };
}

function seed() {
  const categories: Row[] = sampleCatalog.categories.map((c) => ({
    id: `cat-${c.slug}`,
    ...c,
    active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  }));
  const products: Row[] = [];
  const variants: Row[] = [];
  const images: Row[] = [];
  for (const p of sampleCatalog.products) {
    const { category, product_variants, product_images, ...rest } = p;
    products.push({
      ...rest,
      category_id: `cat-${category?.slug ?? "anzuege"}`,
      status: "active",
      updated_at: rest.created_at,
    });
    for (const v of product_variants)
      variants.push({ ...v, product_id: p.id, sku: null, barcode: null });
    for (const i of product_images)
      images.push({ ...i, id: randomUUID(), product_id: p.id, created_at: rest.created_at });
  }
  const orders = [
    orderRow({
      id: "o-1040",
      number: 1040,
      user_id: null,
      email: FIXTURES.email,
      status: "paid",
      kind: "cart",
      created_at: "2026-09-02T09:15:00Z",
      paid_at: "2026-09-02T09:16:00Z",
      shipped_at: null,
      subtotal_cents: 12900,
      total_cents: 12900,
      payment_method: "twint",
      tracking_number: null,
      status_token: FIXTURES.statusTokens.paid,
    }),
    orderRow({
      id: "o-1042",
      number: 1042,
      user_id: FIXTURES.userId,
      email: FIXTURES.email,
      status: "shipped",
      kind: "cart",
      created_at: "2026-09-20T14:02:00Z",
      paid_at: "2026-09-20T14:03:00Z",
      shipped_at: "2026-09-21T10:00:00Z",
      shipping_sent_at: "2026-09-21T10:00:00Z",
      subtotal_cents: 61800,
      discount_cents: 6180,
      discount_code: FIXTURES.discountCode,
      gift_card_cents: 5000,
      total_cents: 50620,
      payment_method: "card",
      tracking_number: "99.00.123456.12345678",
      status_token: FIXTURES.statusTokens.shipped,
    }),
    orderRow({
      id: "o-1043",
      number: 1043,
      user_id: FIXTURES.userId,
      email: FIXTURES.email,
      status: "paid",
      kind: "gift_card",
      created_at: "2026-10-01T08:00:00Z",
      paid_at: "2026-10-01T08:01:00Z",
      shipped_at: null,
      subtotal_cents: 10000,
      total_cents: 10000,
      shipping_name: null,
      shipping_address: null,
      payment_method: "twint",
      tracking_number: null,
      gift_card_purchase: { recipient_name: "Marco", amount_cents: 10000 },
      status_token: FIXTURES.statusTokens.giftPaid,
    }),
    orderRow({
      id: "o-1044",
      number: 1044,
      user_id: null,
      email: "jemand@example.ch",
      status: "cancelled",
      kind: "cart",
      created_at: "2026-10-03T08:00:00Z",
      paid_at: null,
      shipped_at: null,
      subtotal_cents: 21900,
      total_cents: 21900,
      payment_method: null,
      tracking_number: null,
      cancelled_at: "2026-10-03T08:40:00Z",
      cancel_reason: "expired",
      status_token: FIXTURES.statusTokens.cancelled,
    }),
    orderRow({
      id: "o-1045",
      number: 1045,
      user_id: null,
      email: "jemand@example.ch",
      status: "pending",
      kind: "cart",
      created_at: "2026-10-04T08:00:00Z",
      paid_at: null,
      shipped_at: null,
      subtotal_cents: 21900,
      total_cents: 21900,
      payment_method: null,
      tracking_number: null,
      status_token: FIXTURES.statusTokens.pendingForever,
      polls: -1_000_000, // bleibt «offen»
    }),
  ];
  const firstVest = variants.find((v) => String(v["id"]).startsWith("weste-limmat-marine"));
  const orderItems = [
    item(
      "o-1040",
      1,
      "Weste Aare",
      "50",
      "Marine",
      "asset:vest",
      12900,
      1,
      (firstVest?.["id"] as string) ?? null,
    ),
    item("o-1042", 2, "Anzug Limmat", "50", "Marine", "asset:suit", 48900, 1),
    item("o-1042", 3, "Weste Aare", "50", "Marine", "asset:vest", 12900, 1),
  ];
  const giftCards: Row[] = [
    {
      id: "g-1",
      code: FIXTURES.giftCard,
      initial_cents: 5000,
      balance_cents: 5000,
      status: "active",
      expires_at: "2031-10-12T00:00:00Z",
      locale: "de",
      purchaser_email: null,
      recipient_email: "beschenkt@example.ch",
      recipient_name: "Mia",
      sender_name: "Axion",
      message: null,
      purchase_order_id: null,
      created_by: FIXTURES.adminId,
      note: null,
      created_at: "2026-09-10T10:00:00Z",
      updated_at: "2026-09-10T10:00:00Z",
    },
    {
      id: "g-2",
      code: FIXTURES.emptyGiftCard,
      initial_cents: 2500,
      balance_cents: 0,
      status: "active",
      expires_at: "2031-10-12T00:00:00Z",
      locale: "de",
      purchaser_email: "kaeufer@example.ch",
      recipient_email: null,
      recipient_name: null,
      sender_name: null,
      message: null,
      purchase_order_id: "o-1043",
      created_by: null,
      note: null,
      created_at: "2026-09-11T10:00:00Z",
      updated_at: "2026-09-11T10:00:00Z",
    },
  ];
  return {
    users: [
      {
        id: FIXTURES.userId,
        email: FIXTURES.email,
        password: FIXTURES.password,
        confirmed: true,
        newEmail: null,
        metadata: { locale: "de", first_name: "Lena", last_name: "Muster" },
      },
      {
        id: FIXTURES.adminId,
        email: FIXTURES.adminEmail,
        password: FIXTURES.adminPassword,
        confirmed: true,
        newEmail: null,
        metadata: { locale: "de", first_name: "Ada", last_name: "Admin" },
      },
    ] as User[],
    tables: {
      categories,
      products,
      product_variants: variants,
      product_images: images,
      site_content: Object.entries(sampleCatalog.content).map(([key, value]) => ({
        key,
        value,
        updated_at: "2026-09-01T00:00:00Z",
        updated_by: null,
      })),
      shop_settings: [
        {
          id: 1,
          shipping_cents: 0,
          free_shipping_from_cents: null,
          gift_card_min_cents: 2500,
          gift_card_max_cents: 100000,
          gift_card_valid_years: 5,
          newsletter_welcome_percent: null,
          notify_email: "shop@example.ch",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      profiles: [
        {
          id: FIXTURES.userId,
          first_name: "Lena",
          last_name: "Muster",
          phone: null,
          address: null,
          locale: "de",
        },
        {
          id: FIXTURES.adminId,
          first_name: "Ada",
          last_name: "Admin",
          phone: null,
          address: null,
          locale: "de",
        },
      ],
      user_roles: [
        { user_id: FIXTURES.adminId, role: "admin", created_at: "2026-09-01T00:00:00Z" },
      ],
      orders,
      order_items: orderItems,
      discount_codes: [
        {
          id: "d-1",
          code: FIXTURES.discountCode,
          kind: "percent",
          value: 10,
          min_subtotal_cents: 0,
          starts_at: null,
          ends_at: null,
          max_redemptions: null,
          redemptions: 3,
          active: true,
          note: "Testcode",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      gift_cards: giftCards,
      gift_card_transactions: [
        {
          id: 1,
          gift_card_id: "g-1",
          order_id: null,
          delta_cents: 5000,
          kind: "issue",
          note: null,
          created_by: null,
          created_at: "2026-09-10T10:00:00Z",
        },
        {
          id: 2,
          gift_card_id: "g-2",
          order_id: "o-1043",
          delta_cents: 2500,
          kind: "issue",
          note: null,
          created_by: null,
          created_at: "2026-09-11T10:00:00Z",
        },
        {
          id: 3,
          gift_card_id: "g-2",
          order_id: "o-1042",
          delta_cents: -2500,
          kind: "redeem",
          note: null,
          created_by: null,
          created_at: "2026-09-20T14:03:00Z",
        },
      ],
      newsletter_subscribers: [
        {
          id: "n-1",
          email: "leserin@example.ch",
          locale: "de",
          status: "confirmed",
          consent_text: "Ja, ich möchte den Newsletter …",
          consent_at: "2026-09-05T10:00:00Z",
          source: "footer",
          confirmed_at: "2026-09-05T10:05:00Z",
          unsubscribed_at: null,
          created_at: "2026-09-05T10:00:00Z",
          updated_at: "2026-09-05T10:05:00Z",
        },
        {
          id: "n-2",
          email: "reader@example.com",
          locale: "en",
          status: "pending",
          consent_text: "Yes, I would like …",
          consent_at: "2026-10-01T10:00:00Z",
          source: "account",
          confirmed_at: null,
          unsubscribed_at: null,
          created_at: "2026-10-01T10:00:00Z",
          updated_at: "2026-10-01T10:00:00Z",
        },
        {
          id: "n-3",
          email: "weg@example.ch",
          locale: "de",
          status: "unsubscribed",
          consent_text: "Ja, ich möchte den Newsletter …",
          consent_at: "2026-08-01T10:00:00Z",
          source: "footer",
          confirmed_at: "2026-08-01T10:05:00Z",
          unsubscribed_at: "2026-09-01T10:00:00Z",
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-09-01T10:00:00Z",
        },
      ],
      stock_movements: [
        {
          id: 1,
          variant_id: variants[0]?.["id"],
          delta: -1,
          reason: "reservation",
          order_id: "o-1042",
          note: null,
          created_by: null,
          created_at: "2026-09-20T14:02:00Z",
        },
      ],
    } as Record<string, Row[]>,
    nextNumber: 1100,
    nextId: 100,
    sessions: new Map<string, string>(),
    files: new Map<string, { type: string; data: Buffer }>(),
    log: [] as { path: string; body: unknown; auth: string | null }[],
  };
}

let state = seed();

// Hilfen --------------------------------------------------------------------------------------------

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-client-info, prefer, accept, accept-profile, content-profile, range, x-supabase-api-version, x-region, x-upsert, cache-control",
  "access-control-expose-headers": "content-range, x-supabase-api-version",
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...headers },
  });

/** Fehler wie PostgREST (eigene RPC-Fehler: message = Code). */
const pgError = (status: number, code: string, message: string, details: unknown = null) =>
  json(status, {
    code,
    message,
    details: details === null ? null : JSON.stringify(details),
    hint: null,
  });

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function jwtFor(user: User): string {
  const t = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      iat: t,
      exp: t + 3600,
      session_id: randomUUID(),
    }),
    "fake-signature",
  ].join(".");
}

function userJson(user: User) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    new_email: user.newEmail ?? undefined,
    email_confirmed_at: user.confirmed ? "2026-09-01T10:00:00Z" : null,
    confirmed_at: user.confirmed ? "2026-09-01T10:00:00Z" : null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: user.metadata,
    identities: [],
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  };
}

function session(user: User) {
  const refresh = randomUUID();
  state.sessions.set(refresh, user.id);
  return {
    access_token: jwtFor(user),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refresh,
    user: userJson(user),
  };
}

function context(req: Request): Ctx {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  let user: User | null = null;
  if (payload) {
    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string };
      user = state.users.find((u) => u.id === claims.sub) ?? null;
    } catch {
      user = null;
    }
  }
  const admin = Boolean(
    user &&
    state.tables["user_roles"]!.some((r) => r["user_id"] === user!.id && r["role"] === "admin"),
  );
  return { user, admin };
}

const authError = (status: number, code: string, msg: string) =>
  json(status, { code: status, error_code: code, msg });

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

const table = (name: string) => (state.tables[name] ??= []);
const nextId = () => state.nextId++;

// Rechte (grob wie RLS und Spaltenrechte in supabase/migrations) ------------------------------------

const ADMIN_ONLY = new Set([
  "discount_codes",
  "gift_cards",
  "gift_card_transactions",
  "newsletter_subscribers",
  "stock_movements",
]);

function productOf(id: unknown) {
  return table("products").find((p) => p["id"] === id);
}

function canRead(name: string, row: Row, ctx: Ctx): boolean {
  if (ctx.admin) return true;
  if (ADMIN_ONLY.has(name)) return false;
  switch (name) {
    case "categories":
      return row["active"] === true;
    case "products":
      return row["status"] === "active";
    case "product_variants":
      return row["active"] === true && productOf(row["product_id"])?.["status"] === "active";
    case "product_images":
      return productOf(row["product_id"])?.["status"] === "active";
    case "orders":
      return Boolean(ctx.user && row["user_id"] === ctx.user.id);
    case "order_items":
      return Boolean(
        ctx.user &&
        table("orders").some((o) => o["id"] === row["order_id"] && o["user_id"] === ctx.user!.id),
      );
    case "profiles":
    case "user_roles":
      return Boolean(ctx.user && (row["id"] ?? row["user_id"]) === ctx.user.id);
    default:
      return true;
  }
}

function canWrite(name: string, ctx: Ctx, values?: Row): boolean {
  if (name === "profiles") return Boolean(ctx.user);
  if (!ctx.admin) return false;
  if (name === "product_variants" && values && "stock" in values) return false; // nur über admin_adjust_stock
  if (
    name === "orders" &&
    values &&
    Object.keys(values).some((k) => !["admin_note", "needs_attention"].includes(k))
  )
    return false;
  return true;
}

// Mini-PostgREST ------------------------------------------------------------------------------------

type Sel =
  | { kind: "all" }
  | { kind: "col"; name: string }
  | { kind: "rel"; alias: string; rel: string; sel: Sel[] };

function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(text: string | null): Sel[] {
  if (!text) return [{ kind: "all" }];
  return splitTop(text.replace(/\s+/g, "")).map((part) => {
    const rel = /^(?:([a-z_]+):)?([a-z_]+)(?:!\w+)?\((.*)\)$/.exec(part);
    if (rel)
      return { kind: "rel", alias: rel[1] ?? rel[2]!, rel: rel[2]!, sel: parseSelect(rel[3]!) };
    if (part === "*") return { kind: "all" };
    return { kind: "col", name: part.split(":").pop()!.split("::")[0]! };
  });
}

const RELATIONS: Record<
  string,
  Record<string, { table: string; local: string; foreign: string; one: boolean }>
> = {
  products: {
    categories: { table: "categories", local: "category_id", foreign: "id", one: true },
    product_variants: { table: "product_variants", local: "id", foreign: "product_id", one: false },
    product_images: { table: "product_images", local: "id", foreign: "product_id", one: false },
  },
  product_variants: {
    products: { table: "products", local: "product_id", foreign: "id", one: true },
  },
  stock_movements: {
    product_variants: { table: "product_variants", local: "variant_id", foreign: "id", one: true },
    orders: { table: "orders", local: "order_id", foreign: "id", one: true },
  },
  orders: { order_items: { table: "order_items", local: "id", foreign: "order_id", one: false } },
  gift_card_transactions: {
    orders: { table: "orders", local: "order_id", foreign: "id", one: true },
  },
};

function project(name: string, row: Row, sel: Sel[], ctx: Ctx): Row {
  const out: Row = {};
  for (const s of sel) {
    if (s.kind === "all")
      Object.assign(out, Object.fromEntries(Object.entries(row).filter(([k]) => k !== "polls")));
    else if (s.kind === "col") out[s.name] = row[s.name] ?? null;
    else {
      const rel = RELATIONS[name]?.[s.rel];
      if (!rel) throw new Error(`Fake: Beziehung ${name} → ${s.rel} fehlt`);
      const related = table(rel.table).filter(
        (r) => r[rel.foreign] === row[rel.local] && canRead(rel.table, r, ctx),
      );
      out[s.alias] = rel.one
        ? related[0]
          ? project(rel.table, related[0], s.sel, ctx)
          : null
        : related.map((r) => project(rel.table, r, s.sel, ctx));
    }
  }
  return out;
}

function likeRegex(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function test(row: Row, col: string, expr: string): boolean {
  const value = row[col];
  const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|in|is|cs)\.(.*)$/s.exec(expr);
  if (!m) return true;
  const [, not, op, raw = ""] = m;
  const cmp = (a: unknown, b: string) => {
    if (typeof a === "number") return a - Number(b);
    if (typeof a === "boolean") return Number(a) - Number(b === "true");
    return String(a ?? "").localeCompare(b);
  };
  let result: boolean;
  switch (op) {
    case "eq":
      result = value !== null && value !== undefined && cmp(value, raw) === 0;
      break;
    case "neq":
      result = value === null || value === undefined || cmp(value, raw) !== 0;
      break;
    case "gt":
      result = value !== null && cmp(value, raw) > 0;
      break;
    case "gte":
      result = value !== null && cmp(value, raw) >= 0;
      break;
    case "lt":
      result = value !== null && cmp(value, raw) < 0;
      break;
    case "lte":
      result = value !== null && cmp(value, raw) <= 0;
      break;
    case "like":
    case "ilike":
      result = typeof value === "string" && likeRegex(raw).test(value);
      break;
    case "in": {
      const list = raw
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((v) => v.replace(/^"|"$/g, ""));
      result = list.some((v) => cmp(value, v) === 0);
      break;
    }
    case "is":
      result = raw === "null" ? value === null || value === undefined : value === (raw === "true");
      break;
    case "cs": {
      const list = raw.replace(/^\{|\}$/g, "").split(",");
      result = Array.isArray(value) && list.every((v) => value.includes(v));
      break;
    }
    default:
      result = true;
  }
  return not ? !result : result;
}

function matches(row: Row, url: URL): boolean {
  for (const [key, expr] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    if (key === "or") {
      const parts = splitTop(expr.replace(/^\(|\)$/g, ""));
      if (
        !parts.some((p) => {
          const [col, ...rest] = p.split(".");
          return test(row, col!, rest.join("."));
        })
      )
        return false;
      continue;
    }
    if (!test(row, key, expr)) return false;
  }
  return true;
}

function sortRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = order.split(",").map((part) => {
    const [col, dir = "asc"] = part.split(".");
    return { col: col!, desc: dir === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const x = a[k.col];
      const y = b[k.col];
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const c =
        typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      if (c !== 0) return k.desc ? -c : c;
    }
    return 0;
  });
}

const DEFAULTS: Record<string, () => Row> = {
  products: () => ({
    status: "draft",
    tags: [],
    occasions: [],
    outfit_handles: [],
    sort: 0,
    description_de: "",
    compare_at_cents: null,
  }),
  categories: () => ({ active: true, sort: 0 }),
  product_variants: () => ({
    stock: 0,
    active: true,
    sort: 0,
    sku: null,
    barcode: null,
    price_cents: null,
    compare_at_cents: null,
  }),
  product_images: () => ({ sort: 0, alt_de: "", width: 1024, height: 1280 }),
  discount_codes: () => ({ redemptions: 0, active: true, min_subtotal_cents: 0 }),
};

const UNIQUE: Record<string, string[][]> = {
  products: [["handle"]],
  categories: [["slug"]],
  discount_codes: [["code"]],
  product_variants: [["product_id", "size"]],
  site_content: [["key"]],
};

function duplicate(name: string, row: Row, ignoreId?: unknown): boolean {
  return (UNIQUE[name] ?? []).some((cols) =>
    table(name).some(
      (r) =>
        r !== row &&
        r["id"] !== ignoreId &&
        cols.every((c) => String(r[c]).toLowerCase() === String(row[c]).toLowerCase()),
    ),
  );
}

async function rest(req: Request, url: URL, ctx: Ctx): Promise<Response> {
  const name = url.pathname.replace("/rest/v1/", "");
  if (name.startsWith("rpc/")) return rpc(name.slice(4), (await readBody(req)) as Row, ctx);
  if (!(name in state.tables)) return pgError(404, "PGRST205", `Fake: Tabelle ${name} fehlt`);
  const prefer = req.headers.get("prefer") ?? "";
  const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  const sel = parseSelect(url.searchParams.get("select"));
  const respond = (rows: Row[], status = 200, extra: Record<string, string> = {}) => {
    const projected = rows.map((r) => project(name, r, sel, ctx));
    if (single) {
      if (projected.length !== 1)
        return pgError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned");
      return json(status, projected[0], extra);
    }
    return json(status, projected, extra);
  };

  if (req.method === "GET" || req.method === "HEAD") {
    let rows = table(name).filter((r) => canRead(name, r, ctx) && matches(r, url));
    rows = sortRows(rows, url.searchParams.get("order"));
    const total = rows.length;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
    rows = rows.slice(offset, limit === undefined ? undefined : offset + limit);
    const headers: Record<string, string> = prefer.includes("count=exact")
      ? {
          "content-range": rows.length
            ? `${offset}-${offset + rows.length - 1}/${total}`
            : `*/${total}`,
        }
      : {};
    return respond(rows, 200, headers);
  }

  const body = await readBody(req);
  if (req.method === "POST") {
    const input = (Array.isArray(body) ? body : [body]) as Row[];
    state.log.push({ path: `${name}:insert`, body, auth: ctx.user?.id ?? null });
    const upsert = prefer.includes("resolution=merge-duplicates");
    const conflict = url.searchParams.get("on_conflict");
    const out: Row[] = [];
    for (const values of input) {
      if (!canWrite(name, ctx, values))
        return pgError(403, "42501", `permission denied for table ${name}`);
      const existing =
        upsert && conflict ? table(name).find((r) => r[conflict] === values[conflict]) : undefined;
      if (existing) {
        Object.assign(existing, values, { updated_at: now() });
        out.push(existing);
        continue;
      }
      const row: Row = {
        id:
          name === "stock_movements" || name === "gift_card_transactions" ? nextId() : randomUUID(),
        created_at: now(),
        updated_at: now(),
        ...(DEFAULTS[name]?.() ?? {}),
        ...values,
      };
      if (duplicate(name, row))
        return pgError(409, "23505", "duplicate key value violates unique constraint");
      table(name).push(row);
      out.push(row);
    }
    return prefer.includes("return=representation")
      ? respond(out, 201)
      : new Response(null, { status: 201, headers: CORS });
  }

  if (req.method === "PATCH") {
    const values = body as Row;
    state.log.push({ path: `${name}:update`, body, auth: ctx.user?.id ?? null });
    if (!canWrite(name, ctx, values))
      return pgError(403, "42501", `permission denied for table ${name}`);
    const rows = table(name).filter((r) => canRead(name, r, ctx) && matches(r, url));
    for (const r of rows) {
      const next = { ...r, ...values };
      if (duplicate(name, next, r["id"]))
        return pgError(409, "23505", "duplicate key value violates unique constraint");
    }
    for (const r of rows) Object.assign(r, values, "updated_at" in r ? { updated_at: now() } : {});
    return prefer.includes("return=representation")
      ? respond(rows)
      : new Response(null, { status: 204, headers: CORS });
  }

  if (req.method === "DELETE") {
    state.log.push({ path: `${name}:delete`, body: url.search, auth: ctx.user?.id ?? null });
    if (!canWrite(name, ctx)) return pgError(403, "42501", `permission denied for table ${name}`);
    const doomed = table(name).filter((r) => canRead(name, r, ctx) && matches(r, url));
    const ids = new Set(doomed.map((r) => r["id"]));
    if (name === "categories" && table("products").some((p) => ids.has(p["category_id"])))
      return pgError(
        409,
        "23503",
        "update or delete on table categories violates foreign key constraint",
      );
    state.tables[name] = table(name).filter((r) => !doomed.includes(r));
    // Kaskaden wie in den Migrationen
    if (name === "products") {
      const variantIds = new Set(
        table("product_variants")
          .filter((v) => ids.has(v["product_id"]))
          .map((v) => v["id"]),
      );
      state.tables["product_variants"] = table("product_variants").filter(
        (v) => !ids.has(v["product_id"]),
      );
      state.tables["product_images"] = table("product_images").filter(
        (i) => !ids.has(i["product_id"]),
      );
      state.tables["stock_movements"] = table("stock_movements").filter(
        (m) => !variantIds.has(m["variant_id"]),
      );
    }
    if (name === "product_variants")
      state.tables["stock_movements"] = table("stock_movements").filter(
        (m) => !ids.has(m["variant_id"]),
      );
    return new Response(null, { status: 204, headers: CORS });
  }
  return pgError(405, "PGRST000", "Fake: Methode fehlt");
}

// RPC -----------------------------------------------------------------------------------------------

const forbidden = () => pgError(401, "42501", "FORBIDDEN");

function orderJson(order: Row) {
  const { polls: _polls, ...rest } = order;
  const issued = table("gift_cards").find((g) => g["id"] === order["issued_gift_card_id"]);
  return {
    ...rest,
    issued_gift_card: issued
      ? {
          id: issued["id"],
          code: issued["code"],
          balance_cents: issued["balance_cents"],
          expires_at: issued["expires_at"],
        }
      : null,
    items: table("order_items").filter((i) => i["order_id"] === order["id"]),
  };
}

function rpc(fn: string, b: Row, ctx: Ctx): Response {
  state.log.push({ path: `rpc/${fn}`, body: b, auth: ctx.user?.id ?? null });
  switch (fn) {
    case "check_discount": {
      const code = String(b["p_code"] ?? "").toLowerCase();
      const subtotal = Number(b["p_subtotal_cents"] ?? 0);
      const d = table("discount_codes").find((x) => String(x["code"]).toLowerCase() === code);
      if (!d) return json(200, { valid: false, reason: "not_found" });
      if (!d["active"]) return json(200, { valid: false, reason: "inactive" });
      if (d["ends_at"] && new Date(String(d["ends_at"])) <= new Date())
        return json(200, { valid: false, reason: "expired" });
      if (subtotal < Number(d["min_subtotal_cents"]))
        return json(200, {
          valid: false,
          reason: "min_subtotal",
          min_subtotal_cents: d["min_subtotal_cents"],
        });
      const discount =
        d["kind"] === "percent"
          ? Math.round((subtotal * Number(d["value"])) / 100)
          : Math.min(subtotal, Number(d["value"]));
      return json(200, {
        valid: true,
        code: d["code"],
        kind: d["kind"],
        value: d["value"],
        discount_cents: discount,
      });
    }
    case "check_gift_card": {
      const g = table("gift_cards").find((x) => x["code"] === b["p_code"]);
      if (!g) return json(200, { valid: false, reason: "not_found" });
      if (g["status"] !== "active") return json(200, { valid: false, reason: "disabled" });
      if (Number(g["balance_cents"]) === 0) return json(200, { valid: false, reason: "empty" });
      return json(200, {
        valid: true,
        balance_cents: g["balance_cents"],
        expires_at: g["expires_at"],
      });
    }
    case "get_order_status": {
      const order = table("orders").find((o) => o["status_token"] === b["p_token"]);
      if (!order) return json(200, null);
      order["polls"] = Number(order["polls"]) + 1;
      // Neue Bestellungen: zuerst «offen», ab dem zweiten Abruf bezahlt (wie der Webhook kurz danach)
      if (order["status"] === "pending" && Number(order["polls"]) >= 2) {
        order["status"] = "paid";
        order["paid_at"] = now();
      }
      const email = String(order["email"]);
      return json(200, {
        order_number: order["number"],
        status: order["status"],
        kind: order["kind"],
        total_cents: order["total_cents"],
        email_hint: `${email[0]}***@${email.split("@")[1]}`,
      });
    }
    case "claim_guest_orders": {
      if (!ctx.user) return forbidden();
      let n = 0;
      for (const o of table("orders"))
        if (!o["user_id"] && o["email"] === ctx.user.email && o["status"] !== "pending") {
          o["user_id"] = ctx.user.id;
          n += 1;
        }
      return json(200, n);
    }
  }
  if (!ctx.admin) return forbidden();
  switch (fn) {
    case "admin_dashboard": {
      const from = new Date(String(b["p_from"]));
      const to = new Date(String(b["p_to"]));
      const inRange = (o: Row) =>
        o["paid_at"] &&
        new Date(String(o["paid_at"])) >= from &&
        new Date(String(o["paid_at"])) < to;
      const sold = table("orders").filter(
        (o) => ["paid", "shipped", "refunded"].includes(String(o["status"])) && inRange(o),
      );
      const cart = sold.filter((o) => o["kind"] === "cart");
      const days: Row[] = [];
      for (let d = new Date(from); d < to; d = new Date(d.getTime() + 86_400_000)) {
        const day = d.toISOString().slice(0, 10);
        const list = cart.filter((o) => String(o["paid_at"]).slice(0, 10) === day);
        days.push({
          day,
          revenue_cents: list.reduce(
            (s, o) => s + Number(o["subtotal_cents"]) - Number(o["discount_cents"]),
            0,
          ),
          orders: list.length,
        });
      }
      return json(200, {
        orders: cart.length,
        revenue_cents: cart.reduce(
          (s, o) =>
            s +
            Number(o["subtotal_cents"]) -
            Number(o["discount_cents"]) -
            Number(o["refunded_cents"]),
          0,
        ),
        gift_cards_sold_cents: sold
          .filter((o) => o["kind"] === "gift_card")
          .reduce((s, o) => s + Number(o["total_cents"]), 0),
        open_to_ship: table("orders").filter((o) => o["kind"] === "cart" && o["status"] === "paid")
          .length,
        needs_attention: table("orders").filter(
          (o) => o["needs_attention"] && o["status"] !== "cancelled",
        ).length,
        newsletter_confirmed: table("newsletter_subscribers").filter(
          (n) => n["status"] === "confirmed",
        ).length,
        daily: days,
        top_products: [
          { title: "Anzug Limmat", handle: "anzug-limmat", quantity: 2, revenue_cents: 97800 },
        ],
        low_stock: table("product_variants")
          .filter(
            (v) =>
              Number(v["stock"]) <= 1 &&
              v["active"] &&
              productOf(v["product_id"])?.["status"] === "active",
          )
          .slice(0, 20)
          .map((v) => {
            const p = productOf(v["product_id"])!;
            return {
              variant_id: v["id"],
              handle: p["handle"],
              title: p["title_de"],
              color: p["color_name_de"],
              size: v["size"],
              stock: v["stock"],
            };
          }),
      });
    }
    case "admin_get_order": {
      const order = table("orders").find((o) => o["id"] === b["p_order_id"]);
      return json(200, order ? orderJson(order) : null);
    }
    case "admin_adjust_stock": {
      const reason = String(b["p_reason"]);
      const delta = Number(b["p_delta"]);
      if (!["sale_store", "return", "correction"].includes(reason))
        return pgError(400, "22023", "INVALID_REASON");
      if (!delta || Math.abs(delta) > 10000) return pgError(400, "22023", "INVALID_DELTA");
      const v = table("product_variants").find((x) => x["id"] === b["p_variant_id"]);
      if (!v) return pgError(404, "P0002", "VARIANT_NOT_FOUND");
      if (Number(v["stock"]) + delta < 0)
        return pgError(400, "P0001", "INSUFFICIENT_STOCK", { available: v["stock"] });
      v["stock"] = Number(v["stock"]) + delta;
      table("stock_movements").push({
        id: nextId(),
        variant_id: v["id"],
        delta,
        reason,
        order_id: null,
        note: (b["p_note"] as string | undefined) ?? null,
        created_by: ctx.user!.id,
        created_at: now(),
      });
      return json(200, v["stock"]);
    }
    case "admin_restock_order": {
      let total = 0;
      for (const entry of (b["p_items"] as Row[]) ?? []) {
        const it = table("order_items").find(
          (i) => i["id"] === entry["order_item_id"] && i["order_id"] === b["p_order_id"],
        );
        const qty = Number(entry["quantity"]);
        if (!it || qty < 1 || Number(it["restocked_quantity"]) + qty > Number(it["quantity"]))
          return pgError(400, "22023", "INVALID_ITEMS");
        it["restocked_quantity"] = Number(it["restocked_quantity"]) + qty;
        const v = table("product_variants").find((x) => x["id"] === it["variant_id"]);
        if (v) {
          v["stock"] = Number(v["stock"]) + qty;
          table("stock_movements").push({
            id: nextId(),
            variant_id: v["id"],
            delta: qty,
            reason: "return",
            order_id: b["p_order_id"],
            note: null,
            created_by: ctx.user!.id,
            created_at: now(),
          });
        }
        total += qty;
      }
      return json(200, { restocked: total });
    }
    case "admin_list_admins":
      return json(
        200,
        table("user_roles")
          .filter((r) => r["role"] === "admin")
          .map((r) => ({
            user_id: r["user_id"],
            email: state.users.find((u) => u.id === r["user_id"])?.email ?? "",
            created_at: r["created_at"],
          })),
      );
    case "admin_grant_admin": {
      const user = state.users.find((u) => u.email === String(b["p_email"]).trim().toLowerCase());
      if (!user) return pgError(404, "P0002", "USER_NOT_FOUND");
      if (!table("user_roles").some((r) => r["user_id"] === user.id))
        table("user_roles").push({ user_id: user.id, role: "admin", created_at: now() });
      return json(200, { user_id: user.id, email: user.email });
    }
    case "admin_revoke_admin": {
      if (b["p_user_id"] === ctx.user!.id) return pgError(400, "P0001", "CANNOT_REVOKE_SELF");
      if (table("user_roles").filter((r) => r["role"] === "admin").length <= 1)
        return pgError(400, "P0001", "LAST_ADMIN");
      state.tables["user_roles"] = table("user_roles").filter(
        (r) => r["user_id"] !== b["p_user_id"],
      );
      return new Response(null, { status: 204, headers: CORS });
    }
    case "admin_get_settings":
      return json(200, table("shop_settings")[0]);
  }
  return pgError(404, "PGRST202", `Fake: Funktion ${fn} fehlt`);
}

// Auth ----------------------------------------------------------------------------------------------

async function auth(req: Request, url: URL, ctx: Ctx): Promise<Response> {
  const path = url.pathname.replace("/auth/v1", "");
  const b = (req.method === "GET" ? {} : await readBody(req)) as Row;
  if (path === "/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const user = state.users.find((u) => u.email === String(b["email"]).toLowerCase());
      if (!user || user.password !== b["password"])
        return authError(400, "invalid_credentials", "Invalid login credentials");
      if (!user.confirmed) return authError(400, "email_not_confirmed", "Email not confirmed");
      return json(200, session(user));
    }
    if (grant === "refresh_token") {
      const userId = state.sessions.get(String(b["refresh_token"]));
      const user = state.users.find((u) => u.id === userId);
      if (!user)
        return authError(
          400,
          "refresh_token_not_found",
          "Invalid Refresh Token: Refresh Token Not Found",
        );
      return json(200, session(user));
    }
  }
  if (path === "/signup") {
    const email = String(b["email"] ?? "").toLowerCase();
    const existing = state.users.find((u) => u.email === email);
    if (existing) return json(200, { ...userJson(existing), identities: [] }); // wie GoTrue: nichts verraten
    const user: User = {
      id: randomUUID(),
      email,
      password: String(b["password"]),
      confirmed: false,
      newEmail: null,
      metadata: (b["data"] as Row) ?? {},
    };
    state.users.push(user);
    return json(200, userJson(user));
  }
  if (path === "/recover") return json(200, {});
  if (path === "/verify") {
    if (b["token_hash"] !== FIXTURES.validOtp)
      return authError(403, "otp_expired", "Email link is invalid or has expired");
    return json(200, session(state.users[0]!));
  }
  if (path === "/user") {
    const user = ctx.user;
    if (!user)
      return authError(401, "no_authorization", "This endpoint requires a valid Bearer token");
    if (req.method === "PUT") {
      if (typeof b["password"] === "string") {
        if (b["password"] === user.password)
          return authError(
            422,
            "same_password",
            "New password should be different from the old password.",
          );
        user.password = b["password"];
      }
      if (typeof b["email"] === "string") {
        if (state.users.some((u) => u.email === b["email"] && u.id !== user.id))
          return authError(
            422,
            "email_exists",
            "A user with this email address has already been registered",
          );
        user.newEmail = String(b["email"]);
      }
    }
    return json(200, userJson(user));
  }
  if (path === "/logout") return new Response(null, { status: 204, headers: CORS });
  return authError(404, "not_found", `Fake: ${path} fehlt`);
}

// Storage -------------------------------------------------------------------------------------------

/** Datei-Teil aus multipart/form-data (eigener Parser: Bun liest Teile ohne Feldnamen nicht). */
function multipartFile(body: Buffer, contentType: string): { data: Buffer; type: string } | null {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!boundary) return null;
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let start = body.indexOf(marker);
  while (start !== -1) {
    const next = body.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = body.subarray(start + marker.length + 2, next - 2); // ohne CRLF davor/danach
    const split = part.indexOf("\r\n\r\n");
    if (split !== -1) {
      const head = part.subarray(0, split).toString("utf8");
      if (/filename=/i.test(head)) {
        const type =
          /content-type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() ?? "application/octet-stream";
        return { data: Buffer.from(part.subarray(split + 4)), type };
      }
    }
    start = next;
  }
  return null;
}

async function storage(req: Request, url: URL, ctx: Ctx): Promise<Response> {
  const path = decodeURIComponent(url.pathname.replace("/storage/v1/object/", ""));
  if (req.method === "GET" && path.startsWith("public/")) {
    const file = state.files.get(path.slice(7));
    return file
      ? new Response(new Uint8Array(file.data), {
          status: 200,
          headers: { "content-type": file.type, ...CORS },
        })
      : json(404, { message: "Object not found" });
  }
  if (!ctx.admin)
    return json(403, {
      statusCode: "403",
      error: "Unauthorized",
      message: "new row violates row-level security policy",
    });
  if (req.method === "POST" || req.method === "PUT") {
    // storage-js schickt Blobs als multipart/form-data (Feld ohne Namen), sonst die rohen Bytes
    let data: Buffer;
    let type = req.headers.get("content-type") ?? "application/octet-stream";
    if (type.startsWith("multipart/form-data")) {
      const file = multipartFile(Buffer.from(await req.arrayBuffer()), type);
      if (!file) return json(400, { message: "Fake: Datei fehlt" });
      ({ data, type } = file);
    } else data = Buffer.from(await req.arrayBuffer());
    state.files.set(path, { type, data });
    state.log.push({
      path: "storage:upload",
      body: { path, bytes: data.length },
      auth: ctx.user?.id ?? null,
    });
    return json(200, { Key: path, Id: randomUUID() });
  }
  if (req.method === "DELETE") {
    const bucket = path.replace(/\/$/, "");
    const b = (await readBody(req)) as { prefixes?: string[] };
    for (const p of b.prefixes ?? []) state.files.delete(`${bucket}/${p}`);
    state.log.push({ path: "storage:remove", body: b, auth: ctx.user?.id ?? null });
    return json(
      200,
      (b.prefixes ?? []).map((name) => ({ name })),
    );
  }
  return json(405, { message: "Fake: Methode fehlt" });
}

// Edge Functions ------------------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const giftCode = () =>
  `AXN-${[0, 1, 2].map(() => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("")).join("-")}`;

async function functions(req: Request, url: URL, ctx: Ctx): Promise<Response> {
  const name = url.pathname.replace("/functions/v1/", "");
  const b = (await readBody(req)) as Row;
  state.log.push({ path: `functions/${name}`, body: b, auth: ctx.user?.id ?? null });
  const origin = req.headers.get("origin") ?? "http://localhost:8080";
  if (name === "checkout") {
    if (b["kind"] === "release") return json(200, { released: true });
    const email = (b["email"] as string | undefined) ?? ctx.user?.email;
    if (!email) return json(400, { error: "INVALID_EMAIL" });
    const lines = (b["lines"] as { variantId: string; quantity: number }[] | undefined) ?? [];
    if (b["kind"] === "cart" && email === FIXTURES.outOfStockEmail)
      return json(409, {
        error: "OUT_OF_STOCK",
        items: [{ variantId: lines[0]?.variantId, available: 0 }],
      });
    if (b["kind"] === "gift_card") {
      const amount = Number(b["amountCents"]);
      if (!Number.isInteger(amount) || amount % 100 !== 0 || amount < 2500 || amount > 100000)
        return json(400, {
          error: "INVALID_AMOUNT",
          detail: { min_cents: 2500, max_cents: 100000 },
        });
    }
    const token = randomUUID();
    const number = state.nextNumber++;
    const subtotal =
      b["kind"] === "gift_card"
        ? Number(b["amountCents"])
        : lines.reduce((s, l) => {
            const v = table("product_variants").find((x) => x["id"] === l.variantId);
            const price = Number(
              v?.["price_cents"] ?? productOf(v?.["product_id"])?.["price_cents"] ?? 0,
            );
            return s + price * l.quantity;
          }, 0);
    table("orders").push(
      orderRow({
        id: `o-${number}`,
        number,
        user_id: ctx.user?.id ?? null,
        email,
        status: "pending",
        kind: b["kind"] === "gift_card" ? "gift_card" : "cart",
        created_at: now(),
        paid_at: null,
        shipped_at: null,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        payment_method: "card",
        tracking_number: null,
        status_token: token,
        polls: 0,
      }),
    );
    const prefix = b["locale"] === "en" ? "/en" : "";
    return json(200, {
      url: `${origin}${prefix}/bestellung/${token}?bezahlt=1`,
      orderNumber: number,
    });
  }
  if (name === "newsletter") {
    const action = b["action"];
    if (action === "subscribe") {
      if (!b["consent"]) return json(400, { error: "CONSENT_REQUIRED" });
      return json(200, { ok: true });
    }
    if (action === "confirm")
      return json(200, {
        status: b["token"] === FIXTURES.newsletterConfirm ? "confirmed" : "invalid",
      });
    if (action === "unsubscribe")
      return json(200, {
        status: b["token"] === FIXTURES.newsletterInvalid ? "invalid" : "unsubscribed",
      });
    return json(400, { error: "BAD_REQUEST" });
  }
  if (name === "account-delete") {
    if (!ctx.user) return json(401, { error: "UNAUTHORIZED" });
    state.users = state.users.filter((u) => u.id !== ctx.user!.id);
    return json(200, { deleted: true, ordersKept: 2 });
  }
  if (name === "contact") {
    if (!String(b["name"] ?? "").trim()) return json(400, { error: "NAME_REQUIRED" });
    if (String(b["message"] ?? "").trim().length < 10)
      return json(400, { error: "MESSAGE_TOO_SHORT" });
    return json(200, { sent: true });
  }
  if (name === "admin-actions") {
    if (!ctx.user) return json(401, { error: "UNAUTHORIZED" });
    if (!ctx.admin) return json(403, { error: "FORBIDDEN" });
    const order = table("orders").find((o) => o["id"] === b["orderId"]);
    switch (b["action"]) {
      case "ship": {
        if (!order) return json(404, { error: "ORDER_NOT_FOUND" });
        if (order["status"] !== "paid" || order["kind"] !== "cart")
          return json(409, { error: "ORDER_NOT_SHIPPABLE" });
        Object.assign(order, {
          status: "shipped",
          shipped_at: now(),
          tracking_number: (b["trackingNumber"] as string | undefined) ?? null,
        });
        const emailed = b["notify"] !== false;
        if (emailed) order["shipping_sent_at"] = now();
        return json(200, { status: "shipped", trackingNumber: order["tracking_number"], emailed });
      }
      case "translate": {
        const texts = Array.isArray(b["texts"]) ? (b["texts"] as string[]) : [];
        return json(200, { translations: texts.map((t) => (t.trim() ? `EN ${t.trim()}` : "")) });
      }
      case "resend_confirmation":
      case "resend_shipping":
        if (!order) return json(404, { error: "ORDER_NOT_FOUND" });
        return json(200, { emailed: true, to: (b["to"] as string | undefined) ?? order["email"] });
      case "issue_gift_card": {
        const amount = Number(b["amountCents"]);
        if (!Number.isInteger(amount) || amount < 100 || amount > 1_000_000)
          return json(400, { error: "INVALID_AMOUNT" });
        const card: Row = {
          id: randomUUID(),
          code: giftCode(),
          initial_cents: amount,
          balance_cents: amount,
          status: "active",
          expires_at: new Date(Date.now() + 5 * 365 * 86_400_000).toISOString(),
          locale: b["locale"] ?? "de",
          purchaser_email: null,
          recipient_email: b["recipientEmail"] ?? null,
          recipient_name: b["recipientName"] ?? null,
          sender_name: b["senderName"] ?? null,
          message: b["message"] ?? null,
          purchase_order_id: null,
          created_by: ctx.user.id,
          note: b["note"] ?? null,
          created_at: now(),
          updated_at: now(),
        };
        table("gift_cards").push(card);
        table("gift_card_transactions").push({
          id: nextId(),
          gift_card_id: card["id"],
          order_id: null,
          delta_cents: amount,
          kind: "issue",
          note: card["note"],
          created_by: ctx.user.id,
          created_at: now(),
        });
        return json(200, {
          giftCard: { id: card["id"], code: card["code"] },
          emailed: Boolean(b["send"] && card["recipient_email"]),
        });
      }
      case "resend_gift_card": {
        const card = table("gift_cards").find((g) => g["id"] === b["giftCardId"]);
        if (!card) return json(404, { error: "GIFT_CARD_NOT_FOUND" });
        return json(200, {
          emailed: true,
          to: (b["to"] as string | undefined) ?? card["recipient_email"] ?? card["purchaser_email"],
        });
      }
    }
    return json(400, { error: "BAD_REQUEST" });
  }
  return json(404, { error: "NOT_FOUND" });
}

// Server --------------------------------------------------------------------------------------------

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === "/__reset") {
    state = seed();
    return json(200, { ok: true });
  }
  if (url.pathname === "/__log") return json(200, state.log);
  if (url.pathname === "/__health") return json(200, { ok: true });
  if (url.pathname.startsWith("/__table/")) return json(200, table(url.pathname.slice(9)));
  const ctx = context(req);
  if (url.pathname.startsWith("/auth/v1/")) return auth(req, url, ctx);
  if (url.pathname.startsWith("/rest/v1/")) return rest(req, url, ctx);
  if (url.pathname.startsWith("/storage/v1/object/")) return storage(req, url, ctx);
  if (url.pathname.startsWith("/functions/v1/")) return functions(req, url, ctx);
  return json(404, { message: "Fake: unbekannter Pfad" });
}

/** Startet den Server (node:http, läuft unter Node und Bun). */
export function startFakeSupabase(port = PORT): Promise<Server> {
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (c: Buffer) => chunks.push(c));
    incoming.on("end", () => {
      const method = incoming.method ?? "GET";
      const headers = new Headers();
      for (const [k, v] of Object.entries(incoming.headers))
        if (typeof v === "string") headers.set(k, v);
      const req = new Request(`http://127.0.0.1:${port}${incoming.url ?? "/"}`, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? null : Buffer.concat(chunks),
      });
      handle(req)
        .then(async (res) => {
          outgoing.writeHead(res.status, Object.fromEntries(res.headers.entries()));
          outgoing.end(Buffer.from(await res.arrayBuffer()));
        })
        .catch((error: unknown) => {
          console.error(error);
          outgoing.writeHead(500, { "content-type": "application/json", ...CORS });
          outgoing.end(JSON.stringify({ message: String(error) }));
        });
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (import.meta.main) {
  await startFakeSupabase();
  console.log(`Fake-Supabase läuft auf http://127.0.0.1:${PORT}`);
}
