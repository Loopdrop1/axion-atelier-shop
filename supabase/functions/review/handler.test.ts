import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import { makeProduct, rpc } from "../../tests/fixtures.ts";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeSupabase,
} from "../../tests/fakes/servers.ts";
import { parseReview, reviewUrl } from "../_shared/reviews.ts";
import { createReviewHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;
let ipCounter = 0;
const created: string[] = [];

beforeAll(async () => {
  supa = await startFakeSupabase();
  resend = await startFakeResend();
  handler = createReviewHandler(
    createDeps(
      readEnv(
        (k) =>
          ({
            SUPABASE_URL: supa.url,
            SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
            SUPABASE_ANON_KEY: ANON_KEY,
            SITE_URL: "https://shop.test",
            RESEND_API_KEY: "re_test",
            RESEND_API_BASE: resend.url,
            EMAIL_FROM: "Axion <shop@axion.test>",
          })[k],
      ),
    ),
  );
  await sql("update public.shop_settings set reviews_enabled = true where id = 1");
});

afterAll(async () => {
  await sql("update public.shop_settings set reviews_enabled = false where id = 1");
  await sql("delete from public.orders where id = any($1::uuid[])", [created]);
  await Promise.all([supa.close(), resend.close()]);
  await pool.end();
});

function post(body: unknown, init: { contentType?: string } = {}) {
  return handler(
    new Request("https://fn.test/review", {
      method: "POST",
      headers: {
        "content-type": init.contentType ?? "application/json",
        origin: "https://shop.test",
        "x-forwarded-for": `10.8.0.${++ipCounter}, 172.16.0.1`,
      },
      body: JSON.stringify(body),
    }),
  );
}

/** Versendete Bestellung mit einer Position und Link. */
async function shippedOrder(): Promise<{ token: string; itemId: string }> {
  const p = await makeProduct({ priceCents: 10000, stocks: [3] });
  const rows = await sql<{ id: string }>(
    `insert into public.orders (email, locale, status, subtotal_cents, total_cents, paid_at, shipped_at)
     values ($1, 'de', 'shipped', 10000, 10000, now(), now()) returning id`,
    [`${uniq("review")}@example.ch`],
  );
  const orderId = rows[0]!.id;
  created.push(orderId);
  const item = await sql<{ id: string }>(
    `insert into public.order_items (order_id, product_id, variant_id, handle, title, size, unit_price_cents, quantity, line_total_cents)
     values ($1, $2, $3, $4, 'Sakko', '50', 10000, 1, 10000) returning id`,
    [orderId, p.id, p.variants[0]!.id, p.handle],
  );
  const token = await rpc<string>("review_invite_create", [orderId, 90]);
  return { token, itemId: item[0]!.id };
}

const review = {
  rating: 4,
  title: "Gute Qualität",
  body: "Der Stoff fühlt sich hochwertig an.",
  displayName: "Marco R.",
};

describe("review: lookup", () => {
  it("liefert die Stücke der Bestellung", async () => {
    const { token, itemId } = await shippedOrder();
    const res = await post({ action: "lookup", token });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { orderItemId: string; reviewed: boolean }[] };
    expect(body.items).toEqual([expect.objectContaining({ orderItemId: itemId, reviewed: false })]);
  });

  it("unbekannter oder kaputter Link: NOT_FOUND", async () => {
    for (const token of ["0".repeat(48), "kurz", 42]) {
      const res = await post({ action: "lookup", token });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "NOT_FOUND" });
    }
  });

  it("Schalter aus: REVIEWS_DISABLED", async () => {
    const { token } = await shippedOrder();
    await sql("update public.shop_settings set reviews_enabled = false where id = 1");
    try {
      const res = await post({ action: "lookup", token });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "REVIEWS_DISABLED" });
      const sub = await post({
        action: "submit",
        token,
        orderItemId: crypto.randomUUID(),
        ...review,
      });
      expect(sub.status).toBe(409);
    } finally {
      await sql("update public.shop_settings set reviews_enabled = true where id = 1");
    }
  });
});

describe("review: submit", () => {
  it("speichert einmal, ein zweites Mal ALREADY_REVIEWED", async () => {
    const { token, itemId } = await shippedOrder();
    const res = await post({
      action: "submit",
      token,
      orderItemId: itemId,
      locale: "en",
      ...review,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", items: [{ reviewed: true }] });
    const rows = await sql<{ status: string; locale: string; display_name: string }>(
      "select status, locale, display_name from public.reviews where order_item_id = $1",
      [itemId],
    );
    expect(rows).toEqual([{ status: "pending", locale: "en", display_name: "Marco R." }]);
    const again = await post({ action: "submit", token, orderItemId: itemId, ...review });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "ALREADY_REVIEWED" });
  });

  it("prüft die Eingaben", async () => {
    const { token, itemId } = await shippedOrder();
    for (const bad of [
      { rating: 0 },
      { rating: 4.5 },
      { body: "zu kurz" },
      { displayName: "  " },
      { title: "x".repeat(81) },
    ]) {
      const res = await post({ action: "submit", token, orderItemId: itemId, ...review, ...bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(await res.json()).toEqual({ error: "INVALID_REVIEW" });
    }
    const wrongItem = await post({
      action: "submit",
      token,
      orderItemId: crypto.randomUUID(),
      ...review,
    });
    expect(wrongItem.status).toBe(409);
    expect(await wrongItem.json()).toEqual({ error: "ITEM_NOT_REVIEWABLE" });
  });

  it("Honeypot, falscher Inhaltstyp und unbekannte Aktion", async () => {
    expect((await post({ action: "lookup", token: "x", website: "spam" })).status).toBe(404);
    expect((await post({ action: "lookup" }, { contentType: "text/plain" })).status).toBe(415);
    expect((await post({ action: "delete" })).status).toBe(400);
  });
});

describe("Regeln", () => {
  it("parseReview kürzt Leerraum und lässt den Titel weg, wenn leer", () => {
    expect(parseReview({ ...review, title: "  ", displayName: "  Anna   M. " })).toEqual({
      rating: 4,
      title: null,
      body: review.body,
      displayName: "Anna M.",
    });
  });

  it("reviewUrl: Deutsch ohne Präfix, Englisch unter /en", () => {
    expect(reviewUrl("https://shop.test/", "de", "ab")).toBe("https://shop.test/bewertung/ab");
    expect(reviewUrl("https://shop.test", "en", "ab")).toBe("https://shop.test/en/bewertung/ab");
  });
});
