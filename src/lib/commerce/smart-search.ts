// Kluge Suche ohne Server: versteht Synonyme (DE/EN), Tippfehler, zusammengesetzte Wörter («Hochzeitsanzug»),
// Farbe, Kategorie, Anlass, Passform, Preis («unter 500»), Grösse, Sale und Neu. Ergebnis nach Relevanz sortiert;
// ohne exakte Treffer werden Bedingungen schrittweise gelockert statt «keine Treffer» zu zeigen.
import type { Occasion, Product } from "./types";

export interface SearchIntent {
  categories: string[];
  /** Farbgruppen, z. B. «blau» (umfasst Marine, Nachtblau, Hellblau …) */
  colors: string[];
  occasions: Occasion[];
  fit?: "Slim Fit" | "Regular Fit" | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  size?: string | undefined;
  sale: boolean;
  neu: boolean;
  cheap: boolean;
  /** «Geschenk»: Accessoires und Hinweis auf den Geschenkgutschein */
  gift: boolean;
  /** Wörter, die keinem Begriff zugeordnet wurden; sie müssen im Text der Produkte vorkommen */
  terms: string[];
}

export interface SearchResult {
  products: Product[];
  intent: SearchIntent;
  /** true: keine exakten Treffer, Bedingungen wurden gelockert */
  relaxed: boolean;
  /** Korrigierte Anfrage bei Tippfehlern («Meintest du …») */
  didYouMean?: string | undefined;
}

export const normalize = (text: string) =>
  text
    .toLocaleLowerCase("de-CH")
    .replace(/ß/g, "ss")
    // Umlaute wie in der Schweiz üblich ausschreiben («grün» = «gruen»), Tippen ohne Umlaut fängt die Tippfehler-Toleranz
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Grobe Stammform für Deutsch und Englisch (Plural, Adjektivendungen). */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ern", "en", "er", "es", "e", "n", "s"])
    if (word.endsWith(suffix) && word.length - suffix.length >= 4)
      return word.slice(0, -suffix.length);
  return word;
}

/** Damerau-Levenshtein-Abstand mit Abbruch, sobald er grösser als max ist. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

const allowed = (word: string) => (word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0);

/** Wort trifft Begriff: gleich, gleicher Stamm, Präfix (beim Tippen) oder kleiner Tippfehler. */
export function wordMatches(term: string, word: string): boolean {
  if (word === term || stem(word) === stem(term)) return true;
  if (term.length >= 3 && word.startsWith(term)) return true;
  const max = allowed(term);
  return max > 0 && distance(term, word, max) <= max;
}

// Begriffe → Kategorien (Slugs aus dem Admin). Teilwörter reichen («hochzeitsanzug» enthält «anzug»).
const CATEGORY_WORDS: Record<string, string[]> = {
  anzuege: [
    "anzug",
    "anzuege",
    "suit",
    "suits",
    "zweiteiler",
    "dreiteiler",
    "smoking",
    "tuxedo",
    "kombination",
  ],
  sakkos: ["sakko", "sakkos", "blazer", "jackett", "veston", "jacket", "jackets"],
  hosen: ["hose", "hosen", "trousers", "pants", "chino", "chinos", "anzughose"],
  hemden: ["hemd", "hemden", "shirt", "shirts", "businesshemd", "oxfordhemd"],
  westen: ["weste", "westen", "gilet", "waistcoat", "vest"],
  "maentel-jacken": [
    "mantel",
    "maentel",
    "coat",
    "coats",
    "overcoat",
    "jacke",
    "jacken",
    "parka",
    "kurzmantel",
  ],
  strick: [
    "strick",
    "pullover",
    "pulli",
    "sweater",
    "knit",
    "knitwear",
    "kaschmir",
    "cashmere",
    "rollkragen",
    "turtleneck",
    "cardigan",
  ],
  schuhe: [
    "schuh",
    "schuhe",
    "shoe",
    "shoes",
    "oxford",
    "derby",
    "loafer",
    "chelsea",
    "boots",
    "stiefel",
    "monk",
    "sneaker",
  ],
  accessoires: [
    "accessoire",
    "accessoires",
    "accessory",
    "accessories",
    "krawatte",
    "tie",
    "fliege",
    "bowtie",
    "guertel",
    "belt",
    "socken",
    "socks",
    "einstecktuch",
    "pocketsquare",
    "manschettenknoepfe",
    "cufflinks",
    "schal",
    "scarf",
  ],
};

