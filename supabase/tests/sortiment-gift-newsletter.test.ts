// Migration 20261104002500 (Cloud 0024): Gutscheine 30 Jahre als Standard, Gültigkeit des Newsletter-Willkommenscodes
// einstellbar (shop_settings.newsletter_welcome_days), newsletter_confirm mit welcome_days.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, uniq } from "./helpers";
import { rpc } from "./fixtures";

const MIGRATION = readFileSync(
  path.resolve(__dirname, "../migrations/20261104002500_sortiment_gift_newsletter.sql"),
  "utf8",
);

afterAll(async () => {
  await pool.end();
});

describe("Gutscheine: 30 Jahre als Standard", () => {
  it("Standardwert 30; die Migration ändert nur den alten Standard 5, nie einen eigenen Wert", async () => {
    const def = await sql<{ d: string }>(
      `select column_default as d from information_schema.columns
       where table_schema = 'public' and table_name = 'shop_settings' and column_name = 'gift_card_valid_years'`,
    );
    expect(def[0]!.d).toBe("30");
    const years = async () =>
      (await sql<{ y: number }>("select gift_card_valid_years as y from public.shop_settings"))[0]!
        .y;
    expect(await years()).toBe(30);
    try {
      await sql("update public.shop_settings set gift_card_valid_years = 5");
      await sql(MIGRATION);
      expect(await years()).toBe(30);
      await sql("update public.shop_settings set gift_card_valid_years = 7");
      await sql(MIGRATION);
      expect(await years()).toBe(7);
    } finally {
      await sql("update public.shop_settings set gift_card_valid_years = 30");
    }
  });
});

describe("Newsletter: Gültigkeit des Willkommenscodes", () => {
  type Res = {
    status: string;
    newly_confirmed?: boolean;
    welcome_code?: string | null;
    welcome_percent?: number | null;
    welcome_days?: number | null;
  };
  const subscribe = async () =>
    rpc<{ token: string }>("newsletter_subscribe", [
      `${uniq("tage")}@example.ch`,
      "de",
      "Ja",
      "footer",
      `10.24.0.${Math.floor(Math.random() * 250)}`,
    ]);
  const validity = async (code: string) =>
    (
      await sql<{ days: number }>(
        `select extract(epoch from (ends_at - created_at)) / 86400 as days
         from public.discount_codes where code = $1`,
        [code],
      )
    )[0]!.days;
  const reset = () =>
    sql(
      "update public.shop_settings set newsletter_welcome_percent = null, newsletter_welcome_days = 90",
    );

  it("Standard 90 Tage, erlaubt 1 bis 365; lesen dürfen alle, ändern nur das Admin", async () => {
    expect(
      (
        await sql<{ d: number }>("select newsletter_welcome_days as d from public.shop_settings")
      )[0]!.d,
    ).toBe(90);
    for (const bad of [0, 366]) {
      const err = await expectPgError(
        sql("update public.shop_settings set newsletter_welcome_days = $1", [bad]),
      );
      expect(err.code).toBe("23514");
    }
    const read = await q<{ d: number }>(
      "anon",
      null,
      "select newsletter_welcome_days as d from public.shop_settings where id = 1",
    );
    expect(read[0]!.d).toBe(90);
    // Kundschaft: Spaltenrecht vorhanden, RLS lässt aber keine Zeile ändern
    const customer = await createUser();
    await q(
      "authenticated",
      customer.claims,
      "update public.shop_settings set newsletter_welcome_days = 5 where id = 1",
    );
    expect(
      (
        await sql<{ d: number }>("select newsletter_welcome_days as d from public.shop_settings")
      )[0]!.d,
    ).toBe(90);
    const admin = await createUser(undefined, { admin: true });
    try {
      await q(
        "authenticated",
        admin.claims,
        "update public.shop_settings set newsletter_welcome_days = 14 where id = 1",
      );
      const settings = await rpc<{ newsletter_welcome_days: number }>(
        "admin_get_settings",
        [],
        "authenticated",
        admin.claims,
      );
      expect(settings.newsletter_welcome_days).toBe(14);
    } finally {
      await reset();
    }
  });

  it("der Code endet nach der eingestellten Zahl Tage; ein wiederholter Klick nennt die Werte des Codes", async () => {
    await sql(
      "update public.shop_settings set newsletter_welcome_percent = 10, newsletter_welcome_days = 14",
    );
    try {
      const sub = await subscribe();
      const first = await rpc<Res>("newsletter_confirm", [sub.token]);
      expect(first).toMatchObject({ newly_confirmed: true, welcome_percent: 10, welcome_days: 14 });
      expect(await validity(first.welcome_code!)).toBeCloseTo(14, 5);
      // Einstellung später geändert: der ausgestellte Code bleibt bei 10 % und 14 Tagen
      await sql(
        "update public.shop_settings set newsletter_welcome_percent = 20, newsletter_welcome_days = 30",
      );
      const again = await rpc<Res>("newsletter_confirm", [sub.token]);
      expect(again).toMatchObject({
        newly_confirmed: false,
        welcome_code: first.welcome_code,
        welcome_percent: 10,
        welcome_days: 14,
      });
      // Neue Anmeldung: neue Einstellung
      const next = await rpc<Res>("newsletter_confirm", [(await subscribe()).token]);
      expect(next).toMatchObject({ welcome_percent: 20, welcome_days: 30 });
      expect(await validity(next.welcome_code!)).toBeCloseTo(30, 5);
    } finally {
      await reset();
    }
  });

  it("ohne Rabatt: kein Code, keine Gültigkeit", async () => {
    await reset();
    const sub = await subscribe();
    const first = await rpc<Res>("newsletter_confirm", [sub.token]);
    expect(first).toMatchObject({ newly_confirmed: true, welcome_code: null, welcome_days: null });
    const again = await rpc<Res>("newsletter_confirm", [sub.token]);
    expect(again).toMatchObject({ newly_confirmed: false, welcome_code: null, welcome_days: null });
  });

  it("bleibt nur für den Server ausführbar", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      const err = await expectPgError(rpc("newsletter_confirm", ["x"], role));
      expect(err.message).toMatch(/permission denied/);
    }
  });
});
