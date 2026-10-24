# Axion Atelier Shop

Build the online shop for **AXION**, a Swiss menswear brand that sells suits, waistcoats and shoes. This is a real client project, not a template. Quality bar: a calm, premium fashion shop (think COS or Arket), mobile first, with refined motion and one signature 3D moment. Read everything below before you start.

## Ground rules
1. **No backend now.** Do not enable or connect any integration, database, auth, payment or commerce service. Use typed local sample data behind a small data-access layer (spec below). A headless commerce backend with cart API and hosted checkout will replace that layer later, so keep every data function async and keep UI code away from the raw data.
2. **Language:** all UI text in Swiss Standard German (de-CH). Never use "ß", always "ss". Use «guillemets» for quotes. Write "gratis", never "kostenlos". Address customers with "du". No English words in the UI except brand names.
3. **No invented facts.** No founding year, no production country, no quality claims, no reviews, ratings, testimonials, customer counts or awards. Product data is sample data: mark it in code comments as `Beispieldaten`.
4. **Prices** always via `Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' })` (gives "CHF 489.00"). Do not show "inkl. MWST" (VAT status still open, controlled by a config flag `vatRegistered: false`; when true show "inkl. MWST").
5. **Not public yet:** add `<meta name="robots" content="noindex, nofollow">` on every page and a `public/robots.txt` with `Disallow: /`, both controlled by `launched: false` in the config.
6. Use the logo SVGs below exactly as given (inline React components with `currentColor`). Do not redraw, retype or approximate them.

## Brand and design system
Colours (define as CSS variables and Tailwind theme tokens):
- `--green` Tannengrün #1E3A2F (primary, buttons, logo on light)
- `--deep` Tiefgrün #12261D (dark sections, footer, hero)
- `--sand` Sand #E9E1D2 (logo and text on dark, image backgrounds)
- `--paper` Papier #F5F1E8 (page background)
- `--gold` Messing #B8955A (accent only: small labels, hover lines, active states, hotspots; never large areas, never body text)
- `--ink` #141414 (text), `--muted` #6B6A62 (secondary text), `--line` #DCD5C8 (hairlines)

Type (self-host with @fontsource, no Google Fonts request):
- Display and navigation: **Jost** (variable), weight 400 to 500, headlines tracking -0.02em. Eyebrow labels: Jost 500, 12px, uppercase, tracking 0.18em, colour gold on dark and green on light.
- Body and UI: **Inter** (variable), 16px, line-height 1.6. Prices with `tabular-nums`.
- Headline scale: h1 clamp(2.6rem, 6vw, 5.4rem); h2 clamp(1.9rem, 3.6vw, 3rem); h3 1.25rem.

Shape and layout:
- Sharp, tailored look: border-radius 0 for buttons, inputs, images and cards (max 2px). No drop shadows except the cart drawer. No gradients except a very subtle radial glow in the hero. No glassmorphism, no emojis, no icon clutter.
- Max content width 1440px, side padding 20px mobile, 40px tablet, 64px desktop. Generous vertical rhythm: sections 96px to 160px apart on desktop, 64px to 96px on mobile.
- Buttons: height 52px, Jost 500 13px uppercase, tracking 0.14em. Primary: green background, paper text, on hover deep green plus a gold 1px line that grows from left to right under the label. Secondary: 1px ink outline, transparent. On dark backgrounds: sand background, green text.
- Hairlines in `--line`, 1px.
- Icons: lucide-react, stroke width 1.5, 20px.
- Focus states clearly visible (2px gold outline, offset 3px). WCAG AA contrast for all text.

## Motion (use the `motion` library, `motion/react`)
- Scroll reveals: images reveal with a clip-path from the bottom (inset 100% to 0) over 0.9s, easing [0.22, 1, 0.36, 1]; text fades up 16px with 60ms stagger. Each element animates once.
- Product cards: on hover the second image crossfades in (0.5s) and the image scales to 1.03; a "Grösse wählen" bar slides up from the bottom of the image (desktop only).
- Header: transparent over the home hero (sand logo and links), turns solid paper with green content after 40px of scroll, hides when scrolling down, comes back when scrolling up. Solid on all other pages.
- Page transitions: content fades in (0.35s), no sliding of the whole page.
- Drawers (cart, filters, mobile menu, size guide): slide in 0.45s with the same easing, backdrop fades.
- Mobile menu: full screen deep green, large Jost links that stagger in.
- Respect `prefers-reduced-motion`: no reveals, no parallax, no 3D rotation, only opacity changes.
- No layout shift: reserve image space with aspect ratios.