// Farbgruppen: Suchwort → passende Farbnamen der Produkte (Deutsch und Englisch)
const COLOR_GROUPS: Record<string, string[]> = {
  blau: [
    "marine",
    "navy",
    "nachtblau",
    "midnight",
    "hellblau",
    "light blue",
    "dunkelblau",
    "dark blue",
    "blau",
    "blue",
  ],
  grau: [
    "anthrazit",
    "charcoal",
    "mittelgrau",
    "mid grey",
    "hellgrau",
    "light grey",
    "grau",
    "grey",
    "gray",
  ],
  schwarz: ["schwarz", "black", "onyx"],
  braun: ["braun", "brown", "cognac", "espresso", "dunkelbraun", "dark brown"],
  beige: ["sand", "kamel", "camel", "beige"],
  gruen: ["salbei", "sage", "oliv", "olive", "gruen", "green"],
  rot: ["bordeaux", "burgundy", "rot", "red", "weinrot"],
  weiss: ["weiss", "white"],
};
const COLOR_WORDS: Record<string, string[]> = {
  blau: ["blau", "blue", "navy", "marine", "nachtblau", "hellblau", "dunkelblau"],
  grau: ["grau", "grey", "gray", "anthrazit", "charcoal", "hellgrau", "mittelgrau"],
  schwarz: ["schwarz", "black", "onyx"],
  braun: ["braun", "brown", "cognac", "espresso", "dunkelbraun"],
  beige: ["beige", "sand", "kamel", "camel"],
  gruen: ["gruen", "green", "oliv", "olive", "salbei", "sage"],
  rot: ["rot", "red", "bordeaux", "burgundy", "weinrot", "bordo", "bordeau"],
  weiss: ["weiss", "white"],
};

const OCCASION_WORDS: Record<Occasion, string[]> = {
  hochzeit: [
    "hochzeit",
    "wedding",
    "heirat",
    "heiraten",
    "trauzeuge",
    "braeutigam",
    "groom",
    "standesamt",
    "trauung",
  ],
  business: [
    "business",
    "buero",
    "office",
    "arbeit",
    "work",
    "meeting",
    "geschaeft",
    "bewerbung",
    "interview",
  ],
  abschlussfeier: [
    "abschluss",
    "abschlussfeier",
    "graduation",
    "matura",
    "diplom",
    "abschlussball",
  ],
  gala: [
    "gala",
    "smoking",
    "blacktie",
    "abendgarderobe",
    "ball",
    "opernball",
    "festlich",
    "evening",
  ],
};

const FIT_WORDS: Record<"Slim Fit" | "Regular Fit", string[]> = {
  "Slim Fit": ["slim", "schmal", "tailliert", "eng", "fitted"],
  "Regular Fit": ["regular", "gerade", "bequem", "klassisch", "classic", "relaxed"],
};

const SALE_WORDS = ["sale", "reduziert", "rabatt", "angebot", "discount", "outlet", "aktion"];
const NEW_WORDS = ["neu", "neuheit", "neuheiten", "new", "latest"];
const GIFT_WORDS = ["geschenk", "geschenke", "gift", "gifts", "present", "gutschein", "voucher"];
// «Schuhe zum Anzug»: Kategorie nach diesen Wörtern ist nur der Zusammenhang, nicht das Gesuchte
const CONTEXT_WORDS = new Set([
  "zum",
  "zur",
  "zu",
  "passend",
  "for",
  "with",
  "mit",
  "to",
  "match",
  "matching",
]);
const CHEAP_WORDS = ["guenstig", "billig", "preiswert", "cheap", "affordable"];
// Füllwörter ohne Bedeutung für die Suche
const STOP = new Set(
  "fuer fur ein eine einen einem der die das den dem mit und oder in im am an zu zum zur von ich suche brauche moechte mir mein meine was passt passend outfit look kombi style stil zu grosse groesse gr size for a an the with and or in on to my i need looking want something etwas chf fr franken".split(
    " ",
  ),
);

/** Erkennt ein Synonym in einem Wort: gleich, gleicher Stamm oder Teilwort (ab 4 Zeichen). */
function exactHit(token: string, words: string[]): boolean {
  return words.some(
    (w) =>
      token === w ||
      stem(token) === stem(w) ||
      (w.length >= 4 && token.length > w.length && token.includes(w)),
  );
}
/** Tippfehler nur, wenn das Wort sonst nirgends exakt passt («blauer» ist blau, kein «Blazer»). */
function fuzzyHit(token: string, words: string[]): boolean {
  return words.some((w) => allowed(w) > 0 && distance(token, w, allowed(w)) <= allowed(w));
}
const ALL_WORDS = () => [
  ...Object.values(CATEGORY_WORDS),
  ...Object.values(COLOR_WORDS),
  ...Object.values(OCCASION_WORDS),
];
function hits(token: string, words: string[]): boolean {
  if (exactHit(token, words)) return true;
  return !ALL_WORDS().some((list) => exactHit(token, list)) && fuzzyHit(token, words);
}

