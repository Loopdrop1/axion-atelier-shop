import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

const now = () => new Date("2026-10-27T12:00:00Z");

describe("checkHealth", () => {
  it("ok, wenn die Prüfung gelingt", async () => {
    expect(await checkHealth(async () => [], { now })).toEqual({
      ok: true,
      catalogue: "ok",
      time: "2026-10-27T12:00:00.000Z",
    });
  });

  it("error, wenn die Prüfung scheitert, ohne Fehlerdetails", async () => {
    const result = await checkHealth(() => Promise.reject(new Error("secret db password")), {
      now,
    });
    expect(result).toEqual({ ok: false, catalogue: "error", time: "2026-10-27T12:00:00.000Z" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("error bei Zeitüberschreitung", async () => {
    const result = await checkHealth(() => new Promise(() => undefined), { timeoutMs: 20, now });
    expect(result.catalogue).toBe("error");
    expect(result.ok).toBe(false);
  });
});
