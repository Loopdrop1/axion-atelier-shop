import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import { ANON_KEY, SERVICE_KEY, startFakeSupabase } from "../../tests/fakes/servers.ts";
import { cleanPath, createClientErrorHandler, scrub } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let handler: (req: Request) => Promise<Response>;
let ipCounter = 0;
const hash = "encode(extensions.digest($1::text, 'sha256'), 'hex')";

beforeAll(async () => {
  supa = await startFakeSupabase();
  handler = createClientErrorHandler(
    createDeps(
      readEnv(
        (k) =>
          ({
            SUPABASE_URL: supa.url,
            SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
            SUPABASE_ANON_KEY: ANON_KEY,
            SITE_URL: "https://shop.test",
          })[k],
      ),
    ),
  );
});

beforeEach(async () => {
  await sql(`delete from private.rate_limits where key = ${hash}`, ["clienterr-global"]);
});

afterAll(async () => {
  await sql(`delete from private.rate_limits where key = ${hash}`, ["clienterr-global"]);
  await supa.close();
  await pool.end();
});

function post(body: unknown, ip = `10.7.0.${++ipCounter}`) {
  return handler(
    new Request("https://fn.test/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.test",
        "user-agent": "Mozilla/5.0 (iPhone) Test",
        "x-forwarded-for": `${ip}, 172.16.0.1`,
      },
      body: JSON.stringify(body),
    }),
  );
}

const rows = (path: string) =>
  sql<{ message: string; path: string; stack: string | null; user_agent: string; count: number }>(
    "select message, path, stack, user_agent, count from public.client_errors where path = $1",
    [path],
  );

describe("scrub und cleanPath", () => {
  it("entfernt Query-String, Fragment und E-Mail-Adressen", () => {
    expect(scrub("Failed https://x.ch/api?token=abc#f for max@example.ch")).toBe(
      "Failed https://x.ch/api for [email]",
    );
    expect(cleanPath("https://shop.test/produkt/anzug?q=1#x")).toBe("/produkt/anzug");
    expect(cleanPath("/suche?q=max@example.ch")).toBe("/suche");
    expect(cleanPath(undefined)).toBe("/");
  });

  it("ersetzt Bestell-Token, Nummern, UUIDs und lange Folgen in Pfad und Text", () => {
    const token = "3f2b8c1e-9d4a-4b7e-a1c2-5e6f7a8b9c0d";
    expect(cleanPath(`/bestellung/${token}`)).toBe("/bestellung/:token");
    expect(cleanPath(`https://shop.test/en/bestellung/${token}?x=1`)).toBe("/en/bestellung/:token");
    expect(cleanPath("/en/konto/bestellungen/10042")).toBe("/en/konto/bestellungen/:nr");
    expect(scrub(`Boom at https://shop.test/bestellung/${token}?t=1 for ${token}`)).toBe(
      "Boom at https://shop.test/bestellung/:token for :id",
    );
    expect(scrub("key Ab3dEf6hIj9lMn2pQr5tUv8xYz1Bc4De7Fg0 and " + "ab".repeat(16))).toBe(
      "key :tok and :hex",
    );
  });
});

