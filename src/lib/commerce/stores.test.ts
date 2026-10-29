import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PER_LINE,
  MAX_PER_ORDER,
  clampLines,
  consumeClampedOnLoad,
  RECENT_MAX,
  lineMax,
  useCart,
  useRecentlyViewed,
  setWishlistRemote,
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
    expect(add("v2", 5, 2)).toEqual({ added: 2, capped: "stock", max: 2 });
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

describe("Warenkorb: Höchstmengen 3 je Grösse und 20 je Bestellung", () => {
  beforeEach(() => useCart.setState({ lines: [] }));

  it("Konstanten", () => {
    expect(MAX_PER_LINE).toBe(3);
    expect(MAX_PER_ORDER).toBe(20);
  });

  it("add: begrenzt die Gesamtzahl auf 20 und meldet «order»", () => {
    const { add } = useCart.getState();
    for (let i = 0; i < 6; i++) expect(add(`v${i}`, 3, 50).added).toBe(3);
    expect(add("v6", 3, 50)).toEqual({ added: 2, capped: "order", max: 3 });
    expect(add("v7", 1, 50)).toEqual({ added: 0, capped: "order", max: 3 });
    expect(useCart.getState().lines.reduce((s, l) => s + l.quantity, 0)).toBe(20);
  });

  it("quantity: Stepper kann weder 3 je Grösse noch 20 insgesamt überschreiten", () => {
    useCart.setState({
      lines: [
        ...Array.from({ length: 6 }, (_, i) => ({ variantId: `v${i}`, quantity: 3 })),
        { variantId: "last", quantity: 1 },
      ],
    });
    useCart.getState().quantity("last", 3);
    expect(useCart.getState().lines.at(-1)?.quantity).toBe(2);
    useCart.getState().quantity("v0", 9);
    expect(useCart.getState().lines[0]?.quantity).toBe(3);
  });

  it("clampLines: kürzt alte Mengen und lässt Gültiges unverändert", () => {
    const ok = [{ variantId: "a", quantity: 3 }];
    expect(clampLines(ok)).toBe(ok);
    const old = [
      { variantId: "a", quantity: 10 },
      ...Array.from({ length: 6 }, (_, i) => ({ variantId: `b${i}`, quantity: 3 })),
    ];
    const out = clampLines(old);
    expect(out[0]?.quantity).toBe(3);
    expect(out.reduce((s, l) => s + l.quantity, 0)).toBe(20);
    expect(clampLines([{ variantId: "z", quantity: 0 }])).toEqual([]);
  });

  it("Laden aus dem Speicher: ältere Warenkörbe werden gekürzt und melden das einmal", async () => {
    consumeClampedOnLoad();
    localStorage.setItem(
      "axion-cart",
      JSON.stringify({ state: { lines: [{ variantId: "alt", quantity: 10 }] }, version: 0 }),
    );
    await useCart.persist.rehydrate();
    expect(useCart.getState().lines).toEqual([{ variantId: "alt", quantity: 3 }]);
    expect(consumeClampedOnLoad()).toBe(true);
    expect(consumeClampedOnLoad()).toBe(false);
    localStorage.removeItem("axion-cart");
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

describe("useWishlist.toggle mit Konto", () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  beforeEach(() => useWishlist.setState({ handles: [], owner: "u" }));

  it("schreibt pro Handle nacheinander und nur die neueste Absicht", async () => {
    const first = deferred();
    const calls: string[] = [];
    setWishlistRemote({
      add: (h) => {
        calls.push(`add ${h}`);
        return first.promise;
      },
      remove: async (h) => void calls.push(`remove ${h}`),
      onError: () => undefined,
    });
    const t = useWishlist.getState().toggle;
    t("a"); // add (läuft)
    await Promise.resolve();
    t("a"); // remove
    t("a"); // add
    expect(calls).toEqual(["add a"]);
    first.resolve();
    await vi.waitFor(() => expect(calls).toEqual(["add a"]));
    await new Promise((r) => setTimeout(r, 0));
    // remove wurde überholt, das zweite add ist schon bestätigt: nichts Weiteres
    expect(calls).toEqual(["add a"]);
    expect(useWishlist.getState().handles).toEqual(["a"]);
    setWishlistRemote(null);
  });

  it("nimmt nur zurück, wenn die fehlgeschlagene Anfrage die neueste war, auf den bestätigten Stand", async () => {
    const errors: string[] = [];
    const add = deferred();
    setWishlistRemote({
      add: () => add.promise,
      remove: async () => undefined,
      onError: (k) => errors.push(k),
    });
    const t = useWishlist.getState().toggle;
    t("a"); // add schlägt später fehl
    await Promise.resolve();
    t("a"); // remove ist neuer
    await Promise.resolve();
    add.reject(new Error("x"));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toEqual([]); // alte Anfrage fehlgeschlagen, aber nicht die neueste
    expect(useWishlist.getState().handles).toEqual([]);

    const fail = deferred();
    setWishlistRemote({
      add: () => fail.promise,
      remove: async () => undefined,
      onError: (k) => errors.push(k),
    });
    useWishlist.getState().toggle("b");
    await Promise.resolve();
    await Promise.resolve();
    fail.reject(new Error("x"));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toEqual(["add"]);
    expect(useWishlist.getState().handles).toEqual([]);
    setWishlistRemote(null);
  });
});

describe("Warenkorb: Persistenz", () => {
  it("speichert nur die Positionen, nie Gutschein, Rabattcode oder E-Mail", () => {
    const partialize = useCart.persist.getOptions().partialize!;
    const saved = partialize({
      ...useCart.getState(),
      lines: [{ variantId: "v1", quantity: 2 }],
      discountCode: "SOMMER",
      giftCardCode: "AXN-AAAA-BBBB-CCCC",
      email: "a@b.ch",
    });
    expect(saved).toEqual({ lines: [{ variantId: "v1", quantity: 2 }] });
  });
});
