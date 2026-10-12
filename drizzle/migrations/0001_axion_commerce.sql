-- Axion: Bestellungen, Lager, Rabattcodes, Gutscheine, Newsletter, Stripe-Ereignisse

create type public.order_status as enum ('pending', 'paid', 'shipped', 'cancelled', 'refunded');
create type public.order_kind as enum ('cart', 'gift_card');
create type public.discount_kind as enum ('percent', 'amount');
create type public.stock_reason as enum ('reservation', 'release', 'sale_store', 'return', 'correction', 'reclaim');
create type public.gift_card_status as enum ('active', 'disabled');
create type public.gift_card_tx_kind as enum ('issue', 'redeem', 'release', 'adjust');
create type public.newsletter_status as enum ('pending', 'confirmed', 'unsubscribed');

-- Rabattcodes --------------------------------------------------------------------------------------

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null
    check (char_length(code) between 3 and 40 and code ~ '^[A-Za-z0-9_-]+$'),
  kind public.discount_kind not null,
  value int not null check (value > 0),
  min_subtotal_cents int not null default 0 check (min_subtotal_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int check (max_redemptions > 0),
  redemptions int not null default 0 check (redemptions >= 0),
  active boolean not null default true,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger discount_codes_updated_at before update on public.discount_codes
  for each row execute function private.set_updated_at();
-- Gross-/Kleinschreibung ist beim Code egal: eindeutiger Index über lower() statt citext.
create unique index discount_codes_code_lower_idx on public.discount_codes (lower(code));

-- Gutscheine ---------------------------------------------------------------------------------------

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^AXN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  initial_cents int not null check (initial_cents between 100 and 1000000),
  balance_cents int not null check (balance_cents >= 0),
  status public.gift_card_status not null default 'active',
  expires_at timestamptz not null,
  locale text not null default 'de' check (locale in ('de', 'en')),
  purchaser_email text check (char_length(purchaser_email) <= 254),
  recipient_email text check (char_length(recipient_email) <= 254),
  recipient_name text check (char_length(recipient_name) <= 100),
  sender_name text check (char_length(sender_name) <= 100),
  message text check (char_length(message) <= 500),
  purchase_order_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (balance_cents <= initial_cents)
);
create trigger gift_cards_updated_at before update on public.gift_cards
  for each row execute function private.set_updated_at();

-- Bestellungen -------------------------------------------------------------------------------------

create sequence public.order_number_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  status_token uuid not null unique default gen_random_uuid(),
  kind public.order_kind not null default 'cart',
  status public.order_status not null default 'pending',
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (char_length(email) between 3 and 254 and email like '%@%'),
  locale text not null default 'de' check (locale in ('de', 'en')),
  currency text not null default 'CHF' check (currency = 'CHF'),
  subtotal_cents int not null check (subtotal_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  discount_code text,
  discount_code_id uuid references public.discount_codes (id) on delete set null,
  gift_card_cents int not null default 0 check (gift_card_cents >= 0),
  gift_card_id uuid references public.gift_cards (id) on delete set null,
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  shipping_name text check (char_length(shipping_name) <= 200),
  shipping_address jsonb check (shipping_address is null or jsonb_typeof(shipping_address) = 'object'),
  phone text check (char_length(phone) <= 40),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  payment_method text,
  gift_card_purchase jsonb check (gift_card_purchase is null or jsonb_typeof(gift_card_purchase) = 'object'),
  issued_gift_card_id uuid references public.gift_cards (id) on delete set null,
  tracking_number text check (char_length(tracking_number) <= 60),
  shipped_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  expires_at timestamptz,
  needs_attention boolean not null default false,
  confirmation_sent_at timestamptz,
  notification_sent_at timestamptz,
  gift_card_sent_at timestamptz,
  shipping_sent_at timestamptz,
  admin_note text check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents = subtotal_cents - discount_cents - gift_card_cents + shipping_cents)
);
alter sequence public.order_number_seq owned by public.orders.number;
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_email_idx on public.orders (lower(email));
create index orders_payment_intent_idx on public.orders (stripe_payment_intent_id);
create index orders_pending_expiry_idx on public.orders (expires_at) where status = 'pending';
create index orders_discount_code_id_idx on public.orders (discount_code_id);
create index orders_gift_card_id_idx on public.orders (gift_card_id);
create index orders_issued_gift_card_id_idx on public.orders (issued_gift_card_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

alter table public.gift_cards
  add constraint gift_cards_purchase_order_id_fkey
  foreign key (purchase_order_id) references public.orders (id) on delete set null;
create index gift_cards_purchase_order_id_idx on public.gift_cards (purchase_order_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  handle text,
  title text not null,
  size text,
  color text,
  image text,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity between 1 and 10),
  line_total_cents int not null check (line_total_cents >= 0),
  restocked_quantity int not null default 0,
  created_at timestamptz not null default now(),
  check (line_total_cents = unit_price_cents * quantity),
  check (restocked_quantity between 0 and quantity)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- Lagerbewegungen ----------------------------------------------------------------------------------

create table public.stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta int not null check (delta <> 0),
  reason public.stock_reason not null,
  order_id uuid references public.orders (id) on delete set null,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);
