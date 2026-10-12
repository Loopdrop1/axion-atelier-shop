import suit from "@/assets/product-anzug-marine.jpg";
import charcoal from "@/assets/product-anzug-anthrazit.jpg";
import vest from "@/assets/product-weste-marine.jpg";
import sage from "@/assets/product-weste-salbei.jpg";
import derby from "@/assets/product-derby-braun.jpg";
import oxford from "@/assets/product-oxford-schwarz.jpg";
import modelSuit from "@/assets/model-anzug.jpg";
import modelVest from "@/assets/model-weste.jpg";
import modelShoes from "@/assets/model-schuhe.jpg";
import look from "@/assets/look-outfit.jpg";
import fabric from "@/assets/detail-stoff.jpg";
import type { ShopImage } from "./types";
const portrait = (url: string, altText: string): ShopImage => ({
  url,
  altText,
  width: 1024,
  height: 1280,
});
export const media = {
  suit: portrait(suit, "Marineblauer Anzug von vorne"),
  charcoal: portrait(charcoal, "Anthrazitfarbener Anzug von vorne"),
  vest: portrait(vest, "Marineblaue Weste von vorne"),
  sage: portrait(sage, "Salbeigrüne Weste von vorne"),
  derby: portrait(derby, "Braune Derby-Schuhe in Dreiviertelansicht"),
  oxford: portrait(oxford, "Schwarze Oxford-Schuhe in Dreiviertelansicht"),
  modelSuit: portrait(modelSuit, "Marineblauer Anzug am Modell, ohne sichtbares Gesicht"),
  modelVest: portrait(modelVest, "Salbeigrüne Weste mit weissem Hemd am Modell"),
  modelShoes: portrait(modelShoes, "Braune Derby-Schuhe zu einer dunklen Anzughose"),
  look: {
    url: look,
    altText: "Marineblauer Dreiteiler mit schwarzen Oxford-Schuhen in einem hellen Gang",
    width: 960,
    height: 1280,
  },
  fabric: {
    url: fabric,
    altText: "Detail von dunklem Anzugstoff mit messingfarbenem Knopf",
    width: 1536,
    height: 1024,
  },
};

export type MediaKey = keyof typeof media;
