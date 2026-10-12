import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq, type TestUser } from "./helpers";
import { makeProduct, reserve, rpc, stockOf } from "./fixtures";

let admin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
  customer = await createUser();
});

afterAll(async () => {
  await pool.end();
});

describe("Gutschein kaufen", () => {
  it("reserviert einen Gutscheinkauf und erzeugt beim Zahlen einen Code mit 5 Jahren Gültigkeit", async () => {
    const r = await rpc<{ order_id: string; total_cents: number }>("reserve_gift_card_purchase", [
      10000,
      "kaeufer@example.ch",
      "de",
      JSON.stringify({
        recipient_name: "Lea",
        recipient_email: "LEA@example.ch",
        sender_name: "Tom",
        message: "Alles Gute!",
      }),
      null,
    ]);
    expect(r.total_cents).toBe(10000);
    const done = await rpc<{
      newly_paid: boolean;
      gift_card: {
        code: string;
        balance_cents: number;
        expires_at: string;
        recipient_email: string;
      };
    }>("complete_order", [
      r.order_id,
      JSON.stringify({ amount_total_cents: 10000, email: "kaeufer@example.ch" }),
    ]);
    expect(done.newly_paid).toBe(true);
    expect(done.gift_card.code).toMatch(
      /^AXN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
    expect(done.gift_card.balance_cents).toBe(10000);
    expect(done.gift_card.recipient_email).toBe("lea@example.ch");
    const years =
      (new Date(done.gift_card.expires_at).getTime() - Date.now()) / (365.25 * 86400000);
    expect(years).toBeGreaterThan(4.9);
    expect(years).toBeLessThan(5.1);
    const again = await rpc<{ newly_paid: boolean; gift_card: unknown }>("complete_order", [
      r.order_id,
      "{}",
    ]);
    expect(again.newly_paid).toBe(false);
    const cards = await sql<{ n: string }>(
      "select count(*)::text as n from public.gift_cards where purchase_order_id = $1",
      [r.order_id],
    );
    expect(cards[0]!.n).toBe("1");
  });

  it("Beträge ausserhalb CHF 25 bis 1000 oder nicht in ganzen Franken werden abgelehnt", async () => {
    for (const amount of [2400, 100100, 2550]) {
      const err = await expectPgError(
        rpc("reserve_gift_card_purchase", [amount, "a@b.ch", "de", "{}", null]),
      );
      expect(err.message).toBe("INVALID_AMOUNT");
    }
  });

  it("Codes sind eindeutig und zufällig", async () => {
    const rows = await sql<{ code: string }>(
      "select private.gift_card_code() as code from generate_series(1, 200)",
    );
    expect(new Set(rows.map((r) => r.code)).size).toBe(200);
  });
});

describe("Admin-Funktionen", () => {
  it("ohne Admin-Rolle: FORBIDDEN", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const err = await expectPgError(
      rpc(
        "admin_adjust_stock",
        [p.variants[0]!.id, -1, "sale_store", null],
        "authenticated",
        customer.claims,
      ),
    );
    expect(err.message).toBe("FORBIDDEN");
    const dash = await expectPgError(
      rpc(
        "admin_dashboard",
        [new Date(0).toISOString(), new Date().toISOString()],
        "authenticated",
        customer.claims,
      ),
    );
    expect(dash.message).toBe("FORBIDDEN");
  });

  it("Verkauf vor Ort bucht Bestand ab und protokolliert, nie unter 0", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [1] });
    const v = p.variants[0]!.id;
    expect(
      await rpc<number>(
        "admin_adjust_stock",
        [v, -1, "sale_store", "Laden"],
        "authenticated",
        admin.claims,
      ),
    ).toBe(0);
    const err = await expectPgError(
      rpc("admin_adjust_stock", [v, -1, "sale_store", null], "authenticated", admin.claims),
    );
    expect(err.message).toBe("INSUFFICIENT_STOCK");
    const moves = await sql<{ delta: number; reason: string; created_by: string }>(
      "select delta, reason, created_by from public.stock_movements where variant_id = $1",
      [v],
    );
    expect(moves).toEqual([{ delta: -1, reason: "sale_store", created_by: admin.id }]);
    const bad = await expectPgError(
      rpc("admin_adjust_stock", [v, 5, "reservation", null], "authenticated", admin.claims),
    );
    expect(bad.message).toBe("INVALID_REASON");
  });

  it("Retoure einbuchen: höchstens die gekaufte Menge", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 2 }] });
    await rpc("complete_order", [r.order_id, "{}"]);
    const items = await sql<{ id: string }>(
      "select id from public.order_items where order_id = $1",
      [r.order_id],
    );
    const itemId = items[0]!.id;
    await rpc(
      "admin_restock_order",
      [r.order_id, JSON.stringify([{ order_item_id: itemId, quantity: 1 }])],
      "authenticated",
      admin.claims,
    );
    expect(await stockOf(p.variants[0]!.id)).toBe(1);
    const err = await expectPgError(
      rpc(
        "admin_restock_order",
        [r.order_id, JSON.stringify([{ order_item_id: itemId, quantity: 2 }])],
        "authenticated",
        admin.claims,
      ),
    );
    expect(err.message).toBe("INVALID_ITEMS");
  });

  it("Admins verwalten: freischalten per E-Mail, nicht sich selbst entfernen, letzter Admin bleibt", async () => {
    const helper = await createUser(`${uniq("helfer")}@example.ch`);
    const granted = await rpc<{ user_id: string }>(
      "admin_grant_admin",
      [helper.email.toUpperCase()],
      "authenticated",
      admin.claims,
    );
    expect(granted.user_id).toBe(helper.id);
    const list = await q<{ email: string }>(
      "authenticated",
      admin.claims,
      "select * from public.admin_list_admins()",
    );
    expect(list.map((a) => a.email)).toContain(helper.email);
    const self = await expectPgError(
      rpc("admin_revoke_admin", [admin.id], "authenticated", admin.claims),
    );
    expect(self.message).toBe("CANNOT_REVOKE_SELF");
    await rpc("admin_revoke_admin", [helper.id], "authenticated", admin.claims);
    const missing = await expectPgError(
      rpc("admin_grant_admin", ["niemand@example.ch"], "authenticated", admin.claims),
    );
    expect(missing.message).toBe("USER_NOT_FOUND");
  });

  it("Übersicht zählt bezahlte Bestellungen und Umsatz im Zeitraum", async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const p = await makeProduct({ priceCents: 25000, stocks: [5] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 2 }] });
    await rpc("complete_order", [r.order_id, "{}"]);
    const to = new Date(Date.now() + 60_000).toISOString();
    const dash = await rpc<{
      orders: number;
      revenue_cents: number;
      daily: unknown[];
      top_products: { handle: string }[];
    }>("admin_dashboard", [from, to], "authenticated", admin.claims);
    expect(dash.orders).toBeGreaterThanOrEqual(1);
    expect(dash.revenue_cents).toBeGreaterThanOrEqual(50000);
    expect(dash.daily.length).toBeGreaterThanOrEqual(1);
    expect(dash.top_products.map((t) => t.handle)).toContain(p.handle);
  });

  it("Versand markieren nur für bezahlte Warenbestellungen, Sendungsnummer geprüft", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [5] });
    const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }] });
    const early = await expectPgError(
      rpc("mark_order_shipped", [r.order_id, "99.00.123456.78901234"]),
    );
    expect(early.message).toBe("ORDER_NOT_SHIPPABLE");
    await rpc("complete_order", [r.order_id, "{}"]);
    const bad = await expectPgError(rpc("mark_order_shipped", [r.order_id, "<script>"]));
    expect(bad.message).toBe("INVALID_TRACKING");
    const shipped = await rpc<{ status: string; tracking_number: string; items: unknown[] }>(
      "mark_order_shipped",
      [r.order_id, "99.00 123456.78901234"],
    );
    expect(shipped.status).toBe("shipped");
    expect(shipped.tracking_number).toBe("99.00123456.78901234");
    expect(shipped.items).toHaveLength(1);
  });
});

