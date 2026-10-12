import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { renderSampleCatalog } from "../../scripts/db/gen-sample-catalog";
import { pool } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("Beispielkatalog", () => {
  it("entspricht genau den Startdaten der Datenbank (seed.sql)", async () => {
    const client = await pool.connect();
    try {
      // Andere Testdateien legen Testprodukte an; verglichen wird nur, was der Seed anlegt.
      await client.query("begin");
      await client.query("delete from public.products where handle like 'test-%'");
      const expected = await renderSampleCatalog(client);
      await client.query("rollback");
      const file = readFileSync(
        path.resolve(import.meta.dirname, "../../src/lib/commerce/sample-catalog.ts"),
        "utf8",
      );
      expect(file).toBe(expected);
    } finally {
      client.release();
    }
  });
});
