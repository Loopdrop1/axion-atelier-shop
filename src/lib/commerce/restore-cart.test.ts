import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "./types";

const rpc = vi.fn();
vi.mock("@/lib/backend", () => ({ backendConfigured: true, supabaseUrl: "https://x.test" }));
vi.mock("@/lib/supabase-client", () => ({ getSupabase: async () => ({ rpc }) }));

import { applyRestore, fetchRestoreLines, planRestore } from "./restore-cart";
import { useCart } from "./stores";

const TOKEN = "0c6b2b9a-0000-4000-8000-000000000002";

function cart(
  entries: { id: string; quantity: number; stock: number; available?: boolean }[],
): Cart {
  return {
    lines: entries.map((e) => ({
      variantId: e.id,
      quantity: e.quantity,
      product: {} as never,
      variant: {
        id: e.id,
        title: "50",
        availableForSale: e.available ?? e.stock > 0,
        stock: e.stock,
        price: { amount: 100, currencyCode: "CHF" },
        selectedOptions: [],
      },
    })),
    subtotal: { amount: 0, currencyCode: "CHF" },
    checkoutUrl: null,
  };
}

beforeEach(() => {
  rpc.mockReset();
  useCart.setState({ lines: [] });
});

describe("fetchRestoreLines", () => {
  it("ruft restore_cart_by_token auf und übernimmt nur gültige Zeilen", async () => {
    rpc.mockResolvedValue({
      data: [
        { variant_id: "a", quantity: 2 },
        { variant_id: "b", quantity: 0 },
        { variant_id: 5, quantity: 1 },
        { variant_id: "c", quantity: 1.5 },
      ],
      error: null,
    });
    expect(await fetchRestoreLines(TOKEN)).toEqual([{ variantId: "a", quantity: 2 }]);
    expect(rpc).toHaveBeenCalledWith("restore_cart_by_token", { p_token: TOKEN });
  });

  it("ungültiges Token: gar keine Anfrage", async () => {
    expect(await fetchRestoreLines("kein-token")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("leere Antwort oder Nicht-Liste: keine Positionen; Fehler werden geworfen", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await fetchRestoreLines(TOKEN)).toEqual([]);
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchRestoreLines(TOKEN)).toEqual([]);
    rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(fetchRestoreLines(TOKEN)).rejects.toThrow("boom");
  });
});

describe("planRestore", () => {
  it("kürzt auf den Bestand und die Höchstmenge, lässt Nichtverfügbares aus", () => {
    const wanted = [
      { variantId: "ok", quantity: 2 },
      { variantId: "knapp", quantity: 3 },
      { variantId: "weg", quantity: 1 },
      { variantId: "aus", quantity: 1 },
      { variantId: "viele", quantity: 10 },
      { variantId: "unbekannt", quantity: 1 },
    ];
    const plan = planRestore(
      wanted,
      cart([
        { id: "ok", quantity: 2, stock: 5 },
        { id: "knapp", quantity: 3, stock: 1 },
        { id: "weg", quantity: 1, stock: 0 },
        { id: "aus", quantity: 1, stock: 4, available: false },
        { id: "viele", quantity: 10, stock: 40 },
      ]),
    );
    expect(plan.adds).toEqual([
      { variantId: "ok", quantity: 2, stock: 5 },
      { variantId: "knapp", quantity: 1, stock: 1 },
      { variantId: "viele", quantity: 3, stock: 40 },
    ]);
    expect(plan.unavailable).toBe(3);
    expect(plan.reduced).toBe(true);
  });
});

describe("applyRestore", () => {
  const add = (id: string, quantity: number, stock: number) =>
    useCart.getState().add(id, quantity, stock);
  const have = (id: string) =>
    useCart.getState().lines.find((l) => l.variantId === id)?.quantity ?? 0;

  it("alles verfügbar: in den Warenkorb, Ergebnis done", () => {
    const wanted = [
      { variantId: "a", quantity: 2 },
      { variantId: "b", quantity: 1 },
    ];
    const plan = planRestore(
      wanted,
      cart([
        { id: "a", quantity: 2, stock: 5 },
        { id: "b", quantity: 1, stock: 5 },
      ]),
    );
    expect(applyRestore(wanted, plan, add)).toBe("done");
    expect(useCart.getState().lines).toEqual([
      { variantId: "a", quantity: 2 },
      { variantId: "b", quantity: 1 },
    ]);
  });

  it("teilweise verfügbar: partial, Bestand begrenzt auch zusammen mit dem vorhandenen Warenkorb", () => {
    useCart.setState({ lines: [{ variantId: "a", quantity: 2 }] });
    const wanted = [
      { variantId: "a", quantity: 2 },
      { variantId: "b", quantity: 1 },
    ];
    const plan = planRestore(
      wanted,
      cart([
        { id: "a", quantity: 2, stock: 3 },
        { id: "b", quantity: 1, stock: 0 },
      ]),
    );
    expect(applyRestore(wanted, plan, add, have)).toBe("partial");
    // 2 vorhanden, 2 gewünscht: nichts dazu (der Link ergänzt nur bis zur Menge der Bestellung)
    expect(useCart.getState().lines).toEqual([{ variantId: "a", quantity: 2 }]);
  });

  it("zweiter Klick auf den Link verdoppelt nichts", () => {
    const wanted = [{ variantId: "a", quantity: 2 }];
    const plan = planRestore(wanted, cart([{ id: "a", quantity: 2, stock: 5 }]));
    expect(applyRestore(wanted, plan, add, have)).toBe("done");
    expect(applyRestore(wanted, plan, add, have)).toBe("done");
    expect(useCart.getState().lines).toEqual([{ variantId: "a", quantity: 2 }]);
  });

  it("ergänzt eine kleinere vorhandene Menge bis zur Bestellung", () => {
    useCart.setState({ lines: [{ variantId: "a", quantity: 1 }] });
    const wanted = [{ variantId: "a", quantity: 3 }];
    const plan = planRestore(wanted, cart([{ id: "a", quantity: 3, stock: 5 }]));
    expect(applyRestore(wanted, plan, add, have)).toBe("done");
    expect(useCart.getState().lines).toEqual([{ variantId: "a", quantity: 3 }]);
  });

  it("nichts mehr da: none und Warenkorb unverändert; keine Positionen: invalid", () => {
    const wanted = [{ variantId: "a", quantity: 1 }];
    const plan = planRestore(wanted, cart([{ id: "a", quantity: 1, stock: 0 }]));
    expect(applyRestore(wanted, plan, add)).toBe("none");
    expect(useCart.getState().lines).toEqual([]);
    expect(applyRestore([], planRestore([], cart([])), add)).toBe("invalid");
  });
});
