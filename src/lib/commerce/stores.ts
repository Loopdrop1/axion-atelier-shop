import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Höchstmenge pro Grösse und Bestellung (gleich wie in der Edge Function «checkout»). */
export const MAX_PER_LINE = 10;

/** Was beim Hinzufügen herauskam: wie viele Stück neu dazukamen und was die Menge begrenzt hat. */
export interface AddResult {
  added: number;
  /** «stock» = Lagerbestand dieser Grösse, «max» = Höchstmenge pro Grösse, null = nicht begrenzt */
  capped: "stock" | "max" | null;
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
  /** Eingelöste Codes und E-Mail bleiben beim Wechsel zwischen Seitenleiste und Warenkorbseite erhalten. */
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
        const wanted = current + Math.max(0, Math.floor(quantity));
        const next = Math.min(max, wanted);
        const capped = wanted > next ? (max < MAX_PER_LINE ? "stock" : "max") : null;
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
              : s.lines.map((l) => (l.variantId === id ? { ...l, quantity: clamp(quantity) } : l)),
        })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== id) })),
      setDiscountCode: (discountCode) => set({ discountCode }),
      setGiftCardCode: (giftCardCode) => set({ giftCardCode }),
      setEmail: (email) => set({ email }),
      clear: () => set({ lines: [], discountCode: "", giftCardCode: "" }),
    }),
    { name: "axion-cart", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
export const useWishlist = create<{
  handles: string[];
  toggle: (handle: string) => void;
  /** Behält nur Handles, die es noch gibt (Merkliste räumt Gelöschtes auf). */
  prune: (existing: string[]) => void;
}>()(
  persist(
    (set) => ({
      handles: [],
      prune: (existing) =>
        set((s) =>
          s.handles.every((h) => existing.includes(h))
            ? s
            : { handles: s.handles.filter((h) => existing.includes(h)) },
        ),
      toggle: (handle) =>
        set((s) => ({
          handles: s.handles.includes(handle)
            ? s.handles.filter((h) => h !== handle)
            : [...s.handles, handle],
        })),
    }),
    { name: "axion-wishlist", storage: createJSONStorage(() => localStorage), skipHydration: true },
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