## Signature moment: 3D logo in the hero
Home hero: full viewport height on desktop (min 640px), 88svh on mobile, background `--deep` with a very subtle radial glow behind the mark and a faint film-grain overlay (CSS, SVG noise).
- Render the AXION mark (SVG path below) as a real 3D object with three.js via `@react-three/fiber` and `@react-three/drei`: parse the path with three's `SVGLoader`, `createShapes`, then `ExtrudeGeometry` (depth about 12% of the mark height, bevel on: thickness and size about 1%, 6 bevel segments, 48 curve segments). Flip Y (SVG is y-down), centre the geometry.
- Material: brushed brass, `MeshPhysicalMaterial` colour #B8955A, metalness 0.9, roughness 0.3, clearcoat 0.2. Lighting without network requests: drei `Environment` built only from local `Lightformer`s (no HDR presets that download files), one warm key light from upper left.
- Animation: intro over 1.6s (rises 10% and turns in from -25 deg yaw), then a slow idle yaw oscillation of +-14 deg (period about 9s), plus damped pointer parallax (max 10 deg). On scroll through the hero the mark scales to 0.9 and moves up slightly.
- Performance: load the 3D scene lazily (dynamic import after first paint, only when the hero is visible), dpr capped at 1.75, pause rendering when the hero is off screen or the tab is hidden. Until it is ready, and when WebGL is unavailable or reduced motion is on, show the flat SVG mark in brass colour in exactly the same place (no layout jump). Canvas is `aria-hidden`.
- Layout: desktop two columns (text left, mark right, mark about 60vh tall); mobile mark on top (about 38svh), text below.
- Hero text: eyebrow "Anzüge · Westen · Schuhe". H1 "Präzise geschnitten. Für jeden Auftritt." Text: "Anzüge, Westen und Schuhe für Hochzeit, Business und alles dazwischen. Gratisversand in der ganzen Schweiz." Buttons: "Kollektion entdecken" (to /kollektion/alle) and "Anzüge ansehen" (to /kollektion/anzuege). A thin animated scroll cue at the bottom.

## Pages and routes
- `/` Startseite
- `/kollektion/$handle` with handles `alle`, `neu`, `anzuege`, `westen`, `schuhe`, `sale`, and an optional `?anlass=` filter (hochzeit, business, abschlussfeier, gala)
- `/produkt/$handle`
- `/warenkorb`, `/merkliste`, `/suche?q=`
- `/ueber-uns`, `/haeufige-fragen`, `/kontakt`, `/groessenberatung`, `/versand-und-rueckgabe`
- `/impressum`, `/datenschutz`, `/agb`
- Designed 404 page with links back to the collections
Every route sets a German `<title>` ("… · Axion") and meta description, and has exactly one h1.

### Startseite (top to bottom)
1. Announcement bar (deep green, sand text, 12px): rotates slowly between "Gratisversand in der ganzen Schweiz", "Lieferung in 2 bis 5 Arbeitstagen", "Bezahlen mit TWINT, Karte, Apple Pay oder Klarna". Texts come from the config.
2. Header: logo left (mark plus wordmark, see logo section), centre nav on desktop: Neu, Anzüge, Westen, Schuhe, Anlässe (dropdown: Hochzeit, Business, Abschlussfeier, Gala), Sale. Right: search, Merkliste (heart with count), Warenkorb (bag with count). Mobile: burger left, logo centre, search and bag right.
3. Hero with the 3D mark (above).
4. Kategorien: three tall tiles (4:5) Anzüge, Westen, Schuhe with image, title and "Entdecken" link; on hover the image zooms slowly and a gold line grows under the title. On mobile a horizontal snap scroller with the next tile peeking in.
5. "Neu eingetroffen": product carousel (embla), 4 cards visible on desktop, 1.6 on mobile, arrows on desktop, link "Alle Neuheiten".
6. "Komplettes Outfit" (shop the look): large editorial image (look image) on one side with 3 pulsing gold hotspots (Sakko, Weste, Schuhe, positions in percent from data). Clicking a hotspot opens a small card (image, name, price, "Ansehen"). On the other side the three items as a list with prices and the sum "Ganzes Outfit ab CHF …", button "Outfit zusammenstellen" linking to the suit's product page anchor `#outfit`.
7. Anlässe: four large text links in a row (Hochzeit, Business, Abschlussfeier, Gala) with a short line each; hover moves an arrow and changes the colour to gold. Links to `/kollektion/alle?anlass=…`.
8. Vorteile: a hairline-separated row with four items and icons: "Gratisversand in der Schweiz", "Lieferung in 2 bis 5 Arbeitstagen", "TWINT, Karte, Apple Pay, Klarna", "Rückgabe innert 14 Tagen" (return days from config, `returnDays: 14`, still to be confirmed by the client).
9. Über-uns-Teaser: image (fabric detail) and short neutral text: "Axion steht für klare Schnitte und Stücke, die zusammenpassen. Kombiniere Anzug, Weste und Schuhe zu deinem Auftritt." Link "Über uns".
10. Footer (deep green, sand text): small vertical logo, columns "Shop" (categories), "Hilfe" (Versand und Rückgabe, Grössenberatung, Häufige Fragen, Kontakt), "Rechtliches" (Impressum, Datenschutz, AGB); a row of payment method badges as plain text badges with a 1px sand border (TWINT, Visa, Mastercard, American Express, Apple Pay, Google Pay, Klarna; no brand logos); bottom line "© 2026 Axion" and on the right "Made by Flowrenix.com" linking to https://flowrenix.com (target _blank, rel noopener). This credit must stay on every page.
Feature flags in the config (all false for now, render nothing when false): `newsletter`, `pickup` (Abholung in der Autolounge), `reviews`, `customerAccounts`, `giftCards`, `backInStock`.

