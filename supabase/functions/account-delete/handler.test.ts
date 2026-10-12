import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { readEnv, type FunctionEnv } from "../_shared/env.ts";
import { createUser, pool, sql, type TestUser } from "../../tests/helpers";
import { makeProduct, reserve } from "../../tests/fixtures";
import { ANON_KEY, fakeJwt, SERVICE_KEY, startFakeSupabase } from "../../tests/fakes/servers";
import { createAccountDeleteHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let env: FunctionEnv;
let handler: (req: Request) => Promise<Response>;

beforeAll(async () => {
  supa = await startFakeSupabase();
  env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
      })[k],
  );
  handler = createAccountDeleteHandler(createDeps(env));
});

afterAll(async () => {
  await supa.close();
  await pool.end();
});

function post(body: unknown, user: TestUser | null, h = handler) {
  return h(
    new Request("https://fn.test/account-delete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.test",
        ...(user
          ? { authorization: `Bearer ${fakeJwt({ sub: user.id, email: user.email })}` }
          : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("account-delete", () => {
  it("ohne Anmeldung 401, ohne ausdrückliche Bestätigung 400", async () => {
    expect((await post({ confirm: true }, null)).status).toBe(401);
    const user = await createUser();
    const res = await post({}, user);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "CONFIRMATION_REQUIRED" });
  });

  it("löscht nur das eigene Konto; Bestellungen bleiben ohne Kontoverknüpfung", async () => {
    const user = await createUser();
    const other = await createUser();
    const p = await makeProduct({ priceCents: 10000, stocks: [2] });
    const order = await reserve({
      lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }],
      email: user.email,
      userId: user.id,
    });
    const res = await post({ confirm: true, userId: other.id }, user);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, ordersKept: 1 });
    expect(await sql("select 1 from auth.users where id = $1", [user.id])).toHaveLength(0);
    expect(await sql("select 1 from auth.users where id = $1", [other.id])).toHaveLength(1);
    const kept = await sql<{ user_id: string | null; email: string }>(
      "select user_id, email from public.orders where id = $1",
      [order.order_id],
    );
    expect(kept[0]).toEqual({ user_id: null, email: user.email });
  });

  it("gelöschtes Konto: Token ist danach wertlos (401)", async () => {
    const user = await createUser();
    expect((await post({ confirm: true }, user)).status).toBe(200);
    expect((await post({ confirm: true }, user)).status).toBe(401);
  });

  it("letzter Admin: 409, Konto bleibt", async () => {
    const user = await createUser(undefined, { admin: true });
    const deps = createDeps(env);
    const lastAdmin = createAccountDeleteHandler({
      ...deps,
      rpc: async <T>(fn: string): Promise<T> => {
        if (fn === "prepare_account_deletion") throw new RpcError("LAST_ADMIN", null, "P0001");
        return deps.rpc<T>(fn);
      },
    });
    const res = await post({ confirm: true }, user, lastAdmin);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "LAST_ADMIN" });
    expect(await sql("select 1 from auth.users where id = $1", [user.id])).toHaveLength(1);
  });
});
