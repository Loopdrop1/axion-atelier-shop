-- Retoure anmelden: Kundschaft meldet Rücksendungen zu einer bezahlten Bestellung an (Edge Function «return-request»,
-- Schritte lookup und submit). Gespeichert wird je Anmeldung eine Zeile mit den gewählten Stücken (items, Momentaufnahme
-- von Titel, Farbe, Grösse, Bild), Grund und Kommentar. Status: requested → received → refunded | rejected; Admin → Retouren.
-- Erstattung und Wiedereinbuchen bleiben an der Bestellung (Rückerstattung, «Retoure einbuchen»).
-- Pro Bestellposition kann höchstens die bestellte Menge angemeldet werden (abgelehnte Anmeldungen geben sie frei).
-- Kein Zugriff für anon; Admins lesen und ändern Status und Notiz (RLS); die RPCs gehören nur service_role.
-- Text statt citext (Lovable Cloud kennt citext nicht); gleiche Datei in drizzle/migrations als 0016. Mehrfach ausführbar.

create sequence if not exists public.return_request_number_seq start 1001;

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.return_request_number_seq'),
  order_id uuid not null references public.orders (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email like '%@%'),
  locale text not null default 'de' check (locale in ('de', 'en')),
  status text not null default 'requested' check (status in ('requested', 'received', 'refunded', 'rejected')),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  comment text check (comment is null or char_length(comment) <= 1000),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  client_request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists return_requests_order_idx on public.return_requests (order_id);
create index if not exists return_requests_status_created_idx on public.return_requests (status, created_at desc);
drop trigger if exists return_requests_updated_at on public.return_requests;
create trigger return_requests_updated_at before update on public.return_requests
  for each row execute function private.set_updated_at();

alter table public.return_requests enable row level security;
revoke all on public.return_requests from anon, authenticated;
grant select on public.return_requests to authenticated;
grant update (status, admin_note) on public.return_requests to authenticated;
grant all on public.return_requests to service_role;
drop policy if exists "Retouren: Admin liest" on public.return_requests;
create policy "Retouren: Admin liest" on public.return_requests
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "Retouren: Admin ändert" on public.return_requests;
create policy "Retouren: Admin ändert" on public.return_requests
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Bereits angemeldete Menge einer Bestellposition (abgelehnte Anmeldungen zählen nicht).
create or replace function private.return_requested_qty(p_order_id uuid, p_item_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((e ->> 'quantity')::int), 0)::int
  from public.return_requests r
  cross join lateral jsonb_array_elements(r.items) e
  where r.order_id = p_order_id and r.status <> 'rejected' and e ->> 'order_item_id' = p_item_id::text
$$;

-- Noch zurückgebbare Stücke einer Bestellung (nur Menge > 0).
create or replace function private.return_open_items(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'order_item_id', x.id, 'title', x.title, 'size', x.size, 'color', x.color, 'image', x.image,
      'quantity', x.open_qty
    ) order by x.created_at, x.id), '[]'::jsonb)
  from (
    select i.*, i.quantity - private.return_requested_qty(i.order_id, i.id) as open_qty
    from public.order_items i where i.order_id = p_order_id
  ) x
  where x.open_qty > 0
$$;

revoke all on function private.return_requested_qty(uuid, uuid), private.return_open_items(uuid) from public;

