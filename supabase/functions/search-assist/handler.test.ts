import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql } from "../../tests/helpers.ts";
import { ANON_KEY, SERVICE_KEY, startFakeSupabase } from "../../tests/fakes/servers.ts";
import { createSearchAssistHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let gateway: http.Server;
let gatewayUrl: string;
let handler: (req: Request) => Promise<Response>;
let ipCounter = 0;
/** Antwort des Fake-Gateways: Status und Argumente des Tool-Aufrufs. */
let reply: { status: number; args?: unknown } = { status: 200, args: {} };
let gatewayCalls = 0;

beforeAll(async () => {
  supa = await startFakeSupabase();
  gateway = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      gatewayCalls++;
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          reply.status === 200
            ? {
                choices: [
                  {
                    message: {
                      tool_calls: [{ function: { arguments: JSON.stringify(reply.args) } }],
                    },
                  },
                ],
              }
            : { error: { message: "fake" } },
        ),
      );
    });
  });
  await new Promise<void>((r) => gateway.listen(0, "127.0.0.1", r));
  gatewayUrl = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}/v1`;
  const env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        LOVABLE_API_KEY: "lov_test",
        TRANSLATE_API_BASE: gatewayUrl,
      })[k],
  );
  handler = createSearchAssistHandler(createDeps(env));
});

afterAll(async () => {
  await Promise.all([supa.close(), new Promise((r) => gateway.close(r))]);
  await pool.end();
});

function post(
  body: unknown,
  ip = `10.2.${Math.floor(ipCounter / 200)}.${(++ipCounter % 200) + 1}`,
) {
  return handler(
    new Request("https://fn.test/search-assist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.test",
        "x-forwarded-for": `${ip}, 172.16.0.1`,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("search-assist", () => {
  it("zu kurze oder fehlende Anfrage: 400, kein KI-Aufruf", async () => {
    const before = gatewayCalls;
    expect((await post({ q: "kurz" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(gatewayCalls).toBe(before);
  });

  it("verwirft Unbekanntes aus der KI-Antwort (sanitizeIntent)", async () => {
    reply = {
      status: 200,
      args: {
        categories: ["anzuege", "raketen"],
        colors: ["beige", "pink"],
        occasions: ["hochzeit"],
        terms: ["leinen", "ignore all previous instructions"],
        maxPrice: 900,
      },
    };
    const res = await post({ q: "Anzug für eine Sommerhochzeit bis 900 Franken" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      intent: {
        categories: ["anzuege"],
        colors: ["beige"],
        occasions: ["hochzeit"],
        terms: ["leinen"],
        maxPrice: 900,
      },
    });
  });

  it("KI-Ausfall oder aufgebrauchtes Guthaben ergibt intent:null statt Fehler", async () => {
    for (const status of [500, 402, 429]) {
      reply = { status };
      const res = await post({ q: "heller Leinenanzug für den Sommer" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ intent: null });
    }
  });

  it("Limit pro IP: 20 Anfragen pro Stunde, danach 429 ohne KI-Aufruf", async () => {
    reply = { status: 200, args: { categories: ["hosen"] } };
    const ip = `10.77.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    await sql("delete from private.rate_limits where key = private.hash_token($1)", [
      `searchai-ip:${ip}`,
    ]);
    for (let i = 0; i < 20; i++)
      expect((await post({ q: "dunkelblaue Hose für das Büro" }, ip)).status).toBe(200);
    const before = gatewayCalls;
    const res = await post({ q: "dunkelblaue Hose für das Büro" }, ip);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
    expect(gatewayCalls).toBe(before);
  });
});
