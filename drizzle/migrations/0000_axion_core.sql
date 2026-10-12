-- Axion: Grundlagen (Rollen, Profile, Katalog, Inhalte)
-- Rechte werden ausdrücklich vergeben, weil neue Supabase-Projekte Tabellen nicht mehr automatisch freigeben.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create type public.app_role as enum ('admin');
create type public.product_status as enum ('draft', 'active', 'archived');

-- Hilfsfunktionen -----------------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Rollen -------------------------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'
  )
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;

create policy "Rollen: eigene oder als Admin lesen" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- Profile ------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) <= 100),
  last_name text check (char_length(last_name) <= 100),
  phone text check (char_length(phone) <= 40),
  address jsonb check (address is null or jsonb_typeof(address) = 'object'),
  locale text not null default 'de' check (locale in ('de', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create policy "Profil: eigenes oder als Admin lesen" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy "Profil: eigenes ändern" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, address, locale) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sprache und Name aus der Registrierung (user_metadata); nur Anzeige-Daten, nie für Rechte verwenden.
  insert into public.profiles (id, locale, first_name, last_name)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'de' end,
    left(nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), 100),
    left(nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''), 100)
  )
  on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Katalog ------------------------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug not in ('alle', 'neu', 'sale')),
  name_de text not null check (char_length(name_de) between 1 and 80),
  name_en text check (char_length(name_en) <= 80),
  description_de text check (char_length(description_de) <= 500),
  description_en text check (char_length(description_en) <= 500),
  image_path text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id uuid not null references public.categories (id),
  model text not null check (model ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status public.product_status not null default 'draft',
  title_de text not null check (char_length(title_de) between 1 and 120),
  title_en text check (char_length(title_en) <= 120),
  description_de text not null default '' check (char_length(description_de) <= 4000),
  description_en text check (char_length(description_en) <= 4000),
  material_de text check (char_length(material_de) <= 500),
  material_en text check (char_length(material_en) <= 500),
  care_de text check (char_length(care_de) <= 500),
  care_en text check (char_length(care_en) <= 500),
  fit_note_de text check (char_length(fit_note_de) <= 500),
  fit_note_en text check (char_length(fit_note_en) <= 500),
  fit text check (char_length(fit) <= 40),
  color_name_de text not null check (char_length(color_name_de) between 1 and 60),
  color_name_en text check (char_length(color_name_en) <= 60),
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  tags text[] not null default '{}',
  occasions text[] not null default '{}'
    check (occasions <@ array['hochzeit', 'business', 'abschlussfeier', 'gala']::text[]),
  outfit_handles text[] not null default '{}',
  price_cents int not null check (price_cents between 0 and 10000000),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents > price_cents),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);
create index products_model_idx on public.products (model);
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text not null check (char_length(size) between 1 and 20),
  sku text unique check (char_length(sku) <= 60),
  barcode text check (char_length(barcode) <= 60),
  price_cents int check (price_cents between 0 and 10000000),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents > 0),
  stock int not null default 0 check (stock >= 0),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);
create index product_variants_product_id_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function private.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null check (char_length(path) between 1 and 500),
  alt_de text not null default '' check (char_length(alt_de) <= 300),
  alt_en text check (char_length(alt_en) <= 300),
  width int not null default 1024 check (width > 0),
  height int not null default 1280 check (height > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on public.product_images (product_id, sort);

-- Ein Produkt ist für die Kundschaft sichtbar, wenn es aktiv ist.
create or replace function private.product_is_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.products p where p.id = p_product_id and p.status = 'active')
$$;
revoke all on function private.product_is_public(uuid) from public;
grant execute on function private.product_is_public(uuid) to anon, authenticated, service_role;

alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
alter table public.product_variants enable row level security;
revoke all on public.product_variants from anon, authenticated;
alter table public.product_images enable row level security;
revoke all on public.product_images from anon, authenticated;

create policy "Kategorien: aktive lesen" on public.categories
  for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy "Kategorien: Admin schreibt" on public.categories
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Produkte: aktive lesen" on public.products
  for select to anon, authenticated
  using (status = 'active' or (select private.is_admin()));
create policy "Produkte: Admin schreibt" on public.products
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Varianten: von aktiven Produkten lesen" on public.product_variants
  for select to anon, authenticated
  using ((active and private.product_is_public(product_id)) or (select private.is_admin()));
create policy "Varianten: Admin schreibt" on public.product_variants
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Bilder: von aktiven Produkten lesen" on public.product_images
  for select to anon, authenticated
  using (private.product_is_public(product_id) or (select private.is_admin()));
create policy "Bilder: Admin schreibt" on public.product_images
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select on public.categories, public.products, public.product_variants, public.product_images
  to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images to authenticated;
-- Bestand nie direkt: nur über admin_adjust_stock / admin_restock_order (mit Lagerbewegung) und die Kasse.
grant insert (product_id, size, sku, barcode, price_cents, compare_at_cents, sort, active),
  update (size, sku, barcode, price_cents, compare_at_cents, sort, active),
  delete
  on public.product_variants to authenticated;
grant all on public.categories, public.products, public.product_variants, public.product_images to service_role;

-- Inhalte der Startseite ---------------------------------------------------------------------------

create table public.site_content (
  key text primary key check (key ~ '^[a-z0-9_.-]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.site_content enable row level security;
revoke all on public.site_content from anon, authenticated;
create trigger site_content_updated_at before update on public.site_content
  for each row execute function private.set_updated_at();

create policy "Inhalte: alle lesen" on public.site_content
  for select to anon, authenticated
  using (true);
create policy "Inhalte: Admin schreibt" on public.site_content
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
grant all on public.site_content to service_role;