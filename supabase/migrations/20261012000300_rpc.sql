-- Axion: Geschäftslogik (Kasse, Zahlung, Gutscheine, Rabatte, Newsletter, Admin)
-- Alle Funktionen mit SECURITY DEFINER setzen search_path = '' und prüfen Rechte selbst.
-- EXECUTE wird ausdrücklich vergeben; Postgres würde es sonst allen Rollen geben.

-- Einstellungen ------------------------------------------------------------------------------------

create table public.shop_settings (
  id int primary key default 1 check (id = 1),
  shipping_cents int not null default 0 check (shipping_cents between 0 and 100000),
  free_shipping_from_cents int check (free_shipping_from_cents >= 0),
  gift_card_min_cents int not null default 2500 check (gift_card_min_cents >= 100),
  gift_card_max_cents int not null default 100000 check (gift_card_max_cents <= 1000000),
  gift_card_valid_years int not null default 5 check (gift_card_valid_years between 1 and 30),
  newsletter_welcome_percent int check (newsletter_welcome_percent between 1 and 50),
  notify_email text check (char_length(notify_email) <= 254),
  updated_at timestamptz not null default now(),
  check (gift_card_min_cents <= gift_card_max_cents)
);
insert into public.shop_settings default values;
alter table public.shop_settings enable row level security;
revoke all on public.shop_settings from anon, authenticated;
create trigger shop_settings_updated_at before update on public.shop_settings
  for each row execute function private.set_updated_at();

create policy "Einstellungen: alle lesen" on public.shop_settings
  for select to anon, authenticated using (true);
create policy "Einstellungen: Admin ändert" on public.shop_settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select (id, shipping_cents, free_shipping_from_cents, gift_card_min_cents, gift_card_max_cents,
  gift_card_valid_years, newsletter_welcome_percent) on public.shop_settings to anon, authenticated;
-- notify_email (interne Adresse des Shops) liest nur das Admin, über admin_get_settings().
grant select (updated_at) on public.shop_settings to authenticated;
grant update (shipping_cents, free_shipping_from_cents, gift_card_min_cents, gift_card_max_cents,
  gift_card_valid_years, newsletter_welcome_percent, notify_email) on public.shop_settings to authenticated;
grant all on public.shop_settings to service_role;

-- Interne Hilfsfunktionen --------------------------------------------------------------------------

create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'admin'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_uid;
end
$$;

create or replace function private.request_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := coalesce(v_headers ->> 'cf-connecting-ip', split_part(v_headers ->> 'x-forwarded-for', ',', 1));
  return coalesce(nullif(btrim(v_ip), ''), 'unbekannt');
end
$$;

-- true = erlaubt, false = zu viele Versuche im Zeitfenster
create or replace function private.hit_rate_limit(p_key text, p_limit int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end
$$;

create or replace function private.random_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(24), 'hex')
$$;

create or replace function private.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

-- Gutscheincode AXN-XXXX-XXXX-XXXX aus 32 Zeichen ohne 0, O, 1, I (gleichverteilt, 60 Bit Zufall)
create or replace function private.gift_card_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_chars text := '';
begin
  for i in 0..11 loop
    v_chars := v_chars || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return 'AXN-' || substr(v_chars, 1, 4) || '-' || substr(v_chars, 5, 4) || '-' || substr(v_chars, 9, 4);
end
$$;

create or replace function private.normalize_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(v) > 254 or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;
  return v;
end
$$;

