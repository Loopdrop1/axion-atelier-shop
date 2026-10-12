// Rauchtest: startet die echten index.ts der Edge Functions unter Deno (mit den npm-Paketen aus deno.json)
// gegen die lokalen Fakes für Supabase, Stripe und Resend und prüft je einen echten Ablauf.
// Voraussetzung: lokale Datenbank (bun run db:reset) und Deno (DENO_BIN, Standard «deno»).
// Aufruf: bun scripts/deno-smoke.ts
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import Stripe from "stripe";
import { Webhook } from "standardwebhooks";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeStripe,
  startFakeSupabase,
} from "../supabase/tests/fakes/servers";
import { makeProduct } from "../supabase/tests/fixtures";
import { pool, sql } from "../supabase/tests/helpers";

const DENO = process.env["DENO_BIN"] ?? "deno";
const ROOT = path.resolve(import.meta.dirname, "../supabase/functions");
const PORT = 8000; // Deno.serve() ohne Optionen
const WEBHOOK_SECRET = "whsec_smoke";
const HOOK_SECRET = `v1,whsec_${randomBytes(32).toString("base64")}`;

const supa = await startFakeSupabase();
const stripe = await startFakeStripe({ paymentMethod: "card" });
const resend = await startFakeResend();
const env = {
  ...process.env,
  SUPABASE_URL: supa.url,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  SUPABASE_ANON_KEY: ANON_KEY,
  SITE_URL: "https://shop.test",
  STRIPE_SECRET_KEY: "sk_test_smoke",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_API_BASE: stripe.url,
  RESEND_API_KEY: "re_smoke",
  RESEND_API_BASE: resend.url,
  SHOP_NOTIFY_EMAIL: "shop@shop.test",
  SEND_EMAIL_HOOK_SECRET: HOOK_SECRET,
};

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "OK  " : "FEHLER"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function withFunction(name: string, fn: (url: string) => Promise<void>) {
  const child: ChildProcess = spawn(
    DENO,
    ["run", "--allow-net", "--allow-env", "--allow-read", "index.ts"],
    {
      cwd: path.join(ROOT, name),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  child.stdout?.on("data", (d) => (log += d));
  child.stderr?.on("data", (d) => (log += d));
  const url = `http://127.0.0.1:${PORT}`;
  try {
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > 120_000) throw new Error(`${name} startet nicht:\n${log}`);
      if (child.exitCode !== null) throw new Error(`${name} beendet (${child.exitCode}):\n${log}`);
      try {
        await fetch(url, { method: "OPTIONS" });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    await fn(url);
  } catch (error) {
    check(`${name} läuft unter Deno`, false, (error as Error).message.slice(0, 500));
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
    if (failures) console.log(`--- Log ${name} ---\n${log.slice(-2000)}`);
  }
}

const product = await makeProduct({ priceCents: 48900, stocks: [2] });
let orderId = "";

await withFunction("checkout", async (url) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://shop.test" },
    body: JSON.stringify({
      kind: "cart",
      locale: "de",
      email: "smoke@example.ch",
      lines: [{ variantId: product.variants[0]!.id, quantity: 1 }],
    }),
  });
  const body = (await res.json()) as { url?: string };
  check(
    "checkout: Stripe-Session unter Deno",
    res.status === 200 && Boolean(body.url?.startsWith("https://checkout.stripe.test/")),
    `${res.status} ${JSON.stringify(body)}`,
  );
  check(
    "checkout: CORS-Header",
    res.headers.get("access-control-allow-origin") === "https://shop.test",
  );
  const row = await sql<{ id: string }>(
    "select id from public.orders where email = 'smoke@example.ch' order by created_at desc limit 1",
  );
  orderId = row[0]?.id ?? "";
});

await withFunction("stripe-webhook", async (url) => {
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: "event",
    type: "checkout.session.completed",
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "cs_test_smoke",
        object: "checkout.session",
        client_reference_id: orderId,
        metadata: { order_id: orderId },
        payment_status: "paid",
        payment_intent: "pi_smoke",
        amount_total: 48900,
        customer_details: { email: "smoke@example.ch", name: "Smoke Test" },
        collected_information: {
          shipping_details: {
            name: "Smoke Test",
            address: { line1: "Testweg 1", postal_code: "8000", city: "Zürich", country: "CH" },
          },
        },
      },
    },
  });
  const header = await new Stripe("sk_test_signer").webhooks.generateTestHeaderStringAsync({
    payload,
    secret: WEBHOOK_SECRET,
  });
  const before = resend.sent.length;
  const res = await fetch(url, {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
  const status = await sql<{ status: string; payment_method: string }>(
    "select status, payment_method from public.orders where id = $1",
    [orderId],
  );
  check(
    "stripe-webhook: Signatur (SubtleCrypto) und Verbuchung unter Deno",
    res.status === 200 && status[0]?.status === "paid",
    `${res.status} ${status[0]?.status}`,
  );
  check(
    "stripe-webhook: Zahlungsart aus PaymentIntent",
    status[0]?.payment_method === "card",
    status[0]?.payment_method,
  );
  check(
    "stripe-webhook: Bestätigung und Shop-Meldung",
    resend.sent.length - before === 2,
    String(resend.sent.length - before),
  );
  const bad = await fetch(url, {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=x" },
    body: payload,
  });
  check("stripe-webhook: falsche Signatur 400", bad.status === 400);
});

await withFunction("auth-email-hook", async (url) => {
  const payload = JSON.stringify({
    user: { id: randomUUID(), email: "konto@example.ch", user_metadata: { locale: "en" } },
    email_data: {
      token: "123456",
      token_hash: "hash-smoke",
      redirect_to: "https://shop.test/en/konto",
      email_action_type: "signup",
      site_url: "https://shop.test",
      token_new: "",
      token_hash_new: "",
    },
  });
  const id = `msg_${randomUUID()}`;
  const signature = new Webhook(HOOK_SECRET.replace(/^v1,/, "")).sign(id, new Date(), payload);
  const before = resend.sent.length;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": signature,
    },
    body: payload,
  });
  const mail = resend.sent[before];
  check(
    "auth-email-hook: Standard-Webhooks unter Deno",
    res.status === 200 && mail?.subject === "Confirm your Axion account",
    `${res.status} ${mail?.subject}`,
  );
});

await withFunction("newsletter", async (url) => {
  const before = resend.sent.length;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://shop.test",
      "cf-connecting-ip": "203.0.113.9",
    },
    body: JSON.stringify({
      action: "subscribe",
      email: `smoke-${randomUUID().slice(0, 8)}@example.ch`,
      consent: "Ja",
      locale: "de",
    }),
  });
  check(
    "newsletter: Anmeldung unter Deno",
    res.status === 200 && resend.sent.length - before === 1,
    `${res.status}`,
  );
});

for (const name of ["admin-actions", "account-delete"]) {
  await withFunction(name, async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.test" },
      body: "{}",
    });
    check(
      `${name}: startet unter Deno, ohne Anmeldung 401`,
      res.status === 401,
      String(res.status),
    );
  });
}

await Promise.all([supa.close(), stripe.close(), resend.close()]);
await pool.end();
console.log(
  failures
    ? `\n${failures} Prüfung(en) fehlgeschlagen.`
    : "\nAlle Edge Functions laufen unter Deno.",
);
process.exit(failures ? 1 : 0);
