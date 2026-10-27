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

describe("client_error_report: Löschung und Tageslimit", () => {
  const globalHits = async () =>
    (
      await sql<{ hits: number }>(
        "select hits from private.rate_limits where key = encode(extensions.digest('clienterr-global'::text, 'sha256'), 'hex')",
      )
    )[0]?.hits ?? 0;

  it("löscht Einträge über 30 Tage bei jedem Aufruf, auch bei bekanntem Fingerprint", async () => {
    const path = `/${uniq("prune")}`;
    const fp = uniq("fp12345678");
    const call = (ip: string) =>
      q(
        "service_role",
        null,
        "select public.client_error_report($1, $2, 'Boom', $3, null, 'UA', 'rel') as r",
        [ip, fp, path],
      );
    expect(await call("192.0.2.1")).toEqual([{ r: "ok" }]);
    await sql(
      "insert into public.client_errors (fingerprint, message, path, last_seen_at) values ($1, 'alt', $2, now() - interval '31 days')",
      [uniq("altfp12345"), `${path}/alt`],
    );
    await sql(
      "insert into public.client_errors (fingerprint, message, path, last_seen_at) values ($1, 'jung', $2, now() - interval '29 days')",
      [uniq("jungfp1234"), `${path}/jung`],
    );
    expect(await call("192.0.2.1")).toEqual([{ r: "ok" }]); // bekannter Fingerprint: nur Zähler
    expect(
      await sql("select 1 from public.client_errors where path = $1", [`${path}/alt`]),
    ).toEqual([]);
    expect(
      await sql("select 1 from public.client_errors where path = $1", [`${path}/jung`]),
    ).toHaveLength(1);
    expect(await sql("select count from public.client_errors where path = $1", [path])).toEqual([
      { count: 2 },
    ]);
  });

  it("Wiederholungen zählen nur pro IP, nicht zum Tageslimit; neue Fehler schon", async () => {
    const fp = uniq("fp12345678");
    const call = (ip: string, f = fp) =>
      q(
        "service_role",
        null,
        "select public.client_error_report($1, $2, 'Boom', '/limit', null, 'UA', 'rel') as r",
        [ip, f],
      );
    expect(await call("192.0.2.10")).toEqual([{ r: "ok" }]);
    expect(await globalHits()).toBe(1);
    for (let i = 0; i < 4; i++) expect(await call(`192.0.2.${20 + i}`)).toEqual([{ r: "ok" }]);
    expect(await globalHits()).toBe(1);
    expect(await call("192.0.2.30", uniq("fp12345678"))).toEqual([{ r: "ok" }]);
    expect(await globalHits()).toBe(2);
  });

  it("die IP-Bremse gilt zuerst, auch für Wiederholungen", async () => {
    const fp = uniq("fp12345678");
    const ip = "192.0.2.77";
    const call = () =>
      q(
        "service_role",
        null,
        "select public.client_error_report($1, $2, 'Boom', '/ipfirst', null, 'UA', 'rel') as r",
        [ip, fp],
      );
    for (let i = 0; i < 20; i++) expect(await call()).toEqual([{ r: "ok" }]);
    expect(await call()).toEqual([{ r: "rate_limited" }]);
  });

  it("bei erschöpftem Tageslimit gehen Wiederholungen durch, neue Fehler nicht", async () => {
    const fp = uniq("fp12345678");
    const call = (f: string) =>
      q(
        "service_role",
        null,
        "select public.client_error_report('192.0.2.99', $1, 'Boom', '/full', null, 'UA', 'rel') as r",
        [f],
      );
    expect(await call(fp)).toEqual([{ r: "ok" }]);
    await sql(
      "update private.rate_limits set hits = 500 where key = encode(extensions.digest('clienterr-global'::text, 'sha256'), 'hex')",
    );
    expect(await call(fp)).toEqual([{ r: "ok" }]);
    expect(await call(uniq("fp12345678"))).toEqual([{ r: "rate_limited" }]);
  });
});