-- Rabattcode prüfen und Betrag berechnen. p_lock sperrt die Zeile für die Reservierung.
-- Vergleich über lower(), weil bei search_path = '' der citext-Operator aus «extensions» nicht greift.
create or replace function private.evaluate_discount(p_code text, p_subtotal_cents int, p_lock boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dc public.discount_codes;
  v_pending int;
  v_amount int;
begin
  if p_lock then
    select * into v_dc from public.discount_codes where lower(code::text) = lower(btrim(p_code)) for update;
  else
    select * into v_dc from public.discount_codes where lower(code::text) = lower(btrim(p_code));
  end if;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not v_dc.active then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if v_dc.starts_at is not null and v_dc.starts_at > now() then
    return jsonb_build_object('valid', false, 'reason', 'not_started');
  end if;
  if v_dc.ends_at is not null and v_dc.ends_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if p_subtotal_cents < v_dc.min_subtotal_cents then
    return jsonb_build_object('valid', false, 'reason', 'min_subtotal', 'min_subtotal_cents', v_dc.min_subtotal_cents);
  end if;
  if v_dc.max_redemptions is not null then
    select count(*) into v_pending from public.orders o
      where o.discount_code_id = v_dc.id and o.status = 'pending';
    if v_dc.redemptions + v_pending >= v_dc.max_redemptions then
      return jsonb_build_object('valid', false, 'reason', 'exhausted');
    end if;
  end if;
  if v_dc.kind = 'percent' then
    v_amount := (p_subtotal_cents * v_dc.value) / 100;
    v_amount := v_amount - (v_amount % 5); -- auf 5 Rappen abrunden
  else
    v_amount := least(v_dc.value, p_subtotal_cents);
  end if;
  return jsonb_build_object(
    'valid', true, 'id', v_dc.id, 'code', upper(v_dc.code::text), 'kind', v_dc.kind,
    'value', v_dc.value, 'discount_cents', v_amount
  );
end
$$;

-- Gutschein prüfen. p_lock sperrt die Zeile für die Reservierung.
create or replace function private.evaluate_gift_card(p_code text, p_lock boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gc public.gift_cards;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if p_lock then
    select * into v_gc from public.gift_cards where code = v_code for update;
  else
    select * into v_gc from public.gift_cards where code = v_code;
  end if;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if v_gc.status <> 'active' then
    return jsonb_build_object('valid', false, 'reason', 'disabled');
  end if;
  if v_gc.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired', 'expires_at', v_gc.expires_at);
  end if;
  if v_gc.balance_cents <= 0 then
    return jsonb_build_object('valid', false, 'reason', 'empty');
  end if;
  return jsonb_build_object('valid', true, 'id', v_gc.id, 'balance_cents', v_gc.balance_cents, 'expires_at', v_gc.expires_at);
end
$$;

create or replace function private.issue_gift_card(
  p_amount_cents int,
  p_locale text,
  p_purchaser_email text,
  p_recipient_email text,
  p_recipient_name text,
  p_sender_name text,
  p_message text,
  p_order_id uuid,
  p_created_by uuid,
  p_note text
)
returns public.gift_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_years int;
  v_card public.gift_cards;
  v_try int := 0;
begin
  select gift_card_valid_years into v_years from public.shop_settings where id = 1;
  loop
    begin
      insert into public.gift_cards (code, initial_cents, balance_cents, expires_at, locale, purchaser_email,
        recipient_email, recipient_name, sender_name, message, purchase_order_id, created_by, note)
      values (private.gift_card_code(), p_amount_cents, p_amount_cents,
        date_trunc('day', now()) + make_interval(years => coalesce(v_years, 5)) + interval '1 day' - interval '1 second',
        case when p_locale = 'en' then 'en' else 'de' end,
        nullif(btrim(p_purchaser_email), ''), nullif(btrim(p_recipient_email), ''),
        left(nullif(btrim(p_recipient_name), ''), 100), left(nullif(btrim(p_sender_name), ''), 100),
        left(nullif(btrim(p_message), ''), 500), p_order_id, p_created_by, left(p_note, 500))
      returning * into v_card;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;
  insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind, created_by)
  values (v_card.id, p_order_id, p_amount_cents, 'issue', p_created_by);
  return v_card;
end
$$;

create or replace function private.gift_card_json(p_card public.gift_cards)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_card.id, 'code', p_card.code, 'initial_cents', p_card.initial_cents,
    'balance_cents', p_card.balance_cents, 'expires_at', p_card.expires_at, 'locale', p_card.locale,
    'purchaser_email', p_card.purchaser_email, 'recipient_email', p_card.recipient_email,
    'recipient_name', p_card.recipient_name, 'sender_name', p_card.sender_name, 'message', p_card.message
  )
$$;

-- Vollständige Bestellung als JSON (für E-Mails und Admin)
create or replace function private.order_json(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'kind', o.kind, 'status', o.status, 'status_token', o.status_token,
    'email', o.email, 'locale', o.locale, 'user_id', o.user_id,
    'subtotal_cents', o.subtotal_cents, 'discount_cents', o.discount_cents, 'discount_code', o.discount_code,
    'gift_card_cents', o.gift_card_cents, 'shipping_cents', o.shipping_cents, 'total_cents', o.total_cents,
    'refunded_cents', o.refunded_cents, 'shipping_name', o.shipping_name, 'shipping_address', o.shipping_address,
    'phone', o.phone, 'payment_method', o.payment_method, 'tracking_number', o.tracking_number,
    'paid_at', o.paid_at, 'shipped_at', o.shipped_at, 'created_at', o.created_at,
    'needs_attention', o.needs_attention, 'admin_note', o.admin_note, 'gift_card_purchase', o.gift_card_purchase,
    'cancelled_at', o.cancelled_at, 'cancel_reason', o.cancel_reason,
    'stripe_session_id', o.stripe_session_id, 'stripe_payment_intent_id', o.stripe_payment_intent_id,
    'confirmation_sent_at', o.confirmation_sent_at, 'notification_sent_at', o.notification_sent_at,
    'gift_card_sent_at', o.gift_card_sent_at, 'shipping_sent_at', o.shipping_sent_at,
    'issued_gift_card', (select private.gift_card_json(g) from public.gift_cards g where g.id = o.issued_gift_card_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'variant_id', i.variant_id, 'product_id', i.product_id, 'handle', i.handle, 'title', i.title,
        'size', i.size, 'color', i.color, 'image', i.image, 'unit_price_cents', i.unit_price_cents,
        'quantity', i.quantity, 'line_total_cents', i.line_total_cents, 'restocked_quantity', i.restocked_quantity
      ) order by i.created_at, i.id)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o where o.id = p_order_id
$$;

-- Bestellung stornieren: nur offene Reservierungen; Bestand und Gutschein kommen zurück.
create or replace function private.cancel_pending(p_order_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending' then
    return false;
  end if;
  for v_item in
    select i.variant_id, i.quantity from public.order_items i
    where i.order_id = p_order_id and i.variant_id is not null
    order by i.variant_id
  loop
    update public.product_variants set stock = stock + v_item.quantity where id = v_item.variant_id;
    insert into public.stock_movements (variant_id, delta, reason, order_id)
    values (v_item.variant_id, v_item.quantity, 'release', p_order_id);
  end loop;
  if v_order.gift_card_id is not null and v_order.gift_card_cents > 0 then
    update public.gift_cards
      set balance_cents = least(initial_cents, balance_cents + v_order.gift_card_cents)
      where id = v_order.gift_card_id;
    insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind)
    values (v_order.gift_card_id, p_order_id, v_order.gift_card_cents, 'release');
  end if;
  update public.orders
    set status = 'cancelled', cancelled_at = now(), cancel_reason = left(p_reason, 200)
    where id = p_order_id;
  return true;
end
$$;

