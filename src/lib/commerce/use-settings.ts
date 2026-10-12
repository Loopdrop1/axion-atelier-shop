// Einstellungen aus dem Admin (Versand, Gutscheine, ausverkaufte Grössen) für die Shop-Seiten.
// Die Sprach-Ebene lädt sie vor (route.tsx), damit Server und Browser dasselbe zeigen.
import { useQuery } from "@tanstack/react-query";
import { useLocaleLoaderData } from "./locale-data";
import { settingsQuery } from "./queries";
import { DEFAULT_SETTINGS, type ShopSettings } from "./source";

export function useShopSettings(): ShopSettings {
  const initial = useLocaleLoaderData()?.settings;
  const { data } = useQuery({ ...settingsQuery(), ...(initial ? { initialData: initial } : {}) });
  return data ?? DEFAULT_SETTINGS;
}
