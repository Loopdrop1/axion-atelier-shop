import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  server: [] as string[],
  fetchWishlist: vi.fn(),
  addWishlistItems: vi.fn(),
  removeWishlistItem: vi.fn(),
}));
vi.mock("@/lib/account/wishlist", async (orig) => ({
  ...(await orig<typeof import("@/lib/account/wishlist")>()),
  fetchWishlist: api.fetchWishlist,
  addWishlistItems: api.addWishlistItems,
  removeWishlistItem: api.removeWishlistItem,
}));

import { syncWishlist } from "./wishlist-sync";
import { useWishlist } from "@/lib/commerce/stores";

beforeEach(() => {
  api.server = [];
  api.fetchWishlist.mockReset().mockImplementation(async () => [...api.server]);
  api.addWishlistItems.mockReset().mockImplementation(async (_u: string, hs: string[]) => {
    api.server.push(...hs);
  });
  api.removeWishlistItem.mockReset().mockImplementation(async (_u: string, h: string) => {
    api.server = api.server.filter((x) => x !== h);
  });
  useWishlist.setState({ handles: [], owner: null });
});

describe("syncWishlist", () => {
  it("vereinigt eine Gästeliste (Besitzer null) beim ersten Anmelden und lädt Fehlendes hoch", async () => {
    api.server = ["a"];
    useWishlist.setState({ handles: ["b"], owner: null });
    await syncWishlist("u1");
    expect(api.addWishlistItems).toHaveBeenCalledWith("u1", ["b"]);
    expect(useWishlist.getState()).toMatchObject({ handles: ["a", "b"], owner: "u1" });
  });

  it("übernimmt bei gleichem Besitzer den Server und lädt nichts hoch (auf Gerät 2 entfernt bleibt entfernt)", async () => {
    api.server = ["a"];
    useWishlist.setState({ handles: ["a", "stale"], owner: "u1" });
    await syncWishlist("u1");
    expect(api.addWishlistItems).not.toHaveBeenCalled();
    expect(useWishlist.getState()).toMatchObject({ handles: ["a"], owner: "u1" });
  });

  it("verwirft bei anderem Besitzer die lokale Liste, ohne sie hochzuladen", async () => {
    api.server = ["x"];
    useWishlist.setState({ handles: ["secret"], owner: "u1" });
    await syncWishlist("u2");
    expect(api.addWishlistItems).not.toHaveBeenCalled();
    expect(api.server).toEqual(["x"]);
    expect(useWishlist.getState()).toMatchObject({ handles: ["x"], owner: "u2" });
  });

  it("wendet Entfernen und Hinzufügen während des Abgleichs danach an", async () => {
    api.server = ["a", "b"];
    useWishlist.setState({ handles: ["a", "b"], owner: "u1" });
    api.fetchWishlist.mockImplementation(async () => {
      const snapshot = [...api.server];
      useWishlist.getState().toggle("a"); // entfernen
      useWishlist.getState().toggle("c"); // hinzufügen
      return snapshot;
    });
    await syncWishlist("u1");
    expect(api.removeWishlistItem).toHaveBeenCalledWith("u1", "a");
    expect(api.addWishlistItems).toHaveBeenCalledWith("u1", ["c"]);
    expect(useWishlist.getState().handles.sort()).toEqual(["b", "c"]);
    expect(api.server.sort()).toEqual(["b", "c"]);
  });

  it("clearOwned leert nur Kontolisten", () => {
    useWishlist.setState({ handles: ["a"], owner: null });
    useWishlist.getState().clearOwned();
    expect(useWishlist.getState().handles).toEqual(["a"]);
    useWishlist.setState({ handles: ["a"], owner: "u1" });
    useWishlist.getState().clearOwned();
    expect(useWishlist.getState()).toMatchObject({ handles: [], owner: null });
  });
});

describe("Speicher-Migration", () => {
  it("behandelt Listen ohne Besitzer als Gästeliste", async () => {
    localStorage.setItem(
      "axion-wishlist",
      JSON.stringify({ state: { handles: ["g"] }, version: 0 }),
    );
    await useWishlist.persist.rehydrate();
    expect(useWishlist.getState()).toMatchObject({ handles: ["g"], owner: null });
  });
});