revoke all on function private.require_admin(), private.request_ip(), private.hit_rate_limit(text, int, interval),
  private.random_token(), private.hash_token(text), private.gift_card_code(), private.normalize_email(text),
  private.evaluate_discount(text, int, boolean), private.evaluate_gift_card(text, boolean),
  private.issue_gift_card(int, text, text, text, text, text, text, uuid, uuid, text),
  private.gift_card_json(public.gift_cards), private.order_json(uuid), private.cancel_pending(uuid, text)
  from public;

-- Kasse --------------------------------------------------------------------------------------------

create or replace function public.release_expired_orders(p_grace interval default interval '15 minutes')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'pending'
      and coalesce(o.expires_at, o.created_at + interval '35 minutes') < now() - p_grace
    order by o.created_at
    limit 100
    for update skip locked
  loop
    if private.cancel_pending(v_id, 'expired') then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;

create or replace function public.reserve_checkout(
  p_lines jsonb,
  p_email text,
  p_locale text default 'de',
  p_discount_code text default null,
  p_gift_card_code text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := case when p_locale = 'en' then 'en' else 'de' end;
  v_email text;
  v_req record;
  v_requested int;
  v_found int := 0;
  v_out jsonb := '[]'::jsonb;
  v_subtotal int := 0;
  v_discount int := 0;
  v_discount_json jsonb;
  v_gift int := 0;
  v_gift_json jsonb;
  v_shipping int := 0;
  v_settings public.shop_settings;
  v_order_id uuid;
  v_number bigint;
  v_token uuid;
  v_lines jsonb := '[]'::jsonb;
begin
  v_email := private.normalize_email(p_email);

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"empty"}';
  end if;
  if jsonb_array_length(p_lines) > 30 then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"too_many"}';
  end if;

  perform public.release_expired_orders();

  create temporary table if not exists pg_temp.axion_checkout_req (variant_id uuid primary key, quantity int not null)
    on commit drop;
  truncate pg_temp.axion_checkout_req;
  begin
    insert into pg_temp.axion_checkout_req (variant_id, quantity)
    select (l ->> 'variant_id')::uuid, sum((l ->> 'quantity')::int)
    from jsonb_array_elements(p_lines) l
    group by 1;
  exception when invalid_text_representation or numeric_value_out_of_range or not_null_violation then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"format"}';
  end;
  if exists (select 1 from pg_temp.axion_checkout_req where quantity < 1 or quantity > 10) then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"quantity"}';
  end if;
  select count(*) into v_requested from pg_temp.axion_checkout_req;

  -- Varianten in fester Reihenfolge sperren (keine Deadlocks) und prüfen
  for v_req in
    select r.variant_id, r.quantity, v.stock, v.active and p.status = 'active' as sellable,
      coalesce(v.price_cents, p.price_cents) as price_cents, p.id as product_id, p.handle, v.size,
      case when v_locale = 'en' then coalesce(p.title_en, p.title_de) else p.title_de end as title,
      case when v_locale = 'en' then coalesce(p.color_name_en, p.color_name_de) else p.color_name_de end as color,
      (select i.path from public.product_images i where i.product_id = p.id order by i.sort, i.created_at limit 1) as image
    from pg_temp.axion_checkout_req r
    join public.product_variants v on v.id = r.variant_id
    join public.products p on p.id = v.product_id
    order by r.variant_id
    for update of v
  loop
    v_found := v_found + 1;
    if not v_req.sellable then
      v_out := v_out || jsonb_build_object('variant_id', v_req.variant_id, 'available', 0);
    elsif v_req.stock < v_req.quantity then
      v_out := v_out || jsonb_build_object('variant_id', v_req.variant_id, 'available', v_req.stock);
    end if;
    v_subtotal := v_subtotal + v_req.price_cents * v_req.quantity;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_req.variant_id, 'product_id', v_req.product_id, 'handle', v_req.handle,
      'title', v_req.title, 'size', v_req.size, 'color', v_req.color, 'image', v_req.image,
      'unit_price_cents', v_req.price_cents, 'quantity', v_req.quantity
    );
  end loop;

  if v_found <> v_requested then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"unknown_variant"}';
  end if;
  if jsonb_array_length(v_out) > 0 then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001', detail = v_out::text;
  end if;

  -- Rabatt
  if nullif(btrim(coalesce(p_discount_code, '')), '') is not null then
    v_discount_json := private.evaluate_discount(p_discount_code, v_subtotal, true);
    if not (v_discount_json ->> 'valid')::boolean then
      raise exception 'DISCOUNT_INVALID' using errcode = 'P0001', detail = v_discount_json::text;
    end if;
    v_discount := (v_discount_json ->> 'discount_cents')::int;
  end if;

  -- Versand
  select * into v_settings from public.shop_settings where id = 1;
  v_shipping := case
    when v_settings.free_shipping_from_cents is not null and v_subtotal - v_discount >= v_settings.free_shipping_from_cents then 0
    else v_settings.shipping_cents
  end;

  -- Gutschein
  if nullif(btrim(coalesce(p_gift_card_code, '')), '') is not null then
    v_gift_json := private.evaluate_gift_card(p_gift_card_code, true);
    if not (v_gift_json ->> 'valid')::boolean then
      raise exception 'GIFT_CARD_INVALID' using errcode = 'P0001', detail = v_gift_json::text;
    end if;
    v_gift := least((v_gift_json ->> 'balance_cents')::int, v_subtotal - v_discount + v_shipping);
    -- Stripe verlangt mindestens CHF 0.50. Bleibt weniger offen, wird weniger Guthaben verwendet.
    if v_subtotal - v_discount - v_gift + v_shipping between 1 and 49 then
      v_gift := greatest(0, v_gift - (50 - (v_subtotal - v_discount - v_gift + v_shipping)));
    end if;
  end if;

  insert into public.orders (kind, status, user_id, email, locale, subtotal_cents, discount_cents, discount_code,
    discount_code_id, gift_card_cents, gift_card_id, shipping_cents, total_cents, expires_at)
  values ('cart', 'pending', p_user_id, v_email, v_locale, v_subtotal, v_discount, v_discount_json ->> 'code',
    (v_discount_json ->> 'id')::uuid, v_gift, case when v_gift > 0 then (v_gift_json ->> 'id')::uuid end,
    v_shipping, v_subtotal - v_discount - v_gift + v_shipping, now() + interval '35 minutes')
  returning id, number, status_token into v_order_id, v_number, v_token;

  insert into public.order_items (order_id, product_id, variant_id, handle, title, size, color, image,
    unit_price_cents, quantity, line_total_cents)
  select v_order_id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid, l ->> 'handle', l ->> 'title',
    l ->> 'size', l ->> 'color', l ->> 'image', (l ->> 'unit_price_cents')::int, (l ->> 'quantity')::int,
    (l ->> 'unit_price_cents')::int * (l ->> 'quantity')::int
  from jsonb_array_elements(v_lines) l;

  update public.product_variants v set stock = v.stock - r.quantity
    from pg_temp.axion_checkout_req r where v.id = r.variant_id;
  insert into public.stock_movements (variant_id, delta, reason, order_id)
    select r.variant_id, -r.quantity, 'reservation', v_order_id from pg_temp.axion_checkout_req r;

  if v_gift > 0 then
    update public.gift_cards set balance_cents = balance_cents - v_gift where id = (v_gift_json ->> 'id')::uuid;
    insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind)
    values ((v_gift_json ->> 'id')::uuid, v_order_id, -v_gift, 'redeem');
  end if;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_number, 'status_token', v_token, 'locale', v_locale,
    'email', v_email, 'subtotal_cents', v_subtotal, 'discount_cents', v_discount,
    'discount_code', v_discount_json ->> 'code', 'gift_card_cents', v_gift, 'shipping_cents', v_shipping,
    'total_cents', v_subtotal - v_discount - v_gift + v_shipping, 'lines', v_lines
  );