export function parseQuery(query: string): SearchIntent {
  const intent: SearchIntent = {
    categories: [],
    colors: [],
    occasions: [],
    sale: false,
    neu: false,
    cheap: false,
    gift: false,
    terms: [],
  };
  let text = normalize(query);
  // Preis: «unter 500», «bis CHF 300», «< 400», «ab 200», «200-400»
  const range = text.match(/(\d{2,5})\s*(?:-|bis|to)\s*(\d{2,5})/);
  if (range) {
    intent.minPrice = Number(range[1]);
    intent.maxPrice = Number(range[2]);
    text = text.replace(range[0], " ");
  }
  const max = text.match(
    /(?:unter|bis|max(?:imal)?|hoechstens|under|below|up to|<)\s*(?:chf|fr\.?)?\s*(\d{2,5})/,
  );
  if (max) {
    intent.maxPrice = Number(max[1]);
    text = text.replace(max[0], " ");
  }
  const min = text.match(/(?:ab|ueber|mindestens|over|above|from|>)\s*(?:chf|fr\.?)?\s*(\d{2,5})/);
  if (min) {
    intent.minPrice = Number(min[1]);
    text = text.replace(min[0], " ");
  }
  const tokens = text
    .replace(/black tie/g, "blacktie")
    .replace(/bow tie/g, "bowtie")
    .replace(/pocket square/g, "pocketsquare")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const context: string[] = [];
  for (const [index, token] of tokens.entries()) {
    const afterContextWord = index > 0 && CONTEXT_WORDS.has(tokens[index - 1]!);
    if (STOP.has(token)) continue;
    if (GIFT_WORDS.some((w) => token.startsWith(w))) {
      intent.gift = true;
      if (!intent.categories.includes("accessoires")) intent.categories.push("accessoires");
      continue;
    }
    // Grösse: 44 bis 60 (Konfektion), 37 bis 47 (Kragen, Schuhe), S bis XXL
    if (/^\d{2}$/.test(token) && Number(token) >= 36 && Number(token) <= 60) {
      intent.size = token;
      continue;
    }
    if (/^(xs|s|m|l|xl|xxl)$/.test(token) && tokens.length > 1) {
      intent.size = token.toUpperCase();
      continue;
    }
    let used = false;
    for (const [slug, words] of Object.entries(CATEGORY_WORDS))
      if (hits(token, words)) {
        if (afterContextWord) context.push(slug);
        else if (!intent.categories.includes(slug)) intent.categories.push(slug);
        used = true;
      }
    for (const [group, words] of Object.entries(COLOR_WORDS))
      if (hits(token, words)) {
        if (!intent.colors.includes(group)) intent.colors.push(group);
        used = true;
      }
    for (const [occasion, words] of Object.entries(OCCASION_WORDS) as [Occasion, string[]][])
      if (hits(token, words)) {
        if (!intent.occasions.includes(occasion)) intent.occasions.push(occasion);
        used = true;
      }
    for (const [fit, words] of Object.entries(FIT_WORDS) as [
      "Slim Fit" | "Regular Fit",
      string[],
    ][])
      if (words.includes(token)) {
        intent.fit = fit;
        used = true;
      }
    if (SALE_WORDS.some((w) => token === w || token.startsWith(w))) {
      intent.sale = true;
      used = true;
    }
    if (NEW_WORDS.includes(token)) {
      intent.neu = true;
      used = true;
    }
    if (CHEAP_WORDS.some((w) => token.startsWith(w))) {
      intent.cheap = true;
      used = true;
    }
    // Spezifische Begriffe (z. B. «oxford», «loafer», «krawatte») zusätzlich als Text suchen, damit sie die
    // Kategorie nicht nur erweitern, sondern auch eingrenzen; reine Kategoriewörter («anzug») nicht.
    const generic = Object.values(CATEGORY_WORDS).some((words) =>
      words.slice(0, 4).includes(token),
    );
    if (
      !used ||
      (intent.categories.length && !generic && token.length >= 4 && !hitsColorOrOccasion(token))
    )
      intent.terms.push(token);
  }
  // Nur Zusammenhang erkannt («zum Anzug» ohne anderes Stück): dann ist er doch das Gesuchte
  if (!intent.categories.length) intent.categories.push(...context);
  return intent;
}

