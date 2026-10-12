// Textpaare der Startseiten-Inhalte (Tabelle site_content) für die automatische Übersetzung:
// Felder unter value.de / value.en, Bildbeschreibung image_alt { de, en }, Punkte im Outfit-Bild hotspots[].label.
import type { Json } from "@/integrations/supabase/types";
import type { Pairs } from "./auto-translate";

type Obj = Record<string, Json>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function blockPairs(value: Obj, fields: string[]): Pairs {
  const de = isObj(value["de"]) ? value["de"] : {};
  const en = isObj(value["en"]) ? value["en"] : {};
  const pairs: Pairs = {};
  for (const name of fields) pairs[`f:${name}`] = { de: str(de[name]), en: str(en[name]) };
  if ("image" in value || "image_alt" in value) {
    const alt = isObj(value["image_alt"]) ? value["image_alt"] : {};
    pairs["image_alt"] = { de: str(alt["de"]), en: str(alt["en"]) };
  }
  if (Array.isArray(value["hotspots"]))
    for (const h of value["hotspots"].filter(isObj)) {
      const label = isObj(h["label"]) ? h["label"] : {};
      pairs[`spot:${str(h["key"])}`] = { de: str(label["de"]), en: str(label["en"]) };
    }
  return pairs;
}

/** Ein Paar { de, en } mit neuem Englisch; leeres Englisch fällt weg. */
function withEn(obj: Obj, en: string): Obj {
  const { en: _old, ...rest } = obj;
  return en.trim() ? { ...rest, en: en.trim() } : rest;
}

export function applyBlockPairs(value: Obj, pairs: Pairs): Obj {
  const out: Obj = { ...value };
  const en: Obj = isObj(value["en"]) ? { ...value["en"] } : {};
  for (const [key, pair] of Object.entries(pairs)) {
    if (!key.startsWith("f:")) continue;
    const name = key.slice(2);
    if (pair.en.trim()) en[name] = pair.en.trim();
    else delete en[name];
  }
  if (Object.keys(en).length) out["en"] = en;
  else delete out["en"];
  if (pairs["image_alt"] && isObj(value["image_alt"]))
    out["image_alt"] = withEn(value["image_alt"], pairs["image_alt"].en);
  else if (pairs["image_alt"]?.en.trim()) out["image_alt"] = { en: pairs["image_alt"].en.trim() };
  if (Array.isArray(value["hotspots"]))
    out["hotspots"] = value["hotspots"].map((h) => {
      if (!isObj(h)) return h;
      const pair = pairs[`spot:${str(h["key"])}`];
      if (!pair) return h;
      return { ...h, label: withEn(isObj(h["label"]) ? h["label"] : {}, pair.en) };
    });
  return out;
}

/** Laufband: ein Paar pro Satz, nach Position. */
export function itemPairs(items: { de: string; en: string }[]): Pairs {
  return Object.fromEntries(items.map((item, i) => [`item:${i}`, { de: item.de, en: item.en }]));
}

export function applyItemPairs(
  items: { de: string; en: string }[],
  pairs: Pairs,
): { de: string; en: string }[] {
  return items.map((item, i) => ({ ...item, en: pairs[`item:${i}`]?.en ?? item.en }));
}
