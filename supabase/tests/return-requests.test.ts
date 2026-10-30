import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq } from "./helpers";
import { rpc } from "./fixtures";

const created: string[] = [];

afterAll(async () => {
  // Testbestellungen entfernen (Positionen und Retouren folgen per Cascade), damit Übersichten anderer Tests sauber bleiben
  await sql("delete from public.orders where id = any($1::uuid[])", [created]);
  await pool.end();
});

beforeEach(async () => {
  await sql("delete from private.rate_limits");
});

interface Made {
  orderId: string;
  number: number;
  email: string;
  itemIds: string[];
}

async function order(
  opts: {
    status?: string;
    paidDaysAgo?: number;
    shippedDaysAgo?: number | null;
    kind?: string;
  } = {},
): Promise<Made> {
  const email = `${uniq("rt")}@example.ch`;
  const paid = opts.paidDaysAgo ?? 2;
  const shipped = opts.shippedDaysAgo === undefined ? null : opts.shippedDaysAgo;
  const rows = await sql<{ id: string; number: string }>(
    `insert into public.orders (email, status, kind, subtotal_cents, total_cents, paid_at, shipped_at)
     values ($1, $2, $3, 20000, 20000, now() - make_interval(days => $4),
       case when $5::int is null then null else now() - make_interval(days => $5::int) end)
     returning id, number`,
    [email, opts.status ?? "paid", opts.kind ?? "cart", paid, shipped],
  );
  const o = rows[0]!;
  created.push(o.id);
  const itemIds: string[] = [];
  for (const [title, qty] of [
    ["Anzug", 2],
    ["Hemd", 1],
  ] as const) {
    const r = await sql<{ id: string }>(
      `insert into public.order_items (order_id, title, size, unit_price_cents, quantity, line_total_cents)
       values ($1, $2, '50', 10000, $3::int, 10000 * $3::int) returning id`,
      [o.id, title, qty],
    );
    itemIds.push(r[0]!.id);
  }
  return { orderId: o.id, number: Number(o.number), email, itemIds };
}

interface Result {
  status: string;
  items?: { order_item_id: string; quantity: number }[];
  id?: string;
  number?: number;
  duplicate?: boolean;
  return_days?: number;
}

const lookup = (o: Made, email = o.email, ip = "10.9.0.1", days = 14) =>
  rpc<Result>("return_lookup", [o.number, email, ip, days]);

const submit = (
  o: Made,
  items: unknown,
  extra: { email?: string; requestId?: string | null; days?: number; ip?: string } = {},
) =>
  rpc<Result>("return_submit", [
    o.number,
    extra.email ?? o.email,
    JSON.stringify(items),
    "Kommentar",
    "de",
    extra.ip ?? "10.9.0.2",
    extra.days ?? 14,
    extra.requestId ?? null,
  ]);

describe("return_lookup", () => {
  it("liefert offene Stücke; E-Mail ohne Beachtung der Schreibweise", async () => {
    const o = await order();
    const r = await lookup(o, `  ${o.email.toUpperCase()} `);
    expect(r.status).toBe("ok");
    expect(r.items?.map((i) => i.quantity)).toEqual([2, 1]);
  });

  it("nicht gefunden ist einheitlich: falsche Adresse, offen, storniert, Gutscheinkauf, unbekannt", async () => {
    const o = await order();
    for (const made of [
      await order({ status: "pending" }),
      await order({ status: "cancelled" }),
      await order({ kind: "gift_card" }),
    ])
      expect(await lookup(made)).toEqual({ status: "not_found" });
    expect(await lookup(o, "jemand@example.ch")).toEqual({ status: "not_found" });
    expect(await rpc("return_lookup", [999999999, o.email, "10.9.0.1", 14])).toEqual({
      status: "not_found",
    });
  });

  it("Frist ab Erhalt (Versand + 7 Tage Zustellung), sonst ab Zahlung", async () => {
    expect((await lookup(await order({ paidDaysAgo: 30, shippedDaysAgo: 20 }))).status).toBe("ok");
    expect((await lookup(await order({ paidDaysAgo: 30, shippedDaysAgo: 22 }))).status).toBe(
      "expired",
    );
    expect((await lookup(await order({ paidDaysAgo: 15 }))).status).toBe("expired");
    expect((await lookup(await order({ paidDaysAgo: 15 }), undefined, "10.9.0.1", 30)).status).toBe(
      "ok",
    );
    const closed = await lookup(await order({ paidDaysAgo: 40 }));
    expect(closed).toEqual({ status: "expired", return_days: 14 });
  });

  it("von Hand eingebuchte Stücke sind nicht mehr zurückgebbar", async () => {
    const o = await order();
    await sql("update public.order_items set restocked_quantity = 1 where id = $1", [o.itemIds[0]]);
    const r = await lookup(o);
    expect(r.items?.find((i) => i.order_item_id === o.itemIds[0])?.quantity).toBe(1);
    expect(
      await submit(o, [{ order_item_id: o.itemIds[0], quantity: 2, reason: "style" }]),
    ).toEqual({ status: "invalid_items" });
  });

  it("erstattete Bestellung: nothing_returnable; alles angemeldet: nothing_returnable", async () => {
    expect((await lookup(await order({ status: "refunded" }))).status).toBe("nothing_returnable");
    const o = await order();
    await submit(o, [
      { order_item_id: o.itemIds[0], quantity: 2, reason: "style" },
      { order_item_id: o.itemIds[1], quantity: 1, reason: "style" },
    ]);
    expect((await lookup(o)).status).toBe("nothing_returnable");
  });

  it("bremst pro Bestellnummer und Adresse (20 pro Stunde); Fremde sperren niemanden aus", async () => {
    const o = await order();
    const answers: string[] = [];
    for (let i = 0; i < 21; i++)
      answers.push(
        (await rpc<Result>("return_lookup", [o.number, "fremd@example.ch", `10.9.1.${i}`, 14]))
          .status,
      );
    expect(answers.slice(0, 15).every((s) => s === "not_found")).toBe(true);
    expect(answers[20]).toBe("rate_limited");
    // Die echte Kundschaft kommt trotzdem durch
    expect((await lookup(o, o.email, "10.9.1.99")).status).toBe("ok");
    // Pro Adresse zählen nur Treffer (Migration 20261030002200): falsche Nummern sperren die Adresse nicht
    const p = await order();
    const byEmail: string[] = [];
    for (let i = 1; i <= 16; i++)
      byEmail.push(
        (await rpc<Result>("return_lookup", [p.number + 50000 + i, p.email, `10.9.2.${i}`, 14]))
          .status,
      );
    expect(byEmail.every((s) => s === "not_found")).toBe(true);
    expect((await lookup(p, p.email, "10.9.2.99")).status).toBe("ok");
  });
});