end
$$;

create or replace function public.reserve_gift_card_purchase(
  p_amount_cents int,
  p_email text,
  p_locale text default 'de',
  p_purchase jsonb default '{}'::jsonb,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.shop_settings;
  v_email text := private.normalize_email(p_email);
  v_locale text := case when p_locale = 'en' then 'en' else 'de' end;
  v_recipient_email text;
  v_purchase jsonb;
  v_order_id uuid;
  v_number bigint;
  v_token uuid;
begin
  select * into v_settings from public.shop_settings where id = 1;
  if p_amount_cents is null or p_amount_cents % 100 <> 0
     or p_amount_cents < v_settings.gift_card_min_cents or p_amount_cents > v_settings.gift_card_max_cents then
    raise exception 'INVALID_AMOUNT' using errcode = '22023',
      detail = jsonb_build_object('min_cents', v_settings.gift_card_min_cents, 'max_cents', v_settings.gift_card_max_cents)::text;
  end if;
  if nullif(btrim(coalesce(p_purchase ->> 'recipient_email', '')), '') is not null then
    v_recipient_email := private.normalize_email(p_purchase ->> 'recipient_email');
  end if;
  v_purchase := jsonb_build_object(
    'amount_cents', p_amount_cents,
    'recipient_email', v_recipient_email,
    'recipient_name', left(nullif(btrim(p_purchase ->> 'recipient_name'), ''), 100),
    'sender_name', left(nullif(btrim(p_purchase ->> 'sender_name'), ''), 100),
    'message', left(nullif(btrim(p_purchase ->> 'message'), ''), 500)
  );
  insert into public.orders (kind, status, user_id, email, locale, subtotal_cents, total_cents, gift_card_purchase, expires_at)
  values ('gift_card', 'pending', p_user_id, v_email, v_locale, p_amount_cents, p_amount_cents, v_purchase,
    now() + interval '35 minutes')
  returning id, number, status_token into v_order_id, v_number, v_token;
  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_number, 'status_token', v_token, 'locale', v_locale,
    'email', v_email, 'total_cents', p_amount_cents, 'purchase', v_purchase
  );
end
$$;

