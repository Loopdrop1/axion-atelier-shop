import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Höchstmenge pro Grösse und Bestellung (gleich wie in der Edge Function «checkout»). */
export const MAX_PER_LINE = 10;

interface CartStore {
  lines: { variantId: string; quantity: number }[];
  /** Eingelöste Codes und E-Mail bleiben beim Wechsel zwischen Seitenleiste und Warenkorbseite erhalten. */
  discountCode: string;
  giftCardCode: string;
  email: string;
  add: (id: string, quantity?: number) => void;
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
    (set) => ({
      lines: [],
      discountCode: "",
      giftCardCode: "",
      email: "",
      add: (id, quantity = 1) =>
        set((s) => ({
          lines: s.lines.some((l) => l.variantId === id)
            ? s.lines.map((l) =>
                l.variantId === id ? { ...l, quantity: clamp(l.quantity + quantity) } : l,
              )
            : [...s.lines, { variantId: id, quantity: clamp(quantity) }],
        })),
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
export const useWishlist = create<{ handles: string[]; toggle: (handle: string) => void }>()(
  persist(
    (set) => ({
      handles: [],
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
  searchOpen: boolean;
  menuOpen: boolean;
  setCart: (v: boolean) => void;
  setSearch: (v: boolean) => void;
  setMenu: (v: boolean) => void;
}>((set) => ({
  cartOpen: false,
  searchOpen: false,
  menuOpen: false,
  setCart: (cartOpen) => set({ cartOpen }),
  setSearch: (searchOpen) => set({ searchOpen }),
  setMenu: (menuOpen) => set({ menuOpen }),
}));
