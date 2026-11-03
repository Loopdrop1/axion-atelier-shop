-- Kundenbewertungen (kostenpflichtige Option, standardmässig aus). Gleiche Datei wie
-- drizzle/migrations/0026_axion_reviews.sql. Mehrfach ausführbar.
--
-- Zwei Schalter, beide müssen an sein: shopConfig.features.reviews im Frontend (Code) und
-- shop_settings.reviews_enabled hier (Admin → Einstellungen). Ohne reviews_enabled erzeugt der Versand keinen Link,
-- die Edge Function «review» antwortet REVIEWS_DISABLED und product_reviews liefert nichts.
--
-- Nur echte Käufe: Beim Schritt «Versendet» (admin-actions) entsteht pro Bestellung ein Link mit Zufallsschlüssel
-- (gespeichert nur als Hash, 90 Tage gültig). Pro Bestellposition höchstens eine Bewertung, pro Bestellung und
-- Produkt ebenso. Bewertungen erscheinen erst nach Freigabe im Admin. Nach aussen gehen nur Anzeigename, Sterne,
-- Titel, Text, Sprache und Datum freigegebener Bewertungen (product_reviews), nie E-Mail oder Bestelldaten.

alter table public.shop_settings add column if not exists reviews_enabled boolean not null default false;
grant select (reviews_enabled) on public.shop_settings to anon, authenticated;
grant update (reviews_enabled) on public.shop_settings to authenticated;

-- Link pro Bestellung (nur Hash des Schlüssels). Kein Zugriff für anon/authenticated, nur über die RPCs.
create table if not exists public.review_invites (
  order_id uuid primary key references public.orders (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.review_invites enable row level security;
revoke all on public.review_invites from anon, authenticated;
grant all on public.review_invites to service_role;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 10 and 2000),
  display_name text not null check (char_length(display_name) between 1 and 40),
  locale text not null default 'de' check (locale in ('de', 'en')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists reviews_order_item_idx on public.reviews (order_item_id)
  where order_item_id is not null;
create unique index if not exists reviews_order_product_idx on public.reviews (order_id, product_id)
  where order_id is not null;
create index if not exists reviews_product_approved_idx on public.reviews (product_id, approved_at desc)
  where status = 'approved';
create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

-- Freigabezeitpunkt folgt dem Status (Freigeben setzt ihn, Ablehnen oder Zurücksetzen löscht ihn).
create or replace function private.reviews_approved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_at := null;
  end if;
  return new;
end
$$;
drop trigger if exists reviews_approved_at on public.reviews;
create trigger reviews_approved_at before insert or update of status on public.reviews
  for each row execute function private.reviews_approved_at();

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select, delete on public.reviews to authenticated;
grant update (status, admin_note) on public.reviews to authenticated;
grant all on public.reviews to service_role;
drop policy if exists "Bewertungen: Admin liest" on public.reviews;
create policy "Bewertungen: Admin liest" on public.reviews
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "Bewertungen: Admin ändert" on public.reviews;
create policy "Bewertungen: Admin ändert" on public.reviews
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Bewertungen: Admin löscht" on public.reviews;
create policy "Bewertungen: Admin löscht" on public.reviews
  for delete to authenticated using ((select private.is_admin()));

create or replace function private.reviews_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select reviews_enabled from public.shop_settings where id = 1), false)
$$;

-- Link für eine versendete Bestellung erzeugen (beim Schritt «Versendet» und beim erneuten Senden der
-- Versandmeldung). Gibt den Schlüssel im Klartext genau einmal zurück; gespeichert wird nur sein Hash.
-- p_replace = false (Schritt «Versendet»): Gibt es schon einen gültigen Link, bleibt er und die Antwort ist null
-- (die erste Versandmeldung enthält ihn; ein wiederholter Klick entwertet ihn nicht). p_replace = true (Versandmeldung
-- bewusst erneut senden): neuer Link, der alte gilt nicht mehr.
-- null = Bewertungen aus, Bestellung nicht versendet oder (ohne p_replace) Link schon vorhanden.
-- Räumt nebenbei auf: abgelaufene Links und abgelehnte Bewertungen nach 90 Tagen.
create or replace function public.review_invite_create(
  p_order_id uuid,
  p_days int default 90,
  p_replace boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_days int := least(greatest(coalesce(p_days, 90), 1), 365);
begin
  if not private.reviews_enabled() then
    return null;
  end if;
  if not exists (
    select 1 from public.orders where id = p_order_id and kind = 'cart' and status = 'shipped'
  ) then
    return null;
  end if;
  delete from public.review_invites where expires_at < now() - interval '1 day';
  delete from public.reviews where status = 'rejected' and updated_at < now() - interval '90 days';
  if not coalesce(p_replace, false) and exists (
    select 1 from public.review_invites where order_id = p_order_id and expires_at > now()
  ) then
    return null;
  end if;
  v_token := private.random_token();
  insert into public.review_invites (order_id, token_hash, expires_at)
  values (p_order_id, private.hash_token(v_token), now() + make_interval(days => v_days))
  on conflict (order_id) do update
    set token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = now();
  return v_token;
end
$$;

-- Gültiger Link → Bestellung (nur intern)
create or replace function private.review_invite_order(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.order_id
  from public.review_invites i
  join public.orders o on o.id = i.order_id
  where i.token_hash = private.hash_token(coalesce(p_token, ''))
    and i.expires_at > now()
    and o.kind = 'cart' and o.status = 'shipped'
$$;

-- Bewertbare Stücke einer Bestellung: pro Produkt die erste Position, nur aktive Produkte, nicht vollständig
-- zurückgenommen. reviewed = schon bewertet (dann nur zur Anzeige).
create or replace function private.review_items(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'order_item_id', x.id, 'title', x.title, 'size', x.size, 'color', x.color, 'image', x.image,
      'handle', x.handle, 'reviewed', x.reviewed
    ) order by x.created_at, x.id), '[]'::jsonb)
  from (
    select distinct on (oi.product_id) oi.id, oi.title, oi.size, oi.color, oi.image, p.handle, oi.created_at,
      exists (
        select 1 from public.reviews r where r.order_id = p_order_id and r.product_id = oi.product_id
      ) as reviewed
    from public.order_items oi
    join public.products p on p.id = oi.product_id and p.status = 'active'
    where oi.order_id = p_order_id and oi.restocked_quantity < oi.quantity
    order by oi.product_id, oi.created_at, oi.id
  ) x