create or replace function public.attach_checkout_session(p_order_id uuid, p_session_id text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
    set stripe_session_id = p_session_id, expires_at = p_expires_at + interval '5 minutes'
    where id = p_order_id and status = 'pending';
  if not found then
    raise exception 'ORDER_NOT_PENDING' using errcode = 'P0001';
  end if;
end
$$;

-- Zahlung verbuchen (idempotent). Kommt eine Zahlung nach dem Storno, wird neu reserviert;
-- fehlt Bestand oder Guthaben, wird die Bestellung zur Kontrolle markiert.
create or replace function public.complete_order(p_order_id uuid, p_payment jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
  v_attention boolean := false;
  v_notes text[] := '{}';
  v_card public.gift_cards;
  v_balance int;
  v_amount int := nullif(p_payment ->> 'amount_total_cents', '')::int;
  v_address jsonb := p_payment -> 'address';
  v_email text;
  v_used int;
  v_max int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.status in ('paid', 'shipped', 'refunded') then
    return jsonb_build_object('status', v_order.status, 'newly_paid', false, 'order_number', v_order.number,
      'needs_attention', v_order.needs_attention, 'order', private.order_json(v_order.id));
  end if;

  if v_order.status = 'cancelled' then
    for v_item in
      select i.variant_id, i.quantity from public.order_items i
      where i.order_id = v_order.id and i.variant_id is not null order by i.variant_id
    loop
      update public.product_variants set stock = stock - v_item.quantity
        where id = v_item.variant_id and stock >= v_item.quantity;
      if found then
        insert into public.stock_movements (variant_id, delta, reason, order_id)
        values (v_item.variant_id, -v_item.quantity, 'reclaim', v_order.id);
      else
        v_attention := true;
        v_notes := v_notes || 'Bestand fehlte nach Zahlungseingang'::text;
      end if;
    end loop;
    if v_order.gift_card_id is not null and v_order.gift_card_cents > 0 then
      select balance_cents into v_balance from public.gift_cards where id = v_order.gift_card_id for update;
      if v_balance >= v_order.gift_card_cents then
        update public.gift_cards set balance_cents = balance_cents - v_order.gift_card_cents where id = v_order.gift_card_id;
        insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind)
        values (v_order.gift_card_id, v_order.id, -v_order.gift_card_cents, 'redeem');
      else
        v_attention := true;
        v_notes := v_notes || 'Gutscheinguthaben fehlte nach Zahlungseingang'::text;
      end if;
    end if;
  end if;

  if v_amount is not null and v_amount <> v_order.total_cents then
    v_attention := true;
    v_notes := v_notes || format('Bezahlter Betrag %s statt %s Rappen', v_amount, v_order.total_cents);
  end if;

  if v_order.discount_code_id is not null then
    select redemptions, max_redemptions into v_used, v_max
      from public.discount_codes where id = v_order.discount_code_id for update;
    if v_order.status = 'cancelled' and v_max is not null and v_used >= v_max then
      v_attention := true;
      v_notes := v_notes || 'Rabattcode war nach Zahlungseingang schon aufgebraucht'::text;
    end if;
    update public.discount_codes set redemptions = redemptions + 1 where id = v_order.discount_code_id;
  end if;

  begin
    v_email := private.normalize_email(p_payment ->> 'email');
  exception when others then
    v_email := v_order.email;
  end;

  update public.orders set
    status = 'paid',
    paid_at = now(),
    email = v_email,
    shipping_name = coalesce(left(nullif(btrim(p_payment ->> 'name'), ''), 200), shipping_name),
    shipping_address = case when jsonb_typeof(v_address) = 'object' then v_address else shipping_address end,
    phone = coalesce(left(nullif(btrim(p_payment ->> 'phone'), ''), 40), phone),
    stripe_session_id = coalesce(nullif(p_payment ->> 'session_id', ''), stripe_session_id),
    stripe_payment_intent_id = coalesce(nullif(p_payment ->> 'payment_intent_id', ''), stripe_payment_intent_id),
    payment_method = coalesce(nullif(p_payment ->> 'payment_method', ''), payment_method,
      case when v_order.total_cents = 0 then case when v_order.gift_card_cents > 0 then 'gift_card' else 'discount' end end),
    cancelled_at = null,
    cancel_reason = null,
    expires_at = null,
    needs_attention = needs_attention or v_attention,
    admin_note = case when cardinality(v_notes) > 0
      then concat_ws(E'\n', admin_note, array_to_string(v_notes, E'\n')) else admin_note end
  where id = v_order.id;

  if v_order.kind = 'gift_card' then
    v_card := private.issue_gift_card(
      v_order.total_cents, v_order.locale, v_email,
      coalesce(v_order.gift_card_purchase ->> 'recipient_email', v_email),
      v_order.gift_card_purchase ->> 'recipient_name', v_order.gift_card_purchase ->> 'sender_name',
      v_order.gift_card_purchase ->> 'message', v_order.id, null, null
    );
    update public.orders set issued_gift_card_id = v_card.id where id = v_order.id;
  end if;

  return jsonb_build_object(
    'status', 'paid', 'newly_paid', true, 'order_number', v_order.number, 'needs_attention', v_attention,
    'order', private.order_json(v_order.id),
    'gift_card', case when v_card.id is not null then private.gift_card_json(v_card) end
  );
end
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text default 'cancelled')
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.cancel_pending(p_order_id, p_reason)
$$;

create or replace function public.record_refund(p_payment_intent_id text, p_refunded_cents int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_delta int;
  v_card public.gift_cards;
  v_taken int;
begin
  select * into v_order from public.orders where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  v_delta := greatest(0, p_refunded_cents - v_order.refunded_cents);
  update public.orders set
    refunded_cents = greatest(refunded_cents, p_refunded_cents),
    status = case when greatest(refunded_cents, p_refunded_cents) >= total_cents and total_cents > 0
      then 'refunded'::public.order_status else status end
  where id = v_order.id
  returning * into v_order;

  -- Gutscheinkauf zurückerstattet: Der verschickte Code darf nicht weiter gelten.
  if v_order.kind = 'gift_card' and v_order.issued_gift_card_id is not null and v_delta > 0 then
    select * into v_card from public.gift_cards where id = v_order.issued_gift_card_id for update;
    v_taken := least(v_card.balance_cents, v_delta);
    update public.gift_cards set
      balance_cents = balance_cents - v_taken,
      status = case when v_order.status = 'refunded' or balance_cents - v_taken = 0
        then 'disabled'::public.gift_card_status else status end
    where id = v_card.id;
    if v_taken > 0 then
      insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind, note)
      values (v_card.id, v_order.id, -v_taken, 'adjust', 'Rückerstattung des Gutscheinkaufs');
    end if;
    if v_taken < v_delta then
      update public.orders set needs_attention = true,
        admin_note = concat_ws(E'\n', admin_note, format(
          'Gutscheinkauf zurückerstattet, Gutschein %s war schon benutzt: %s Rappen nicht mehr gedeckt',
          v_card.code, v_delta - v_taken))
      where id = v_order.id;
    end if;
  end if;
  return jsonb_build_object('found', true, 'order_number', v_order.number, 'status', v_order.status,
    'refunded_cents', v_order.refunded_cents);
