import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, type TestUser } from "./helpers";

let admin: TestUser;
let alice: TestUser;
let bob: TestUser;
let aliceOrder: string;
let bobOrder: string;

async function insertOrder(userId: string | null, email: string): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into public.orders (user_id, email, subtotal_cents, total_cents, status)
     values ($1, $2, 10000, 10000, 'paid') returning id`,
    [userId, email],
  );
  const id = rows[0]!.id;
  await sql(
    `insert into public.order_items (order_id, title, unit_price_cents, quantity, line_total_cents)
     values ($1, 'Testartikel', 10000, 1, 10000)`,
    [id],
  );
  return id;
}

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
  alice = await createUser();
  bob = await createUser();
  aliceOrder = await insertOrder(alice.id, alice.email);
  bobOrder = await insertOrder(bob.id, bob.email);
  await sql(`insert into public.discount_codes (code, kind, value) values ('RLSTEST', 'percent', 10)`);
  await sql(
    `insert into public.gift_cards (code, initial_cents, balance_cents, expires_at)
     values ('AXN-ABCD-EFGH-JKLM', 5000, 5000, now() + interval '1 year')`,
  );
  await sql(`insert into public.newsletter_subscribers (email, consent_text) values ('news@example.ch', 'Ja')`);
});

afterAll(async () => {
  await pool.end();
});

describe("Bestellungen", () => {
  it("Kundschaft sieht nur die eigene Bestellung und deren Positionen", async () => {
    const orders = await q<{ id: string }>("authenticated", alice.claims, "select id from public.orders");
    expect(orders.map((o) => o.id)).toEqual([aliceOrder]);
    const items = await q<{ order_id: string }>("authenticated", alice.claims, "select order_id from public.order_items");
    expect(items.map((i) => i.order_id)).toEqual([aliceOrder]);
  });

  it("anon sieht keine Bestellungen", async () => {
    const err = await expectPgError(q("anon", null, "select id from public.orders"));
    expect(err.message).toMatch(/permission denied/);
  });

  it("Kundschaft kann Bestellungen weder anlegen noch Status ändern", async () => {
    const insert = await expectPgError(
      q("authenticated", alice.claims, "insert into public.orders (email, subtotal_cents, total_cents) values ('x@y.ch', 0, 0)"),
    );
    expect(insert.message).toMatch(/permission denied/);
    const update = await expectPgError(
      q("authenticated", alice.claims, "update public.orders set status = 'shipped' where id = $1", [aliceOrder]),
    );
    expect(update.message).toMatch(/permission denied/);
  });

  it("Admin sieht alle Bestellungen und darf nur Notizen ändern", async () => {
    const orders = await q<{ id: string }>("authenticated", admin.claims, "select id from public.orders where id in ($1, $2)", [aliceOrder, bobOrder]);
    expect(orders).toHaveLength(2);
    const note = await q("authenticated", admin.claims, "update public.orders set admin_note = 'Rückfrage' where id = $1 returning id", [bobOrder]);
    expect(note).toHaveLength(1);
    const status = await expectPgError(q("authenticated", admin.claims, "update public.orders set status = 'shipped' where id = $1", [bobOrder]));
    expect(status.message).toMatch(/permission denied/);
  });

  it("die Summenprüfung verhindert falsche Totale", async () => {
    const err = await expectPgError(
      sql("insert into public.orders (email, subtotal_cents, discount_cents, total_cents) values ('a@b.ch', 10000, 1000, 10000)"),
    );
    expect(err.message).toMatch(/check constraint/);
  });

  it("Bestellnummern beginnen bei 10001 und steigen", async () => {
    const rows = await sql<{ number: string }>("select number::text from public.orders order by number limit 1");
    expect(Number(rows[0]?.number)).toBeGreaterThanOrEqual(10001);
  });
});

describe("Admin-Daten", () => {
  for (const table of ["discount_codes", "gift_cards", "newsletter_subscribers", "gift_card_transactions", "stock_movements"]) {
    it(`Kundschaft liest ${table} nicht`, async () => {
      const rows = await q("authenticated", alice.claims, `select * from public.${table}`).catch((e: Error) => e);
      if (rows instanceof Error) expect(rows.message).toMatch(/permission denied/);
      else expect(rows).toHaveLength(0);
    });
  }

  it("anon liest weder Rabattcodes noch Gutscheine", async () => {
    for (const table of ["discount_codes", "gift_cards", "newsletter_subscribers"]) {
      const err = await expectPgError(q("anon", null, `select * from public.${table}`));
      expect(err.message).toMatch(/permission denied/);
    }
  });

  it("Admin liest Rabattcodes, Gutscheine und Newsletter", async () => {
    const codes = await q("authenticated", admin.claims, "select * from public.discount_codes where code = 'rlstest'");
    expect(codes).toHaveLength(1);
    const cards = await q("authenticated", admin.claims, "select * from public.gift_cards");
    expect(cards.length).toBeGreaterThan(0);
    const news = await q("authenticated", admin.claims, "select * from public.newsletter_subscribers");
    expect(news.length).toBeGreaterThan(0);
  });

  it("Admin kann Gutscheinguthaben nicht direkt ändern, nur den Status", async () => {
    const err = await expectPgError(
      q("authenticated", admin.claims, "update public.gift_cards set balance_cents = 999999 where code = 'AXN-ABCD-EFGH-JKLM'"),
    );
    expect(err.message).toMatch(/permission denied/);
    const ok = await q("authenticated", admin.claims, "update public.gift_cards set status = 'disabled' where code = 'AXN-ABCD-EFGH-JKLM' returning id");
    expect(ok).toHaveLength(1);
  });

  it("Gutscheincodes müssen das Format AXN-XXXX-XXXX-XXXX ohne 0, O, 1 und I haben", async () => {
    const err = await expectPgError(
      sql("insert into public.gift_cards (code, initial_cents, balance_cents, expires_at) values ('AXN-0000-OOOO-IIII', 5000, 5000, now())"),
    );
    expect(err.message).toMatch(/check constraint/);
  });
});
