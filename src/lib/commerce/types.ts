export interface Money {
  amount: number;
  currencyCode: "CHF";
}
export interface ShopImage {
  url: string;
  altText: string;
  width: number;
  height: number;
  /** Eigenes Bild fürs Handy (z. B. hoch statt quer), freiwillig */
  mobile?:
    | {
        url: string;
        width: number;
        height: number;
        variants?: { url: string; width: number }[] | undefined;
      }
    | undefined;
  /** Verkleinerte Fassungen (WebP) fürs srcset, freiwillig; ohne sie bleibt es beim einen Bild */
  variants?: { url: string; width: number }[] | undefined;
}
export interface Variant {
  id: string;
  title: string;
  availableForSale: boolean;
  /** Bestand dieser Grösse (für «Nur noch 2 an Lager») */
  stock: number;
  price: Money;
  compareAtPrice?: Money | undefined;
  /** Artikelnummer und Barcode (GTIN) der Grösse, freiwillig; nur für den Produktfeed */
  sku?: string | undefined;
  barcode?: string | undefined;
  selectedOptions: { name: string; value: string }[];
}
export type Occasion = "hochzeit" | "business" | "abschlussfeier" | "gala";
export interface Product {
  id: string;
  handle: string;
  title: string;
  /** Slug der Kategorie, z. B. «anzuege» */
  category: string;
  /** Name der Kategorie in der aktuellen Sprache */
  categoryTitle: string;
  model: string;
  color: { name: string; hex: string };
  /** Passform als Code («Slim Fit», «Regular Fit»), Anzeige über die Übersetzungen */
  fit?: string | undefined;
  tags: string[];
  occasions: Occasion[];
  description: string;
  details: {
    material?: string | undefined;
    care?: string | undefined;
    fit?: string | undefined;
    /** Herkunft, z. B. «Gefertigt in Italien» */
    origin?: string | undefined;
    /** Ausstattung, ein Merkmal pro Eintrag */
    features: string[];
  };
  images: ShopImage[];
  options: { name: "size" | "color"; values: string[] }[];
  variants: Variant[];
  priceRange: { min: Money; max: Money };
  compareAtPrice?: Money | undefined;
  outfitHandles: string[];
  createdAt: string;
}
export interface Collection {
  handle: string;
  title: string;
  description: string;
  image?: ShopImage;
}
export interface CartLine {
  variantId: string;
  quantity: number;
  product: Product;
  variant: Variant;
}
export interface Cart {
  lines: CartLine[];
  subtotal: Money;
  checkoutUrl: string | null;
}
export interface ProductFilters {
  collection?: string | undefined;
  occasion?: string | undefined;
  sizes?: string[] | undefined;
  colors?: string[] | undefined;
  fits?: string[] | undefined;
  priceMax?: number | undefined;
  sort?: "newest" | "price-asc" | "price-desc" | undefined;
}
export interface Hotspot {
  handle: string;
  /** Sprachneutraler Schlüssel für die Platzierung der Karte (CSS) */
  key: string;
  label: string;
  x: number;
  y: number;
}
/** Texte und Bilder der Startseite (im Admin bearbeitbar), bereits in der aktuellen Sprache. */
export interface HomeContent {
  hero: {
    eyebrow: string;
    title: string;
    text: string;
    primary: string;
    secondary: string;
    /** Bild über die ganze Breite (mit eigenem Handy-Bild, falls im Admin hinterlegt) */
    image: ShopImage;
    /** Video statt Bild (läuft stumm in Schleife; das Bild ist Vorschau und Rückfall) */
    /** Mindestens eine Adresse; aufs Handy nur `mobileUrl`, am Computer nur `url` */
    video?: { url?: string | undefined; mobileUrl?: string | undefined } | undefined;
  };
  /** Marken-Abschnitt mit dem 3D-Logo */
  brand: { eyebrow: string; title: string };
  collections: { eyebrow: string; title: string };
  newArrivals: { eyebrow: string; title: string; link: string };
  look: {
    image: ShopImage;
    hotspots: Hotspot[];
    eyebrow: string;
    title: string;
    text: string;
    /** Text vor der Summe, wenn alle Stücke des Looks ausgewählt sind */
    total: string;
  };
  occasions: { eyebrow: string; title: string; texts: Record<string, string> };
  story: { image: ShopImage; eyebrow: string; title: string; text: string; link: string };
}
export interface Editorial {
  look: { image: ShopImage; hotspots: Hotspot[] };
  fabric: ShopImage;
}
