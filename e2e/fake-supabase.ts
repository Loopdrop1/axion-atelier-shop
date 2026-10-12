// Nachbau von Supabase (Auth, REST, RPC, Edge Functions) für die Browser-Tests in e2e/.
// Er ersetzt NICHT die echten Prüfungen: Datenbanklogik und RLS testen supabase/tests gegen Postgres,
// die Edge Functions ihre eigenen Tests. Hier geht es nur darum, ob der Shop im Browser richtig fragt und
// richtig auf Antworten reagiert. Start: bun e2e/fake-supabase.ts (Port 54400, sonst FAKE_SUPABASE_PORT).
import { createServer, type Server } from "node:http";
import { sampleCatalog } from "../src/lib/commerce/sample-catalog";

const PORT = Number(process.env["FAKE_SUPABASE_PORT"] ?? 54400);

export const FIXTURES = {
  email: "kunde@example.ch",
  password: "richtig-passwort-123",
  userId: "0b7f8c1e-6f2a-4d4b-9a51-2f4b6c7d8e01",
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

type Json = Record<string, unknown>;

interface User {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  newEmail: string | null;
  metadata: Json;
}

interface OrderRow {
  id: string;
  number: number;
  user_id: string | null;
  email: string;
  status: string;
  kind: "cart" | "gift_card";
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  subtotal_cents: number;
  discount_cents: number;
  discount_code: string | null;
  gift_card_cents: number;
  shipping_cents: number;
  total_cents: number;
  refunded_cents: number;
  shipping_name: string | null;
  shipping_address: Json | null;
  payment_method: string | null;
  tracking_number: string | null;
  gift_card_purchase: Json | null;
  status_token: string;
  polls: number;
  order_items: Json[];
}

const item = (
  n: number,
  title: string,
  size: string,
  color: string,
  image: string,
  cents: number,
  qty: number,
) => ({
  id: `item-${n}`,
  title,
  size,
  color,
  image,
  handle: title.toLowerCase().replace(/\s+/g, "-"),
  unit_price_cents: cents,
  quantity: qty,
  line_total_cents: cents * qty,
});

function seedOrders(): OrderRow[] {
  const base = {
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
    gift_card_purchase: null,
    polls: 0,
  };
  return [
    {
      ...base,
      id: "o-1040",
      number: 1040,
      user_id: null, // Gastbestellung: wird nach der Anmeldung zugeordnet
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
      order_items: [item(1, "Weste Aare", "50", "Marine", "asset:vest", 12900, 1)],
    },
    {
      ...base,
      id: "o-1042",
      number: 1042,
      user_id: FIXTURES.userId,
      email: FIXTURES.email,
      status: "shipped",
      kind: "cart",
      created_at: "2026-09-20T14:02:00Z",
      paid_at: "2026-09-20T14:03:00Z",
      shipped_at: "2026-09-21T10:00:00Z",
      subtotal_cents: 61800,
      discount_cents: 6180,
      discount_code: FIXTURES.discountCode,
      gift_card_cents: 5000,
      total_cents: 50620,
      payment_method: "card",
      tracking_number: "99.00.123456.12345678",
      status_token: FIXTURES.statusTokens.shipped,
      order_items: [
        item(2, "Anzug Limmat", "50", "Marine", "asset:suit", 48900, 1),
        item(3, "Weste Aare", "50", "Marine", "asset:vest", 12900, 1),
      ],
    },
    {
      ...base,
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
      order_items: [],
    },
    {
      ...base,
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
      status_token: FIXTURES.statusTokens.cancelled,
      order_items: [],
    },
    {
      ...base,
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
      order_items: [],
    },
  ];
}

function freshState() {
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
    ] as User[],
    profiles: {
      [FIXTURES.userId]: {
        first_name: "Lena",
        last_name: "Muster",
        phone: null,
        address: null,
        locale: "de",
      },
    } as Record<string, Json>,
    orders: seedOrders(),
    nextNumber: 1100,
    sessions: new Map<string, string>(), // refresh_token → userId
    log: [] as { path: string; body: unknown; auth: string | null }[],
  };
}