describe("client-error", () => {
  it("speichert Meldung, Pfad ohne Query-String, Stack und Browser, aber keine IP", async () => {
    const path = `/${uniq("seite")}`;
    const res = await post({
      message: "TypeError: x is undefined (kunde@example.ch)",
      stack: "TypeError: x\n    at f (https://shop.test/assets/a.js?v=1:10:5)",
      path: `${path}?email=kunde@example.ch#top`,
      release: "2026.10.27+abc",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [row] = await rows(path);
    expect(row).toMatchObject({
      message: "TypeError: x is undefined ([email])",
      path,
      user_agent: "Mozilla/5.0 (iPhone) Test",
      count: 1,
    });
    expect(row!.stack).not.toContain("?v=1");
    const all = await sql("select * from public.client_errors where path = $1", [path]);
    expect(JSON.stringify(all)).not.toMatch(/10\.7\.0\.|kunde@/);
  });

  it("speichert den Bestell-Token nirgends (Pfad, Meldung, Stack)", async () => {
    const token = "9a8b7c6d-1111-4222-8333-444455556666";
    const marker = uniq("tok");
    const res = await post({
      message: `Render ${marker} bestellung/${token}`,
      stack: `Error\n    at Page (https://shop.test/bestellung/${token}?t=1:10:5)`,
      path: `/bestellung/${token}`,
    });
    expect(res.status).toBe(200);
    const all = await sql("select * from public.client_errors where message like $1", [
      `Render ${marker}%`,
    ]);
    expect(all).toHaveLength(1);
    expect(JSON.stringify(all)).not.toContain(token);
    expect(all[0]).toMatchObject({ path: "/bestellung/:token" });
  });

  it("kürzt zu lange Angaben", async () => {
    const path = `/${uniq("lang")}`;
    const res = await post({
      message: "m".repeat(800),
      stack: "s".repeat(5000),
      path,
      release: "r".repeat(200),
    });
    expect(res.status).toBe(200);
    const [row] = await rows(path);
    expect(row!.message).toHaveLength(500);
    expect(row!.stack).toHaveLength(2000);
    const [rel] = await sql<{ release: string }>(
      "select release from public.client_errors where path = $1",
      [path],
    );
    expect(rel!.release.length).toBeLessThanOrEqual(64);
  });

  it("gleicher Fehler innerhalb von 24 Stunden erhöht nur den Zähler", async () => {
    const path = `/${uniq("dupe")}`;
    const body = { message: "Boom 123 at item 77", stack: "Error\n    at g (a.js:1:2)", path };
    expect((await post(body)).status).toBe(200);
    // andere Zahlen in der Meldung, gleiche Stelle: derselbe Fingerprint
    expect((await post({ ...body, message: "Boom 456 at item 88" })).status).toBe(200);
    expect((await post(body)).status).toBe(200);
    const list = await rows(path);
    expect(list).toHaveLength(1);
    expect(list[0]!.count).toBe(3);
    // nach 24 Stunden beginnt ein neuer Eintrag
    await sql(
      "update public.client_errors set last_seen_at = now() - interval '25 hours' where path = $1",
      [path],
    );
    expect((await post(body)).status).toBe(200);
    expect(await rows(path)).toHaveLength(2);
  });

  it("löscht Einträge, die älter als 30 Tage sind, beim Anlegen neuer", async () => {
    const old = `/${uniq("alt")}`;
    await sql(
      "insert into public.client_errors (fingerprint, message, path, last_seen_at) values ('altaltalt1', 'alt', $1, now() - interval '31 days')",
      [old],
    );
    expect((await post({ message: "neu", path: `/${uniq("neu")}` })).status).toBe(200);
    expect(await rows(old)).toHaveLength(0);
  });

  it("löscht alte Einträge auch dann, wenn nur bekannte Fehler wiederkehren", async () => {
    const old = `/${uniq("alt2")}`;
    const path = `/${uniq("bekannt")}`;
    const body = { message: `Bekannt ${uniq("b")}`, path };
    expect((await post(body)).status).toBe(200);
    await sql(
      "insert into public.client_errors (fingerprint, message, path, last_seen_at) values ('altaltalt2', 'alt', $1, now() - interval '31 days')",
      [old],
    );
    expect((await post(body)).status).toBe(200); // nur Zähler
    expect(await rows(path)).toMatchObject([{ count: 2 }]);
    expect(await rows(old)).toHaveLength(0);
  });

  it("Wiederholungen eines bekannten Fehlers belasten das Tageslimit nicht", async () => {
    const body = { message: `Wiederholt ${uniq("w")}`, path: `/${uniq("rep")}` };
    expect((await post(body)).status).toBe(200);
    const global = () =>
      sql<{ hits: number }>(`select hits from private.rate_limits where key = ${hash}`, [
        "clienterr-global",
      ]);
    expect(await global()).toEqual([{ hits: 1 }]);
    for (let i = 0; i < 5; i++) expect((await post(body)).status).toBe(200);
    expect(await global()).toEqual([{ hits: 1 }]);
    // bei erschöpftem Tageslimit gehen Wiederholungen weiter durch, neue Fehler nicht
    await sql(`update private.rate_limits set hits = 500 where key = ${hash}`, [
      "clienterr-global",
    ]);
    expect((await post(body)).status).toBe(200);
    expect((await post({ message: `Neu ${uniq("n")}`, path: "/g" })).status).toBe(429);
  });

  it("ungültige Anfragen: 400, 413, 415", async () => {
    for (const body of [{}, { message: "  " }, { message: 12 }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "BAD_REQUEST" });
    }
    expect((await post({ message: "x".repeat(13_000) })).status).toBe(413);
    const text = await handler(
      new Request("https://fn.test/client-error", {
        method: "POST",
        headers: { "content-type": "text/plain", origin: "https://shop.test" },
        body: JSON.stringify({ message: "x" }),
      }),
    );
    expect(text.status).toBe(415);
    const get = await handler(new Request("https://fn.test/client-error", { method: "GET" }));
    expect(get.status).toBe(405);
  });

  it("bremst: 20 pro IP und Stunde, 500 pro Tag gesamt", async () => {
    const ip = "10.8.8.8";
    for (let i = 0; i < 20; i++)
      expect((await post({ message: `Fehler ${uniq("e")}`, path: "/ip" }, ip)).status).toBe(200);
    const blocked = await post({ message: "noch einer", path: "/ip" }, ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "RATE_LIMITED" });

    await sql(
      `insert into private.rate_limits (key, window_start, hits) values (${hash}, now(), 500)
       on conflict (key) do update set window_start = now(), hits = 500`,
      ["clienterr-global"],
    );
    expect((await post({ message: "global", path: "/g" })).status).toBe(429);
  });
});