end
$$;

create or replace function public.mark_order_shipped(p_order_id uuid, p_tracking text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_tracking text := nullif(regexp_replace(coalesce(p_tracking, ''), '\s', '', 'g'), '');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.kind <> 'cart' or v_order.status not in ('paid', 'shipped') then
    raise exception 'ORDER_NOT_SHIPPABLE' using errcode = 'P0001';
  end if;
  if v_tracking is not null and v_tracking !~ '^[A-Za-z0-9.-]{6,40}$' then
    raise exception 'INVALID_TRACKING' using errcode = '22023';
  end if;
  update public.orders
    set status = 'shipped', tracking_number = v_tracking, shipped_at = coalesce(shipped_at, now())
    where id = p_order_id;
  return private.order_json(p_order_id);
end
$$;

create or replace function public.get_order_for_email(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.order_json(p_order_id)
$$;

create or replace function public.get_shop_notify_email()
returns text
language sql
security definer
set search_path = ''
as $$
  select notify_email from public.shop_settings where id = 1
$$;

create or replace function public.issue_gift_card(
  p_amount_cents int,
  p_locale text,
  p_recipient_email text,
  p_recipient_name text default null,
  p_sender_name text default null,
  p_message text default null,
  p_created_by uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.gift_cards;
  v_email text;
begin
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 1000000 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_recipient_email, '')), '') is not null then
    v_email := private.normalize_email(p_recipient_email);
  end if;
  v_card := private.issue_gift_card(p_amount_cents, p_locale, null, v_email, p_recipient_name, p_sender_name,
    p_message, null, p_created_by, p_note);
  return private.gift_card_json(v_card);
end
$$;

create or replace function public.mark_order_email_sent(p_order_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set
    confirmation_sent_at = case when p_kind = 'confirmation' then now() else confirmation_sent_at end,
    notification_sent_at = case when p_kind = 'notification' then now() else notification_sent_at end,
    gift_card_sent_at = case when p_kind = 'gift_card' then now() else gift_card_sent_at end,
    shipping_sent_at = case when p_kind = 'shipping' then now() else shipping_sent_at end
  where id = p_order_id;
  if p_kind not in ('confirmation', 'notification', 'gift_card', 'shipping') then
    raise exception 'INVALID_KIND' using errcode = '22023';
  end if;
end
$$;

create or replace function public.user_is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'admin')
$$;

-- Öffentliche Prüfungen (mit Rate-Limit pro IP) ------------------------------------------------------