function hitsColorOrOccasion(token: string) {
  return (
    Object.values(COLOR_WORDS).some((w) => hits(token, w)) ||
    Object.values(OCCASION_WORDS).some((w) => hits(token, w))
  );
}

const productText = (p: Product) =>
  normalize(
    [
      p.title,
      p.categoryTitle,
      p.color.name,
      p.model,
      p.handle.replace(/-/g, " "),
      p.description,
      p.details.material ?? "",
      p.details.origin ?? "",
      p.details.features.join(" "),
      p.details.fit ?? "",
    ].join(" "),
  );

/** Punkte für einen freien Begriff: Titel zählt am meisten. 0 = kein Treffer. */
function termScore(term: string, p: Product, words: string[]): number {
  const title = normalize(`${p.title} ${p.model}`).split(/[^a-z0-9]+/);
  if (title.some((w) => w === term || stem(w) === stem(term))) return 6;
  if (title.some((w) => wordMatches(term, w))) return 4;
  const head = normalize(`${p.categoryTitle} ${p.color.name}`).split(/[^a-z0-9]+/);
  if (head.some((w) => wordMatches(term, w))) return 3;
  if (words.some((w) => wordMatches(term, w))) return 1;
  // Zusammengesetzte Wörter im Text («Kaschmirpullover» enthält «kaschmir»)
  if (term.length >= 5 && words.some((w) => w.length > term.length && w.includes(term))) return 1;
  return 0;
}

const colorMatches = (p: Product, groups: string[]) => {
  const name = normalize(p.color.name);
  return groups.some((g) => (COLOR_GROUPS[g] ?? []).some((c) => name.includes(c)));
};

type Check = keyof Pick<
  SearchIntent,
  "size" | "maxPrice" | "minPrice" | "colors" | "fit" | "occasions" | "sale" | "neu" | "categories"
>;

function passes(p: Product, intent: SearchIntent, skip: Set<Check>): boolean {
  const price = p.priceRange.min.amount;
  if (
    !skip.has("categories") &&
    intent.categories.length &&
    !intent.categories.includes(p.category)
  )
    return false;
  if (!skip.has("colors") && intent.colors.length && !colorMatches(p, intent.colors)) return false;
  if (
    !skip.has("occasions") &&
    intent.occasions.length &&
    !intent.occasions.some((o) => p.occasions.includes(o))
  )
    return false;
  if (!skip.has("fit") && intent.fit && p.fit !== intent.fit) return false;
  if (!skip.has("maxPrice") && intent.maxPrice !== undefined && price > intent.maxPrice)
    return false;
  if (!skip.has("minPrice") && intent.minPrice !== undefined && price < intent.minPrice)
    return false;
  if (
    !skip.has("size") &&
    intent.size &&
    !p.variants.some((v) => v.availableForSale && normalize(v.title) === normalize(intent.size!))
  )
    return false;
  if (!skip.has("sale") && intent.sale && !(p.tags.includes("sale") || p.compareAtPrice))
    return false;
  if (!skip.has("neu") && intent.neu && !p.tags.includes("neu")) return false;
  return true;
}

function rank(products: Product[], intent: SearchIntent, skip: Set<Check>, partial: boolean) {
  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    if (!passes(p, intent, skip)) continue;
    const words = productText(p).split(/[^a-z0-9]+/);
    let score = 0;
    let matched = 0;
    for (const term of intent.terms) {
      const s = termScore(term, p, words);
      if (s) matched++;
      score += s;
    }
    if (intent.terms.length && (partial ? matched === 0 : matched < intent.terms.length)) continue;
    // Erfüllte Begriffe heben das Stück; verfügbare Stücke vor ausverkauften
    if (intent.categories.includes(p.category)) score += 2;
    if (intent.occasions.some((o) => p.occasions.includes(o)))
      score += 1 + (intent.categories.length ? 0 : (OCCASION_WEIGHT[p.category] ?? 0));
    if (p.variants.some((v) => v.availableForSale)) score += 0.5;
    scored.push({ p, score });
  }
  return scored
    .sort((a, b) =>
      intent.cheap
        ? a.p.priceRange.min.amount - b.p.priceRange.min.amount
        : b.score - a.score || b.p.createdAt.localeCompare(a.p.createdAt),
    )
    .map((s) => s.p);
}

// Bei reinen Anlass-Suchen («Hochzeit») zuerst die Hauptstücke zeigen
const OCCASION_WEIGHT: Record<string, number> = {
  anzuege: 3,
  sakkos: 2,
  westen: 1.5,
  hemden: 1,
  schuhe: 1,
  hosen: 0.5,
};