describe("return_submit", () => {
  it("speichert eine Momentaufnahme der Stücke und zählt die Menge ab", async () => {
    const o = await order();
    const r = await submit(o, [{ order_item_id: o.itemIds[0], quantity: 1, reason: "too_small" }]);
    expect(r).toMatchObject({ status: "ok", duplicate: false });
    const rows = await sql<{
      status: string;
      items: { title: string; reason: string; size: string }[];
    }>("select status, items from public.return_requests where order_id = $1", [o.orderId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("requested");
    expect(rows[0]!.items[0]).toMatchObject({ title: "Anzug", reason: "too_small", size: "50" });
    const after = await lookup(o);
    expect(after.items?.map((i) => i.quantity)).toEqual([1, 1]);
  });

  it("lehnt zu grosse Mengen, doppelte und fremde Positionen, unbekannte Gründe ab", async () => {
    const o = await order();
    const other = await order();
    const bad = [
      [{ order_item_id: o.itemIds[0], quantity: 3, reason: "style" }],
      [{ order_item_id: o.itemIds[1], quantity: 0, reason: "style" }],
      [{ order_item_id: other.itemIds[0], quantity: 1, reason: "style" }],
      [{ order_item_id: o.itemIds[0], quantity: 1, reason: "erfunden" }],
      [
        { order_item_id: o.itemIds[0], quantity: 1, reason: "style" },
        { order_item_id: o.itemIds[0], quantity: 1, reason: "style" },
      ],
      [],
    ];
    for (const items of bad) {
      await sql("delete from private.rate_limits");
      expect(await submit(o, items), JSON.stringify(items)).toEqual({ status: "invalid_items" });
    }
    expect(
      await sql("select 1 from public.return_requests where order_id = $1", [o.orderId]),
    ).toHaveLength(0);
  });

  it("zählt Anmeldungen zusammen, abgelehnte geben die Menge frei", async () => {
    const o = await order();
    const one = [{ order_item_id: o.itemIds[0], quantity: 2, reason: "style" }];
    expect((await submit(o, one)).status).toBe("ok");
    expect((await submit(o, one)).status).toBe("invalid_items");
    await sql("update public.return_requests set status = 'rejected' where order_id = $1", [
      o.orderId,
    ]);
    expect((await submit(o, one)).status).toBe("ok");
    // erstattete und eingegangene Anmeldungen zählen weiter
    await sql(
      "update public.return_requests set status = 'refunded' where order_id = $1 and status = 'requested'",
      [o.orderId],
    );
    expect((await submit(o, one)).status).toBe("invalid_items");
  });

  it("zwei gleichzeitige Anmeldungen derselben Menge: nur eine gelingt", async () => {
    const o = await order();
    const item = [{ order_item_id: o.itemIds[1], quantity: 1, reason: "other" }];
    const results = await Promise.all([
      submit(o, item, { ip: "10.9.3.1" }),
      submit(o, item, { ip: "10.9.3.2" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["invalid_items", "ok"]);
  });

  it("gleiche Anfrage-Kennung: dieselbe Zeile, ein zweites Mal 'duplicate'", async () => {
    const o = await order();
    const requestId = crypto.randomUUID();
    const item = [{ order_item_id: o.itemIds[1], quantity: 1, reason: "other" }];
    const a = await submit(o, item, { requestId });
    const b = await submit(o, item, { requestId });
    expect(a).toMatchObject({ status: "ok", duplicate: false });
    expect(b).toMatchObject({ status: "ok", duplicate: true, id: a.id, number: a.number });
    // fremde Bestellung mit derselben Kennung bekommt nichts von der anderen Anmeldung zu sehen
    const o2 = await order();
    const c = await submit(o2, [{ order_item_id: o2.itemIds[1], quantity: 1, reason: "other" }], {
      requestId,
    });
    expect(c).toEqual({ status: "invalid_items" });
  });

  it("Adresse und Frist werden wie beim lookup geprüft", async () => {
    const o = await order();
    const item = [{ order_item_id: o.itemIds[1], quantity: 1, reason: "other" }];
    expect(await submit(o, item, { email: "falsch@example.ch" })).toEqual({ status: "not_found" });
    const old = await order({ paidDaysAgo: 40 });
    expect(
      await submit(old, [{ order_item_id: old.itemIds[1], quantity: 1, reason: "other" }]),
    ).toEqual({ status: "expired", return_days: 14 });
  });

  it("Rückgabewerte: Nummer fortlaufend, Kommentar getrimmt auf 1000 Zeichen", async () => {
    const o = await order();
    const long = " " + "k".repeat(1200);
    const r = await rpc<Result & { comment: string }>("return_submit", [
      o.number,
      o.email,
      JSON.stringify([{ order_item_id: o.itemIds[1], quantity: 1, reason: "other" }]),
      long,
      "en",
      "10.9.4.1",
      14,
      null,
    ]);
    expect(r.comment).toHaveLength(1000);
    expect(r.number).toBeGreaterThanOrEqual(1001);
    const row = await sql<{ locale: string }>(
      "select locale from public.return_requests where id = $1",
      [r.id],
    );
    expect(row[0]!.locale).toBe("en");
  });
});

describe("return_requests: Rechte", () => {
  async function seeded() {
    const o = await order();
    const r = await submit(o, [{ order_item_id: o.itemIds[1], quantity: 1, reason: "style" }]);
    return { o, id: r.id! };
  }

  it("Admins lesen und ändern Status und Notiz; Kundschaft und Gäste sehen nichts", async () => {
    const { id } = await seeded();
    const admin = await createUser(undefined, { admin: true });
    const customer = await createUser();
    const read = "select status from public.return_requests where id = $1";
    expect(await q("authenticated", admin.claims, read, [id])).toEqual([{ status: "requested" }]);
    expect(await q("authenticated", customer.claims, read, [id])).toEqual([]);
    expect((await expectPgError(q("anon", null, read, [id]))).message).toMatch(/permission denied/);

    const upd =
      "update public.return_requests set status = 'received', admin_note = 'ok' where id = $1";
    await q("authenticated", customer.claims, upd, [id]);
    expect(await sql(read, [id])).toEqual([{ status: "requested" }]);
    await q("authenticated", admin.claims, upd, [id]);
    expect(await sql(read, [id])).toEqual([{ status: "received" }]);
  });

  it("ungültiger Status und andere Spalten werden abgelehnt", async () => {
    const { id } = await seeded();
    const admin = await createUser(undefined, { admin: true });
    const badStatus = await expectPgError(
      q(
        "authenticated",
        admin.claims,
        "update public.return_requests set status = 'weg' where id = $1",
        [id],
      ),
    );
    expect(badStatus.code).toBe("23514");
    const items = await expectPgError(
      q(
        "authenticated",
        admin.claims,
        "update public.return_requests set items = '[]' where id = $1",
        [id],
      ),
    );
    expect(items.message).toMatch(/permission denied/);
    for (const stmt of [
      "insert into public.return_requests (order_id, email, items) select order_id, email, items from public.return_requests",
      "delete from public.return_requests",
    ]) {
      const err = await expectPgError(q("authenticated", admin.claims, stmt));
      expect(err.message).toMatch(/permission denied/);
    }
  });

  it("die RPCs gehören nur service_role", async () => {
    const o = await order();
    const user = await createUser();
    for (const role of ["anon", "authenticated"] as const) {
      const lookupErr = await expectPgError(
        q(
          role,
          role === "anon" ? null : user.claims,
          "select public.return_lookup($1, $2, 'ip', 14)",
          [o.number, o.email],
        ),
      );
      expect(lookupErr.message).toMatch(/permission denied/);
      const submitErr = await expectPgError(
        q(
          role,
          role === "anon" ? null : user.claims,
          "select public.return_submit($1, $2, '[]'::jsonb, null, 'de', 'ip', 14, null)",
          [o.number, o.email],
        ),
      );
      expect(submitErr.message).toMatch(/permission denied/);
    }
  });

  it("wird die Bestellung gelöscht, verschwindet die Anmeldung mit", async () => {
    const { o } = await seeded();
    await sql("delete from public.orders where id = $1", [o.orderId]);
    expect(
      await sql("select 1 from public.return_requests where order_id = $1", [o.orderId]),
    ).toHaveLength(0);
  });
});
