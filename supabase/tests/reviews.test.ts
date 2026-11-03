// Kundenbewertungen (Migration 20261104002700/Cloud 0026): Link nur für versendete Bestellungen und nur mit
// eingeschaltetem Schalter, eine Bewertung pro Position und Produkt, öffentlich nur Freigegebenes ohne Muster.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq } from "./helpers";
import { makeProduct, rpc, type TestProduct } from "./fixtures";

const created: string[] = [];

async function setEnabled(on: boolean) {
  await sql("update public.shop_settings set reviews_enabled = $1 where id = 1", [on]);
}

beforeAll(() => setEnabled(true));

afterAll(async () => {
  await setEnabled(false);
  await sql("delete from public.orders where id = any($1::uuid[])", [created]);
  await pool.end();
});

/** Bestellung mit je einer Position pro Produkt (zweites Produkt optional zweimal in anderer Grösse). */
async function order(
  products: TestProduct[],
  status = "shipped",
): Promise<{ id: string; items: string[] }> {
  const rows = await sql<{ id: string }>(
    `insert into public.orders (email, locale, status, subtotal_cents, total_cents, paid_at, shipped_at)
     values ($1, 'de', $2::public.order_status, 20000, 20000, now(), case when $2::text = 'shipped' then now() end) returning id`,
    [`${uniq("bewertung")}@example.ch`, status],
  );
  const id = rows[0]!.id;
  created.push(id);
  const items: string[] = [];
  for (const p of products) {
    const r = await sql<{ id: string }>(
      `insert into public.order_items (order_id, product_id, variant_id, handle, title, size, unit_price_cents, quantity, line_total_cents)
       values ($1, $2, $3, $4, 'Stück', $5, 10000, 1, 10000) returning id`,
      [id, p.id, p.variants[0]!.id, p.handle, p.variants[0]!.size],
    );
    items.push(r[0]!.id);
  }
  return { id, items };
}