/** Lockern in dieser Reihenfolge, bis es Treffer gibt (das Unwichtigste zuerst). */
const RELAX: Check[] = ["size", "minPrice", "neu", "fit", "colors", "maxPrice"];
const RELAX_LAST: Check[] = ["sale", "occasions"];

export function smartSearch(
  products: Product[],
  query: string,
  extra?: Partial<SearchIntent>,
): SearchResult {
  const parsed = parseQuery(query);
  return searchWithIntent(products, extra ? mergeIntent(parsed, extra) : parsed, query, extra);
}

/** Suche mit fertiger Absicht (z. B. nachdem ein Begriff entfernt wurde). */
export function searchWithIntent(
  products: Product[],
  intent: SearchIntent,
  query = "",
  extra?: Partial<SearchIntent>,
): SearchResult {
  const empty =
    !intent.terms.length &&
    !intent.categories.length &&
    !intent.colors.length &&
    !intent.occasions.length &&
    !intent.fit &&
    intent.maxPrice === undefined &&
    intent.minPrice === undefined &&
    !intent.size &&
    !intent.sale &&
    !intent.neu &&
    !intent.cheap &&
    !intent.gift;
  if (empty) return { products: [], intent, relaxed: false };
  const exact = rank(products, intent, new Set(), false);
  if (exact.length) return { products: exact, intent, relaxed: false };
  const didYouMean = query ? correct(products, query, intent) : undefined;
  if (didYouMean) {
    const fixed = smartSearch(products, didYouMean, extra);
    if (fixed.products.length && !fixed.relaxed) return { ...fixed, didYouMean };
  }
  const skip = new Set<Check>();
  for (const check of RELAX) {
    skip.add(check);
    const loose = rank(products, intent, skip, true);
    if (loose.length) return { products: loose, intent, relaxed: true, didYouMean };
  }
  // Dann unbekannte Wörter ignorieren und nur die erkannten Begriffe zählen, zuletzt auch Sale und Anlass lockern
  const known = { ...intent, terms: [] };
  if (intent.terms.length && (intent.categories.length || intent.occasions.length || intent.sale)) {
    const loose = rank(products, known, skip, true);
    if (loose.length) return { products: loose, intent, relaxed: true, didYouMean };
  }
  for (const check of RELAX_LAST) {
    skip.add(check);
    const loose = rank(products, known, skip, true);
    if (loose.length && (intent.categories.length || !intent.terms.length))
      return { products: loose, intent, relaxed: true, didYouMean };
  }
  return { products: [], intent, relaxed: true, didYouMean };
}

/** «Meintest du»: unbekannte Wörter durch das nächste Wort aus dem Katalog ersetzen. */
function correct(products: Product[], query: string, intent: SearchIntent): string | undefined {
  if (!intent.terms.length) return undefined;
  const vocabulary = new Set(
    products.flatMap((p) =>
      normalize(`${p.title} ${p.categoryTitle} ${p.color.name} ${p.details.material ?? ""}`)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4),
    ),
  );
  let changed = false;
  let text = normalize(query);
  for (const term of intent.terms) {
    if ([...vocabulary].some((w) => w === term)) continue;
    let best: string | undefined;
    let bestDistance = 3;
    for (const w of vocabulary) {
      const d = distance(term, w, 2);
      if (d < bestDistance) {
        best = w;
        bestDistance = d;
      }
    }
    if (best && bestDistance <= 2) {
      text = text.replace(term, best);
      changed = true;
    }
  }
  return changed ? text : undefined;
}

/** Ergebnis der KI (nur bekannte Werte) mit der lokalen Erkennung zusammenführen. */
export function mergeIntent(base: SearchIntent, extra: Partial<SearchIntent>): SearchIntent {
  const union = <T>(a: T[], b: T[] | undefined) => [...new Set([...a, ...(b ?? [])])];
  return {
    ...base,
    categories: union(base.categories, extra.categories),
    colors: union(base.colors, extra.colors),
    occasions: union(base.occasions, extra.occasions),
    fit: base.fit ?? extra.fit,
    maxPrice: base.maxPrice ?? extra.maxPrice,
    minPrice: base.minPrice ?? extra.minPrice,
    sale: base.sale || Boolean(extra.sale),
    neu: base.neu || Boolean(extra.neu),
    gift: base.gift || Boolean(extra.gift),
    // Die KI ersetzt freie Wörter durch ihre Stichworte (sonst würden Füllwörter alles ausfiltern)
    terms: extra.terms ? extra.terms.map(normalize) : base.terms,
  };
}

export const COLOR_GROUP_KEYS = Object.keys(COLOR_GROUPS);