### Kollektion
Title, short intro, product count. Filter bar: Grösse, Farbe, Preis (range), Passform, Anlass; sort: Neuheiten, Preis aufsteigend, Preis absteigend. Desktop: filters as dropdown chips in a sticky bar; mobile: "Filtern und sortieren" button opening a bottom drawer. Active filters as removable chips. Filters and sort live in the URL search params. Grid: 2 columns mobile (gap 12px), 3 on tablet, 4 on desktop. Empty state with "Filter zurücksetzen".

### Produktkarte
Image 4:5 on sand background, second image on hover, heart (Merkliste) top right, badge "Neu" or "Sale" top left (small, Jost uppercase). Below: name, colour and fit in muted text, price (sale: new price in ink, old price struck through in muted). Desktop hover: size chips for quick add (sold-out sizes disabled and struck through); clicking a size adds to cart and opens the cart drawer.

### Produktseite
- Desktop: gallery left (large images stacked vertically, click opens a full-screen zoom viewer with swipe and pinch), info column right, sticky. Mobile: swipeable gallery with dots, then info.
- Info: breadcrumb, name (h1), colour, price, colour swatches (link to sibling products of the same model), size grid (46 to 56, shoes EU 40 to 46; sold-out sizes struck through and disabled), link "Grössentabelle" opening the size guide drawer, "In den Warenkorb" (disabled with hint "Bitte Grösse wählen" until a size is chosen), heart button. Delivery note: "Gratisversand in der Schweiz · Lieferung in 2 bis 5 Arbeitstagen".
- Accordions: Beschreibung, Material und Pflege, Passform, Versand und Rückgabe.
- Section `#outfit` "Komplettes Outfit": the complementary products (from `outfitHandles`) each with a size select and a checkbox, total price, button "Auswahl in den Warenkorb".
- "Das könnte dir auch gefallen": 4 recommendations.
- Mobile: sticky bottom bar with price and "In den Warenkorb" once the main button scrolls out of view.
- JSON-LD Product data (name, image, offers in CHF, availability).

### Warenkorb
Cart drawer from the right (opens after adding) and a full page `/warenkorb`. Line items with image, name, colour, size, quantity stepper, remove; subtotal; line "Versand: gratis"; button "Zur Kasse". The checkout URL comes from the data layer; in sample mode it is null, so the button is disabled with the small note "Die Kasse wird beim Livegang verbunden." Empty state with links to the collections. Persist the cart in localStorage.

### Suche
Search overlay (header icon, also Ctrl/Cmd+K) with instant results while typing (name, category, colour), keyboard navigation, link "Alle Ergebnisse" to `/suche?q=`.

### Merkliste
Heart toggles everywhere, stored in localStorage, page `/merkliste` with grid and empty state.

### Content pages
- `/groessenberatung`: size table for suits and waistcoats (46 to 56: Brustumfang, Taillenumfang, Körpergrösse) and shoes (EU 40 to 46: Fusslänge in cm). Mark the values clearly as "Beispielwerte, werden ersetzt". The same table appears in the size guide drawer.
- `/versand-und-rueckgabe`, `/haeufige-fragen` (accordion: Grössen, Lieferung, Rückgabe, Zahlung, Pflege), `/ueber-uns`, `/kontakt` (show e-mail and phone from config as links, no form), `/impressum`, `/datenschutz`, `/agb`: clean text layout (max 68ch), headings in place, and a visible placeholder box "Inhalt folgt vor dem Livegang" where real content is still missing. Values like company name, address, e-mail, UID come from the config with obvious placeholders like `[Firmenname]`.

