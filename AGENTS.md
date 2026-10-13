<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# AXION architecture

- Keep brand, contact, launch, VAT, fulfilment and feature settings in `src/config/shop.ts` so client-confirmed values have one source.
- UI reads commerce data only through async exports from `src/lib/commerce/index.ts`; the catalogue comes from Supabase via `source.ts` (cached 30 s on the server), so page components never query tables directly.
- Commerce contracts live in `types.ts`, the Supabase row mapping in `mapping.ts`, and image metadata in `media.ts` to separate contracts from content.
- Store only variant identifiers/quantities and wishlist product handles in persisted Zustand stores; resolve all display data through the commerce adapter.
- Hydrate persisted stores after mounting, never during SSR, to keep server and browser output consistent.
- Use TanStack Query for initial catalogue reads and route loaders, and leaf-specific German metadata for every content route.
- Keep shared presentation in `src/components/shop`; lazily import the Three scene (3D logo in the brand section further down the home page, `brand-moment.tsx`) only after section visibility and browser capability checks.
- Motion respects reduced-motion preferences; the brand section shows the exact flat SVG when animation/WebGL is unavailable and pauses its canvas offscreen.
- The hero is a full-bleed photo (eager, high fetch priority) with an optional muted loop video from `site-media` (MP4/WebM up to 25 MB): `video` for computers and tablets, `video_mobile` (portrait) for phones; a phone without its own video shows the photo. The video loads only in the browser, never with reduced motion or data saver, pauses offscreen and has a pause/play button (WCAG 2.2.2). The photo stays underneath as fallback.
- Product page: three columns on desktop (text left, images centre, buy box right; text and buy box sticky), two on tablets, stacked on phones. Details come from `origin_*` and `features_*` (one feature per line, parsed by `featureList`); 2 or fewer in stock of the chosen size shows a hint (persistent `role="status"` region). Page changes use View Transitions only when the path changes (`defaultViewTransition` types in `src/router.tsx`; search and filter navigations also pass `viewTransition: false`; off with reduced motion).
- Sample range: 24 products tagged `muster` (card badge «Muster», notice on the product page) with illustrations from `src/assets/muster`, referenced as `asset:muster/<handle>-1|2`. `supabase/seed.sql` (local database, tests) and `supabase/demo/muster-einspielen.sql` (Cloud, to present the shop) hold the same products; `supabase/demo/muster-entfernen.sql` removes them before launch (the admin shows a «Muster» badge and a checkbox to keep a piece; demo sizes and images only attach to products tagged `muster`; `supabase/tests/demo-scripts.test.ts` runs both scripts on a fresh database). After changing the seed run `bun scripts/db/gen-sample-catalog.ts` (after `bun run db:reset`) to regenerate `src/lib/commerce/sample-catalog.ts`.
- `launched` controls metadata; after changing it regenerate `public/robots.txt` using `bun scripts/sync-robots.ts` before publishing so both protections stay aligned.
- Checkout always goes through the `checkout` Edge Function (stock reservation, Stripe Checkout); never hardcode payment links in the UI.
- Admin lives under `/admin` (role `admin` in `user_roles`); stock changes only via the `admin_adjust_stock` RPC, never by updating `product_variants.stock`.
- Edge Functions: see `supabase/functions/README.md`; secrets live in Cloud, never in the repo.
- The root `README.md` is the outdated first brief (no backend, sample data); this file, `docs/DEPLOYMENT.md` and `supabase/functions/README.md` describe the current shop.
- Backend is Lovable Cloud (region Europe). Migrations in `supabase/migrations/` are applied manually in order (Lovable does not run migration files from Git); never edit an applied migration, add a new one instead.
- Never edit the generated `src/integrations/supabase/client.ts`; `backendConfigured` and `supabaseUrl` live in `src/lib/backend.ts`.
- What runs in Cloud is `drizzle/migrations/` (written by Lovable's migration tool when Cloud was connected; same SQL as `supabase/migrations/` except `citext` → `text` with unique `lower(...)` indexes). `supabase/migrations/` stays the source for the local test database. A schema change needs a new file in both, applied once in Cloud.
- `supabase/config.toml` must keep `verify_jwt = false` for every function (they check callers themselves); Lovable dropped it once when connecting Cloud. Check it after Cloud changes and redeploy the functions if it was missing.
- Cloud lacks `citext` and rejects `INSERT INTO storage.buckets`: use text with a unique index on `lower(...)`; create buckets with the storage tool, their policies in a migration.
- The delivery area is the `SHIPPING_COUNTRIES` secret (default `CH`); adding `LI` requires the Liechtenstein clauses in the legal texts.
- English follows German in the admin: on save, `src/lib/admin/auto-translate.ts` fills empty English and re-translates machine English when the German changes, through `admin-actions` (`translate`, Lovable AI gateway, 500 requests per admin and day). Provenance is stored per field (`en_auto` columns on products, categories and product_images; `en_auto` list in `site_content` blocks; `auto` flag on announcement items and size-guide texts). English written or edited by hand is never overwritten or cleared; emptying an English field asks for a new translation. A failed translation clears only outdated machine English, so the shop shows German there.
- The complete outfit on the product page and the home look (buy the look next to the image: choose sizes, whole look or a selection into the cart) share `src/components/shop/outfit.ts`: available pieces are preselected, sold-out pieces cannot be chosen, nothing goes into the cart while a selected piece lacks an available size. Reset by remounting with `key={outfitKey(...)}`, so refetched identical data keeps the chosen sizes.
- Menus come from the active categories (`navQuery`); size charts from `site_content` key `size_guides` (Admin → Grössentabellen); shipping texts from `shop_settings` via `shippingLabel`; never hardcode «Gratisversand» in new UI.
- Legal and help pages exist in German (`pages.ts`) and English (`pages-en.ts`) with the same structure (a test enforces it); German is binding.
- The contact form posts to the `contact` Edge Function (`contact_guard`: 5 per IP or IPv6 /64 and 3 per address per hour, 20 per hour and 50 per day for everyone; messages are not stored, rate-limit keys only as hashes); all functions require `Content-Type: application/json` (415 otherwise). The admin order page prints a receipt (`components/admin/receipt.tsx`, named print page `receipt`).

- Search serialization uses plain string query values, with optional defaults resolved by consumers, to avoid redirecting clean URLs.
- Shared Dialog panels restore their external opener and initialise search focus; filter and occasion dropdowns use controlled non-modal Radix Popovers for keyboard and outside-click handling.
- Reveal visibility is controlled by the pre-paint html.js class and CSS reduced-motion media queries, so SSR content remains visible without JavaScript.
- Persisted-store screens await hydration and data resolution before showing an empty state, to prevent false empty flashes.
- Leaf metadata uses the configured site URL for canonical and structured-image URLs, keeping deployment-specific values centralised.
- Missing catalogue/product records use a leaf not-found component so their metadata executes alongside HTTP 404 rendering.
- Store client legal/help copy as structured page data in `src/content/pages.ts`; the shared renderer interpolates config values and detects placeholders at render time so content and draft status stay aligned.
