import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { pool, sql, uniq } from "../../tests/helpers.ts";
import {
  ANON_KEY,
  SERVICE_KEY,
  startFakeResend,
  startFakeSupabase,
} from "../../tests/fakes/servers.ts";
import { createReturnRequestHandler } from "./handler.ts";

let supa: Awaited<ReturnType<typeof startFakeSupabase>>;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;
let ipCounter = 0;
const created: string[] = [];

function makeEnv(extra: Record<string, string> = {}) {
  return readEnv(
    (k) =>
      ({
        SUPABASE_URL: supa.url,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
        EMAIL_FROM: "Axion <shop@axion.test>",
        SHOP_NOTIFY_EMAIL: "shop@axion.test",
        SHOP_ADDRESS: "Axion AG, Teststrasse 1, 8000 Zürich",
        SHOP_RETURN_DAYS: "14",
        ...extra,
      })[k],
  );
}

beforeAll(async () => {
  supa = await startFakeSupabase();
  resend = await startFakeResend();
  handler = createReturnRequestHandler(createDeps(makeEnv()));
  await sql("update public.shop_settings set notify_email = null where id = 1");
});

afterAll(async () => {
  // Testbestellungen entfernen (Positionen und Retouren folgen per Cascade), damit Übersichten anderer Tests sauber bleiben
  await sql("delete from public.orders where id = any($1::uuid[])", [created]);
  await Promise.all([supa.close(), resend.close()]);
  await pool.end();
});

