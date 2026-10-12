# Axion Eigenbau Implementation Plan

> **Nachtrag 12.10.2026 (Angebot v5):** Datenbank in Lovable Cloud (Region Europa) statt eigenem Supabase-Projekt, Liefergebiet standardmässig nur CH, englische Rechtstexte von Flowrenix, automatische Übersetzung, Kontaktformular, Grössentabellen im Admin, Quittung. Massgebend für die Inbetriebnahme ist `docs/DEPLOYMENT.md`.
> Nach dem unabhängigen Review: Herkunft des Englisch pro Feld (eigenes Englisch wird nie überschrieben), Kontaktformular
> mit Deckel für alle und JSON-Pflicht für alle Funktionen, Rate-Limit-Zähler nur als Hash, Übersetzung mit Tagesdeckel.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Lovable-Shop «Axion» zu einem selbst betriebenen Shop mit Supabase-Backend, Stripe-Kasse, Admin, Kundenkonto, Gutscheinen, Rabattcodes, Newsletter und DE/EN ausbauen, lokal vollständig prüfen und als GitHub-taugliches Paket ablegen.

**Architecture:** Frontend bleibt TanStack Start (SSR) und liest Daten nur über `src/lib/commerce` (Adapter `sample` ohne Backend, `supabase` mit Backend). Geschäftslogik mit Geld und Bestand liegt in Postgres-Funktionen (RPC) mit RLS; Edge Functions (Deno) sprechen die Datenbank nur über RPC an und kapseln Stripe, Resend und Auth-Hook. Deutsch ohne Präfix, Englisch unter `/en` über den optionalen Routen-Parameter `{-$locale}`; Admin unter `/admin`.

