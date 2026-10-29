// Nachbesserungen aus dem Audit (Migration 20261029001900): Erinnerungs-Limit, Kontolöschung, Newsletter-Bestätigung.
import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq } from "./helpers";
import { makeProduct, reserve, rpc } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

async function expiredReminderOrder(email: string) {
  const p = await makeProduct({ priceCents: 1000, stocks: [5] });
  const r = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }], email });
  await rpc("set_order_reminder", [r.order_id, true]);
  await rpc("cancel_order", [r.order_id, "expired"]);
  return { r, p };
}

describe("get_cart_reminder: eine Erinnerung pro Adresse und 7 Tage", () => {
  it("sperrt weitere Erinnerungen an dieselbe Adresse (ohne Gross-/Kleinschreibung), danach wieder frei", async () => {
    const email = `${uniq("abuse")}@example.ch`;
    const first = await expiredReminderOrder(email);
    const second = await expiredReminderOrder(email.toUpperCase());
    const other = await expiredReminderOrder(`${uniq("andere")}@example.ch`);
    expect(await rpc("get_cart_reminder", [second.r.order_id])).not.toBeNull();
    await rpc("mark_order_email_sent", [first.r.order_id, "reminder"]);
    expect(await rpc("get_cart_reminder", [second.r.order_id])).toBeNull();
    // andere Adressen bleiben unberührt
    expect(await rpc("get_cart_reminder", [other.r.order_id])).not.toBeNull();
    // nach mehr als 7 Tagen wieder möglich
    await sql(
      "update public.orders set reminder_sent_at = now() - interval '8 days' where id = $1",
      [first.r.order_id],
    );
    expect(await rpc("get_cart_reminder", [second.r.order_id])).not.toBeNull();
  });

  it("bleibt nur für den Server aufrufbar", async () => {
    const { r } = await expiredReminderOrder(`${uniq("rechte")}@example.ch`);
    const err = await expectPgError(
      q("anon", null, "select public.get_cart_reminder($1)", [r.order_id]),
    );
    expect(err.message).toMatch(/permission denied/);
  });
});

describe("prepare_account_deletion: Newsletter und Wieder-da-Wünsche", () => {
  it("löscht beides zur Adresse des Kontos (case-insensitiv), andere Adressen bleiben", async () => {
    const user = await createUser(`${uniq("weg")}@example.ch`);
    const keeper = `${uniq("bleibt")}@example.ch`;
    const p = await makeProduct({ priceCents: 5000, stocks: [0] });
    const v = p.variants[0]!.id;
    for (const email of [user.email.toUpperCase(), keeper]) {
      await rpc("newsletter_subscribe", [
        email,
        "de",
        "Ja",
        "footer",
        `10.9.0.${uniq("i").length}`,
      ]);
      await sql(
        "insert into public.stock_alerts (variant_id, email, status) values ($1, $2, 'confirmed')",
        [v, email],
      );
    }
    await rpc("prepare_account_deletion", [user.id]);
    const subs = await sql<{ email: string }>(
      "select email::text as email from public.newsletter_subscribers where lower(email::text) in ($1, $2)",
      [user.email.toLowerCase(), keeper],
    );
    expect(subs.map((s) => s.email)).toEqual([keeper]);
    const alerts = await sql<{ email: string }>(
      "select email from public.stock_alerts where variant_id = $1",
      [v],
    );
    expect(alerts.map((a) => a.email)).toEqual([keeper]);
  });

  it("bei LAST_ADMIN wird nichts gelöscht", async () => {
    const me = await createUser(undefined, { admin: true });
    await rpc("newsletter_subscribe", [me.email, "de", "Ja", "footer", "10.9.1.1"]);
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("delete from public.user_roles where role = 'admin' and user_id <> $1", [
        me.id,
      ]);
      await c.query("select set_config('role', 'service_role', true)");
      const msg = await c.query("select public.prepare_account_deletion($1)", [me.id]).then(
        () => null,
        (e: { message: string }) => e.message,
      );
      expect(msg).toBe("LAST_ADMIN");
    } finally {
      await c.query("rollback").catch(() => undefined);
      c.release();
    }
    expect(
      await sql("select 1 from public.newsletter_subscribers where email = $1", [me.email]),
    ).toHaveLength(1);
  });
});

describe("newsletter_confirm: bereits bestätigt", () => {
  type Res = {
    status: string;
    newly_confirmed?: boolean;
    welcome_code?: string | null;
    welcome_percent?: number | null;
  };
  const subscribe = async () =>
    rpc<{ token: string }>("newsletter_subscribe", [
      `${uniq("nl")}@example.ch`,
      "de",
      "Ja",
      "footer",
      `10.9.2.${Math.floor(Math.random() * 250)}`,
    ]);

  it("liefert denselben Code und Prozentsatz erneut, ohne neuen Code zu erzeugen", async () => {
    await sql("update public.shop_settings set newsletter_welcome_percent = 15");
    try {
      const sub = await subscribe();
      const first = await rpc<Res>("newsletter_confirm", [sub.token]);
      expect(first).toMatchObject({ newly_confirmed: true, welcome_percent: 15 });
      const before = await sql<{ n: string }>(
        "select count(*) as n from public.discount_codes where note = 'Newsletter-Willkommensrabatt'",
      );
      const again = await rpc<Res>("newsletter_confirm", [sub.token]);
      expect(again).toMatchObject({
        status: "confirmed",
        newly_confirmed: false,
        welcome_code: first.welcome_code,
        welcome_percent: 15,
      });
      const after = await sql<{ n: string }>(
        "select count(*) as n from public.discount_codes where note = 'Newsletter-Willkommensrabatt'",
      );
      expect(after[0]!.n).toBe(before[0]!.n);
    } finally {
      await sql("update public.shop_settings set newsletter_welcome_percent = null");
    }
  });

  it("ohne Rabatt: kein Code, kein Prozentsatz", async () => {
    const sub = await subscribe();
    await rpc("newsletter_confirm", [sub.token]);
    const again = await rpc<Res>("newsletter_confirm", [sub.token]);
    expect(again.newly_confirmed).toBe(false);
    expect(again.welcome_code ?? null).toBeNull();
    expect(again.welcome_percent ?? null).toBeNull();
  });
});
