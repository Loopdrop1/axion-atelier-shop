export interface Money {
  amount: number;
  currencyCode: "CHF";
}
export interface ShopImage {
  url: string;
  altText: string;
  width: number;
  height: number;
}
export interface Variant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice?: Money | undefined;
  selectedOptions: { name: string; value: string }[];
}
export type Occasion = "hochzeit" | "business" | "abschlussfeier" | "gala";
export interface Product {
  id: string;
  handle: string;
  title: string;
  category: "anzuege" | "westen" | "schuhe";
  model: string;
  color: { name: string; hex: string };
  fit?: string;
  tags: string[];
  occasions: Occasion[];
  description: string;
  details: { material?: string; care?: string; fit?: string };
  images: ShopImage[];
  options: { name: "Grösse" | "Farbe"; values: string[] }[];
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
