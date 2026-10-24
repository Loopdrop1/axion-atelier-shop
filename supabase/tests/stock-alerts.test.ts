import { afterAll, describe, expect, it } from "vitest";
import { expectPgError, pool, q, sql, uniq } from "./helpers";
import { makeProduct, rpc } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

interface RequestResult {
  status: string;
  token?: string;
  email?: string;
}

const request = (
  variant: string,
  email: string,
  ip = `10.3.0.${Math.floor(Math.random() * 250)}`,
) => rpc<RequestResult>("stock_alert_request", [variant, email, "de", ip]);

async function confirmed(variant: string, email = `${uniq("w")}@example.ch`) {
  const r = await request(variant, email);
  await rpc("stock_alert_confirm", [r.token]);
  return email.toLowerCase();
}

describe("stock_alert_request", () => {
  it("legt nur für ausverkaufte, aktive Grössen einen offenen Wunsch an", async () => {
    const out = await makeProduct({ priceCents: 10000, stocks: [0] });
    const inStock = await makeProduct({ priceCents: 10000, stocks: [2] });
    const draft = await makeProduct({ priceCents: 10000, stocks: [0], status: "draft" });
    expect(await request(inStock.variants[0]!.id, "a@example.ch")).toEqual({ status: "in_stock" });
    expect(await request(draft.variants[0]!.id, "a@example.ch")).toEqual({ status: "invalid" });
    expect(await request("00000000-0000-4000-8000-000000000000", "a@example.ch")).toEqual({
      status: "invalid",
    });
    const ok = await request(out.variants[0]!.id, "  Wunsch@Example.CH ");
    expect(ok).toMatchObject({ status: "pending", email: "wunsch@example.ch" });
    expect(ok.token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("pro Grösse und Adresse nur ein offener Wunsch; ein neuer Antrag ersetzt das Token", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [0] });
    const v = p.variants[0]!.id;
    const email = `${uniq("doppelt")}@example.ch`;
    const first = await request(v, email);
    const second = await request(v, email);
    expect(second.token).not.toBe(first.token);
    expect(await sql("select 1 from public.stock_alerts where variant_id = $1", [v])).toHaveLength(
      1,
    );
    // Das alte Token ist entwertet
    expect(await rpc("stock_alert_confirm", [first.token])).toEqual({ status: "invalid" });
    expect(await rpc("stock_alert_confirm", [second.token])).toEqual({ status: "confirmed" });
    expect(await request(v, email)).toEqual({ status: "confirmed" });
  });

  it("begrenzt pro Adresse (5 pro Stunde)", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [0] });
    const email = `${uniq("limit")}@example.ch`;
    for (let i = 0; i < 5; i++)
      expect((await request(p.variants[0]!.id, email)).status).toBe("pending");
    expect((await request(p.variants[0]!.id, email)).status).toBe("rate_limited");
  });
});

describe("stock_alert_confirm", () => {
  it("unbekanntes oder leeres Token: invalid; Anon darf die RPCs nicht aufrufen", async () => {
    expect(await rpc("stock_alert_confirm", ["0".repeat(48)])).toEqual({ status: "invalid" });
    expect(await rpc("stock_alert_confirm", [null])).toEqual({ status: "invalid" });
    const err = await expectPgError(
      q("anon", null, "select public.stock_alert_confirm($1)", ["x"]),
    );
    expect(err.code).toBe("42501");
  });
});

describe("stock_alerts_pending und stock_alerts_done", () => {
  it("liefert bestätigte Wünsche erst, wenn die Grösse vorrätig ist", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [0] });
    const v = p.variants[0]!.id;
    const email = await confirmed(v);
    await request(v, `${uniq("offen")}@example.ch`); // nur «pending»
    expect(await rpc("stock_alerts_pending", [v])).toEqual([]);
    await sql("update public.product_variants set stock = 3 where id = $1", [v]);
    const pending = await rpc<{ id: string; email: string; handle: string }[]>(
      "stock_alerts_pending",
      [v],
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ email, handle: p.handle });
  });

  it("hakt nur die übergebenen Wünsche ab, entfernt die Adresse und lässt andere stehen", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [0] });
    const v = p.variants[0]!.id;
    await confirmed(v);
    await confirmed(v);
    await sql("update public.product_variants set stock = 2 where id = $1", [v]);
    const pending = await rpc<{ id: string }[]>("stock_alerts_pending", [v]);
    expect(pending).toHaveLength(2);
    expect(await rpc("stock_alerts_done", [[pending[0]!.id]])).toBe(1);
    // zweimal abhaken zählt nicht doppelt
    expect(await rpc("stock_alerts_done", [[pending[0]!.id]])).toBe(0);
    const rows = await sql<{ status: string; email: string; token_hash: string | null }>(
      "select status, email, token_hash from public.stock_alerts where variant_id = $1 order by status",
      [v],
    );
    expect(rows.map((r) => r.status)).toEqual(["confirmed", "notified"]);
    const done = rows.find((r) => r.status === "notified")!;
    expect(done).toMatchObject({ email: "entfernt@invalid", token_hash: null });
    expect(await rpc("stock_alerts_pending", [v])).toHaveLength(1);
  });
});

describe("translate_guard", () => {
  it("500 Anfragen pro Admin und Tag erlaubt, die 501. abgelehnt, getrennt pro Admin", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    await sql(
      "delete from private.rate_limits where key in (private.hash_token($1), private.hash_token($2))",
      [`translate:${a}`, `translate:${b}`],
    );
    // 499 Treffer direkt in die Zählertabelle, dann die letzten über die Funktion
    await sql(
      "insert into private.rate_limits (key, window_start, hits) values (private.hash_token($1), now(), 499)",
      [`translate:${a}`],
    );
    expect(await rpc<boolean>("translate_guard", [a])).toBe(true); // 500.
    expect(await rpc<boolean>("translate_guard", [a])).toBe(false); // 501.
    expect(await rpc<boolean>("translate_guard", [b])).toBe(true);
  });

  it("nach einem Tag beginnt das Fenster neu", async () => {
    const a = crypto.randomUUID();
    await sql(
      "insert into private.rate_limits (key, window_start, hits) values (private.hash_token($1), now() - interval '2 days', 900)",
      [`translate:${a}`],
    );
    expect(await rpc<boolean>("translate_guard", [a])).toBe(true);
  });
});
