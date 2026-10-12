// Test-Doubles für Supabase (RPC + Auth), Stripe und Resend. Laufen als lokale HTTP-Server.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { pool } from "../helpers";

export const SERVICE_KEY = "test-service-key";
export const ANON_KEY = "test-anon-key";

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Unsigniertes Test-JWT im Supabase-Format. */
export function fakeJwt(claims: { sub: string; email?: string }): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ role: "authenticated", aud: "authenticated", ...claims })}.test`;
}

function decodeJwt(token: string): { sub?: string; email?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
  } catch {
    return null;
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export interface FakeServer {
  url: string;
  close: () => Promise<void>;
}

/** PostgREST-RPC und die nötigen GoTrue-Endpunkte auf der lokalen Datenbank. */
export async function startFakeSupabase(): Promise<FakeServer & { rpcCalls: string[] }> {
  const rpcCalls: string[] = [];
  const setof = new Map<string, boolean>();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpcMatch && req.method === "POST") {
        const fn = rpcMatch[1]!;
        rpcCalls.push(fn);
        const args = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
        const claims = token === SERVICE_KEY ? null : decodeJwt(token);
        const role = token === SERVICE_KEY ? "service_role" : claims ? "authenticated" : "anon";
        if (!setof.has(fn)) {
          const r = await pool.query<{ proretset: boolean }>(
            "select proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1",
            [fn],
          );
          setof.set(fn, r.rows[0]?.proretset ?? false);
        }
        const names = Object.keys(args);
        const params = names.map((n) => {
          const v = args[n];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        });
        const call = `public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")})`;
        const c = await pool.connect();
        try {
          await c.query("begin");
          await c.query("select set_config('role', $1, true)", [role]);
          await c.query("select set_config('request.jwt.claims', $1, true)", [
            JSON.stringify({ role, ...(claims ?? {}) }),
          ]);
          await c.query("select set_config('request.headers', $1, true)", [
            JSON.stringify({ "x-forwarded-for": req.headers["x-forwarded-for"] ?? "127.0.0.1" }),
          ]);
          const result = setof.get(fn)
            ? await c.query(`select * from ${call}`, params)
            : await c.query(`select ${call} as r`, params);
          await c.query("commit");
          send(res, 200, setof.get(fn) ? result.rows : (result.rows[0]?.r ?? null));
        } catch (error) {
          await c.query("rollback").catch(() => undefined);
          const e = error as { code?: string; message: string; detail?: string; hint?: string };
          send(res, e.code === "42501" ? 403 : 400, {
            code: e.code,
            message: e.message,
            details: e.detail ?? null,
            hint: e.hint ?? null,
          });
        } finally {
          c.release();
        }
        return;
      }
      if (url.pathname === "/auth/v1/user" && req.method === "GET") {
        const claims = decodeJwt(token);
        const rows = claims?.sub
          ? (await pool.query("select id, email from auth.users where id = $1", [claims.sub])).rows
          : [];
        if (!rows[0]) return send(res, 401, { code: 401, msg: "invalid JWT" });
        return send(res, 200, {
          id: rows[0].id,
          email: rows[0].email,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        });
      }
      const del = url.pathname.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/);
      if (del && req.method === "DELETE") {
        if (token !== SERVICE_KEY) return send(res, 403, { msg: "forbidden" });
        await pool.query("delete from auth.users where id = $1", [del[1]]);
        return send(res, 200, {});
      }
      send(res, 404, { message: `Nicht nachgebaut: ${req.method} ${url.pathname}` });
    } catch (error) {
      send(res, 500, { message: (error as Error).message });
    }
  });
  const url = await listen(server);
  return { url, rpcCalls, close: () => new Promise((r) => server.close(() => r())) };
}

/** Formular-Body von stripe-node (a[b][0][c]=x) in ein verschachteltes Objekt umwandeln. */
export function parseStripeForm(body: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const keys = rawKey.replace(/\]/g, "").split("[");
    let node: Record<string, unknown> | unknown[] = root;
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(keys[i + 1]!);
      const container = node as Record<string, unknown>;
      if (last) container[k] = value;
      else {
        container[k] ??= nextIsIndex ? [] : {};
        node = container[k] as Record<string, unknown>;
      }
    });
  }
  return root;
}

export interface StripeCall {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

export async function startFakeStripe(
  opts: { paymentMethod?: string } = {},
): Promise<FakeServer & { calls: StripeCall[]; failNextSession: (times?: number) => void }> {
  const calls: StripeCall[] = [];
  let fail = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const body = parseStripeForm(await readBody(req));
    calls.push({ method: req.method ?? "", path: url.pathname, body });
    if (url.pathname === "/v1/coupons" && req.method === "POST") {
      return send(res, 200, { id: `co_${randomUUID().slice(0, 8)}`, object: "coupon", ...body });
    }
    if (url.pathname === "/v1/checkout/sessions" && req.method === "POST") {
      if (fail > 0) {
        fail -= 1;
        return send(res, 500, {
          error: { type: "api_error", message: "Stripe ist gerade nicht erreichbar" },
        });
      }
      const id = `cs_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      return send(res, 200, {
        id,
        object: "checkout.session",
        url: `https://checkout.stripe.test/c/pay/${id}`,
        expires_at: Number(body["expires_at"]),
        metadata: body["metadata"],
      });
    }
    const pi = url.pathname.match(/^\/v1\/payment_intents\/([^/]+)$/);
    if (pi && req.method === "GET") {
      const type = opts.paymentMethod ?? "twint";
      return send(res, 200, {
        id: pi[1],
        object: "payment_intent",
        latest_charge: {
          id: "ch_test",
          payment_method_details:
            type === "apple_pay"
              ? { type: "card", card: { wallet: { type: "apple_pay" } } }
              : { type },
        },
      });
    }
    send(res, 404, { error: { message: `Nicht nachgebaut: ${req.method} ${url.pathname}` } });
  });
  const url = await listen(server);
  return {
    url,
    calls,
    failNextSession: (times = 1) => {
      fail = times;
    },
    close: () => new Promise((r) => server.close(() => r())),
  };
}

export interface SentEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
  idempotencyKey?: string;
}

export async function startFakeResend(): Promise<
  FakeServer & { sent: SentEmail[]; failNext: () => void }
> {
  const sent: SentEmail[] = [];
  let fail = false;
  const server = http.createServer(async (req, res) => {
    const body = JSON.parse((await readBody(req)) || "{}") as SentEmail;
    if (req.url === "/emails" && req.method === "POST") {
      if (fail) {
        fail = false;
        return send(res, 500, { message: "Resend nicht erreichbar" });
      }
      const key = req.headers["idempotency-key"];
      sent.push({ ...body, ...(typeof key === "string" ? { idempotencyKey: key } : {}) });
      return send(res, 200, { id: randomUUID() });
    }
    send(res, 404, {});
  });
  const url = await listen(server);
  return {
    url,
    sent,
    failNext: () => {
      fail = true;
    },
    close: () => new Promise((r) => server.close(() => r())),
  };
}