## Data layer
- `src/config/shop.ts`: brand, contact (placeholders), announcement texts, `shipping` (free in CH, 2 to 5 working days), `returnDays: 14`, payment methods list, feature flags, `vatRegistered: false`, `launched: false`.
- `src/lib/commerce/types.ts`: `Money { amount: number; currencyCode: 'CHF' }`, `ShopImage { url, altText, width, height }`, `Variant { id, title, availableForSale, price, compareAtPrice?, selectedOptions: { name, value }[] }`, `Product { id, handle, title, category: 'anzuege' | 'westen' | 'schuhe', model (shared by colour siblings), color: { name, hex }, fit?, tags: string[] (e.g. 'neu'), occasions: ('hochzeit' | 'business' | 'abschlussfeier' | 'gala')[], description, details: { material?, care?, fit? }, images: ShopImage[], options: { name: 'Grösse' | 'Farbe', values: string[] }[], variants: Variant[], priceRange: { min: Money, max: Money }, compareAtPrice?: Money, outfitHandles: string[], createdAt }`, `Collection { handle, title, description, image? }`, `Cart { lines, subtotal, checkoutUrl: string | null }`.
- `src/lib/commerce/index.ts` exports async functions: `listCollections`, `getCollection(handle)`, `listProducts({ collection, occasion, sizes, colors, fits, priceMax, sort })`, `getProduct(handle)`, `getProductsByHandles(handles)`, `searchProducts(query)`, `getRecommendations(handle, count)`, `getSiblings(product)`. Today they read `src/lib/commerce/sample-data.ts`. UI code imports only from `src/lib/commerce`.
- Cart and Merkliste as small stores (zustand with persist) that store variant ids and quantities and resolve product data through the data layer.
- Sample data (`Beispieldaten`, prices are placeholders), six products with these handles:
  - `anzug-limmat-marine`: Anzug «Limmat», Marine, Slim Fit, CHF 489.00, tags neu, occasions hochzeit and business, outfit: `weste-limmat-marine`, `oxford-nero-schwarz`. Images 1 and 7.
  - `anzug-aare-anthrazit`: Anzug «Aare», Anthrazit, Regular Fit, CHF 459.00, occasions business and gala, outfit: `weste-limmat-salbeigruen`, `derby-lino-braun`. Image 2.
  - `weste-limmat-marine`: Weste «Limmat», Marine, CHF 129.00, tags neu, occasions hochzeit and business, outfit: `anzug-limmat-marine`, `oxford-nero-schwarz`. Image 3.
  - `weste-limmat-salbeigruen`: Weste «Limmat», Salbeigrün, CHF 129.00 with compareAtPrice CHF 159.00, tags sale, occasions hochzeit and abschlussfeier, outfit: `anzug-aare-anthrazit`, `derby-lino-braun`. Images 4 and 8. Same model as the marine waistcoat, so the two are colour siblings.
  - `derby-lino-braun`: Derby «Lino», Braun, CHF 219.00, tags neu, occasions business and hochzeit. Images 5 and 9.
  - `oxford-nero-schwarz`: Oxford «Nero», Schwarz, CHF 239.00, tags neu, occasions gala, business and abschlussfeier. Image 6.
  - Sizes: suits and waistcoats 46, 48, 50, 52, 54, 56 (one or two sizes sold out per product); shoes 40 to 46 (one size sold out).
  - Descriptions: two neutral sentences each, no material or origin claims; `details.material` and `details.care` = "Angaben folgen".
  - "Neu eingetroffen" on the home page shows all products sorted by `createdAt`; `/kollektion/neu` shows products tagged neu; `/kollektion/sale` products tagged sale.
  - Shop-the-look data: look image (10) with hotspots for `anzug-limmat-marine`, `weste-limmat-marine` and `oxford-nero-schwarz`; place the hotspots on the jacket, the waistcoat and the shoes of the generated image (positions in percent, adjust them to the actual picture).

