import { sampleCollections, sampleLook, sampleProducts } from './sample-data';
import { media } from './media';
import type { Cart, Product, ProductFilters } from './types';
export type * from './types';
export async function listCollections() { return sampleCollections; }
export async function getCollection(handle: string) { return sampleCollections.find(c => c.handle === handle); }
export async function listProducts(filters: ProductFilters = {}) {
 let products = sampleProducts.filter(p => {
  if (filters.collection && filters.collection !== 'alle' && !(p.category === filters.collection || p.tags.includes(filters.collection))) return false;
  if (filters.occasion && !p.occasions.some(o => o === filters.occasion)) return false;
  if (filters.sizes?.length && !p.variants.some(v => v.availableForSale && filters.sizes?.includes(v.title))) return false;
  if (filters.colors?.length && !filters.colors.includes(p.color.name)) return false;
  if (filters.fits?.length && (!p.fit || !filters.fits.includes(p.fit))) return false;
  if (filters.priceMax !== undefined && p.priceRange.min.amount > filters.priceMax) return false;
  return true;
 });
 products = [...products].sort((a,b) => filters.sort === 'price-asc' ? a.priceRange.min.amount-b.priceRange.min.amount : filters.sort === 'price-desc' ? b.priceRange.min.amount-a.priceRange.min.amount : b.createdAt.localeCompare(a.createdAt));
 return products;
}
export async function getProduct(handle: string) { return sampleProducts.find(p => p.handle === handle); }
export async function getProductsByHandles(handles: string[]) { return handles.flatMap(h => { const p=sampleProducts.find(p=>p.handle===h); return p ? [p] : []; }); }
export async function searchProducts(query: string) { const q=query.trim().toLocaleLowerCase('de-CH'); return q ? sampleProducts.filter(p=>`${p.title} ${p.category} ${p.color.name} ${p.category === 'anzuege' ? 'Anzüge' : ''}`.toLocaleLowerCase('de-CH').includes(q)) : []; }
export async function getRecommendations(handle: string, count: number) { return (await listProducts()).filter(p=>p.handle!==handle).slice(0,count); }
export async function getSiblings(product: Product) { return sampleProducts.filter(p=>p.model===product.model); }
export async function getEditorial() { return { look: sampleLook, fabric: media.fabric }; }
export async function resolveCart(lines: { variantId: string; quantity: number }[]): Promise<Cart> {
 const resolved = lines.flatMap(line => { const product=sampleProducts.find(p=>p.variants.some(v=>v.id===line.variantId)); const variant=product?.variants.find(v=>v.id===line.variantId); return product && variant ? [{...line,product,variant}] : []; });
 return { lines: resolved, subtotal: { amount: resolved.reduce((s,l)=>s+l.variant.price.amount*l.quantity,0), currencyCode:'CHF' }, checkoutUrl:null };
}
