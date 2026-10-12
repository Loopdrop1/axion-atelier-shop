import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "./helpers";

describe("lokale Werkbank", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("führt Abfragen als anon aus", async () => {
    const rows = await q<{ one: number }>("anon", null, "select 1 as one");
    expect(rows[0]?.one).toBe(1);
  });

  it("liefert auth.uid() aus den JWT-Claims", async () => {
    const sub = "11111111-2222-3333-4444-555555555555";
    const rows = await q<{ uid: string; role: string }>(
      "authenticated",
      { sub },
      "select auth.uid() as uid, current_user as role",
    );
    expect(rows[0]).toEqual({ uid: sub, role: "authenticated" });
  });
});