describe("Newsletter", () => {
  it("Double Opt-in: pending, bestätigen, abmelden", async () => {
    const email = `${uniq("news")}@example.ch`;
    const sub = await rpc<{ status: string; token: string }>("newsletter_subscribe", [
      email,
      "en",
      "Ja, ich möchte den Newsletter.",
      "footer",
      "1.1.1.1",
    ]);
    expect(sub.status).toBe("pending");
    expect(sub.token).toMatch(/^[0-9a-f]{48}$/);
    const stored = await sql<{ status: string; token_hash: string }>(
      "select status, token_hash from public.newsletter_subscribers where email = $1",
      [email],
    );
    expect(stored[0]!.status).toBe("pending");
    expect(stored[0]!.token_hash).not.toBe(sub.token);
    const confirmed = await rpc<{ status: string; newly_confirmed: boolean; locale: string }>(
      "newsletter_confirm",
      [sub.token],
    );
    expect(confirmed).toMatchObject({ status: "confirmed", newly_confirmed: true, locale: "en" });
    const again = await rpc<{ status: string }>("newsletter_subscribe", [
      email,
      "de",
      "Ja",
      "footer",
      "1.1.1.2",
    ]);
    expect(again.status).toBe("confirmed");
    const out = await rpc<{ status: string }>("newsletter_unsubscribe", [sub.token]);
    expect(out.status).toBe("unsubscribed");
    const invalid = await rpc<{ status: string }>("newsletter_confirm", ["falsch"]);
    expect(invalid.status).toBe("invalid");
  });

  it("Willkommensrabatt, wenn eingestellt: einmalig nutzbarer Code", async () => {
    await sql("update public.shop_settings set newsletter_welcome_percent = 10");
    try {
      const sub = await rpc<{ token: string }>("newsletter_subscribe", [
        `${uniq("welcome")}@example.ch`,
        "de",
        "Ja",
        "footer",
        "2.2.2.2",
      ]);
      const res = await rpc<{ welcome_code: string; welcome_percent: number }>(
        "newsletter_confirm",
        [sub.token],
      );
      expect(res.welcome_code).toMatch(/^WILLKOMMEN-[0-9A-F]{6}$/);
      expect(res.welcome_percent).toBe(10);
      const code = await sql<{ max_redemptions: number }>(
        "select max_redemptions from public.discount_codes where code = $1",
        [res.welcome_code],
      );
      expect(code[0]!.max_redemptions).toBe(1);
    } finally {
      await sql("update public.shop_settings set newsletter_welcome_percent = null");
    }
  });

  it("ohne Einwilligung keine Anmeldung; Rate-Limit pro Adresse", async () => {
    const err = await expectPgError(
      rpc("newsletter_subscribe", ["x@example.ch", "de", " ", "footer", "3.3.3.3"]),
    );
    expect(err.message).toBe("CONSENT_REQUIRED");
    const email = `${uniq("spam")}@example.ch`;
    let last = { status: "" };
    for (let i = 0; i < 4; i++)
      last = await rpc("newsletter_subscribe", [email, "de", "Ja", "footer", `4.4.4.${i}`]);
    expect(last.status).toBe("rate_limited");
  });

  it("anon kann die Newsletter-Funktionen nicht direkt aufrufen", async () => {
    const err = await expectPgError(
      q("anon", null, "select public.newsletter_subscribe('a@b.ch', 'de', 'Ja')"),
    );
    expect(err.message).toMatch(/permission denied/);
  });
});

describe("Stripe-Ereignisse", () => {
  it("register_stripe_event erkennt Wiederholungen", async () => {
    const id = uniq("evt");
    expect(await rpc<boolean>("register_stripe_event", [id, "checkout.session.completed"])).toBe(
      true,
    );
    expect(await rpc<boolean>("register_stripe_event", [id, "checkout.session.completed"])).toBe(
      false,
    );
    await rpc("forget_stripe_event", [id]);
    expect(await rpc<boolean>("register_stripe_event", [id, "checkout.session.completed"])).toBe(
      true,
    );
  });
});
