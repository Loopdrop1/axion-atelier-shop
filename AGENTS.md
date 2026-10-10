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
- UI reads commerce data only through async exports from `src/lib/commerce/index.ts`; replace its sample adapter with headless commerce calls without changing page components.
- Commerce contracts live in `types.ts`, sample products in `sample-data.ts`, and image metadata in `media.ts` to separate contracts from content.
- Store only variant identifiers/quantities and wishlist product handles in persisted Zustand stores; resolve all display data through the commerce adapter.
- Hydrate persisted stores after mounting, never during SSR, to keep server and browser output consistent.
- Use TanStack Query for initial catalogue reads and route loaders, and leaf-specific German metadata for every content route.
- Keep shared presentation in `src/components/shop`; lazily import the Three scene only after hero visibility and browser capability checks.
- Motion respects reduced-motion preferences; the hero uses the exact flat SVG when animation/WebGL is unavailable and pauses its canvas offscreen.
- `launched` controls metadata; after changing it regenerate `public/robots.txt` using `bun scripts/sync-robots.ts` before publishing so both protections stay aligned.
- Cart checkout is null in sample mode; hosted checkout must come from the future commerce adapter, never a UI hardcoded link.

- Search serialization uses plain string query values, with optional defaults resolved by consumers, to avoid redirecting clean URLs.
- Shared Dialog panels restore their external opener and initialise search focus; filter and occasion dropdowns use controlled non-modal Radix Popovers for keyboard and outside-click handling.
- Reveal visibility is controlled by the pre-paint html.js class and CSS reduced-motion media queries, so SSR content remains visible without JavaScript.
- Persisted-store screens await hydration and data resolution before showing an empty state, to prevent false empty flashes.
- Leaf metadata uses the configured site URL for canonical and structured-image URLs, keeping deployment-specific values centralised.
- Missing catalogue/product records use a leaf not-found component so their metadata executes alongside HTTP 404 rendering.
