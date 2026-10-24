import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PER_LINE,
  RECENT_MAX,
  lineMax,
  useCart,
  useRecentlyViewed,
  useWishlist,
} from "./stores";

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

describe("Warenkorb: Menge begrenzen", () => {
  beforeEach(() => useCart.setState({ lines: [] }));

  it("lineMax: kleiner von Bestand und Höchstmenge", () => {
    expect(lineMax(1)).toBe(1);
    expect(lineMax(0)).toBe(0);
    expect(lineMax(99)).toBe(MAX_PER_LINE);
    expect(lineMax(undefined)).toBe(MAX_PER_LINE);
  });

  it("add: höchstens bis zum Bestand und meldet, dass gekürzt wurde", () => {
    const { add } = useCart.getState();
    expect(add("v1", 1, 1)).toEqual({ added: 1, capped: null, max: 1 });
    expect(add("v1", 1, 1)).toEqual({ added: 0, capped: "stock", max: 1 });
    expect(useCart.getState().lines).toEqual([{ variantId: "v1", quantity: 1 }]);
    expect(add("v2", 5, 3)).toEqual({ added: 3, capped: "stock", max: 3 });
  });

  it("add: ohne Bestand gilt die Höchstmenge pro Grösse", () => {
    const { add } = useCart.getState();
    expect(add("v1", 12, 50)).toEqual({ added: MAX_PER_LINE, capped: "max", max: MAX_PER_LINE });
    expect(useCart.getState().lines[0]?.quantity).toBe(MAX_PER_LINE);
  });

  it("add: kürzt nie unter die Menge, die schon im Warenkorb liegt", () => {
    useCart.setState({ lines: [{ variantId: "v1", quantity: 4 }] });
    const result = useCart.getState().add("v1", 1, 2);
    expect(result.added).toBe(0);
    expect(useCart.getState().lines[0]?.quantity).toBe(4);
  });
});

describe("Merkliste: prune", () => {
  beforeEach(() => useWishlist.setState({ handles: [] }));

  it("behält nur Handles, die es noch gibt", () => {
    useWishlist.setState({ handles: ["a", "b", "c"] });
    useWishlist.getState().prune(["a", "c"]);
    expect(useWishlist.getState().handles).toEqual(["a", "c"]);
  });

  it("ändert nichts, wenn alle noch existieren", () => {
    useWishlist.setState({ handles: ["a"] });
    const before = useWishlist.getState().handles;
    useWishlist.getState().prune(["a", "b"]);
    expect(useWishlist.getState().handles).toBe(before);
  });
});
