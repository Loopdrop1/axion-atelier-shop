import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql } from "./helpers";
import { makeProduct, reserve, rpc } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

/** Führt fn als Superuser in einer Transaktion aus und rollt immer zurück (Testdaten bleiben unberührt). */
async function inRollback(fn: (c: import("pg").PoolClient) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await fn(c);
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
  }
}

describe("Letzter Admin", () => {
  it("die Rolle des letzten Admins lässt sich nicht löschen, auch nicht über das Konto", async () => {
    const me = await createUser(undefined, { admin: true });
    await inRollback(async (c) => {
      await c.query("delete from public.user_roles where role = 'admin' and user_id <> $1", [me.id]);
      await c.query("savepoint s1");
      const direct = await c.query("delete from public.user_roles where user_id = $1", [me.id]).then(
        () => null,
        (e: { message: string }) => e.message,
      );
      expect(direct).toBe("LAST_ADMIN");
      await c.query("rollback to savepoint s1");
      const viaAccount = await c.query("delete from auth.users where id = $1", [me.id]).then(
        () => null,
        (e: { message: string }) => e.message,
      );
      expect(viaAccount).toBe("LAST_ADMIN");
    });
  });

  it("mit einem zweiten Admin darf ein Admin-Konto gelöscht werden", async () => {
    const a = await createUser(undefined, { admin: true });
    await createUser(undefined, { admin: true });
    await sql("delete from auth.users where id = $1", [a.id]);
    expect(await sql("select 1 from public.user_roles where user_id = $1", [a.id])).toHaveLength(0);
  });
});

describe("prepare_account_deletion", () => {
  it("meldet LAST_ADMIN für den einzigen Admin", async () => {
    const me = await createUser(undefined, { admin: true });
    await inRollback(async (c) => {
      await c.query("delete from public.user_roles where role = 'admin' and user_id <> $1", [me.id]);
      await c.query("select set_config('role', 'service_role', true)");
      const msg = await c.query("select public.prepare_account_deletion($1)", [me.id]).then(
        () => null,
        (e: { message: string }) => e.message,
      );
      expect(msg).toBe("LAST_ADMIN");
    });
  });

  it("zählt die Bestellungen, die nach dem Löschen ohne Konto erhalten bleiben", async () => {
    const user = await createUser();
    const p = await makeProduct({ priceCents: 10000, stocks: [3] });
    const order = await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }], email: user.email, userId: user.id });
    const res = await rpc<{ orders_kept: number }>("prepare_account_deletion", [user.id]);
    expect(res.orders_kept).toBe(1);
    await sql("delete from auth.users where id = $1", [user.id]);
    const rows = await sql<{ user_id: string | null; email: string }>("select user_id, email from public.orders where id = $1", [order.order_id]);
    expect(rows[0]).toEqual({ user_id: null, email: user.email });
    expect(await sql("select 1 from public.profiles where id = $1", [user.id])).toHaveLength(0);
  });

  it("ist nur für den Server aufrufbar", async () => {
    const user = await createUser();
    const err = await expectPgError(q("authenticated", user.claims, "select public.prepare_account_deletion($1)", [user.id]));
    expect(err.code).toBe("42501");
  });
});

describe("get_gift_card_for_email", () => {
  it("liefert den Gutschein für den erneuten Versand, nur für den Server", async () => {
    const card = await rpc<{ id: string; code: string }>("issue_gift_card", [5000, "de", "lea@example.ch", "Lea", null, null, null, null]);
    const again = await rpc<{ code: string; recipient_email: string }>("get_gift_card_for_email", [card.id]);
    expect(again).toMatchObject({ code: card.code, recipient_email: "lea@example.ch" });
    const user = await createUser();
    const err = await expectPgError(q("authenticated", user.claims, "select public.get_gift_card_for_email($1)", [card.id]));
    expect(err.code).toBe("42501");
  });
});
