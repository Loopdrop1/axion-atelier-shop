// Ratgeber: kleine Stammdaten (Adressen, Titel, Beschreibungen, Datum). Die langen Texte stehen in guides.ts und
// guides-en.ts und werden nur im Loader der Ratgeber-Seite geladen. Diese Datei darf deshalb überall importiert werden
// (head, Sitemap, llms.txt, Kollektionsseiten).
import type { Locale } from "@/i18n/locale";

export const guideSlugs = [
  "anzug-hochzeit",
  "slim-fit-oder-regular-fit",
  "business-dresscode-schweiz",
  "abschlussfeier-outfit",
  "anzug-pflegen",
  "stoffe-und-qualitaet",
] as const;
export type GuideSlug = (typeof guideSlugs)[number];

export function isGuideSlug(value: string): value is GuideSlug {
  return (guideSlugs as readonly string[]).includes(value);
}

/** Datum der letzten inhaltlichen Überarbeitung (ISO), für die Anzeige und dateModified. */
export const guidesUpdated = "2026-10-28";

export interface GuideMeta {
  title: string;
  /** Meta-Beschreibung, höchstens 155 Zeichen. */
  description: string;
  /** Ein Satz für die Karte auf der Übersicht. */
  teaser: string;
}

export const guideIndexMeta: Record<Locale, { title: string; description: string; intro: string }> =
  {
    de: {
      title: "Ratgeber",
      description:
        "Ratgeber zu Anzug, Passform, Dresscode und Pflege: praktische Tipps für Hochzeit, Büro und Abschlussfeier in der Schweiz.",
      intro:
        "Praktische Antworten rund um den Anzug: Was zur Hochzeit passt, wie ein Anzug sitzen soll, was im Büro gilt und wie du ihn pflegst.",
    },
    en: {
      title: "Guides",
      description:
        "Guides to suits, fit, dress codes and care: practical advice for weddings, the office and graduation ceremonies in Switzerland.",
      intro:
        "Practical answers about the suit: what suits a wedding, how a suit should fit, what applies at the office and how to look after it.",
    },
  };

