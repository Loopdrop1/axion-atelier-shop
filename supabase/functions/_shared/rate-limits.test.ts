import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDeps, type Deps } from "./deps.ts";
import { readEnv } from "./env.ts";
import { pruneRateLimitsSometimes } from "./rate-limits.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import { ANON_KEY, SERVICE_KEY, startFakeSupabase } from "../../tests/fakes/servers.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let deps: Deps;

beforeAll(async () => {
  supa = await startFakeSupabase();
  deps = createDeps(
    readEnv(
      (k) =>
        ({
          SUPABASE_URL: supa.url,
          SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
          SUPABASE_ANON_KEY: ANON_KEY,
          SITE_URL: "https://shop.test",
        })[k],
    ),
  );
});

afterAll(async () => {
  await supa.close();
  await pool.end();
});

async function counter(key: string, age: string) {
  await sql(
    `insert into private.rate_limits (key, window_start, hits)
     values ($1, now() - $2::interval, 1)`,
    [key, age],
  );
}

const exists = async (key: string) =>
  (await sql("select 1 from private.rate_limits where key = $1", [key])).length === 1;

describe("Zähler der Missbrauchsbremsen aufräumen", () => {
  it("löscht nur Zähler, die älter als zwei Tage sind", async () => {
    const old = uniq("alt");
    const fresh = uniq("frisch");
    const day = uniq("tag");
    await counter(old, "3 days");
    await counter(fresh, "5 minutes");
    await counter(day, "1 day");
    await pruneRateLimitsSometimes(deps, 1);
    expect(await exists(old)).toBe(false);
    expect(await exists(fresh)).toBe(true);
    expect(await exists(day)).toBe(true);
  });

  it("meistens nichts tun (nur bei einem Teil der Anfragen)", async () => {
    const rpc = vi.fn(async () => 0);
    await pruneRateLimitsSometimes({ rpc: rpc as never }, 0.05, () => 0.5);
    expect(rpc).not.toHaveBeenCalled();
    await pruneRateLimitsSometimes({ rpc: rpc as never }, 0.05, () => 0.01);
    expect(rpc).toHaveBeenCalledWith("prune_rate_limits");
  });

  it("ein Fehler beim Aufräumen stört die Anfrage nicht", async () => {
    const rpc = vi.fn(async () => {
      throw new Error("weg");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(pruneRateLimitsSometimes({ rpc: rpc as never }, 1)).resolves.toBeUndefined();
    log.mockRestore();
  });

  it("nur der Server darf aufräumen (nicht anon, nicht authenticated)", async () => {
    const grants = await sql<{ anon: boolean; auth: boolean; service: boolean }>(
      `select has_function_privilege('anon', 'public.prune_rate_limits()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.prune_rate_limits()', 'execute') as auth,
              has_function_privilege('service_role', 'public.prune_rate_limits()', 'execute') as service`,
    );
    expect(grants).toEqual([{ anon: false, auth: false, service: true }]);
  });
});