let state = freshState();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-client-info, prefer, accept, accept-profile, content-profile, range, x-supabase-api-version, x-region",
  "access-control-expose-headers": "content-range, x-supabase-api-version",
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...headers },
  });

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function jwtFor(user: User): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
      session_id: crypto.randomUUID(),
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
  const refresh = crypto.randomUUID();
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

function currentUser(req: Request): User | null {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string };
    return state.users.find((u) => u.id === claims.sub) ?? null;
  } catch {
    return null;
  }
}

const authError = (status: number, code: string, msg: string) =>
  json(status, { code: status, error_code: code, msg });

async function body(req: Request): Promise<Json> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Json;
  } catch {
    return {};
  }
}

/** PostgREST-Filter wie number=eq.1042 oder id=eq.<uuid> */
function eq(url: URL, column: string): string | null {
  const value = url.searchParams.get(column);
  return value?.startsWith("eq.") ? value.slice(3) : null;
}

function pick(row: Json, select: string | null): Json {
  if (!select || select === "*") return row;
  const out: Json = {};
  // Spalten auf oberster Ebene; eingebettete Tabellen wie order_items(...) vollständig
  for (const part of select.split(/,(?![^(]*\))/)) {
    const name = part.trim().replace(/\(.*$/, "").split(":").pop()!.trim();
    if (name in row) out[name] = row[name];
  }
  return out;
}

async function auth(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace("/auth/v1", "");
  const b = req.method === "GET" ? {} : await body(req);
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
      id: crypto.randomUUID(),
      email,
      password: String(b["password"]),
      confirmed: false,
      newEmail: null,
      metadata: (b["data"] as Json) ?? {},
    };
    state.users.push(user);
    return json(200, userJson(user));
  }
  if (path === "/recover") return json(200, {});
  if (path === "/verify") {
    if (b["token_hash"] !== FIXTURES.validOtp)
      return authError(403, "otp_expired", "Email link is invalid or has expired");
    const user = state.users[0]!;
    return json(200, session(user));
  }
  if (path === "/user") {
    const user = currentUser(req);
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

async function rest(req: Request, url: URL): Promise<Response> {
  const table = url.pathname.replace("/rest/v1/", "");
  const user = currentUser(req);
  const select = url.searchParams.get("select");
  if (table.startsWith("rpc/")) {
    const fn = table.slice(4);
    const b = await body(req);
    state.log.push({ path: `rpc/${fn}`, body: b, auth: user?.id ?? null });
    switch (fn) {
      case "check_discount": {
        const code = String(b["p_code"] ?? "").toUpperCase();
        const subtotal = Number(b["p_subtotal_cents"] ?? 0);
        if (code !== FIXTURES.discountCode) return json(200, { valid: false, reason: "not_found" });
        return json(200, {
          valid: true,
          code,
          kind: "percent",
          value: 10,
          discount_cents: Math.round(subtotal / 10),
        });
      }
      case "check_gift_card": {
        const code = String(b["p_code"] ?? "");
        if (code === FIXTURES.giftCard)
          return json(200, {
            valid: true,
            balance_cents: 5000,
            expires_at: "2031-10-12T00:00:00Z",
          });
        if (code === FIXTURES.emptyGiftCard) return json(200, { valid: false, reason: "empty" });
        return json(200, { valid: false, reason: "not_found" });
      }
      case "get_order_status": {
        const order = state.orders.find((o) => o.status_token === b["p_token"]);
        if (!order) return json(200, null);
        order.polls += 1;
        // Neue Bestellungen: zuerst «offen», ab dem zweiten Abruf bezahlt (wie der Webhook kurz danach)
        if (order.status === "pending" && order.polls >= 2) order.status = "paid";
        return json(200, {
          order_number: order.number,
          status: order.status,
          kind: order.kind,
          total_cents: order.total_cents,
          email_hint: `${order.email[0]}***@${order.email.split("@")[1]}`,
        });
      }
      case "claim_guest_orders": {
        if (!user) return json(401, { code: "42501", message: "FORBIDDEN" });
        let n = 0;
        for (const o of state.orders)
          if (!o.user_id && o.email === user.email && o.status !== "pending") {
            o.user_id = user.id;
            n += 1;
          }
        return json(200, n);
      }
      default:
        return json(404, { code: "PGRST202", message: `Fake: Funktion ${fn} fehlt` });
    }
  }
  if (req.method === "GET") {
    switch (table) {
      case "categories":
        return json(200, sampleCatalog.categories);
      case "products":
        return json(200, sampleCatalog.products);
      case "site_content":
        return json(
          200,
          Object.entries(sampleCatalog.content).map(([key, value]) => ({ key, value })),
        );
      case "shop_settings":
        return json(200, [
          {
            shipping_cents: 0,
            free_shipping_from_cents: null,
            gift_card_min_cents: 2500,
            gift_card_max_cents: 100000,
            gift_card_valid_years: 5,
          },
        ]);
      case "profiles": {
        const id = eq(url, "id");
        const profile = user && id === user.id ? state.profiles[user.id] : null;
        return json(200, profile ? [pick(profile, select)] : []);
      }
      case "orders": {
        if (!user) return json(200, []);
        let rows = state.orders.filter((o) => o.user_id === user.id);
        if (url.searchParams.get("status") === "neq.pending")
          rows = rows.filter((o) => o.status !== "pending");
        const number = eq(url, "number");
        if (number) rows = rows.filter((o) => String(o.number) === number);
        rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
        return json(
          200,
          rows.map((o) => pick(o as unknown as Json, select)),
        );
      }
    }
  }
  if (req.method === "PATCH" && table === "profiles") {
    const id = eq(url, "id");
    if (!user || id !== user.id) return json(200, []);
    const b = await body(req);
    state.log.push({ path: "profiles:update", body: b, auth: user.id });
    state.profiles[user.id] = { ...state.profiles[user.id], ...b };
    return new Response(null, { status: 204, headers: CORS });
  }
  return json(404, { code: "PGRST205", message: `Fake: ${req.method} ${table} fehlt` });
}

async function functions(req: Request, url: URL): Promise<Response> {
  const name = url.pathname.replace("/functions/v1/", "");
  const user = currentUser(req);
  const b = await body(req);
  state.log.push({ path: `functions/${name}`, body: b, auth: user?.id ?? null });
  const origin = req.headers.get("origin") ?? "http://localhost:8080";
  if (name === "checkout") {
    if (b["kind"] === "release") return json(200, { released: true });
    const email = (b["email"] as string | undefined) ?? user?.email;
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
    const token = crypto.randomUUID();
    const number = state.nextNumber++;
    state.orders.push({
      ...seedOrders()[0]!,
      id: `o-${number}`,
      number,
      user_id: user?.id ?? null,
      email,
      status: "pending",
      kind: b["kind"] === "gift_card" ? "gift_card" : "cart",
      created_at: new Date().toISOString(),
      total_cents: b["kind"] === "gift_card" ? Number(b["amountCents"]) : 10000,
      status_token: token,
      polls: 0,
    });
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
    if (!user) return json(401, { error: "UNAUTHORIZED" });
    state.users = state.users.filter((u) => u.id !== user.id);
    return json(200, { deleted: true, ordersKept: 2 });
  }
  return json(404, { error: "NOT_FOUND" });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === "/__reset") {
    state = freshState();
    return json(200, { ok: true });
  }
  if (url.pathname === "/__log") return json(200, state.log);
  if (url.pathname === "/__health") return json(200, { ok: true });
  if (url.pathname.startsWith("/auth/v1/")) return auth(req, url);
  if (url.pathname.startsWith("/rest/v1/")) return rest(req, url);
  if (url.pathname.startsWith("/functions/v1/")) return functions(req, url);
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
