import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq } from "./helpers";

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await sql("delete from private.rate_limits");
});

async function seed(path = `/${uniq("rls")}`) {
  await sql(
    "insert into public.client_errors (fingerprint, message, path) values ($1, 'Boom', $2)",
    [uniq("fingerprint"), path],
  );
  return path;
}

const report = (ip: string, message = `Fehler ${uniq("m")}`, path = "/rpc") =>
  q(
    "service_role",
    null,
    "select public.client_error_report($1, $2, $3, $4, null, 'UA', 'rel') as r",
    [ip, uniq("fp12345678"), message, path],
  );

describe("client_errors: RLS", () => {
  it("Admins lesen und löschen, Kundschaft und Gäste sehen und löschen nichts", async () => {
    const path = await seed();
    const admin = await createUser(undefined, { admin: true });
    const customer = await createUser();
    const read = "select path from public.client_errors where path = $1";
    expect(await q("authenticated", admin.claims, read, [path])).toEqual([{ path }]);
    expect(await q("authenticated", customer.claims, read, [path])).toEqual([]);
    expect((await expectPgError(q("anon", null, read, [path]))).message).toMatch(
      /permission denied/,
    );
    // Löschen: Kundschaft trifft nichts, Admin trifft die Zeile
    await q("authenticated", customer.claims, "delete from public.client_errors where path = $1", [
      path,
    ]);
    expect(await sql(read, [path])).toHaveLength(1);
    await q("authenticated", admin.claims, "delete from public.client_errors where path = $1", [
      path,
    ]);
    expect(await sql(read, [path])).toHaveLength(0);
  });

  it("niemand ausser service_role schreibt: kein INSERT, UPDATE und kein Aufruf der RPC", async () => {
    const admin = await createUser(undefined, { admin: true });
    for (const [role, claims] of [
      ["authenticated", admin.claims],
      ["anon", null],
    ] as const) {
      const insert = await expectPgError(
        q(
          role,
          claims,
          "insert into public.client_errors (fingerprint, message) values ('abcdefgh', 'x')",
        ),
      );
      expect(insert.message).toMatch(/permission denied/);
      const call = await expectPgError(
        q(
          role,
          claims,
          "select public.client_error_report('1.1.1.1', 'abcdefgh', 'x', '/', null, null, null)",
        ),
      );
      expect(call.message).toMatch(/permission denied/);
    }
    const update = await expectPgError(
      q("authenticated", admin.claims, "update public.client_errors set count = 99"),
    );
    expect(update.message).toMatch(/permission denied/);
  });

  it("die Tabelle erzwingt die Längen", async () => {
    const err = await expectPgError(
      sql("insert into public.client_errors (fingerprint, message) values ('abcdefgh', $1)", [
        "m".repeat(501),
      ]),
    );
    expect(err.message).toMatch(/check constraint/);
  });
});

describe("client_error_report", () => {
  it("verbucht, zählt gleiche Fingerprints hoch und speichert keine IP", async () => {
    const path = `/${uniq("rpc")}`;
    const fp = uniq("fp12345678");
    const call = () =>
      q(
        "service_role",
        null,
        "select public.client_error_report('203.0.113.77', $1, 'Boom', $2, 'stack', 'UA', 'rel') as r",
        [fp, path],
      );
    expect(await call()).toEqual([{ r: "ok" }]);
    expect(await call()).toEqual([{ r: "ok" }]);
    const rows = await sql<Record<string, unknown>>(
      "select * from public.client_errors where path = $1",
      [path],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!["count"]).toBe(2);
    expect(JSON.stringify(rows)).not.toContain("203.0.113.77");
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        "count",
        "created_at",
        "fingerprint",
        "id",
        "last_seen_at",
        "message",
        "path",
        "release",
        "stack",
        "user_agent",
      ].sort(),
    );
  });

  it("bremst pro IP (20 pro Stunde)", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
    await sql("delete from private.rate_limits");
    for (let i = 0; i < 20; i++) expect(await report(ip)).toEqual([{ r: "ok" }]);
    expect(await report(ip)).toEqual([{ r: "rate_limited" }]);
    expect(await report("198.51.100.250")).toEqual([{ r: "ok" }]);
  });
});
