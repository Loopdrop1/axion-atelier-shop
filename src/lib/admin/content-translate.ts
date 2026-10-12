// Textpaare der Startseiten-Inhalte (Tabelle site_content) für die automatische Übersetzung:
// Felder unter value.de / value.en, Bildbeschreibung image_alt { de, en }, Punkte im Outfit-Bild hotspots[].label.
// Herkunft: value.en_auto listet die Schlüssel mit maschinellem Englisch («f:title», «image_alt», «spot:<key>»);
// im Laufband trägt jeder Satz sein eigenes «auto».
import type { Json } from "@/integrations/supabase/types";
import { autoList, type Pairs } from "./auto-translate";

type Obj = Record<string, Json>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Kurze ID für Einträge, die nur während der Bearbeitung eindeutig sein müssen. */
export const newId = () => Math.random().toString(36).slice(2, 10);

export function blockPairs(value: Obj, fields: string[]): Pairs {
  const de = isObj(value["de"]) ? value["de"] : {};
  const en = isObj(value["en"]) ? value["en"] : {};
  const auto = new Set(strings(value["en_auto"]));
  const pairs: Pairs = {};
  const add = (key: string, d: string, e: string) => {
    pairs[key] = { de: d, en: e, auto: auto.has(key) };
  };
  for (const name of fields) add(`f:${name}`, str(de[name]), str(en[name]));
  if ("image" in value || "image_alt" in value) {
    const alt = isObj(value["image_alt"]) ? value["image_alt"] : {};
    add("image_alt", str(alt["de"]), str(alt["en"]));
  }
  if (Array.isArray(value["hotspots"]))
    for (const h of value["hotspots"].filter(isObj)) {
      const label = isObj(h["label"]) ? h["label"] : {};
      add(`spot:${str(h["key"])}`, str(label["de"]), str(label["en"]));
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
  const auto = autoList(pairs);
  if (auto.length) out["en_auto"] = auto;
  else delete out["en_auto"];
  return out;
}

/** Nächster freier Schlüssel für einen Punkt im Outfit-Bild (punkt-1, punkt-2 …). */
export function nextSpotKey(used: Iterable<string>): string {
  const taken = new Set(used);
  let n = taken.size + 1;
  while (taken.has(`punkt-${n}`)) n++;
  return `punkt-${n}`;
}

/** Punkte mit eindeutigen Schlüsseln: Fehlende oder doppelte bekommen einen neuen (die Übersetzung hängt daran). */
export function withUniqueSpotKeys(value: Obj): Obj {
  if (!Array.isArray(value["hotspots"])) return value;
  const used = new Set<string>();
  const hotspots = value["hotspots"].map((h) => {
    if (!isObj(h)) return h;
    let key = str(h["key"]);
    if (!key || used.has(key)) {
      const all = value["hotspots"] as Json[];
      key = nextSpotKey([...used, ...all.filter(isObj).map((x) => str(x["key"]))]);
    }
    used.add(key);
    return key === h["key"] ? h : { ...h, key };
  });
  return { ...value, hotspots };
}

/** Laufband: ein Satz mit ID (nur während der Bearbeitung) und Herkunft des Englisch. */
export interface Item {
  id: string;
  de: string;
  en: string;
  auto?: boolean;
}

export function readItems(value: Obj): Item[] {
  return (Array.isArray(value["items"]) ? value["items"] : []).filter(isObj).map((i) => ({
    id: newId(),
    de: str(i["de"]),
    en: str(i["en"]),
    auto: i["auto"] === true,
  }));
}

/** Ein Paar pro Satz, über die ID (Umsortieren und Löschen bringen das Englisch nicht durcheinander). */
export function itemPairs(items: Item[]): Pairs {
  return Object.fromEntries(
    items.map((item) => [
      `item:${item.id}`,
      { de: item.de, en: item.en, auto: Boolean(item.auto) },
    ]),
  );
}

export function applyItemPairs(items: Item[], pairs: Pairs): Item[] {
  return items.map((item) => {
    const pair = pairs[`item:${item.id}`];
    return pair ? { ...item, en: pair.en, auto: Boolean(pair.auto) } : item;
  });
}

/** Gespeicherte Form: Sätze ohne Deutsch fallen weg, «auto» nur bei maschinellem Englisch. */
export function itemsJson(items: Item[]): Json {
  return {
    items: items
      .filter((x) => x.de.trim())
      .map((x) => ({
        de: x.de.trim(),
        ...(x.en.trim() ? { en: x.en.trim() } : {}),
        ...(x.auto && x.en.trim() ? { auto: true } : {}),
      })),
  };
}
