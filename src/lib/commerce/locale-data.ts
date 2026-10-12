// Daten aus dem Loader der Sprach-Ebene (Laufband, Menü, Einstellungen), vom Server mitgeschickt.
// Dienen als Startwerte der Abfragen, damit Server und Browser beim Hydrieren dasselbe zeigen.
import { useMatch } from "@tanstack/react-router";

export function useLocaleLoaderData() {
  return useMatch({ from: "/{-$locale}", shouldThrow: false })?.loaderData;
}