-- Schritt 1: Bestellnummer + E-Mail prüfen und die zurückgebbaren Stücke liefern.
-- 'not_found' ist einheitlich für unbekannte Nummer, falsche Adresse und nicht bezahlte Bestellungen; 'expired',
-- 'nothing_returnable' und 'ok' gibt es erst, wenn die Adresse zur Bestellung passt. Fristbeginn: Versand, sonst Zahlung.
-- Begrenzt pro IP (30 pro Stunde), Adresse (15), Bestellung (20) und gesamt (500): 'rate_limited'.
create or replace function public.return_lookup(p_order_number bigint, p_email text, p_ip text, p_days int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.normalize_email(p_email);
  v_days int := least(greatest(coalesce(p_days, 14), 1), 365);
  v_order public.orders;
  v_deadline timestamptz;
  v_items jsonb;
begin
  if not private.hit_rate_limit('return-ip:' || coalesce(nullif(btrim(p_ip), ''), 'unbekannt'), 30, interval '1 hour')
     or not private.hit_rate_limit('return-email:' || v_email, 15, interval '1 hour')
     or not private.hit_rate_limit('return-order:' || coalesce(p_order_number, 0), 20, interval '1 hour')
     or not private.hit_rate_limit('return-global', 500, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_order from public.orders
    where number = p_order_number and kind = 'cart' and status in ('paid', 'shipped', 'refunded')
      and lower(btrim(email)) = v_email;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  v_deadline := coalesce(v_order.shipped_at, v_order.paid_at) + make_interval(days => v_days);
  if v_order.status = 'refunded' then
    return jsonb_build_object('status', 'nothing_returnable');
  end if;
  if v_deadline is null or v_deadline < now() then
    return jsonb_build_object('status', 'expired', 'return_days', v_days);
  end if;
  v_items := private.return_open_items(v_order.id);
  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('status', 'nothing_returnable');
  end if;
  return jsonb_build_object('status', 'ok', 'number', v_order.number, 'locale', v_order.locale,
    'deadline', v_deadline, 'items', v_items);
end
$$;

-- Schritt 2: Anmeldung speichern. p_items: [{order_item_id, quantity, reason}]. Gleiche Prüfungen wie lookup, dazu
-- Menge ≤ noch zurückgebbar. p_request_id (UUID aus dem Formular) macht doppeltes Absenden unschädlich: dieselbe
-- Anmeldung wird nochmals geliefert ('duplicate' = true), nichts wird zweimal angelegt.
-- Status: 'ok', 'not_found', 'expired', 'nothing_returnable', 'invalid_items', 'rate_limited'.
create or replace function public.return_submit(
  p_order_number bigint,
  p_email text,
  p_items jsonb,
  p_comment text,
  p_locale text,
  p_ip text,
  p_days int,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.normalize_email(p_email);
  v_days int := least(greatest(coalesce(p_days, 14), 1), 365);
  v_locale text := case when p_locale = 'en' then 'en' else 'de' end;
  v_comment text := nullif(left(btrim(coalesce(p_comment, '')), 1000), '');
  v_order public.orders;
  v_deadline timestamptz;
  v_entry jsonb;
  v_item public.order_items;
  v_qty int;
  v_reason text;
  v_seen uuid[] := '{}';
  v_snapshot jsonb := '[]'::jsonb;
  v_row public.return_requests;
begin
  if not private.hit_rate_limit('return-submit-ip:' || coalesce(nullif(btrim(p_ip), ''), 'unbekannt'), 10, interval '1 hour')
     or not private.hit_rate_limit('return-submit-email:' || v_email, 5, interval '1 hour')
     or not private.hit_rate_limit('return-order:' || coalesce(p_order_number, 0), 20, interval '1 hour')
     or not private.hit_rate_limit('return-global', 500, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_order from public.orders
    where number = p_order_number and kind = 'cart' and status in ('paid', 'shipped', 'refunded')
      and lower(btrim(email)) = v_email
    for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_request_id is not null then
    select * into v_row from public.return_requests where client_request_id = p_request_id and order_id = v_order.id;
    if found then
      return jsonb_build_object('status', 'ok', 'duplicate', true, 'id', v_row.id, 'number', v_row.number,
        'order_number', v_order.number, 'email', v_row.email, 'locale', v_row.locale, 'items', v_row.items,
        'comment', v_row.comment);
    end if;
  end if;
  if v_order.status = 'refunded' then
    return jsonb_build_object('status', 'nothing_returnable');
  end if;
  v_deadline := coalesce(v_order.shipped_at, v_order.paid_at) + make_interval(days => v_days);
  if v_deadline is null or v_deadline < now() then
    return jsonb_build_object('status', 'expired', 'return_days', v_days);
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    return jsonb_build_object('status', 'invalid_items');
  end if;
  for v_entry in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_entry ->> 'quantity')::int;
    v_reason := v_entry ->> 'reason';
    select * into v_item from public.order_items
      where id = (v_entry ->> 'order_item_id')::uuid and order_id = v_order.id;
    if not found or v_qty is null or v_qty < 1
       or v_item.id = any (v_seen)
       or v_reason is null or v_reason not in ('too_small', 'too_large', 'style', 'quality', 'wrong_item', 'other')
       or v_qty > v_item.quantity - private.return_requested_qty(v_order.id, v_item.id) then
      return jsonb_build_object('status', 'invalid_items');
    end if;
    v_seen := v_seen || v_item.id;
    v_snapshot := v_snapshot || jsonb_build_object(
      'order_item_id', v_item.id, 'title', v_item.title, 'size', v_item.size, 'color', v_item.color,
      'image', v_item.image, 'quantity', v_qty, 'reason', v_reason);
  end loop;
  insert into public.return_requests (order_id, email, locale, items, comment, client_request_id)
  values (v_order.id, v_email, v_locale, v_snapshot, v_comment, p_request_id)
  returning * into v_row;
  return jsonb_build_object('status', 'ok', 'duplicate', false, 'id', v_row.id, 'number', v_row.number,
    'order_number', v_order.number, 'email', v_row.email, 'locale', v_row.locale, 'items', v_row.items,
    'comment', v_row.comment);
end
$$;

revoke all on function
  public.return_lookup(bigint, text, text, int),
  public.return_submit(bigint, text, jsonb, text, text, text, int, uuid)
from public, anon, authenticated;

grant execute on function
  public.return_lookup(bigint, text, text, int),
  public.return_submit(bigint, text, jsonb, text, text, text, int, uuid)
to service_role;
