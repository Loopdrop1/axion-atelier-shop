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
- Keep shared presentation in `src/components/shop`; lazily import the Three scene only after hero visibility and browser capability checks.
- Motion respects reduced-motion preferences; the hero uses the exact flat SVG when animation/WebGL is unavailable and pauses its canvas offscreen.
- `launched` controls metadata; after changing it regenerate `public/robots.txt` using `bun scripts/sync-robots.ts` before publishing so both protections stay aligned.
- Checkout always goes through the `checkout` Edge Function (stock reservation, Stripe Checkout); never hardcode payment links in the UI.
- Admin lives under `/admin` (role `admin` in `user_roles`); stock changes only via the `admin_adjust_stock` RPC, never by updating `product_variants.stock`.
- Edge Functions are documented in `supabase/functions/README.md`, deployment in `docs/DEPLOYMENT.md`. Secrets never go into the repo.
- Backend is Lovable Cloud (region Europe). Migrations in `supabase/migrations/` are applied manually in order (Lovable does not run migration files from Git); never edit an applied migration, add a new one instead.
- Keep `src/integrations/supabase/client.ts` as is: it is SSR-safe, exports `backendConfigured` and works without env (preview); do not replace it with a generated client.
- The delivery area is the `SHIPPING_COUNTRIES` secret (default `CH`); adding `LI` requires the Liechtenstein clauses in the legal texts.
- English follows German in the admin: on save, `src/lib/admin/auto-translate.ts` translates new or changed German texts through `admin-actions` (`translate`, Lovable AI gateway); English edited by hand is never overwritten, and a failed translation leaves English empty so the shop shows German.
- Menus come from the active categories (`navQuery`); size charts from `site_content` key `size_guides` (Admin → Grössentabellen); shipping texts from `shop_settings` via `shippingLabel`; never hardcode «Gratisversand» in new UI.
- Legal and help pages exist in German (`pages.ts`) and English (`pages-en.ts`) with the same structure (a test enforces it); German is binding.
- The contact form posts to the `contact` Edge Function (rate-limited by `contact_guard`, nothing stored); the admin order page prints a receipt (`components/admin/receipt.tsx`).

- Search serialization uses plain string query values, with optional defaults resolved by consumers, to avoid redirecting clean URLs.
- Shared Dialog panels restore their external opener and initialise search focus; filter and occasion dropdowns use controlled non-modal Radix Popovers for keyboard and outside-click handling.
- Reveal visibility is controlled by the pre-paint html.js class and CSS reduced-motion media queries, so SSR content remains visible without JavaScript.
- Persisted-store screens await hydration and data resolution before showing an empty state, to prevent false empty flashes.
- Leaf metadata uses the configured site URL for canonical and structured-image URLs, keeping deployment-specific values centralised.
- Missing catalogue/product records use a leaf not-found component so their metadata executes alongside HTTP 404 rendering.
- Store client legal/help copy as structured page data in `src/content/pages.ts`; the shared renderer interpolates config values and detects placeholders at render time so content and draft status stay aligned.
