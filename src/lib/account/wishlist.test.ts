import { beforeEach, describe, expect, it, vi } from "vitest";
import { WISHLIST_MAX, mergeWishlist, normalizeHandles } from "./wishlist";
import { setWishlistRemote, useWishlist } from "@/lib/commerce/stores";

describe("normalizeHandles", () => {
  it("entfernt Doppelte, Leeres, Zu-Langes und Nicht-Text", () => {
    expect(normalizeHandles(["a", "b", "a", "", 3, null, "x".repeat(201), "c"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("mergeWishlist", () => {
  it("bildet die Vereinigung: Server zuerst, dann neue lokale", () => {
    expect(mergeWishlist(["a", "b"], ["b", "c", "d"])).toEqual({
      merged: ["a", "b", "c", "d"],
      toUpload: ["c", "d"],
    });
  });
  it("lädt nichts hoch, wenn der Server schon alles kennt", () => {
    expect(mergeWishlist(["a", "b"], ["b", "a"]).toUpload).toEqual([]);
    expect(mergeWishlist([], [])).toEqual({ merged: [], toUpload: [] });
  });
  it("begrenzt auf WISHLIST_MAX", () => {
    const remote = Array.from({ length: WISHLIST_MAX - 1 }, (_, i) => `r${i}`);
    const out = mergeWishlist(remote, ["l1", "l2"]);
    expect(out.merged).toHaveLength(WISHLIST_MAX);
    expect(out.toUpload).toEqual(["l1"]);
    expect(mergeWishlist([...remote, "z"], ["l1"]).toUpload).toEqual([]);
  });
});

describe("useWishlist mit Konto", () => {
  beforeEach(() => {
    useWishlist.setState({ handles: [] });
    setWishlistRemote(null);
  });

  it("schreibt Hinzufügen und Entfernen durch", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    setWishlistRemote({ add, remove, onError: vi.fn() });
    useWishlist.getState().toggle("mantel");
    expect(useWishlist.getState().handles).toEqual(["mantel"]);
    useWishlist.getState().toggle("mantel");
    expect(useWishlist.getState().handles).toEqual([]);
    expect(add).toHaveBeenCalledWith("mantel");
    expect(remove).toHaveBeenCalledWith("mantel");
  });

  it("nimmt Hinzufügen bei Fehler zurück und meldet ihn", async () => {
    const onError = vi.fn();
    setWishlistRemote({ add: vi.fn().mockRejectedValue(new Error("x")), remove: vi.fn(), onError });
    useWishlist.getState().toggle("hemd");
    expect(useWishlist.getState().handles).toEqual(["hemd"]);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("add"));
    expect(useWishlist.getState().handles).toEqual([]);
  });

  it("nimmt Entfernen bei Fehler zurück", async () => {
    const onError = vi.fn();
    useWishlist.setState({ handles: ["hemd"] });
    setWishlistRemote({ add: vi.fn(), remove: vi.fn().mockRejectedValue(new Error("x")), onError });
    useWishlist.getState().toggle("hemd");
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("remove"));
    expect(useWishlist.getState().handles).toEqual(["hemd"]);
  });

  it("ohne Konto bleibt alles lokal; replace ersetzt die Liste", () => {
    useWishlist.getState().toggle("a");
    useWishlist.getState().replace(["b", "c"]);
    expect(useWishlist.getState().handles).toEqual(["b", "c"]);
  });

  it("prune räumt auch im Konto auf", () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    setWishlistRemote({ add: vi.fn(), remove, onError: vi.fn() });
    useWishlist.setState({ handles: ["a", "weg"] });
    useWishlist.getState().prune(["a"]);
    expect(useWishlist.getState().handles).toEqual(["a"]);
    expect(remove).toHaveBeenCalledWith("weg");
  });
});
