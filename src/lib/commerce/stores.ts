import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Höchstmenge pro Grösse und Bestellung (gleich wie in der Edge Function «checkout» und in reserve_checkout). */
export const MAX_PER_LINE = 3;
/** Höchstmenge Stück pro Bestellung (gleich wie in der Edge Function «checkout» und in reserve_checkout). */
export const MAX_PER_ORDER = 20;

type CartLine = { variantId: string; quantity: number };

/** Gesamtzahl Stück im Warenkorb. */
export function totalQuantity(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Bringt Positionen unter die Höchstmengen (je Grösse und je Bestellung); ältere Warenkörbe mit mehr Stück werden
 *  so gekürzt, statt dass die Kasse sie ablehnt. Gibt dieselbe Liste zurück, wenn nichts zu kürzen war. */
export function clampLines<T extends CartLine>(lines: readonly T[]): T[] {
  let left = MAX_PER_ORDER;
  let changed = false;
  const out: T[] = [];
  for (const l of lines) {
    const q = Math.min(
      MAX_PER_LINE,
      left,
      Math.max(0, Math.floor(Number.isFinite(l.quantity) ? l.quantity : 0)),
    );
    if (q !== l.quantity) changed = true;
    if (q <= 0) continue;
    left -= q;
    out.push(q === l.quantity ? l : { ...l, quantity: q });
  }
  return changed || out.length !== lines.length ? out : (lines as T[]);
}

/** Wurde der Warenkorb beim Laden gekürzt? Der Warenkorb zeigt dazu einmal einen Hinweis. */
let clampedOnLoad = false;
export function consumeClampedOnLoad(): boolean {
  const was = clampedOnLoad;
  clampedOnLoad = false;
  return was;
}

/** Was beim Hinzufügen herauskam: wie viele Stück neu dazukamen und was die Menge begrenzt hat. */
export interface AddResult {
  added: number;
  /** «stock» = Lagerbestand dieser Grösse, «max» = Höchstmenge pro Grösse, «order» = Höchstmenge pro Bestellung,
   *  null = nicht begrenzt */
  capped: "stock" | "max" | "order" | null;
  /** Höchstmenge dieser Zeile (kleiner von Bestand und Höchstmenge) */
  max: number;
}

/** Höchstmenge einer Zeile: nie mehr als der Bestand der Grösse und nie mehr als MAX_PER_LINE.
 *  Ohne bekannten Bestand gilt nur MAX_PER_LINE. Der Server (reserve_checkout) bleibt die verbindliche Grenze. */
export function lineMax(stock?: number): number {
  if (stock === undefined || !Number.isFinite(stock)) return MAX_PER_LINE;
  return Math.min(MAX_PER_LINE, Math.max(0, Math.floor(stock)));
}

interface CartStore {
  lines: { variantId: string; quantity: number }[];
  /** Eingelöste Codes und E-Mail bleiben beim Wechsel zwischen Seitenleiste und Warenkorbseite erhalten (nur im Speicher, nicht im localStorage). */
  discountCode: string;
  giftCardCode: string;
  email: string;
  /** Legt in den Warenkorb, höchstens bis `lineMax(stock)`; das Ergebnis sagt, ob gekürzt wurde. */
  add: (id: string, quantity?: number, stock?: number) => AddResult;
  quantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  setDiscountCode: (code: string) => void;
  setGiftCardCode: (code: string) => void;
  setEmail: (email: string) => void;
  /** Nach erfolgreicher Bestellung: Positionen und Codes leeren, E-Mail behalten. */
  clear: () => void;
}
const clamp = (n: number) => Math.min(MAX_PER_LINE, Math.max(0, Math.floor(n)));
/** Stück, die in der Bestellung neben dieser Zeile liegen (zählen gegen MAX_PER_ORDER). */
const othersQuantity = (lines: readonly CartLine[], id: string) =>
  totalQuantity(lines.filter((l) => l.variantId !== id));
export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      discountCode: "",
      giftCardCode: "",
      email: "",
      add: (id, quantity = 1, stock) => {
        const max = lineMax(stock);
        const current = get().lines.find((l) => l.variantId === id)?.quantity ?? 0;
        const orderRoom = Math.max(0, MAX_PER_ORDER - othersQuantity(get().lines, id));
        const wanted = current + Math.max(0, Math.floor(quantity));
        const next = Math.min(max, orderRoom, wanted);
        const capped =
          wanted > next ? (orderRoom < max ? "order" : max < MAX_PER_LINE ? "stock" : "max") : null;
        // Nie unter die bereits vorhandene Menge kürzen (z. B. wenn der Bestand inzwischen gesunken ist)
        const result = Math.max(current, next);
        if (result !== current)
          set((s) => ({
            lines: s.lines.some((l) => l.variantId === id)
              ? s.lines.map((l) => (l.variantId === id ? { ...l, quantity: result } : l))
              : [...s.lines, { variantId: id, quantity: result }],
          }));
        return { added: result - current, capped, max };
      },
      quantity: (id, quantity) =>
        set((s) => ({
          lines:
            quantity <= 0
              ? s.lines.filter((l) => l.variantId !== id)
              : s.lines.map((l) =>
                  l.variantId === id
                    ? {
                        ...l,
                        quantity: Math.min(
                          clamp(quantity),
                          Math.max(1, MAX_PER_ORDER - othersQuantity(s.lines, id)),
                        ),
                      }
                    : l,
                ),
        })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== id) })),
      setDiscountCode: (discountCode) => set({ discountCode }),
      setGiftCardCode: (giftCardCode) => set({ giftCardCode }),
      setEmail: (email) => set({ email }),
      clear: () => set({ lines: [], discountCode: "", giftCardCode: "" }),
    }),
    {
      name: "axion-cart",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Nur Positionen bleiben im Browser; Gutschein, Rabattcode und E-Mail gelten nur für diese Sitzung.
      partialize: (s) => ({ lines: s.lines }),
      // Version 1: Höchstmengen 3 je Grösse und 20 je Bestellung. Gespeicherte Warenkörbe werden beim Laden gekürzt.
      version: 1,
      migrate: (state) => {
        const stored = state as { lines?: CartLine[] } | null;
        const old = Array.isArray(stored?.lines) ? stored.lines : [];
        const lines = clampLines(old);
        if (lines !== old) clampedOnLoad = true;
        return { lines };
      },
      merge: (persisted, current) => {
        const stored = (persisted as { lines?: CartLine[] } | undefined)?.lines;
        const lines = Array.isArray(stored) ? clampLines(stored) : current.lines;
        if (Array.isArray(stored) && lines !== stored) clampedOnLoad = true;
        return { ...current, lines };
      },
    },
  ),
);
/** Schreibzugriff auf die Merkliste im Konto; gesetzt, solange eine Person angemeldet und abgeglichen ist. */
export interface WishlistRemote {
  add: (handle: string) => Promise<void>;
  remove: (handle: string) => Promise<void>;
  /** Ein Schreibzugriff ist fehlgeschlagen und die Änderung wurde zurückgenommen. */
  onError: (kind: "add" | "remove") => void;
}
let wishlistRemote: WishlistRemote | null = null;
/** Letzter bekannter Serverstand und neueste Absicht je Handle; Schreibzugriffe laufen pro Handle nacheinander. */
interface PendingWrite {
  chain: Promise<void>;
  latest: number;
  confirmed: boolean;
}
const pendingWrites = new Map<string, PendingWrite>();
export function setWishlistRemote(remote: WishlistRemote | null) {
  wishlistRemote = remote;
  pendingWrites.clear();
}
/** Während des ersten Abgleichs lokal vorgenommene Änderungen (Handle → true = hinzugefügt, false = entfernt). */
let wishlistIntents: Map<string, boolean> | null = null;
export function trackWishlistIntents(): { intents: Map<string, boolean>; stop: () => void } {
  const intents = new Map<string, boolean>();
  wishlistIntents = intents;
  return {
    intents,
    stop: () => {
      if (wishlistIntents === intents) wishlistIntents = null;
    },
  };
}
export const useWishlist = create<{
  handles: string[];
  /** Konto, dessen Liste `handles` spiegelt; `null` = reine Gästeliste. */
  owner: string | null;
  toggle: (handle: string) => void;
  /** Ersetzt die Liste (nach dem Abgleich mit dem Konto); mit `owner` wird auch die Zugehörigkeit gesetzt. */
  replace: (handles: string[], owner?: string | null) => void;
  /** Verwirft eine Kontoliste (Abmeldung); Gästelisten bleiben unberührt. */
  clearOwned: () => void;
  /** Behält nur Handles, die es noch gibt (Merkliste räumt Gelöschtes auf). */
  prune: (existing: string[]) => void;
}>()(
  persist(
    (set, get) => ({
      handles: [],
      owner: null,
      replace: (handles, owner) =>
        set((s) => {
          const nextOwner = owner === undefined ? s.owner : owner;
          return nextOwner === s.owner &&
            s.handles.length === handles.length &&
            s.handles.every((h, i) => h === handles[i])
            ? s
            : { handles, owner: nextOwner };
        }),
      clearOwned: () => {
        if (get().owner !== null) set({ handles: [], owner: null });
      },
      prune: (existing) => {
        const gone = get().handles.filter((h) => !existing.includes(h));
        if (!gone.length) return;
        set((s) => ({ handles: s.handles.filter((h) => existing.includes(h)) }));
        // Im Konto ebenfalls aufräumen (ohne Meldung: der Eintrag ist ohnehin nicht mehr sichtbar)
        const remote = wishlistRemote;
        if (remote) for (const h of gone) void remote.remove(h).catch(() => undefined);
      },
      toggle: (handle) => {
        const adding = !get().handles.includes(handle);
        set((s) => ({
          handles: adding ? [...s.handles, handle] : s.handles.filter((h) => h !== handle),
        }));
        wishlistIntents?.set(handle, adding);
        const remote = wishlistRemote;
        if (!remote) return;
        let rec = pendingWrites.get(handle);
        if (!rec) {
          rec = { chain: Promise.resolve(), latest: 0, confirmed: !adding };
          pendingWrites.set(handle, rec);
        }
        const r = rec;
        const mine = ++r.latest;
        r.chain = r.chain.then(async () => {
          try {
            // Überholt oder schon so im Konto: nichts zu senden (es zählt die neueste Absicht)
            if (r.latest !== mine || r.confirmed === adding) return;
            await (adding ? remote.add(handle) : remote.remove(handle));
            r.confirmed = adding;
          } catch {
            // Nur die neueste Anfrage nimmt zurück, und zwar auf den bestätigten Stand im Konto
            if (r.latest !== mine) return;
            set((s) =>
              s.handles.includes(handle) === r.confirmed
                ? s
                : {
                    handles: r.confirmed
                      ? [...s.handles, handle]
                      : s.handles.filter((h) => h !== handle),
                  },
            );
            remote.onError(adding ? "add" : "remove");
          } finally {
            if (r.latest === mine && pendingWrites.get(handle) === r) pendingWrites.delete(handle);
          }
        });
      },
    }),
    {
      name: "axion-wishlist",
      version: 1,
      // Ältere Gästelisten kennen keinen Besitzer: als Gästeliste behandeln
      migrate: (state) => ({ ...(state as { handles?: string[] }), owner: null }),
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
/** Zuletzt angesehene Produkte (nur Handles, neueste zuerst). */
export const RECENT_MAX = 12;
export const useRecentlyViewed = create<{ handles: string[]; add: (handle: string) => void }>()(
  persist(
    (set) => ({
      handles: [],
      add: (handle) =>
        set((s) => ({
          handles: [handle, ...s.handles.filter((h) => h !== handle)].slice(0, RECENT_MAX),
        })),
    }),
    { name: "axion-recent", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
export const useShopUI = create<{
  cartOpen: boolean;
  /** Hinweis im Warenkorb nach dem Hinzufügen, z. B. «Nur noch 1 an Lager» (leer = keiner) */
  cartNotice: string;
  setCartNotice: (v: string) => void;
  searchOpen: boolean;
  menuOpen: boolean;
  setCart: (v: boolean) => void;
  setSearch: (v: boolean) => void;
  setMenu: (v: boolean) => void;
}>((set) => ({
  cartOpen: false,
  cartNotice: "",
  setCartNotice: (cartNotice) => set({ cartNotice }),
  searchOpen: false,
  menuOpen: false,
  setCart: (cartOpen) => set(cartOpen ? { cartOpen } : { cartOpen, cartNotice: "" }),
  setSearch: (searchOpen) => set({ searchOpen }),
  setMenu: (menuOpen) => set({ menuOpen }),
}));