create index stock_movements_order_id_idx on public.stock_movements (order_id);

-- Gutschein-Buchungen ------------------------------------------------------------------------------

create table public.gift_card_transactions (
  id bigint generated always as identity primary key,
  gift_card_id uuid not null references public.gift_cards (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  delta_cents int not null check (delta_cents <> 0),
  kind public.gift_card_tx_kind not null,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_card_transactions_card_idx on public.gift_card_transactions (gift_card_id, created_at desc);
create index gift_card_transactions_order_idx on public.gift_card_transactions (order_id);

-- Newsletter ---------------------------------------------------------------------------------------

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email like '%@%'),
  locale text not null default 'de' check (locale in ('de', 'en')),
  status public.newsletter_status not null default 'pending',
  consent_text text not null check (char_length(consent_text) <= 1000),
  consent_at timestamptz not null default now(),
  source text not null default 'footer' check (source in ('footer', 'account', 'checkout', 'admin')),
  token_hash text unique,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  welcome_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger newsletter_subscribers_updated_at before update on public.newsletter_subscribers
  for each row execute function private.set_updated_at();
-- Doppelte Anmeldungen in anderer Schreibweise verhindern: eindeutiger Index über lower().
create unique index newsletter_subscribers_email_lower_idx on public.newsletter_subscribers (lower(email));

-- Stripe-Ereignisse (gegen doppelte Verarbeitung) und Rate-Limits ---------------------------------

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

-- Zeilenschutz -------------------------------------------------------------------------------------

alter table public.discount_codes enable row level security;
revoke all on public.discount_codes from anon, authenticated;
alter table public.gift_cards enable row level security;
revoke all on public.gift_cards from anon, authenticated;
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
alter table public.order_items enable row level security;
revoke all on public.order_items from anon, authenticated;
alter table public.stock_movements enable row level security;
revoke all on public.stock_movements from anon, authenticated;
alter table public.gift_card_transactions enable row level security;
revoke all on public.gift_card_transactions from anon, authenticated;
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
alter table private.rate_limits enable row level security;

create policy "Bestellungen: eigene oder als Admin lesen" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Bestellungen: Admin ändert Notizen" on public.orders
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Positionen: zur eigenen Bestellung oder als Admin lesen" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))
  ));

create policy "Lager: Admin liest" on public.stock_movements
  for select to authenticated using ((select private.is_admin()));

create policy "Rabattcodes: Admin verwaltet" on public.discount_codes
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Gutscheine: Admin liest" on public.gift_cards
  for select to authenticated using ((select private.is_admin()));
create policy "Gutscheine: Admin ändert Status" on public.gift_cards
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Gutschein-Buchungen: Admin liest" on public.gift_card_transactions
  for select to authenticated using ((select private.is_admin()));

create policy "Newsletter: Admin liest" on public.newsletter_subscribers
  for select to authenticated using ((select private.is_admin()));
create policy "Newsletter: Admin löscht" on public.newsletter_subscribers
  for delete to authenticated using ((select private.is_admin()));

-- admin_note ist intern: nicht für Kundschaft lesbar (das Admin liest sie über admin_get_order).
grant select (id, number, status_token, kind, status, user_id, email, locale, currency, subtotal_cents,
  discount_cents, discount_code, discount_code_id, gift_card_cents, gift_card_id, shipping_cents, total_cents,
  refunded_cents, shipping_name, shipping_address, phone, stripe_session_id, stripe_payment_intent_id,
  payment_method, gift_card_purchase, issued_gift_card_id, tracking_number, shipped_at, paid_at, cancelled_at,
  cancel_reason, expires_at, needs_attention, confirmation_sent_at, notification_sent_at, gift_card_sent_at,
  shipping_sent_at, created_at, updated_at) on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant update (admin_note, needs_attention) on public.orders to authenticated;
grant select on public.stock_movements, public.gift_card_transactions, public.newsletter_subscribers to authenticated;
grant delete on public.newsletter_subscribers to authenticated;
grant select, insert, update, delete on public.discount_codes to authenticated;
grant select on public.gift_cards to authenticated;
grant update (status, expires_at, note) on public.gift_cards to authenticated;

grant all on public.discount_codes, public.gift_cards, public.orders, public.order_items, public.stock_movements,
  public.gift_card_transactions, public.newsletter_subscribers, public.stripe_events to service_role;
grant usage, select on sequence public.order_number_seq to service_role;