export const guideMeta: Record<Locale, Record<GuideSlug, GuideMeta>> = {
  de: {
    "anzug-hochzeit": {
      title: "Anzug für die Hochzeit: Gast und Bräutigam",
      description:
        "Welcher Anzug passt zur Hochzeit? Dresscodes, Farben nach Jahreszeit sowie Schuhe und Accessoires für Gäste und Bräutigam.",
      teaser: "Dresscode lesen, Farbe nach Jahreszeit wählen, Schuhe und Accessoires abstimmen.",
    },
    "slim-fit-oder-regular-fit": {
      title: "Slim Fit oder Regular Fit: Welcher Schnitt passt?",
      description:
        "Slim Fit oder Regular Fit? So wählst du Schnitt und Grösse beim Anzugkauf und erkennst, ob ein Anzug richtig sitzt.",
      teaser: "So findest du Schnitt und Grösse und erkennst, ob ein Anzug richtig sitzt.",
    },
    "business-dresscode-schweiz": {
      title: "Business-Dresscode in der Schweiz",
      description:
        "Business formal oder business casual? Was im Schweizer Büroalltag gilt, welche Farben passen und wie du Hemd und Krawatte kombinierst.",
      teaser: "Business formal und business casual: Farben, Hemden und Krawatten im Überblick.",
    },
    "abschlussfeier-outfit": {
      title: "Was trägt man zur Abschlussfeier, Matura oder Diplomfeier?",
      description:
        "Outfit für Abschlussfeier, Matura oder Diplomfeier: vom Anzug bis zur Kombination mit Sakko, mit Tipps zu Hemd, Schuhen und Farben.",
      teaser: "Anzug oder Kombination: Was zu Matura, Diplom- und Abschlussfeier passt.",
    },
    "anzug-pflegen": {
      title: "Anzug pflegen: lüften, bürsten, aufbewahren, reinigen",
      description:
        "So pflegst du deinen Anzug richtig: lüften, bürsten, Flecken behandeln, aufbewahren und wann die Reinigung sinnvoll ist.",
      teaser: "Lüften, bürsten, aufhängen, reinigen: So bleibt ein Anzug lange in Form.",
    },
    "stoffe-und-qualitaet": {
      title: "Stoffe und Qualität erklärt",
      description:
        "Schurwolle, Super-Zahlen, Tuchgewicht, Leinen, Baumwolle, Kaschmir und Futter einfach erklärt: So liest du die Materialangabe richtig.",
      teaser: "Schurwolle, Super-Zahlen, Tuchgewicht und Futter: die Materialangabe richtig lesen.",
    },
  },
  en: {
    "anzug-hochzeit": {
      title: "Wedding suit: what to wear as a guest or groom",
      description:
        "Which suit suits a wedding? Dress codes, colours by season, plus shoes and accessories for guests and grooms.",
      teaser: "Read the dress code, choose a colour by season, match shoes and accessories.",
    },
    "slim-fit-oder-regular-fit": {
      title: "Slim fit or regular fit: which cut suits you?",
      description:
        "Slim fit or regular fit? How to choose cut and size when buying a suit, and how to tell whether a suit fits properly.",
      teaser: "Find your cut and size, and learn to tell whether a suit fits properly.",
    },
    "business-dresscode-schweiz": {
      title: "Business dress code in Switzerland",
      description:
        "Business formal or business casual? What applies in Swiss offices, which colours work and how to combine shirt and tie.",
      teaser: "Business formal and business casual: colours, shirts and ties at a glance.",
    },
    "abschlussfeier-outfit": {
      title: "What to wear to a graduation, Matura or diploma ceremony",
      description:
        "Outfit for a graduation, Matura or diploma ceremony: from the full suit to a jacket combination, with tips on shirt, shoes and colours.",
      teaser: "Suit or combination: what works for Matura, diploma and graduation ceremonies.",
    },
    "anzug-pflegen": {
      title: "Suit care: airing, brushing, storing, cleaning",
      description:
        "How to look after your suit: airing, brushing, treating stains, storing it properly and when dry cleaning makes sense.",
      teaser: "Airing, brushing, hanging, cleaning: how a suit keeps its shape for years.",
    },
    "stoffe-und-qualitaet": {
      title: "Fabrics and quality explained",
      description:
        "Virgin wool, Super numbers, fabric weight, linen, cotton, cashmere and lining explained simply: how to read a material line properly.",
      teaser: "Virgin wool, Super numbers, fabric weight and lining: how to read a material line.",
    },
  },
};

/** Welche Ratgeber zu einer Kollektion oder einem Anlass gehören (für den kleinen Block unter den Produkten). */
export function guidesFor(handle: string, occasion?: string): GuideSlug[] {
  if (occasion === "hochzeit") return ["anzug-hochzeit", "slim-fit-oder-regular-fit"];
  if (occasion === "business") return ["business-dresscode-schweiz", "slim-fit-oder-regular-fit"];
  if (occasion === "abschlussfeier") return ["abschlussfeier-outfit", "slim-fit-oder-regular-fit"];
  if (handle === "anzuege")
    return [
      "anzug-hochzeit",
      "slim-fit-oder-regular-fit",
      "business-dresscode-schweiz",
      "anzug-pflegen",
      "stoffe-und-qualitaet",
    ];
  if (handle === "sakkos" || handle === "hosen" || handle === "westen")
    return ["slim-fit-oder-regular-fit", "anzug-pflegen", "stoffe-und-qualitaet"];
  if (handle === "hemden" || handle === "accessoires" || handle === "schuhe")
    return ["business-dresscode-schweiz", "anzug-hochzeit"];
  if (handle === "strick") return ["stoffe-und-qualitaet"];
  return [];
}