**Tech Stack:** TanStack Start/Router 1.17x, React 19, TanStack Query, Zustand, Tailwind v4, shadcn; Supabase (Postgres 15+, Auth, Storage, Edge Functions/Deno 2), supabase-js 2, stripe-node (Fetch-Client), Resend REST, standardwebhooks; Tests: Vitest (jsdom fürs Frontend, node fürs Backend), lokales Postgres 16, Deno 2.9 (`deno check`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-axion-eigenbau-spec.md`

## Global Constraints

- Schweizer Rechtschreibung (ss, kein ß), Anführungszeichen «», CHF-Format wie `src/lib/commerce/format.ts`; «gratis» statt «kostenlos».
- Geld in DB, RPC und Edge Functions als Ganzzahl in Rappen (`*_cents int`); im UI `Money.amount` in CHF.
- Locale-Typ `Locale = "de" | "en"`; `de` ohne URL-Präfix, `en` mit `/en`; jede fehlende englische Produkt- oder Inhaltsangabe fällt auf Deutsch zurück.
- Edge Functions greifen nur über `rpc()` auf die Datenbank zu (Ausnahme: `account-delete` nutzt die Auth-Admin-API).
- Keine Geheimnisse im Repo. Server-Variablen: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SHOP_NOTIFY_EMAIL`, `SITE_URL`, `SEND_EMAIL_HOOK_SECRET`. Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (fehlen sie, läuft der Sample-Adapter).
- Bestehendes Verhalten bleibt: SSR, echte 404, `noindex` solange `launched: false`, reduzierte Bewegung, Lazy-3D, Hydration nach Mount für persistente Stores.
- Footer «Made by Flowrenix.com» in Shop und Admin.
- Alle SQL-Funktionen `security definer` setzen `search_path = ''` und qualifizieren Objekte voll; RLS auf jeder Tabelle in `public`.
- Bestellnummern `AX-` + fortlaufende Zahl ab 10001.
- Stripe Checkout: `mode=payment`, Währung `chf`, Lieferländer `CH`, `LI`, Ablauf nach 30 Minuten, Zahlungsarten aus dem Dashboard (kein `payment_method_types`).
- Gutscheincodes: Format `AXN-XXXX-XXXX-XXXX` aus dem Alphabet ohne 0/O/1/I (32 Zeichen), Gültigkeit Standard 5 Jahre.

## Review Focus

1. Zwei Leute kaufen gleichzeitig das letzte Stück: genau eine Reservierung gelingt, die andere bekommt «ausverkauft», Bestand nie negativ (Test in Task 4).
2. Stripe schickt Webhooks doppelt oder in falscher Reihenfolge (`expired` nach `completed`, `completed` nach eigener Freigabe): bezahlte Bestellung wird nie storniert, Bestand und Gutschein bleiben stimmig, E-Mails gehen nur einmal raus (Tests in Task 4 und 9).
3. Derselbe Gutschein in zwei Kassen gleichzeitig: Restguthaben nie negativ, Teilbetrag korrekt (Test in Task 4).
4. Manipulierte Preise oder Mengen vom Browser: Server rechnet nur mit DB-Preisen, Menge 1 bis 10 pro Zeile (Tests in Task 4 und 8).
5. Eingeloggte Kundschaft ohne Admin-Rolle ruft Admin-Daten direkt über supabase-js ab: RLS verweigert Bestellungen anderer, Rabattcodes, Gutscheine, Newsletter (Test in Task 3).
6. Englische Seite mit fehlenden EN-Texten: zeigt deutschen Text statt leerer Felder (Test in Task 14).
7. Rabatt plus Gutschein decken 100 %: Bestellung wird ohne Stripe abgeschlossen, keine 0-Franken-Session (Tests in Task 4 und 8).

---

## Phase A: Datenbank

### Task 1: Lokale Werkbank (Git-Basis, Postgres, Supabase-Nachbau, Testlauf)

**Files:**

- Create: `scripts/db/local-db.sh`, `scripts/db/supabase-compat.sql`, `scripts/db/migrate.ts`, `vitest.backend.config.ts`, `supabase/tests/setup.ts`, `supabase/tests/helpers.ts`
- Modify: `.gitignore` (`.local/`, `delivery/`), `package.json` (Scripts `db:reset`, `test:backend`; devDeps `pg`, `@types/pg`, `tsx`), `vitest.config.ts` (`exclude: ["supabase/**"]`)

**Interfaces:**

- Produces: `withRole(role: "anon"|"authenticated"|"service_role", claims: {sub?: string, email?: string} | null, fn: (c: PoolClient) => Promise<T>): Promise<T>`; `resetDb(): Promise<void>`; `createUser(email: string, opts?: {confirmed?: boolean, admin?: boolean}): Promise<string /* uuid */>`.

- [x] Commit «Basis = Lovable e3800b2» mit dem heutigen Stand (ohne `qa/`, `docs/`).
- [x] `supabase-compat.sql`: Rollen `anon`, `authenticated`, `service_role` (bypassrls), Schemas `auth`, `storage`, `extensions`; `auth.users` (id, email, email_confirmed_at, raw_user_meta_data, created_at), `auth.uid()`, `auth.email()`, `auth.jwt()` wie Supabase (aus `request.jwt.claims`); `storage.buckets`, `storage.objects` mit `storage.foldername()`.
- [x] `local-db.sh`: initdb nach `.local/pg`, Port 54329, Datenbank `axion`, wendet compat + `supabase/migrations/*.sql` + `supabase/seed.sql` an.
- [x] Test `supabase/tests/smoke.test.ts`: `select 1` als `anon` klappt; `auth.uid()` liefert die gesetzte `sub`.
- [x] Run: `bun run test:backend` → PASS.

### Task 2: Katalog, Rollen, Profile, Inhalte

**Files:**

- Create: `supabase/migrations/20261012000100_core.sql`, `supabase/seed.sql`, `supabase/tests/core.test.ts`

**Interfaces:**

- Produces Tabellen: `user_roles(user_id, role app_role)`, `profiles(id, first_name, last_name, phone, address jsonb, locale)`, `categories(id, slug, sort, name_de, name_en, description_de, description_en, image_path, active)`, `products(id, handle, category_id, model, status product_status, title_de/en, description_de/en, material_de/en, care_de/en, fit_note_de/en, fit, color_name_de/en, color_hex, tags text[], occasions text[], outfit_handles text[], price_cents, compare_at_cents, created_at, updated_at)`, `product_variants(id, product_id, size, sku, barcode, price_cents, compare_at_cents, stock int check (stock >= 0), sort, active)`, `product_images(id, product_id, path, alt_de, alt_en, width, height, sort)`, `site_content(key, value jsonb, updated_at)`.
- Produces Funktionen: `public.has_role(_user_id uuid, _role public.app_role) returns boolean`; Trigger `handle_new_user` legt `profiles` an.
- Seed: Kategorien `anzuege`, `westen`, `schuhe`; die 6 Beispielprodukte aus `sample-data.ts` mit Bildpfaden `asset:<schlüssel>` (Schlüssel wie in `media.ts`); `site_content` Schlüssel `announcements`, `home.hero`, `home.collections`, `home.new`, `home.look`, `home.occasions`, `home.story`.

- [x] Tests: `anon` sieht nur aktive Produkte/Varianten/Bilder/Kategorien; Entwurf unsichtbar; `authenticated` ohne Admin kann nicht schreiben; Admin kann alles schreiben; Profil nur eigenes lesbar und änderbar; neuer `auth.users`-Eintrag erzeugt Profil.
- [x] Migration und Seed schreiben, Tests grün.
- [x] Commit.

### Task 3: Bestellungen, Gutscheine, Rabatte, Newsletter, Ereignisse

**Files:**

- Create: `supabase/migrations/20261012000200_commerce.sql`, `supabase/tests/commerce-rls.test.ts`

**Interfaces:**

- Produces Tabellen: `orders(id, number bigint, status order_status, user_id, email, locale, subtotal_cents, discount_cents, discount_code, gift_card_cents, gift_card_id, shipping_cents, total_cents, refunded_cents, shipping_name, shipping_address jsonb, phone, stripe_session_id unique, stripe_payment_intent_id, payment_method, kind ('cart'|'gift_card'), gift_card_purchase jsonb, tracking_number, shipped_at, paid_at, cancelled_at, expires_at, needs_attention bool, admin_note, created_at, updated_at)`, `order_items(...)`, `stock_movements(id, variant_id, delta, reason stock_reason, order_id, note, created_by, created_at)`, `discount_codes(id, code citext unique, kind, value, min_subtotal_cents, starts_at, ends_at, max_redemptions, redemptions, active)`, `gift_cards(id, code unique, initial_cents, balance_cents check (balance_cents >= 0), status, expires_at, purchaser_email, recipient_email, recipient_name, sender_name, message, order_id, created_at)`, `gift_card_transactions(id, gift_card_id, order_id, delta_cents, kind, created_at)`, `newsletter_subscribers(id, email citext unique, locale, status, consent_text, consent_at, token_hash, confirmed_at, unsubscribed_at, source, welcome_code)`, `stripe_events(id text pk, type, received_at)`, `rate_limits(key, window_start, hits)`.
- `order_number` Sequenz ab 10001.

- [x] Tests: Kundschaft sieht nur eigene Bestellungen und Positionen; `anon` sieht keine; nur Admin liest Rabattcodes, Gutscheine, Newsletter, Lagerbewegungen; niemand ausser `service_role` schreibt Bestellungen direkt.
- [x] Migration schreiben, Tests grün, Commit.

### Task 4: Geschäftslogik als RPC

**Files:**

- Create: `supabase/migrations/20261012000300_rpc.sql`, `supabase/tests/checkout-rpc.test.ts`, `supabase/tests/giftcard-rpc.test.ts`, `supabase/tests/admin-rpc.test.ts`

**Interfaces (alle `security definer`, `search_path = ''`):**

- `reserve_checkout(p_lines jsonb, p_email text, p_locale text, p_discount_code text, p_gift_card_code text, p_user_id uuid) returns jsonb` (nur `service_role`). Rückgabe `{order_id, order_number, subtotal_cents, discount_cents, gift_card_cents, shipping_cents, total_cents, lines:[{variant_id, product_id, handle, title, size, color, unit_price_cents, quantity, image}]}`. Fehler als `raise exception` mit Meldung `OUT_OF_STOCK`, `INVALID_LINES`, `DISCOUNT_INVALID`, `GIFT_CARD_INVALID` und JSON im `detail`.
- `reserve_gift_card_purchase(p_amount_cents int, p_email text, p_locale text, p_purchase jsonb, p_user_id uuid) returns jsonb` (nur `service_role`), Betrag 25 bis 1000 CHF.
- `attach_checkout_session(p_order_id uuid, p_session_id text, p_expires_at timestamptz) returns void`.
- `complete_order(p_order_id uuid, p_payment jsonb) returns jsonb` → `{status, newly_paid, order_number, needs_attention, gift_card}` (idempotent; bei Gutscheinkauf erzeugt es den Gutschein).
- `cancel_order(p_order_id uuid, p_reason text) returns boolean` (nur `pending`; Bestand und Gutschein zurück).
- `release_expired_orders(p_grace interval default '15 minutes') returns int`.
- `record_refund(p_payment_intent_id text, p_refunded_cents int) returns jsonb`.
- `check_discount(p_code text, p_subtotal_cents int) returns jsonb` → `{valid, discount_cents, reason}`; `check_gift_card(p_code text) returns jsonb` → `{valid, balance_cents, expires_at, reason}` (beide für `anon`, Rate-Limit 20 pro 10 Minuten je Anfrage-IP).
- `get_order_status(p_session_id text) returns jsonb` (für `anon`) → `{order_number, status, total_cents, email_hint}`.
- `claim_guest_orders() returns int` (für `authenticated`, nur bestätigte E-Mail).
- `admin_adjust_stock(p_variant_id uuid, p_delta int, p_reason stock_reason, p_note text) returns int`, `admin_restock_order(p_order_id uuid, p_items jsonb) returns void`, `admin_grant_admin(p_email text) returns jsonb`, `admin_revoke_admin(p_user_id uuid) returns void`, `admin_dashboard(p_from timestamptz, p_to timestamptz) returns jsonb`, `admin_issue_gift_card(...) returns jsonb` (alle prüfen `has_role(auth.uid(), 'admin')`).
- `mark_order_shipped(p_order_id uuid, p_tracking text) returns jsonb` (nur `service_role`, für die Edge Function).
- `newsletter_subscribe(p_email text, p_locale text, p_consent text, p_source text) returns jsonb` → `{status, token}`; `newsletter_confirm(p_token text) returns jsonb`; `newsletter_unsubscribe(p_token text) returns jsonb` (nur `service_role`).

- [x] Tests mit exakten Werten: zwei Varianten à CHF 549.00 + CHF 189.00, Code `LAUNCH10` (10 %) → Rabatt 7380 Rappen; Gutschein 10000 Rappen auf Rest 66420 → Gutschein 10000, Total 56420; Gutschein deckt alles → `total_cents = 0`; letzter Bestand parallel reserviert (zwei Transaktionen) → eine `OUT_OF_STOCK`; `complete_order` zweimal → `newly_paid` nur einmal true; `cancel_order` nach `complete_order` → false; `complete_order` nach `cancel_order` mit fehlendem Bestand → `needs_attention = true`; Gutschein in zwei Reservierungen parallel → Summe der Abbuchungen ≤ Guthaben; abgelaufener oder deaktivierter Code → `valid=false` mit `reason`; Admin-RPC ohne Rolle → Fehler `FORBIDDEN`; letzter Admin kann sich nicht entfernen.
- [x] Funktionen schreiben, Tests grün, Commit.

### Task 5: Speicher für Bilder

**Files:**

- Create: `supabase/migrations/20261012000400_storage.sql`, `supabase/tests/storage.test.ts`

- [x] Buckets `product-images` und `site-media` (öffentlich lesbar, 8 MB, nur Bildtypen); Schreiben, Ändern, Löschen nur Admin. Tests: `anon` darf nicht schreiben, Admin darf.
- [x] Commit.

### Task 6: TypeScript-Typen der Datenbank

**Files:**

- Create: `scripts/db/gen-types.ts`, `src/integrations/supabase/types.ts`

- [x] Generator liest Tabellen, Enums und RPC-Signaturen aus der lokalen DB und schreibt einen `Database`-Typ im Supabase-Format (`Tables.Row/Insert/Update`, `Functions.Args/Returns`, `Enums`). Später durch `supabase gen types` ersetzbar.
- [x] `tsc --noEmit` grün, Commit.

## Phase B: Edge Functions

### Task 7: Gemeinsame Bausteine und E-Mail-Vorlagen

**Files:**

- Create: `supabase/functions/_shared/{env,http,money,db,stripe,auth,i18n}.ts`, `supabase/functions/_shared/email/{send,layout,templates}.ts`, `supabase/functions/_shared/email/templates.test.ts`, `scripts/email-preview.ts`, `supabase/functions/deno.json`

**Interfaces:**

- `getEnv(): FunctionEnv`; `json(status: number, body: unknown, headers?: HeadersInit): Response`; `corsHeaders(origin: string | null, allowed: string[]): HeadersInit`.
- `type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>`; `class RpcError { code: string; detail: unknown }`; `createRpc(url: string, key: string): Rpc`.
- `createStripe(secretKey: string, opts?: {host?: string, port?: number, protocol?: "http"|"https"}): Stripe` (Fetch-Client, SubtleCrypto).
- `sendEmail(msg: {to: string, subject: string, html: string, text: string, replyTo?: string}, cfg: {apiKey: string, from: string, baseUrl?: string}): Promise<{id: string}>`.
- Vorlagen `(data, locale) => {subject, html, text}`: `orderConfirmation`, `shopNotification`, `shippingConfirmation`, `giftCard`, `newsletterConfirm`, `newsletterWelcome`, `authEmail(kind: "signup"|"recovery"|"email_change"|"magiclink"|"invite")`.
- `getUser(req: Request, env): Promise<{id: string, email: string} | null>`; `requireAdmin(req, env, rpc): Promise<{id: string, email: string}>`.

- [x] Tests: jede Vorlage DE und EN hat Betreff, HTML und Text; Beträge als «CHF 564.20»; HTML enthält keine ungefüllten `{{`; Sendungslink der Post enthält die Sendungsnummer.
- [x] Vorschau-Skript schreibt alle Vorlagen nach `.local/email-preview/*.html`, Sichtprüfung per Screenshot.
- [x] Commit.

### Task 8: Funktion `checkout`

**Files:**

- Create: `supabase/functions/checkout/{index.ts,handler.ts,handler.test.ts}`, `supabase/tests/fakes/{rpc-shim.ts,fake-stripe.ts,fake-resend.ts}`

**Interfaces:**

- Request `POST {kind:"cart", lines:[{variantId, quantity}], email?, discountCode?, giftCardCode?, locale}` oder `{kind:"gift_card", amountCents, recipientName?, recipientEmail?, senderName?, message?, email?, locale}`; optional `Authorization: Bearer <jwt>`.
- Response `200 {url}` | `409 {error:"OUT_OF_STOCK", items:[{variantId, available}]}` | `422 {error:"DISCOUNT_INVALID"|"GIFT_CARD_INVALID"|"INVALID_LINES", reason}` | `400 {error:"BAD_REQUEST"}`.
- `handleCheckout(req: Request, deps: {env, rpc, stripe, now?}): Promise<Response>`.

- [x] Tests (Fake-Stripe, RPC-Shim auf lokale DB): Session hat Positionen zu DB-Preisen, einen Coupon über Rabatt+Gutschein, `metadata.order_id`, Erfolgs-URL mit Locale; Total 0 → keine Stripe-Session, Bestellung bezahlt, URL zur Dankesseite; ausverkauft → 409 mit verfügbarer Menge; Stripe-Fehler → Reservierung wird storniert.
- [x] Commit.

### Task 9: Funktion `stripe-webhook`

**Files:**

- Create: `supabase/functions/stripe-webhook/{index.ts,handler.ts,handler.test.ts}`

- [x] Tests: falsche Signatur → 400; `checkout.session.completed` (bezahlt) → Bestellung `paid`, Bestätigung an Kundschaft und Meldung an Shop genau einmal; dasselbe Ereignis doppelt → keine zweite E-Mail; `checkout.session.expired` → storniert, Bestand zurück; `async_payment_failed` → storniert; `charge.refunded` → `refunded_cents`; Gutscheinkauf → Gutschein-E-Mail mit Code.
- [x] Commit.

### Task 10: Funktionen `newsletter`, `admin-actions`, `account-delete`, `auth-email-hook`

**Files:**

- Create: je `index.ts`, `handler.ts`, `handler.test.ts` unter `supabase/functions/<name>/`, `supabase/config.toml`

- [x] Newsletter: Anmeldung → `pending` + Bestätigungs-E-Mail; Bestätigen → `confirmed` (+ Willkommensrabatt, falls eingestellt); Abmelden → `unsubscribed`; doppelte Anmeldung verrät nicht, ob die Adresse existiert.
- [x] Admin-Aktionen: `ship` (Versandmeldung), `resend_confirmation`, `issue_gift_card`; ohne Admin-Rolle 403.
- [x] Konto löschen: nur eigener Benutzer; Bestellungen bleiben ohne `user_id`.
- [x] Auth-Hook: Standard-Webhooks-Signatur geprüft; richtige Vorlage und Sprache aus `user_metadata.locale`.
- [x] `config.toml`: `verify_jwt = false` für `stripe-webhook`, `auth-email-hook`, `newsletter`, `checkout`.
- [x] `deno check` für alle `index.ts` grün; Deno-Smoke-Test: `checkout/index.ts` unter Deno gegen Shim und Fake-Stripe.
- [x] Commit.

## Phase C: Frontend

### Task 11: Supabase-Client und Commerce-Adapter

**Files:**

- Create: `src/integrations/supabase/client.ts`, `src/lib/commerce/backend.ts`, `src/lib/commerce/adapters/sample.ts`, `src/lib/commerce/adapters/supabase.ts`, `src/lib/commerce/adapters/supabase.test.ts`, `src/lib/commerce/mapping.ts`
- Modify: `src/lib/commerce/index.ts`, `src/lib/commerce/types.ts`, `src/lib/commerce/media.ts`, `package.json` (`@supabase/supabase-js`)

**Interfaces:**

- `supabase: SupabaseClient<Database> | null`, `backendConfigured: boolean`.
- `interface CommerceBackend` mit allen heutigen Exporten aus `index.ts` plus `locale` und `checkDiscount(code, subtotalCents)`, `checkGiftCard(code)`, `startCheckout(input: CheckoutInput): Promise<CheckoutResult>`, `getOrderStatus(sessionId)`, `getSiteContent(locale)`.
- `mapProduct(row: ProductRow, locale: Locale): Product` (Fallback DE, `asset:`-Pfade über `media.ts`, Storage-Pfade über öffentliche URL).
- `index.ts` behält alle Namen, neuer letzter Parameter `locale: Locale = "de"`.

- [x] Tests: Mapping mit fehlendem EN-Titel → DE-Titel; Preis 54900 → `Money {amount: 549}`; Variante ohne Bestand → `availableForSale=false`; Sample-Adapter liefert dieselben Daten wie heute (bestehende Tests bleiben grün).
- [x] Commit.
- Umgesetzt mit einfacherem Zuschnitt: `source.ts` (Supabase oder Beispielkatalog, 30 s Zwischenspeicher), `mapping.ts`, `rows.ts`, `sample-catalog.ts` (aus `supabase/seed.sql` erzeugt, `--check` im Test), `checkout.ts`, `queries.ts`. Kein separates Adapter-Interface nötig.

### Task 12: Zweisprachigkeit

**Files:**

- Create: `src/i18n/{index.ts,messages/de.ts,messages/en.ts,routing.ts,i18n.test.ts}`, `src/routes/{-$locale}/route.tsx`
- Move: alle Shop-Routen von `src/routes/*.tsx` nach `src/routes/{-$locale}/`
- Modify: `src/routes/__root.tsx` (lang, hreflang), `src/components/shop/*.tsx` (Texte über `useT()`, Links mit `locale`), `src/lib/commerce/seo.ts`, `src/content/pages.ts` (EN-Hinweis)

**Interfaces:**

- `type Locale = "de"|"en"`; `useLocale(): Locale`; `useT(): Messages`; `localeParam(locale): {locale?: "en"}`; `switchLocalePath(pathname: string, target: Locale): string`; `<LanguageSwitch />`.

- [x] Tests: `en` und `de` haben dieselben Schlüssel; `/en/produkt/x` rendert englische Navigation und `lang="en"`; `/fr/produkt/x` → 404; `switchLocalePath("/en/kollektion/anzuege", "de") === "/kollektion/anzuege"` (Vitest und e2e/shop.spec.ts).
- [x] Commit.

### Task 13: Warenkorb, Kasse, Dankesseite

**Files:**

- Modify: `src/components/shop/cart.tsx`, `src/routes/{-$locale}/warenkorb.tsx`
- Create: `src/routes/{-$locale}/bestellung.$token.tsx` (statt `bestellung.danke`: success_url ist `/bestellung/<token>?bezahlt=1`), `src/components/shop/checkout-summary.tsx`, `src/components/shop/checkout-summary.test.tsx`

- [x] Rabattcode- und Gutscheinfeld mit Prüfung, Totale, «Zur Kasse» leitet zu Stripe; ausverkauft-Hinweis aktualisiert den Warenkorb; Dankesseite leert den Warenkorb und wartet bis zu 30 s auf `paid`.
- [x] Abbruch in Stripe (`?abgebrochen=<token>`) gibt die Reservierung frei.
- [x] Commit.

### Task 14: Kundenkonto

**Files:**

- Create: `src/lib/account/{auth-store.ts,api.ts,api.test.ts}`, `src/routes/{-$locale}/konto.*.tsx` (anmelden, registrieren, bestaetigen, passwort-vergessen, passwort-neu, index, bestellungen.$number, daten), `src/components/account/*`
- Vertrag der Funktionen: `supabase/functions/README.md` (Links der Auth-E-Mails auf `/konto/bestaetigen?token_hash&type&next`, Bestätigung per Klick mit `verifyOtp`, `next` nur als interner Pfad)
- Modify: `src/components/shop/shell.tsx` (Konto-Symbol)

- [x] Registrieren mit Locale in den Metadaten, Anmelden, Abmelden, Passwort vergessen/neu, Bestellliste und -detail, Daten und Adresse, Konto löschen; nach Anmeldung `claim_guest_orders`.
- [x] Commit. (`auth-store.ts` heisst `session.ts`; dazu `claim.ts`, `use-require-session.ts`, `use-sign-out.ts`)

### Task 15: Geschenkgutschein-Seite und Newsletter

**Files:**

- Create: `src/routes/{-$locale}/geschenkgutschein.tsx`, `src/routes/{-$locale}/newsletter.bestaetigen.tsx`, `src/routes/{-$locale}/newsletter.abmelden.tsx`, `src/components/shop/newsletter-form.tsx`
- Modify: `src/components/shop/shell.tsx` (Footer-Formular), `src/config/shop.ts` (Features an; Gutscheinbeträge kommen aus `shop_settings`)

- [x] Commit nach UI-Tests.

### Browser-Tests (zusätzlich)

- [x] `e2e/fake-supabase.ts` (Auth, REST, RPC, Functions nachgebaut) und `e2e/shop.spec.ts`: 12 Abläufe × Desktop und Handy (`bun run test:e2e`).

### Task 16: Admin-Grundgerüst, Anmeldung, Übersicht

**Files:**

- Create: `src/routes/admin.tsx`, `src/routes/admin.index.tsx`, `src/routes/admin.anmelden.tsx`, `src/components/admin/{layout,guard,stat-cards}.tsx`, `src/lib/admin/api.ts`

- [x] Ohne Admin-Rolle «Kein Zugriff»; Übersicht mit Umsatz heute/7/30 Tage, offene Versände, tiefer Bestand.
- [x] Commit.

### Task 17: Admin Produkte und Kategorien

**Files:**

- Create: `src/routes/admin.produkte.*.tsx`, `src/routes/admin.kategorien.tsx`, `src/components/admin/{product-form,variant-table,image-uploader}.tsx`, `src/lib/admin/image.ts`, `src/lib/admin/image.test.ts`

- [x] Bild wird im Browser auf max. 2000 px verkleinert (WebP, sonst JPEG); Felder DE/EN; Varianten mit Bestand; Sortierung der Bilder.
- [x] Commit.

### Task 18: Admin Bestellungen und Lager

**Files:**

- Create: `src/routes/admin.bestellungen.*.tsx`, `src/routes/admin.lager.tsx`, `src/components/admin/{order-table,order-detail,stock-table}.tsx`

- [x] Versand mit Sendungsnummer (E-Mail), Notiz, Retoure einbuchen, Verkauf vor Ort (−1), Korrektur mit Grund, Bewegungsliste.
- [x] Commit.

### Task 19: Admin Rabattcodes, Gutscheine, Newsletter, Inhalte, Zugänge, Export

**Files:**

- Create: `src/routes/admin.{rabattcodes,gutscheine,newsletter,inhalte,zugaenge}.tsx`, `src/lib/admin/csv.ts`, `src/lib/admin/csv.test.ts`

- [x] CSV mit Semikolon und UTF-8-BOM (Excel CH); Inhalte DE/EN für Startseite und Laufband.
- [x] Commit.

### Task 20: Rechtstexte, Hilfe, SEO

**Files:**

- Modify: `src/content/pages.ts`, `src/lib/commerce/seo.ts`
- Create: `src/routes/sitemap[.]xml.ts`

- [x] Datenschutz ohne Shopify, mit Supabase, Stripe, Resend, Lovable-Hosting, Kundenkonto, Newsletter; AGB mit Gutscheinen und Kundenkonto; Fakten mit Quellen geprüft.
- [x] Commit.

## Phase D: Prüfen und Paket

### Task 21: Gesamtprüfung

- [x] `tsc`, `eslint`, `vitest` (Frontend 60, Backend 207), Build. `deno check` offen: Deno ist in der Cloud-Umgebung nicht verfügbar, lokal bei Ben vor dem Deploy (`supabase functions deploy` prüft ebenfalls).
- [x] Playwright Desktop und Handy: Shop DE/EN, Warenkorb bis Kasse, Konto, Admin-Kernabläufe (44/44).
- [x] Unabhängige Prüfung durch frischen Reviewer: Sicherheit (RLS, RPC, Funktionen) und Code. Befunde behoben (Commit «Sicherheit Kasse und Zahlungen»); offen und dokumentiert: Turnstile gegen Bots, Content-Security-Policy, Streitfälle (Disputes) von Hand.

### Task 22: Anleitung und Paket

**Files:**

- Create: `docs/DEPLOYMENT.md`, `scripts/package-delivery.sh`

- [x] Anleitung DE: GitHub verbinden, Dateien übernehmen, Supabase-Projekt (Zürich), Migrationen, Funktionen, Secrets, Auth-Einstellungen und Hook, Stripe (Zahlungsarten, Webhook, Teamzugang), Resend (Domain), erster Admin, Testkauf, Veröffentlichen.
- [x] Paket: ZIP mit allen geänderten und neuen Dateien plus Löschliste plus Git-Patch.