/** Jede Anfrage bekommt eine eigene IP, damit sich die Tests nicht gegenseitig ins IP-Limit bringen. */
function post(body: unknown, ip = `10.7.0.${++ipCounter}`, h = handler) {
  return h(
    new Request("https://fn.test/return-request", {
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

interface TestOrder {
  id: string;
  number: number;
  email: string;
  items: { id: string; title: string }[];
}

/** Bezahlte (oder versendete) Bestellung mit zwei Positionen: 2 × Anzug und 1 × Hemd. */
async function order(
  opts: {
    status?: string;
    paidDaysAgo?: number;
    shippedDaysAgo?: number | null;
    locale?: string;
  } = {},
): Promise<TestOrder> {
  const email = `${uniq("Retoure")}@Example.ch`;
  const paid = opts.paidDaysAgo ?? 3;
  const shipped = opts.shippedDaysAgo === undefined ? paid - 1 : opts.shippedDaysAgo;
  const rows = await sql<{ id: string; number: string }>(
    `insert into public.orders (email, locale, status, subtotal_cents, total_cents, paid_at, shipped_at)
     values ($1, $2, $3, 30000, 30000, now() - make_interval(days => $4),
       case when $5::int is null then null else now() - make_interval(days => $5::int) end)
     returning id, number`,
    [email, opts.locale ?? "de", opts.status ?? "shipped", paid, shipped],
  );
  const o = rows[0]!;
  created.push(o.id);
  const items: TestOrder["items"] = [];
  for (const [title, size, qty, price] of [
    ["Anzug Limmat", "50", 2, 10000],
    ["Hemd Aare", "41", 1, 10000],
  ] as const) {
    const r = await sql<{ id: string }>(
      `insert into public.order_items (order_id, title, size, color, unit_price_cents, quantity, line_total_cents)
       values ($1, $2, $3, 'Blau', $4::int, $5::int, $4::int * $5::int) returning id`,
      [o.id, title, size, price, qty],
    );
    items.push({ id: r[0]!.id, title });
  }
  return { id: o.id, number: Number(o.number), email: email.toLowerCase(), items };
}

const lookup = (o: TestOrder, extra: Record<string, unknown> = {}) =>
  post({ action: "lookup", orderNumber: `AX-${o.number}`, email: o.email, ...extra });

describe("return-request: lookup", () => {
  it("liefert die zurückgebbaren Stücke (Adresse ohne Beachtung der Gross-/Kleinschreibung)", async () => {
    const o = await order();
    const res = await post({
      action: "lookup",
      orderNumber: String(o.number),
      email: `  ${o.email.toUpperCase()} `,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      orderNumber: number;
      items: { orderItemId: string; title: string; quantity: number; size: string }[];
    };
    expect(body.status).toBe("ok");
    expect(body.orderNumber).toBe(o.number);
    expect(body.items.map((i) => [i.title, i.quantity, i.size])).toEqual([
      ["Anzug Limmat", 2, "50"],
      ["Hemd Aare", 1, "41"],
    ]);
    expect(body.items[0]!.orderItemId).toBe(o.items[0]!.id);
  });

  it("falsche Adresse, unbekannte Nummer, offene und abgebrochene Bestellung: gleiche Antwort NOT_FOUND", async () => {
    const o = await order();
    const pending = await order({ status: "pending" });
    const cancelled = await order({ status: "cancelled" });
    const cases = [
      { orderNumber: o.number, email: "andere@example.ch" },
      { orderNumber: 999999999, email: o.email },
      { orderNumber: pending.number, email: pending.email },
      { orderNumber: cancelled.number, email: cancelled.email },
    ];
    const answers = [];
    for (const c of cases) {
      const res = await post({ action: "lookup", ...c });
      answers.push([res.status, await res.json()]);
    }
    for (const a of answers) expect(a).toEqual([404, { error: "NOT_FOUND" }]);
  });

  it("Frist: ab Versand gerechnet, sonst ab Zahlung; danach RETURN_WINDOW_CLOSED", async () => {
    const shippedRecently = await order({ paidDaysAgo: 30, shippedDaysAgo: 5 });
    expect((await lookup(shippedRecently)).status).toBe(200);
    const shippedLong = await order({ paidDaysAgo: 30, shippedDaysAgo: 25 });
    const closed = await lookup(shippedLong);
    expect(closed.status).toBe(409);
    expect(await closed.json()).toEqual({ error: "RETURN_WINDOW_CLOSED", returnDays: 14 });
    const paidOnlyOld = await order({ status: "paid", paidDaysAgo: 20, shippedDaysAgo: null });
    expect((await lookup(paidOnlyOld)).status).toBe(409);
    const paidOnlyNew = await order({ status: "paid", paidDaysAgo: 2, shippedDaysAgo: null });
    expect((await lookup(paidOnlyNew)).status).toBe(200);
  });

  it("die Frist kommt aus SHOP_RETURN_DAYS", async () => {
    const o = await order({ paidDaysAgo: 40, shippedDaysAgo: 25 });
    expect((await lookup(o)).status).toBe(409);
    const longer = createReturnRequestHandler(createDeps(makeEnv({ SHOP_RETURN_DAYS: "30" })));
    const res = await post(
      { action: "lookup", orderNumber: o.number, email: o.email },
      undefined,
      longer,
    );
    expect(res.status).toBe(200);
  });

  it("vollständig erstattete Bestellung: NOTHING_RETURNABLE", async () => {
    const o = await order({ status: "refunded" });
    const res = await lookup(o);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "NOTHING_RETURNABLE" });
  });

  it("ungültige Eingaben: 400 BAD_REQUEST; verstecktes Feld: wie nicht gefunden", async () => {
    for (const body of [
      { action: "lookup", orderNumber: "abc", email: "a@example.ch" },
      { action: "lookup", orderNumber: "10001", email: "keine-adresse" },
      { action: "lookup", email: "a@example.ch" },
      { action: "unbekannt" },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "BAD_REQUEST" });
    }
    const o = await order();
    const bot = await lookup(o, { website: "https://spam.example" });
    expect(bot.status).toBe(404);
  });

  it("verlangt Content-Type application/json (415)", async () => {
    const res = await handler(
      new Request("https://fn.test/return-request", {
        method: "POST",
        headers: { "content-type": "text/plain", origin: "https://shop.test" },
        body: JSON.stringify({ action: "lookup" }),
      }),
    );
    expect(res.status).toBe(415);
  });

  it("bremst pro IP (30 pro Stunde)", async () => {
    const ip = "10.77.0.1";
    const o = await order();
    let last = 200;
    for (let i = 0; i < 31; i++) {
      const res = await post(
        { action: "lookup", orderNumber: o.number, email: `x${i}@example.ch` },
        ip,
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("return-request: submit", () => {
  const submit = (o: TestOrder, items: unknown, extra: Record<string, unknown> = {}) =>
    post({
      action: "submit",
      orderNumber: o.number,
      email: o.email,
      items,
      comment: "Passt leider nicht",
      ...extra,
    });

  it("speichert die Anmeldung und schickt Bestätigung und Shop-Meldung mit Idempotency-Key", async () => {
    const o = await order();
    const before = resend.sent.length;
    const res = await submit(o, [
      { orderItemId: o.items[0]!.id, quantity: 1, reason: "too_large" },
      { orderItemId: o.items[1]!.id, quantity: 1, reason: "quality" },
    ]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      returnNumber: string;
      orderNumber: number;
      emailed: boolean;
    };
    expect(body).toMatchObject({ status: "ok", orderNumber: o.number, emailed: true });
    expect(body.returnNumber).toMatch(/^R-\d+$/);

    const rows = await sql<{ id: string; status: string; email: string; comment: string }>(
      "select id, status, email, comment from public.return_requests where order_id = $1",
      [o.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "requested",
      email: o.email,
      comment: "Passt leider nicht",
    });

    const mails = resend.sent.slice(before);
    expect(mails).toHaveLength(2);
    const customer = mails.find((m) => m.to[0] === o.email)!;
    expect(customer.subject).toBe(`Deine Retoure ${body.returnNumber} ist angemeldet`);
    expect(customer.text).toContain(`AX-${o.number}`);
    expect(customer.text).toContain("Axion AG, Teststrasse 1, 8000 Zürich");
    expect(customer.text).toContain("Anzug Limmat");
    expect(customer.text).toContain("Zu gross");
    expect(customer.text).not.toMatch(/Etikett (liegt|folgt)|Retourenetikette/);
    expect(customer.idempotencyKey).toBe(`return-${rows[0]!.id}-customer`);
    const shop = mails.find((m) => m.to[0] === "shop@axion.test")!;
    expect(shop.subject).toBe(`Neue Retoure ${body.returnNumber} zu AX-${o.number}`);
    expect(shop.reply_to).toBe(o.email);
    expect(shop.idempotencyKey).toBe(`return-${rows[0]!.id}-shop`);
  });

  it("englische Bestätigung bei locale en", async () => {
    const o = await order();
    const before = resend.sent.length;
    const res = await submit(o, [{ orderItemId: o.items[1]!.id, quantity: 1, reason: "style" }], {
      locale: "en",
    });
    expect(res.status).toBe(200);
    const customer = resend.sent.slice(before).find((m) => m.to[0] === o.email)!;
    expect(customer.subject).toMatch(/^Your return R-\d+ is registered$/);
    expect(customer.text).toContain("Not to my taste");
  });

  it("Menge: angemeldet + neu darf die bestellte Menge nicht übersteigen; danach schrumpft lookup", async () => {
    const o = await order();
    const suit = o.items[0]!.id;
    expect(
      (await submit(o, [{ orderItemId: suit, quantity: 3, reason: "too_small" }])).status,
    ).toBe(409);
    expect(
      (await submit(o, [{ orderItemId: suit, quantity: 2, reason: "too_small" }])).status,
    ).toBe(200);
    const again = await submit(o, [{ orderItemId: suit, quantity: 1, reason: "too_small" }]);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "ITEMS_NOT_RETURNABLE" });
    const res = await lookup(o);
    const body = (await res.json()) as { items: { title: string }[] };
    expect(body.items.map((i) => i.title)).toEqual(["Hemd Aare"]);
  });

  it("eine abgelehnte Anmeldung gibt die Menge wieder frei", async () => {
    const o = await order();
    const suit = o.items[0]!.id;
    await submit(o, [{ orderItemId: suit, quantity: 2, reason: "style" }]);
    await sql("update public.return_requests set status = 'rejected' where order_id = $1", [o.id]);
    expect((await submit(o, [{ orderItemId: suit, quantity: 2, reason: "style" }])).status).toBe(
      200,
    );
  });

  it("gleiche requestId: dieselbe Anmeldung, keine zweite Zeile", async () => {
    const o = await order();
    const requestId = crypto.randomUUID();
    const items = [{ orderItemId: o.items[1]!.id, quantity: 1, reason: "other" }];
    const a = await submit(o, items, { requestId });
    const b = await submit(o, items, { requestId });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(((await a.json()) as { returnNumber: string }).returnNumber).toBe(
      ((await b.json()) as { returnNumber: string }).returnNumber,
    );
    expect(
      await sql("select 1 from public.return_requests where order_id = $1", [o.id]),
    ).toHaveLength(1);
  });

  it("falsche Adresse, fremde Position, doppelte Position, Grund oder Menge: kein Eintrag", async () => {
    const o = await order();
    const other = await order();
    const wrongEmail = await post({
      action: "submit",
      orderNumber: o.number,
      email: "andere@example.ch",
      items: [{ orderItemId: o.items[0]!.id, quantity: 1, reason: "style" }],
    });
    expect(wrongEmail.status).toBe(404);
    const foreign = await submit(o, [
      { orderItemId: other.items[0]!.id, quantity: 1, reason: "style" },
    ]);
    expect(foreign.status).toBe(409);
    for (const items of [
      [],
      [{ orderItemId: o.items[0]!.id, quantity: 0, reason: "style" }],
      [{ orderItemId: o.items[0]!.id, quantity: 1.5, reason: "style" }],
      [{ orderItemId: o.items[0]!.id, quantity: 1, reason: "gefaellt-nicht" }],
      [{ orderItemId: "kein-uuid", quantity: 1, reason: "style" }],
      [
        { orderItemId: o.items[0]!.id, quantity: 1, reason: "style" },
        { orderItemId: o.items[0]!.id, quantity: 1, reason: "style" },
      ],
    ]) {
      const res = await submit(o, items);
      expect(res.status, JSON.stringify(items)).toBe(400);
    }
    const long = await submit(o, [{ orderItemId: o.items[0]!.id, quantity: 1, reason: "style" }], {
      comment: "x".repeat(1001),
    });
    expect(long.status).toBe(400);
    expect(await long.json()).toEqual({ error: "COMMENT_TOO_LONG" });
    expect(
      await sql("select 1 from public.return_requests where order_id = $1", [o.id]),
    ).toHaveLength(0);
  });

  it("Frist abgelaufen: RETURN_WINDOW_CLOSED, kein Eintrag", async () => {
    const o = await order({ paidDaysAgo: 40, shippedDaysAgo: 30 });
    const res = await submit(o, [{ orderItemId: o.items[0]!.id, quantity: 1, reason: "style" }]);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "RETURN_WINDOW_CLOSED", returnDays: 14 });
  });

  it("scheitert der E-Mail-Versand, bleibt die Anmeldung gespeichert (emailed: false)", async () => {
    const o = await order();
    resend.failNext();
    const res = await submit(o, [{ orderItemId: o.items[1]!.id, quantity: 1, reason: "style" }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", emailed: false });
    expect(
      await sql("select 1 from public.return_requests where order_id = $1", [o.id]),
    ).toHaveLength(1);
  });

  it("HTML im Kommentar wird in der Mail maskiert", async () => {
    const o = await order();
    const before = resend.sent.length;
    await submit(o, [{ orderItemId: o.items[1]!.id, quantity: 1, reason: "other" }], {
      comment: "<script>alert(1)</script>",
    });
    for (const mail of resend.sent.slice(before)) {
      expect(mail.html).not.toContain("<script>");
      expect(mail.html).toContain("&lt;script&gt;");
    }
  });

  it("bremst pro Adresse (5 Anmeldungen pro Stunde)", async () => {
    const o = await order();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await submit(o, [{ orderItemId: o.items[0]!.id, quantity: 1, reason: "style" }]);
      statuses.push(res.status);
    }
    // 2 Stück bestellt: zwei Anmeldungen gehen durch, dann ist nichts mehr übrig; die sechste trifft die Bremse
    expect(statuses).toEqual([200, 200, 409, 409, 409, 429]);
  });
});
