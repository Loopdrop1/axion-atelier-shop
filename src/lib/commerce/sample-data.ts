import { media } from './media';
import type { Collection, Money, Product } from './types';
// Beispieldaten: Produkte, Verfügbarkeit, Zeitstempel und Preise sind Platzhalter.
const money = (amount: number): Money => ({ amount, currencyCode: 'CHF' });
type Seed = Omit<Product, 'id' | 'variants' | 'options' | 'priceRange' | 'details'> & { amount: number };
function makeProduct(seed: Seed, index: number): Product {
 const { amount, ...data } = seed;
 const sizes = data.category === 'schuhe' ? ['40','41','42','43','44','45','46'] : ['46','48','50','52','54','56'];
 return { ...data, id: data.handle, details: { material: 'Angaben folgen', care: 'Angaben folgen', fit: data.fit || 'Angaben folgen' },
 options: [{ name: 'Grösse', values: sizes }, { name: 'Farbe', values: [data.color.name] }],
 variants: sizes.map((size, i) => ({ id: `${data.handle}-${size}`, title: size, availableForSale: i !== (index + 3) % sizes.length && !(index === 0 && i === 5), price: money(amount), compareAtPrice: data.compareAtPrice, selectedOptions: [{ name: 'Grösse', value: size }, { name: 'Farbe', value: data.color.name }] })),
 priceRange: { min: money(amount), max: money(amount) } };
}
export const sampleProducts: Product[] = [
 { handle: 'anzug-limmat-marine', title: 'Anzug «Limmat»', category: 'anzuege', model: 'anzug-limmat', color: { name: 'Marine', hex: '#243448' }, fit: 'Slim Fit', amount: 489, tags: ['neu'], occasions: ['hochzeit','business'], description: 'Der Anzug «Limmat» besteht aus Sakko und Hose. Kombiniere ihn mit der passenden Weste zu einem Dreiteiler.', images: [media.suit, media.modelSuit], outfitHandles: ['weste-limmat-marine','oxford-nero-schwarz'], createdAt: '2026-10-06' },
 { handle: 'anzug-aare-anthrazit', title: 'Anzug «Aare»', category: 'anzuege', model: 'anzug-aare', color: { name: 'Anthrazit', hex: '#484946' }, fit: 'Regular Fit', amount: 459, tags: [], occasions: ['business','gala'], description: 'Der Anzug «Aare» kombiniert ein Sakko mit einer passenden Hose. Anthrazit lässt sich mit hellen Hemden und dunklen Schuhen ergänzen.', images: [media.charcoal], outfitHandles: ['weste-limmat-salbeigruen','derby-lino-braun'], createdAt: '2026-10-03' },
 { handle: 'weste-limmat-marine', title: 'Weste «Limmat»', category: 'westen', model: 'weste-limmat', color: { name: 'Marine', hex: '#243448' }, amount: 129, tags: ['neu'], occasions: ['hochzeit','business'], description: 'Die Weste «Limmat» ergänzt den marineblauen Anzug. Du kannst sie auch einzeln über einem Hemd tragen.', images: [media.vest], outfitHandles: ['anzug-limmat-marine','oxford-nero-schwarz'], createdAt: '2026-10-05' },
 { handle: 'weste-limmat-salbeigruen', title: 'Weste «Limmat»', category: 'westen', model: 'weste-limmat', color: { name: 'Salbeigrün', hex: '#929881' }, amount: 129, compareAtPrice: money(159), tags: ['sale'], occasions: ['hochzeit','abschlussfeier'], description: 'Die Weste «Limmat» in Salbeigrün setzt einen hellen Farbakzent. Kombiniere sie mit einem weissen Hemd und einer Anzughose.', images: [media.sage, media.modelVest], outfitHandles: ['anzug-aare-anthrazit','derby-lino-braun'], createdAt: '2026-10-01' },
 { handle: 'derby-lino-braun', title: 'Derby «Lino»', category: 'schuhe', model: 'derby-lino', color: { name: 'Braun', hex: '#825834' }, amount: 219, tags: ['neu'], occasions: ['business','hochzeit'], description: 'Der Derby «Lino» zeigt eine offene Schnürung. Der braune Farbton ergänzt dunkle und helle Anzughosen.', images: [media.derby, media.modelShoes], outfitHandles: [], createdAt: '2026-10-04' },
 { handle: 'oxford-nero-schwarz', title: 'Oxford «Nero»', category: 'schuhe', model: 'oxford-nero', color: { name: 'Schwarz', hex: '#20211F' }, amount: 239, tags: ['neu'], occasions: ['gala','business','abschlussfeier'], description: 'Der Oxford «Nero» hat eine geschlossene Schnürung. Seine schwarze Farbe lässt sich mit den Anzügen der Kollektion kombinieren.', images: [media.oxford], outfitHandles: [], createdAt: '2026-10-02' },
].map((seed, index) => makeProduct(seed as Seed, index));
export const sampleCollections: Collection[] = [
 { handle:'alle',title:'Die Kollektion',description:'Anzüge, Westen und Schuhe. Finde die Stücke für deinen Auftritt.' },
 { handle:'neu',title:'Neu eingetroffen',description:'Neue Stücke. Neue Kombinationen.' },
 { handle:'anzuege',title:'Anzüge',description:'Klare Schnitte für die besonderen und die alltäglichen Momente.',image:media.modelSuit },
 { handle:'westen',title:'Westen',description:'Einzeln getragen. Oder als Teil des Ganzen.',image:media.modelVest },
 { handle:'schuhe',title:'Schuhe',description:'Der passende Abschluss für deinen Auftritt.',image:media.modelShoes },
 { handle:'sale',title:'Ausgewählte Stücke',description:'Anzüge, Westen und Schuhe zu reduzierten Preisen.' },
];
export const sampleLook = { image: media.look, hotspots: [{ handle:'anzug-limmat-marine',label:'Sakko',x:37,y:25 },{ handle:'weste-limmat-marine',label:'Weste',x:50,y:31 },{ handle:'oxford-nero-schwarz',label:'Schuhe',x:47,y:89 }] };