create or replace function public.check_discount(p_code text, p_subtotal_cents int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.hit_rate_limit('discount:' || private.request_ip(), 30, interval '10 minutes') then
    return jsonb_build_object('valid', false, 'reason', 'rate_limited');
  end if;
  if nullif(btrim(coalesce(p_code, '')), '') is null or p_subtotal_cents is null or p_subtotal_cents < 0 then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  v := private.evaluate_discount(p_code, p_subtotal_cents, false);
  return v - 'id';
end
$$;

create or replace function public.check_gift_card(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.hit_rate_limit('giftcard:' || private.request_ip(), 20, interval '10 minutes') then
    return jsonb_build_object('valid', false, 'reason', 'rate_limited');
  end if;
  v := private.evaluate_gift_card(p_code, false);
  return v - 'id';
end
$$;

create or replace function public.get_order_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', o.number, 'status', o.status, 'kind', o.kind, 'total_cents', o.total_cents,
    'email_hint', left(o.email, 1) || '***@' || split_part(o.email, '@', 2)
  )
  from public.orders o where o.status_token = p_token
$$;

-- Kundenkonto -------------------------------------------------------------------------------------

create or replace function public.claim_guest_orders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_count int;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;
  update public.orders set user_id = v_uid
    where user_id is null and lower(email) = v_email and status <> 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Admin --------------------------------------------------------------------------------------------

create or replace function public.admin_adjust_stock(
  p_variant_id uuid,
  p_delta int,
  p_reason public.stock_reason,
  p_note text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_stock int;
begin
  if p_reason not in ('sale_store', 'return', 'correction') then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'INVALID_DELTA' using errcode = '22023';
  end if;
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001', detail = jsonb_build_object('available', v_stock)::text;
  end if;
  update public.product_variants set stock = stock + p_delta where id = p_variant_id returning stock into v_stock;
  insert into public.stock_movements (variant_id, delta, reason, note, created_by)
  values (p_variant_id, p_delta, p_reason, left(p_note, 500), v_admin);
  return v_stock;
end
$$;

create or replace function public.admin_restock_order(p_order_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_entry jsonb;
  v_item public.order_items;
  v_qty int;
  v_total int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  for v_entry in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_entry ->> 'quantity')::int;
    select * into v_item from public.order_items
      where id = (v_entry ->> 'order_item_id')::uuid and order_id = p_order_id for update;
    if not found or v_qty is null or v_qty < 1 or v_item.restocked_quantity + v_qty > v_item.quantity then
      raise exception 'INVALID_ITEMS' using errcode = '22023';
    end if;
    if v_item.variant_id is not null then
      update public.product_variants set stock = stock + v_qty where id = v_item.variant_id;
      insert into public.stock_movements (variant_id, delta, reason, order_id, created_by)
      values (v_item.variant_id, v_qty, 'return', p_order_id, v_admin);
    end if;
    update public.order_items set restocked_quantity = restocked_quantity + v_qty where id = v_item.id;
    v_total := v_total + v_qty;
  end loop;
  return jsonb_build_object('restocked', v_total);
end
$$;

create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select r.user_id, u.email::text, r.created_at
    from public.user_roles r join auth.users u on u.id = r.user_id
    where r.role = 'admin'
    order by r.created_at;
end
$$;

create or replace function public.admin_grant_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  perform private.require_admin();
  select u.id into v_uid from auth.users u
    where lower(u.email) = lower(btrim(p_email)) and u.email_confirmed_at is not null;
  if v_uid is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role) values (v_uid, 'admin') on conflict do nothing;
  return jsonb_build_object('user_id', v_uid, 'email', lower(btrim(p_email)));
end
$$;

create or replace function public.admin_revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  if p_user_id = v_admin then
    raise exception 'CANNOT_REVOKE_SELF' using errcode = 'P0001';
  end if;
  if (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = 'admin';
end
$$;

create or replace function public.admin_get_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return (select to_jsonb(s) from public.shop_settings s where s.id = 1);
end
$$;

create or replace function public.admin_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'orders', (select count(*) from public.orders o
      where o.kind = 'cart' and o.status in ('paid', 'shipped', 'refunded') and o.paid_at >= p_from and o.paid_at < p_to),
    'revenue_cents', (select coalesce(sum(o.subtotal_cents - o.discount_cents - least(o.refunded_cents, o.subtotal_cents - o.discount_cents)), 0)
      from public.orders o
      where o.kind = 'cart' and o.status in ('paid', 'shipped', 'refunded') and o.paid_at >= p_from and o.paid_at < p_to),
    'gift_cards_sold_cents', (select coalesce(sum(o.total_cents), 0) from public.orders o
      where o.kind = 'gift_card' and o.status in ('paid', 'shipped', 'refunded') and o.paid_at >= p_from and o.paid_at < p_to),
    'open_to_ship', (select count(*) from public.orders o where o.kind = 'cart' and o.status = 'paid'),
    'needs_attention', (select count(*) from public.orders o where o.needs_attention and o.status <> 'cancelled'),
    'newsletter_confirmed', (select count(*) from public.newsletter_subscribers n where n.status = 'confirmed'),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue_cents', d.revenue, 'orders', d.orders) order by d.day)
      from (
        select g.day::date as day,
          coalesce(sum(o.subtotal_cents - o.discount_cents), 0) as revenue,
          count(o.id) as orders
        from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day') g(day)
        left join public.orders o on o.kind = 'cart' and o.status in ('paid', 'shipped', 'refunded')
          and o.paid_at >= g.day and o.paid_at < g.day + interval '1 day'
        group by g.day
      ) d
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select i.title, i.handle, sum(i.quantity)::int as quantity, sum(i.line_total_cents)::int as revenue_cents
        from public.order_items i join public.orders o on o.id = i.order_id
        where o.kind = 'cart' and o.status in ('paid', 'shipped', 'refunded') and o.paid_at >= p_from and o.paid_at < p_to
        group by i.title, i.handle
        order by sum(i.quantity) desc, i.title
        limit 5
      ) t
    ), '[]'::jsonb),
    'low_stock', coalesce((
      select jsonb_agg(t) from (
        select v.id as variant_id, p.handle, p.title_de as title, p.color_name_de as color, v.size, v.stock
        from public.product_variants v join public.products p on p.id = v.product_id
        where p.status = 'active' and v.active and v.stock <= 1
        order by v.stock, p.title_de, v.sort
        limit 20
      ) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;

-- Newsletter (nur über die Edge Function) ----------------------------------------------------------

create or replace function public.newsletter_subscribe(
  p_email text,
  p_locale text,
  p_consent text,
  p_source text default 'footer',
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.normalize_email(p_email);
  v_locale text := case when p_locale = 'en' then 'en' else 'de' end;
  v_source text := case when p_source in ('footer', 'account', 'checkout', 'admin') then p_source else 'footer' end;
  v_sub public.newsletter_subscribers;
  v_token text;
begin
  if nullif(btrim(coalesce(p_consent, '')), '') is null then
    raise exception 'CONSENT_REQUIRED' using errcode = '22023';
  end if;
  -- Pro Adresse, pro IP und gesamt begrenzt, damit niemand über das Formular Mails an fremde Adressen streut.
  if not private.hit_rate_limit('newsletter:' || v_email, 3, interval '1 hour')
     or not private.hit_rate_limit('newsletter-ip:' || coalesce(p_ip, private.request_ip()), 10, interval '1 hour')
     or not private.hit_rate_limit('newsletter-global', 200, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_sub from public.newsletter_subscribers where lower(email::text) = v_email for update;
  if found and v_sub.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed');
  end if;
  v_token := private.random_token();
  if found then
    update public.newsletter_subscribers set status = 'pending', locale = v_locale, consent_text = left(p_consent, 1000),
      consent_at = now(), source = v_source, token_hash = private.hash_token(v_token), unsubscribed_at = null
      where id = v_sub.id;
  else
    insert into public.newsletter_subscribers (email, locale, status, consent_text, source, token_hash)
    values (v_email, v_locale, 'pending', left(p_consent, 1000), v_source, private.hash_token(v_token));
  end if;
  return jsonb_build_object('status', 'pending', 'token', v_token, 'email', v_email, 'locale', v_locale);
end
$$;

create or replace function public.newsletter_confirm(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.newsletter_subscribers;
  v_percent int;
  v_code text;
begin
  select * into v_sub from public.newsletter_subscribers
    where token_hash = private.hash_token(coalesce(p_token, '')) for update;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_sub.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed', 'email', v_sub.email::text, 'locale', v_sub.locale, 'newly_confirmed', false);
  end if;
  if v_sub.status = 'unsubscribed' then
    return jsonb_build_object('status', 'unsubscribed');
  end if;
  select newsletter_welcome_percent into v_percent from public.shop_settings where id = 1;
  if v_percent is not null and v_sub.welcome_code is null then
    loop
      v_code := 'WILLKOMMEN-' || substr(replace(private.gift_card_code(), '-', ''), 4, 10);
      begin
        insert into public.discount_codes (code, kind, value, max_redemptions, ends_at, note)
        values (v_code, 'percent', v_percent, 1, now() + interval '90 days', 'Newsletter-Willkommensrabatt');
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end if;
  update public.newsletter_subscribers
    set status = 'confirmed', confirmed_at = now(), welcome_code = coalesce(welcome_code, v_code)
    where id = v_sub.id;
  return jsonb_build_object('status', 'confirmed', 'newly_confirmed', true, 'email', v_sub.email::text,
    'locale', v_sub.locale, 'welcome_code', coalesce(v_sub.welcome_code, v_code), 'welcome_percent', v_percent);
end
$$;

create or replace function public.newsletter_unsubscribe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.newsletter_subscribers set status = 'unsubscribed', unsubscribed_at = now()
    where token_hash = private.hash_token(coalesce(p_token, ''))
    returning id into v_id;
  return jsonb_build_object('status', case when v_id is null then 'invalid' else 'unsubscribed' end);
end
$$;

-- Ereignisse von Stripe nur einmal verarbeiten. true = neu.
-- 'new' = verarbeiten, 'processing' = läuft gerade (Stripe soll später wiederholen), 'done' = erledigt.
-- Hängt eine Bearbeitung länger als 5 Minuten (Funktion abgebrochen), gilt das Ereignis wieder als neu.
create or replace function public.register_stripe_event(p_event_id text, p_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.stripe_events;
begin
  insert into public.stripe_events (id, type) values (p_event_id, p_type) on conflict (id) do nothing;
  if found then
    return 'new';
  end if;
  select * into v_event from public.stripe_events where id = p_event_id for update;
  if v_event.processed_at is not null then
    return 'done';
  end if;
  if v_event.received_at < now() - interval '5 minutes' then
    update public.stripe_events set received_at = now() where id = p_event_id;
    return 'new';
  end if;
  return 'processing';
end
$$;

create or replace function public.finish_stripe_event(p_event_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stripe_events set processed_at = now() where id = p_event_id
$$;

create or replace function public.forget_stripe_event(p_event_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.stripe_events where id = p_event_id
$$;

-- Rechte -------------------------------------------------------------------------------------------

revoke all on function
  public.release_expired_orders(interval),
  public.reserve_checkout(jsonb, text, text, text, text, uuid),
  public.reserve_gift_card_purchase(int, text, text, jsonb, uuid),
  public.attach_checkout_session(uuid, text, timestamptz),
  public.complete_order(uuid, jsonb),
  public.cancel_order(uuid, text),
  public.record_refund(text, int),
  public.mark_order_shipped(uuid, text),
  public.get_order_for_email(uuid),
  public.mark_order_email_sent(uuid, text),
  public.user_is_admin(uuid),
  public.get_shop_notify_email(),
  public.issue_gift_card(int, text, text, text, text, text, uuid, text),
  public.check_discount(text, int),
  public.check_gift_card(text),
  public.get_order_status(uuid),
  public.claim_guest_orders(),
  public.admin_adjust_stock(uuid, int, public.stock_reason, text),
  public.admin_restock_order(uuid, jsonb),
  public.admin_list_admins(),
  public.admin_grant_admin(text),
  public.admin_revoke_admin(uuid),
  public.admin_get_settings(),
  public.admin_dashboard(timestamptz, timestamptz),
  public.newsletter_subscribe(text, text, text, text, text),
  public.newsletter_confirm(text),
  public.newsletter_unsubscribe(text),
  public.register_stripe_event(text, text),
  public.finish_stripe_event(text),
  public.forget_stripe_event(text)
from public, anon, authenticated;

-- Nur der Server (Edge Functions)
grant execute on function
  public.release_expired_orders(interval),
  public.reserve_checkout(jsonb, text, text, text, text, uuid),
  public.reserve_gift_card_purchase(int, text, text, jsonb, uuid),
  public.attach_checkout_session(uuid, text, timestamptz),
  public.complete_order(uuid, jsonb),
  public.cancel_order(uuid, text),
  public.record_refund(text, int),
  public.mark_order_shipped(uuid, text),
  public.get_order_for_email(uuid),
  public.mark_order_email_sent(uuid, text),
  public.user_is_admin(uuid),
  public.get_shop_notify_email(),
  public.issue_gift_card(int, text, text, text, text, text, uuid, text),
  public.newsletter_subscribe(text, text, text, text, text),
  public.newsletter_confirm(text),
  public.newsletter_unsubscribe(text),
  public.register_stripe_event(text, text),
  public.finish_stripe_event(text),
  public.forget_stripe_event(text)
to service_role;

-- Öffentlich (Warenkorb, Dankesseite)
grant execute on function
  public.check_discount(text, int),
  public.check_gift_card(text),
  public.get_order_status(uuid)
to anon, authenticated, service_role;

-- Eingeloggt (Konto, Admin prüft die Rolle selbst)
grant execute on function
  public.claim_guest_orders(),
  public.admin_adjust_stock(uuid, int, public.stock_reason, text),
  public.admin_restock_order(uuid, jsonb),
  public.admin_list_admins(),
  public.admin_grant_admin(text),
  public.admin_revoke_admin(uuid),
  public.admin_get_settings(),
  public.admin_dashboard(timestamptz, timestamptz)
to authenticated;
