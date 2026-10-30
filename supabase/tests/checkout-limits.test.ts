// Mengenlimits (3 je Grösse, 20 je Bestellung) und Zähler der Kasse gegen Bestandsblockade (Migration 20261029002000).
import { afterAll, describe, expect, it } from "vitest";
import { expectPgError, pool, sql, uniq } from "./helpers";
import { makeProduct, reserve, rpc, stockOf } from "./fixtures";

afterAll(async () => {
  await pool.end();
});

const guard = (email: string, ip: string | null) =>
  rpc<string>("checkout_guard", [email, ip], "service_role");

async function reason(promise: Promise<unknown>): Promise<unknown> {
  const err = await expectPgError(promise);
  expect(err.message).toBe("INVALID_LINES");
  return JSON.parse((err as { detail?: string }).detail ?? "{}").reason;
}

describe("reserve_checkout: Höchstmengen", () => {
  it("3 Stück je Grösse gehen, 4 nicht (auch auf mehrere Zeilen verteilt)", async () => {
    const p = await makeProduct({ priceCents: 10000, stocks: [50] });
    const id = p.variants[0]!.id;
    const ok = await reserve({ lines: [{ variant_id: id, quantity: 3 }] });
    expect(ok.lines[0]?.quantity).toBe(3);
    expect(await stockOf(id)).toBe(47);
    expect(await reason(reserve({ lines: [{ variant_id: id, quantity: 4 }] }))).toBe("quantity");
    expect(
      await reason(
        reserve({
          lines: [
            { variant_id: id, quantity: 2 },
            { variant_id: id, quantity: 2 },
          ],
        }),
      ),
    ).toBe("quantity");
    expect(await stockOf(id)).toBe(47);
  });

  it("höchstens 20 Stück je Bestellung, höchstens 20 Positionen", async () => {
    const p = await makeProduct({ priceCents: 1000, stocks: Array(8).fill(10) });
    const ids = p.variants.map((v) => v.id);
    const lines = (n: number, q: number) =>
      ids.slice(0, n).map((variant_id) => ({ variant_id, quantity: q }));
    // 7 x 3 = 21 Stück
    expect(await reason(reserve({ lines: lines(7, 3) }))).toBe("order_quantity");
    // 6 x 3 + 2 = 20 Stück
    const ok = await reserve({
      lines: [...lines(6, 3), { variant_id: ids[6]!, quantity: 2 }],
    });
    expect(ok.lines.reduce((s, l) => s + l.quantity, 0)).toBe(20);
    const many = Array.from({ length: 21 }, () => ({
      variant_id: "00000000-0000-4000-8000-000000000000",
      quantity: 1,
    }));
    expect(await reason(reserve({ lines: many }))).toBe("too_many");
  });
});

describe("checkout_guard: IP-Zähler", () => {
  it("ohne IP gilt der gemeinsame Zähler «checkout-noip» (30 in 30 Minuten)", async () => {
    await sql("delete from private.rate_limits where key = private.hash_token($1)", [
      "checkout-noip",
    ]);
    for (let i = 0; i < 30; i++) expect(await guard(`${uniq("a")}@example.ch`, "")).toBe("ok");
    expect(await guard(`${uniq("a")}@example.ch`, null)).toBe("rate_limited");
    expect(await guard(`${uniq("a")}@example.ch`, "  ")).toBe("rate_limited");
    await sql("delete from private.rate_limits where key = private.hash_token($1)", [
      "checkout-noip",
    ]);
  });

  it("mit IP: höchstens 8 Kassen in 35 Minuten, andere IPs und der noip-Zähler bleiben unberührt", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 8; i++) expect(await guard(`${uniq("b")}@example.ch`, ip)).toBe("ok");
    expect(await guard(`${uniq("b")}@example.ch`, ip)).toBe("too_many_open");
    expect(await guard(`${uniq("b")}@example.ch`, "198.51.100.251")).toBe("ok");
  });

  it("offene Kassen pro E-Mail sperren nicht mehr (Migration 20261030002200)", async () => {
    const email = `${uniq("c")}@example.ch`;
    const p = await makeProduct({ priceCents: 1000, stocks: [10] });
    for (let i = 0; i < 3; i++)
      await reserve({ lines: [{ variant_id: p.variants[0]!.id, quantity: 1 }], email });
    expect(await guard(email, `192.0.2.${Math.floor(Math.random() * 250)}`)).toBe("ok");
  });
});
