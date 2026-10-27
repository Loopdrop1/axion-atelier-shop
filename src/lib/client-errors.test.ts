import { describe, expect, it, vi } from "vitest";
import {
  createReporter,
  createThrottle,
  isNoise,
  MAX_REPORTS_PER_PAGE_VIEW,
} from "./client-errors";

function reporter(enabled = true) {
  const send = vi.fn();
  const r = createReporter({
    enabled,
    send,
    location: () => "/produkt/anzug-limmat?q=max@example.ch#x",
    release: () => "build-1",
  });
  return { r, send };
}

describe("createThrottle", () => {
  it("lässt höchstens fünf verschiedene Fehler pro Seitenaufruf durch", () => {
    const t = createThrottle();
    const results = Array.from({ length: 8 }, (_, i) => t.allow(`Fehler ${i}`));
    expect(results.filter(Boolean)).toHaveLength(MAX_REPORTS_PER_PAGE_VIEW);
    expect(MAX_REPORTS_PER_PAGE_VIEW).toBe(5);
  });

  it("meldet denselben Fehler nur einmal", () => {
    const t = createThrottle();
    expect(t.allow("Boom", "at a")).toBe(true);
    expect(t.allow("Boom", "at a")).toBe(false);
    expect(t.allow("Boom", "at b")).toBe(true);
  });
});

describe("createReporter", () => {
  it("sendet Meldung, Stack, Pfad ohne Query-String und Version", () => {
    const { r, send } = reporter();
    const error = new TypeError("x is undefined");
    expect(r.report(error)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({
      message: "TypeError: x is undefined",
      path: "/produkt/anzug-limmat",
      release: "build-1",
    });
  });

  it("kürzt Meldung und Stack", () => {
    const { r, send } = reporter();
    const error = new Error("m".repeat(900));
    error.stack = "s".repeat(5000);
    r.report(error);
    const report = send.mock.calls[0]![0] as { message: string; stack: string };
    expect(report.message).toHaveLength(500);
    expect(report.stack).toHaveLength(2000);
  });

  it("tut nichts, wenn deaktiviert (kein Backend oder Entwicklung)", () => {
    const { r, send } = reporter(false);
    expect(r.report(new Error("Boom"))).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("ignoriert Rauschen und leere Meldungen", () => {
    const { r, send } = reporter();
    expect(r.report("ResizeObserver loop completed with undelivered notifications.")).toBe(false);
    expect(r.report("Script error.")).toBe(false);
    expect(r.report(new Error("x"), { filename: "chrome-extension://abc/content.js" })).toBe(false);
    expect(r.report("  ")).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(isNoise("TypeError: real bug")).toBe(false);
  });

  it("drosselt: höchstens fünf Berichte, Wiederholungen nie", () => {
    const { r, send } = reporter();
    for (let i = 0; i < 20; i++) r.report(new Error(`Fehler ${i % 8}`));
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("ein scheiternder Versand wirft nie", async () => {
    const r = createReporter({
      enabled: true,
      send: () => Promise.reject(new Error("offline")),
      location: () => "/",
      release: () => "",
    });
    expect(() => r.report(new Error("Boom"))).not.toThrow();
    const sync = createReporter({
      enabled: true,
      send: () => {
        throw new Error("sync");
      },
      location: () => "/",
      release: () => "",
    });
    expect(() => sync.report(new Error("Boom2"))).not.toThrow();
    await Promise.resolve();
  });
});