const ip = () => `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

const submit = (token: string, item: string, extra: Partial<Record<string, unknown>> = {}) =>
  rpc<{ status: string; id?: string }>("review_submit", [
    token,
    item,
    extra["rating"] ?? 5,
    extra["title"] ?? "Sitzt gut",
    extra["body"] ?? "Schöner Stoff, gute Passform.",
    extra["name"] ?? "Anna M.",
    "de",
    ip(),
  ]);

describe("review_invite_create", () => {
  it("nur für versendete Warenkorb-Bestellungen und nur mit Schalter", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const paid = await order([p], "paid");
    expect(await rpc("review_invite_create", [paid.id, 90])).toBeNull();
    const shipped = await order([p]);
    const token = await rpc<string>("review_invite_create", [shipped.id, 90]);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    // Nur der Hash liegt in der Datenbank
    const stored = await sql<{ token_hash: string }>(
      "select token_hash from public.review_invites where order_id = $1",
      [shipped.id],
    );
    expect(stored[0]!.token_hash).not.toBe(token);
    await setEnabled(false);
    try {
      expect(await rpc("review_invite_create", [shipped.id, 90])).toBeNull();
      expect(await rpc("review_lookup", [token, ip()])).toEqual({ status: "disabled" });
    } finally {
      await setEnabled(true);
    }
  });

  it("ohne p_replace bleibt ein gültiger Link; mit p_replace ersetzt ein neuer den alten", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const o = await order([p]);
    const first = await rpc<string>("review_invite_create", [o.id, 90]);
    expect(await rpc("review_invite_create", [o.id, 90, false])).toBeNull();
    expect(await rpc("review_lookup", [first, ip()])).toMatchObject({ status: "ok" });
    const second = await rpc<string>("review_invite_create", [o.id, 90, true]);
    expect(second).toMatch(/^[0-9a-f]{48}$/);
    expect(await rpc("review_lookup", [first, ip()])).toEqual({ status: "not_found" });
    expect(await rpc("review_lookup", [second, ip()])).toMatchObject({ status: "ok" });
  });

  it("nur service_role darf Links erzeugen, Bewertungen einreichen und Links prüfen", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      const e = await expectPgError(
        q(role, null, "select public.review_invite_create(gen_random_uuid(), 90, false)"),
      );
      expect(e.message).toMatch(/permission denied/);
      const l = await expectPgError(q(role, null, "select public.review_lookup('x', null)"));
      expect(l.message).toMatch(/permission denied/);
    }
  });
});

describe("review_lookup und review_submit", () => {
  it("zeigt die Stücke und speichert eine Bewertung pro Produkt als «pending»", async () => {
    const a = await makeProduct({ priceCents: 10000, stocks: [3] });
    const b = await makeProduct({ priceCents: 10000, stocks: [3, 3] });
    const o = await order([a, b, b]);
    const token = await rpc<string>("review_invite_create", [o.id, 90]);
    const lookup = await rpc<{
      status: string;
      items: { order_item_id: string; reviewed: boolean }[];
    }>("review_lookup", [token, ip()]);
    expect(lookup.status).toBe("ok");
    // Produkt b nur einmal, obwohl zwei Positionen
    expect(lookup.items.map((i) => i.order_item_id)).toEqual([o.items[0], o.items[1]]);
    expect((await submit(token, o.items[0]!)).status).toBe("ok");
    expect((await submit(token, o.items[0]!)).status).toBe("duplicate");
    expect((await submit(token, o.items[1]!)).status).toBe("ok");
    // Zweite Position desselben Produkts: schon bewertet
    expect((await submit(token, o.items[2]!)).status).toBe("duplicate");
    const rows = await sql<{ status: string; approved_at: string | null }>(
      "select status, approved_at from public.reviews where order_id = $1",
      [o.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "pending" && r.approved_at === null)).toBe(true);
    const after = await rpc<{ items: { reviewed: boolean }[] }>("review_lookup", [token, ip()]);
    expect(after.items.every((i) => i.reviewed)).toBe(true);
  });

  it("lehnt ungültige Eingaben, fremde Positionen und abgelaufene Links ab", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const o = await order([p]);
    const other = await order([p]);
    const token = await rpc<string>("review_invite_create", [o.id, 90]);
    expect((await submit(token, o.items[0]!, { rating: 6 })).status).toBe("invalid");
    expect((await submit(token, o.items[0]!, { body: "kurz" })).status).toBe("invalid");
    expect((await submit(token, o.items[0]!, { name: "" })).status).toBe("invalid");
    expect((await submit(token, o.items[0]!, { title: "x".repeat(81) })).status).toBe("invalid");
    expect((await submit(token, other.items[0]!)).status).toBe("invalid_item");
    expect((await submit("0".repeat(48), o.items[0]!)).status).toBe("not_found");
    await sql(
      "update public.review_invites set expires_at = now() - interval '1 minute' where order_id = $1",
      [o.id],
    );
    expect((await submit(token, o.items[0]!)).status).toBe("not_found");
  });

  it("vollständig zurückgenommene Stücke sind nicht bewertbar", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const o = await order([p]);
    await sql("update public.order_items set restocked_quantity = quantity where id = $1", [
      o.items[0],
    ]);
    const token = await rpc<string>("review_invite_create", [o.id, 90]);
    expect(await rpc("review_lookup", [token, ip()])).toMatchObject({ items: [] });
    expect((await submit(token, o.items[0]!)).status).toBe("invalid_item");
  });

  it("bremst pro Bestellung (10 pro Tag)", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const o = await order([p]);
    const token = await rpc<string>("review_invite_create", [o.id, 90]);
    const results: string[] = [];
    for (let i = 0; i < 11; i++)
      results.push((await submit(token, o.items[0]!, { rating: 9 })).status);
    expect(results.slice(0, 10).every((s) => s === "invalid")).toBe(true);
    expect(results[10]).toBe("rate_limited");
  });
});

describe("product_reviews und Freigabe im Admin", () => {
  it("öffentlich nur freigegebene Bewertungen, ohne E-Mail oder Bestellung; Muster nie", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3, 3] });
    const o1 = await order([p]);
    const o2 = await order([p]);
    const t1 = await rpc<string>("review_invite_create", [o1.id, 90]);
    const t2 = await rpc<string>("review_invite_create", [o2.id, 90]);
    const r1 = await submit(t1, o1.items[0]!, { rating: 5 });
    await submit(t2, o2.items[0]!, { rating: 4 });

    const empty = await rpc<{ count: number; average: number | null; items: unknown[] }>(
      "product_reviews",
      [p.handle, 20],
      "anon",
    );
    expect(empty).toEqual({ count: 0, average: null, items: [] });

    const admin = await createUser(undefined, { admin: true });
    await q(
      "authenticated",
      admin.claims,
      "update public.reviews set status = 'approved' where id = $1",
      [r1.id],
    );
    const shown = await rpc<{
      count: number;
      average: number;
      items: Record<string, unknown>[];
    }>("product_reviews", [p.handle, 20], "anon");
    expect(shown.count).toBe(1);
    expect(Number(shown.average)).toBe(5);
    expect(Object.keys(shown.items[0]!).sort()).toEqual(
      ["body", "date", "display_name", "id", "locale", "rating", "title"].sort(),
    );
    expect(shown.items[0]!["date"]).toBeTruthy();

    // Muster bekommen nie Bewertungen nach aussen
    await sql("update public.products set tags = array['muster'] where id = $1", [p.id]);
    expect(await rpc("product_reviews", [p.handle, 20], "anon")).toBeNull();
    await sql("update public.products set tags = '{}' where id = $1", [p.id]);

    // Schalter aus: nichts
    await setEnabled(false);
    try {
      expect(await rpc("product_reviews", [p.handle, 20], "anon")).toBeNull();
    } finally {
      await setEnabled(true);
    }

    // Zurück auf «abgelehnt»: Freigabezeitpunkt weg
    await q(
      "authenticated",
      admin.claims,
      "update public.reviews set status = 'rejected' where id = $1",
      [r1.id],
    );
    const row = await sql<{ approved_at: string | null }>(
      "select approved_at from public.reviews where id = $1",
      [r1.id],
    );
    expect(row[0]!.approved_at).toBeNull();
  });

  it("RLS: nur Admins lesen, ändern Status/Notiz und löschen; anon und Kundschaft sehen nichts", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const o = await order([p]);
    const token = await rpc<string>("review_invite_create", [o.id, 90]);
    const r = await submit(token, o.items[0]!);
    const customer = await createUser();
    const admin = await createUser(undefined, { admin: true });
    const anonRead = await expectPgError(q("anon", null, "select * from public.reviews"));
    expect(anonRead.message).toMatch(/permission denied/);
    expect(await q("authenticated", customer.claims, "select * from public.reviews")).toEqual([]);
    expect(
      await q(
        "authenticated",
        customer.claims,
        "update public.reviews set status = 'approved' returning id",
      ),
    ).toEqual([]);
    const body = await expectPgError(
      q(
        "authenticated",
        admin.claims,
        "update public.reviews set body = 'Geändert durch Admin' where id = $1",
        [r.id],
      ),
    );
    expect(body.message).toMatch(/permission denied/);
    const invites = await expectPgError(
      q("authenticated", admin.claims, "select * from public.review_invites"),
    );
    expect(invites.message).toMatch(/permission denied/);
    const note = await q<{ admin_note: string }>(
      "authenticated",
      admin.claims,
      "update public.reviews set admin_note = 'ok' where id = $1 returning admin_note",
      [r.id],
    );
    expect(note[0]!.admin_note).toBe("ok");
    expect(
      await q(
        "authenticated",
        admin.claims,
        "delete from public.reviews where id = $1 returning id",
        [r.id],
      ),
    ).toHaveLength(1);
  });

  it("shop_settings.reviews_enabled: standardmässig aus, nur Admins ändern", async () => {
    const def = await sql<{ column_default: string }>(
      "select column_default from information_schema.columns where table_name = 'shop_settings' and column_name = 'reviews_enabled'",
    );
    expect(def[0]!.column_default).toBe("false");
    const customer = await createUser();
    expect(
      await q(
        "authenticated",
        customer.claims,
        "update public.shop_settings set reviews_enabled = true where id = 1 returning id",
      ),
    ).toEqual([]);
  });
});
