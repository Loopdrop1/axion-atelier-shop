import { describe, expect, it } from "vitest";
import { RECENT_MAX, useRecentlyViewed } from "./stores";

describe("useRecentlyViewed", () => {
  it("setzt das zuletzt angesehene Stück nach vorne, ohne Doppelte, höchstens RECENT_MAX", () => {
    const { add } = useRecentlyViewed.getState();
    for (let i = 0; i < RECENT_MAX + 3; i++) add(`p${i}`);
    add("p5");
    const { handles } = useRecentlyViewed.getState();
    expect(handles[0]).toBe("p5");
    expect(handles.filter((h) => h === "p5")).toHaveLength(1);
    expect(handles).toHaveLength(RECENT_MAX);
  });
});