## Images
Generate these photographs with your image generation and save them in `src/assets/` (list them in one `media.ts` with alt texts in German, width and height). Consistent style for all: high-end editorial menswear photography, soft natural light, muted palette of deep forest green, sand beige and warm brass, clean warm off-white or sand studio background, no text, no logos, no visible faces (crop at the chin or show from the shoulders down), realistic fabric.
1. `product-anzug-marine.jpg` navy two-piece suit on an invisible mannequin, front view, 4:5
2. `product-anzug-anthrazit.jpg` charcoal two-piece suit on an invisible mannequin, 4:5
3. `product-weste-marine.jpg` navy waistcoat on an invisible mannequin, 4:5
4. `product-weste-salbei.jpg` sage green waistcoat on an invisible mannequin, 4:5
5. `product-derby-braun.jpg` pair of brown leather derby shoes, three-quarter view on sand, 4:5
6. `product-oxford-schwarz.jpg` pair of black leather oxford shoes, three-quarter view on sand, 4:5
7. `model-anzug.jpg` man in a navy suit, standing, cropped at the chin, sand studio, 4:5 (second image of Anzug «Limmat» Marine, category tile Anzüge)
8. `model-weste.jpg` man in white shirt and sage waistcoat, cropped at the chin, 4:5 (category tile Westen)
9. `model-schuhe.jpg` close-up of trouser hems and brown derby shoes on a light stone floor, 4:5 (category tile Schuhe, second image of Derby «Lino»)
10. `look-outfit.jpg` editorial full-length look: navy three-piece suit with black oxford shoes in a bright stone hallway with green plants, cropped at the chin, 3:4 (shop the look)
11. `detail-stoff.jpg` macro of wool suiting fabric with a brass-coloured button, warm light, 3:2 (Über-uns-Teaser)

## Logo (use exactly, as React components with `fill="currentColor"`)
Mark (viewBox 0 0 1115.2 1000):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1115.2 1000" fill="currentColor"><path d="M613.1 0L964.4 846.5C990.7 910 1037.3 1000 1115.2 1000L801.2 1000C837.9 1000 823.9 933.2 810.8 901.5L516.2 191.8ZM565.3 478.2C403.6 500.4 277.2 636.6 205.4 773.4C167.9 844.9 133.2 917.9 65.2 965.8C49.8 976.6 19.2 1000 0 1000L447.4 1000C437.8 1000 419 985.7 410.7 980.4C364.3 950.5 340 898.8 339.9 844.4C339.5 737.2 400.6 618.9 475.4 544.6C492.9 527.2 511.7 511.7 532.3 498.2C541.9 492 558.3 487.2 565.3 478.2Z"/></svg>
```
Wordmark AXION (viewBox 0 0 6712.9 1050, keep `fill-rule="evenodd"`):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6712.9 1050" fill="currentColor"><path fill-rule="evenodd" d="M0 1025L560 7L1120 1025L966.6 1025L560 285.8L153.4 1025ZM1620 25L1793 25L2111.4 418.2L2429.9 25L2602.9 25L2197.9 525L2602.9 1025L2429.9 1025L2111.4 631.8L1793 1025L1620 1025L2025 525ZM3362.9 1025L3362.9 25L3222.9 25L3222.9 1025ZM4042.9 525a525 525 0 1 0 1050 0a525 525 0 1 0 -1050 0ZM4187.1 525a380.8 380.8 0 1 0 761.6 0a380.8 380.8 0 1 0 -761.6 0ZM6712.9 1043L5912.9 315.9L5912.9 1025L5772.9 1025L5772.9 7L6572.9 734.1L6572.9 25L6712.9 25Z"/></svg>
```
- Header logo: mark (height 30px desktop, 26px mobile) and wordmark (height 13px desktop, 11px mobile) side by side, gap 12px, vertically centred; `aria-label="Axion Startseite"`.
- Footer: mark 56px high above the wordmark (wordmark 15px high), centred.
- Favicon: create `public/favicon.svg` as a square: rect with rx 180 in #1E3A2F (viewBox 0 0 1000 1000), the mark in #E9E1D2 centred at 64% of the size. Link it in the document head.

## Code quality
TypeScript strict, small components, one responsibility each. Shared UI parts in `src/components/shop/`. No unused dependencies, no console errors or warnings, no horizontal scroll at 360px width. Use semantic HTML (header, nav, main, footer, buttons for actions, links for navigation), alt texts in German, keyboard support for drawers, dropdowns, gallery and search (Escape closes, focus is trapped and restored). Add a short `AGENTS.md` that explains the architecture (config, data layer, stores, motion rules, how to replace the sample data). Add vitest tests for the price formatter and for `listProducts` filtering and sorting.

When you are done, reply with a short list of what you built and any deviations from this brief.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/81384fd7-77a8-4809-b8c3-48b5a9ee05e8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