$$;

-- Schritt 1 der Seite /bewertung/<schlüssel>: Stücke der Bestellung. Bremse pro IP.
create or replace function public.review_lookup(p_token text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order record;
begin
  if not private.reviews_enabled() then
    return jsonb_build_object('status', 'disabled');
  end if;
  if not private.hit_rate_limit('review-ip:' || coalesce(p_ip, private.request_ip()), 30, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  v_order_id := private.review_invite_order(p_token);
  if v_order_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  select number, locale into v_order from public.orders where id = v_order_id;
  return jsonb_build_object(
    'status', 'ok',
    'number', v_order.number,
    'locale', v_order.locale,
    'items', private.review_items(v_order_id)
  );
end
$$;

-- Schritt 2: eine Bewertung speichern (Status «pending», erscheint erst nach Freigabe). Bremsen pro IP und, nach
-- gültigem Link, pro Bestellung. Eingaben prüft die Edge Function; die Tabelle prüft sie nochmals.
create or replace function public.review_submit(
  p_token text,
  p_order_item_id uuid,
  p_rating int,
  p_title text,
  p_body text,
  p_display_name text,
  p_locale text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_item record;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_body text := btrim(coalesce(p_body, ''));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_review public.reviews;
begin
  if not private.reviews_enabled() then
    return jsonb_build_object('status', 'disabled');
  end if;
  if not private.hit_rate_limit('review-ip:' || coalesce(p_ip, private.request_ip()), 30, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  v_order_id := private.review_invite_order(p_token);
  if v_order_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not private.hit_rate_limit('review-order:' || v_order_id::text, 10, interval '1 day') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if p_rating is null or p_rating not between 1 and 5
     or char_length(v_body) not between 10 and 2000
     or char_length(v_name) not between 1 and 40
     or (v_title is not null and char_length(v_title) > 80) then
    return jsonb_build_object('status', 'invalid');
  end if;
  select oi.id, oi.product_id into v_item
    from public.order_items oi
    join public.products p on p.id = oi.product_id and p.status = 'active'
    where oi.id = p_order_item_id and oi.order_id = v_order_id and oi.restocked_quantity < oi.quantity;
  if not found then
    return jsonb_build_object('status', 'invalid_item');
  end if;
  if exists (
    select 1 from public.reviews
    where order_item_id = v_item.id or (order_id = v_order_id and product_id = v_item.product_id)
  ) then
    return jsonb_build_object('status', 'duplicate');
  end if;
  insert into public.reviews (product_id, order_id, order_item_id, rating, title, body, display_name, locale)
  values (v_item.product_id, v_order_id, v_item.id, p_rating, v_title, v_body, v_name,
    case when p_locale = 'en' then 'en' else 'de' end)
  returning * into v_review;
  return jsonb_build_object('status', 'ok', 'id', v_review.id, 'items', private.review_items(v_order_id));
exception
  when unique_violation then
    return jsonb_build_object('status', 'duplicate');
end
$$;

-- Öffentlich: Durchschnitt, Anzahl und die neuesten freigegebenen Bewertungen eines Produkts. null, wenn
-- Bewertungen aus sind, das Produkt nicht aktiv ist oder ein Muster ist (Tag «muster»).
create or replace function public.product_reviews(p_handle text, p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if not private.reviews_enabled() then
    return null;
  end if;
  select id into v_product_id from public.products
    where handle = p_handle and status = 'active' and not ('muster' = any (tags));
  if v_product_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'count', (select count(*) from public.reviews where product_id = v_product_id and status = 'approved'),
    'average', (
      select round(avg(rating)::numeric, 1) from public.reviews
      where product_id = v_product_id and status = 'approved'
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id, 'rating', r.rating, 'title', r.title, 'body', r.body,
          'display_name', r.display_name, 'locale', r.locale, 'date', r.approved_at
        ) order by r.approved_at desc, r.id)
      from (
        select * from public.reviews
        where product_id = v_product_id and status = 'approved'
        order by approved_at desc, id
        limit v_limit
      ) r
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function
  private.reviews_enabled(),
  private.review_invite_order(text),
  private.review_items(uuid),
  public.review_invite_create(uuid, int, boolean),
  public.review_lookup(text, text),
  public.review_submit(text, uuid, int, text, text, text, text, text),
  public.product_reviews(text, int)
from public, anon, authenticated;

grant execute on function
  public.review_invite_create(uuid, int, boolean),
  public.review_lookup(text, text),
  public.review_submit(text, uuid, int, text, text, text, text, text)
to service_role;

grant execute on function public.product_reviews(text, int) to anon, authenticated, service_role;
