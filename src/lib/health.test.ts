import { describe, expect, it, vi } from "vitest";
import { checkHealth, createHealthCache, type HealthResult } from "./health";

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

describe("createHealthCache", () => {
  const result = (ok: boolean): HealthResult => ({
    ok,
    catalogue: ok ? "ok" : "error",
    time: "2026-10-27T12:00:00.000Z",
  });

  it("prüft innerhalb von 10 Sekunden nur einmal, danach wieder", async () => {
    let t = 0;
    const check = vi.fn(async () => result(false));
    const get = createHealthCache(check, 10_000, () => t);
    await get();
    t = 9_999;
    await get();
    expect(check).toHaveBeenCalledTimes(1);
    t = 10_000;
    await get();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("teilt eine laufende Prüfung zwischen gleichzeitigen Abfragen", async () => {
    const check = vi.fn(async () => result(true));
    const get = createHealthCache(check, 10_000, () => 0);
    const [a, b, c] = await Promise.all([get(), get(), get()]);
    expect(check).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
