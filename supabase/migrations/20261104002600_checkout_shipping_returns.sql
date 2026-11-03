-- Versandwahl (Economy/Priority) und Sale-Artikel bei Retouren. Gleiche Datei in drizzle/migrations (Cloud) als 0025.
-- Mehrfach ausführbar.
-- 1. shop_settings.priority_shipping_cents: Preis für Post Priority; NULL (Standard) = nicht angeboten. Lesen alle,
--    ändern nur Admins (wie die anderen Versandeinstellungen).
-- 2. orders.shipping_method ('economy' | 'priority', Standard 'economy'), bei der Reservierung gespeichert.
-- 3. order_items.on_sale: beim Anlegen per Trigger gesetzt, wenn das Stück zu diesem Zeitpunkt im Sale war (Tag «sale»
--    oder durchgestrichener Preis über dem Stückpreis, gleiche Regel wie isOnSale im Shop). Ältere Positionen bleiben
--    false (nicht nachträglich raten).
-- 4. reserve_checkout: neuer letzter Parameter p_shipping_method (unbekannt → 'economy'; 'priority' ohne Preis →
--    'economy'). Priority kostet immer den eingestellten Preis, die Gratis-ab-Schwelle gilt nur für Economy. Sonst
--    unverändert wie in 20261030002200. Die alte Fassung mit sechs Parametern wird entfernt.
-- 5. private.order_json: shipping_method und on_sale je Position (Mails, Admin, Webhook).
-- 6. private.return_open_items liefert on_sale (return_lookup zeigt Sale-Stücke ausgegraut); return_submit lehnt
--    Sale-Stücke ab ('invalid_items'). Sonst unverändert wie in 20261103002300.

-- 1 ------------------------------------------------------------------------------------------------
alter table public.shop_settings
  add column if not exists priority_shipping_cents int
    check (priority_shipping_cents is null or priority_shipping_cents >= 0);
grant select (priority_shipping_cents) on public.shop_settings to anon, authenticated;
grant update (priority_shipping_cents) on public.shop_settings to authenticated;

-- 2 ------------------------------------------------------------------------------------------------
alter table public.orders
  add column if not exists shipping_method text not null default 'economy'
    check (shipping_method in ('economy', 'priority'));
grant select (shipping_method) on public.orders to authenticated;

-- 3 ------------------------------------------------------------------------------------------------
alter table public.order_items
  add column if not exists on_sale boolean not null default false;

create or replace function private.order_item_set_on_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.on_sale := coalesce(new.on_sale, false) or coalesce((
    select 'sale' = any (p.tags)
      or coalesce(v.compare_at_cents, p.compare_at_cents, 0) > new.unit_price_cents
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = new.variant_id
  ), false);
  return new;
end
$$;

revoke all on function private.order_item_set_on_sale() from public;

drop trigger if exists order_items_on_sale on public.order_items;
create trigger order_items_on_sale before insert on public.order_items
  for each row execute function private.order_item_set_on_sale();

-- 4 ------------------------------------------------------------------------------------------------
drop function if exists public.reserve_checkout(jsonb, text, text, text, text, uuid);

create or replace function public.reserve_checkout(
  p_lines jsonb,
  p_email text,
  p_locale text default 'de',
  p_discount_code text default null,
  p_gift_card_code text default null,
  p_user_id uuid default null,
  p_shipping_method text default 'economy'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := case when p_locale = 'en' then 'en' else 'de' end;
  v_method text := case when p_shipping_method = 'priority' then 'priority' else 'economy' end;
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
  if jsonb_array_length(p_lines) > 20 then
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
  if exists (select 1 from pg_temp.axion_checkout_req where quantity < 1 or quantity > 3) then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"quantity"}';
  end if;
  if (select sum(quantity) from pg_temp.axion_checkout_req) > 20 then
    raise exception 'INVALID_LINES' using errcode = '22023', detail = '{"reason":"order_quantity"}';
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

  -- Versand: Priority nur mit Preis (sonst Economy); Priority kostet immer den Preis, gratis ab Schwelle nur Economy.
  select * into v_settings from public.shop_settings where id = 1;
  if v_method = 'priority' and v_settings.priority_shipping_cents is null then
    v_method := 'economy';
  end if;
  v_shipping := case
    when v_method = 'priority' then v_settings.priority_shipping_cents
    when v_settings.free_shipping_from_cents is not null and v_subtotal - v_discount >= v_settings.free_shipping_from_cents then 0
    else v_settings.shipping_cents
  end;
  -- Stripe verlangt mindestens CHF 0.50. Liesse der Rabatt weniger übrig, wird er gekürzt, sodass 50 Rappen bleiben.
  -- Weniger Rabatt kann die Gratisversand-Schwelle erreichen (nur Economy): dann ohne Versand nochmals auf 50 Rappen.
  if v_discount > 0 and v_subtotal - v_discount + v_shipping between 1 and 49 then
    v_discount := greatest(0, v_subtotal + v_shipping - 50);
    if v_method = 'economy' and v_settings.free_shipping_from_cents is not null
       and v_subtotal - v_discount >= v_settings.free_shipping_from_cents then
      v_shipping := 0;
      v_discount := greatest(0, v_subtotal - 50);
    end if;
  end if;

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
    discount_code_id, gift_card_cents, gift_card_id, shipping_cents, shipping_method, total_cents, expires_at)
  values ('cart', 'pending', p_user_id, v_email, v_locale, v_subtotal, v_discount, v_discount_json ->> 'code',
    (v_discount_json ->> 'id')::uuid, v_gift, case when v_gift > 0 then (v_gift_json ->> 'id')::uuid end,
    v_shipping, v_method, v_subtotal - v_discount - v_gift + v_shipping, now() + interval '35 minutes')
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
    'shipping_method', v_method, 'total_cents', v_subtotal - v_discount - v_gift + v_shipping, 'lines', v_lines
  );
end
$$;

revoke all on function public.reserve_checkout(jsonb, text, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_checkout(jsonb, text, text, text, text, uuid, text) to service_role;

-- 5 ------------------------------------------------------------------------------------------------
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
    'gift_card_cents', o.gift_card_cents, 'shipping_cents', o.shipping_cents, 'shipping_method', o.shipping_method,
    'total_cents', o.total_cents,
    'refunded_cents', o.refunded_cents, 'vat_rate', o.vat_rate, 'shipping_name', o.shipping_name, 'shipping_address', o.shipping_address,
    'phone', o.phone, 'payment_method', o.payment_method, 'tracking_number', o.tracking_number,
    'paid_at', o.paid_at, 'shipped_at', o.shipped_at, 'created_at', o.created_at,
    'needs_attention', o.needs_attention, 'admin_note', o.admin_note, 'gift_card_purchase', o.gift_card_purchase,
    'cancelled_at', o.cancelled_at, 'cancel_reason', o.cancel_reason,
    'stripe_session_id', o.stripe_session_id, 'stripe_payment_intent_id', o.stripe_payment_intent_id,
    'confirmation_sent_at', o.confirmation_sent_at, 'notification_sent_at', o.notification_sent_at,
    'gift_card_sent_at', o.gift_card_sent_at, 'shipping_sent_at', o.shipping_sent_at,
    'gift_card_credited_cents', coalesce((
      select sum(t.delta_cents) from public.gift_card_transactions t
      where t.order_id = o.id and t.gift_card_id = o.gift_card_id and t.kind = 'adjust' and t.delta_cents > 0
    ), 0),
    'issued_gift_card', (select private.gift_card_json(g) from public.gift_cards g where g.id = o.issued_gift_card_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'variant_id', i.variant_id, 'product_id', i.product_id, 'handle', i.handle, 'title', i.title,
        'size', i.size, 'color', i.color, 'image', i.image, 'unit_price_cents', i.unit_price_cents,
        'quantity', i.quantity, 'line_total_cents', i.line_total_cents, 'restocked_quantity', i.restocked_quantity,
        'on_sale', i.on_sale
      ) order by i.created_at, i.id)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o where o.id = p_order_id
$$;

-- 6 ------------------------------------------------------------------------------------------------
create or replace function private.return_open_items(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'order_item_id', x.id, 'title', x.title, 'size', x.size, 'color', x.color, 'image', x.image,
      'quantity', x.open_qty, 'on_sale', x.on_sale
    ) order by x.created_at, x.id), '[]'::jsonb)
  from (
    -- Schon von Hand eingebuchte Stücke («Retoure einbuchen» ohne Anmeldung) zählen wie angemeldete; greatest statt
    -- Summe, weil eine angemeldete Retoure später auch eingebucht wird.
    select i.*, i.quantity - greatest(private.return_requested_qty(i.order_id, i.id), i.restocked_quantity) as open_qty
    from public.order_items i where i.order_id = p_order_id
  ) x
  where x.open_qty > 0
$$;

revoke all on function private.return_open_items(uuid) from public;

create or replace function public.return_submit(
  p_order_number bigint,
  p_email text,
  p_items jsonb,
  p_comment text,
  p_locale text,
  p_ip text,
  p_days int,
  p_request_id uuid default null,
  p_refund_method text default 'original'
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
  v_refund text := case when p_refund_method = 'gift_card' then 'gift_card' else 'original' end;
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
     or not private.hit_rate_limit('return-order:' || coalesce(p_order_number, 0) || ':' || md5(v_email), 20, interval '1 hour')
     or not private.hit_rate_limit('return-global', 3000, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_order from public.orders
    where number = p_order_number and kind = 'cart' and status in ('paid', 'shipped', 'refunded')
      and lower(btrim(email)) = v_email
    for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- Pro Adresse erst nach passender Bestellung zählen (wie return_lookup).
  if not private.hit_rate_limit('return-submit-email:' || v_email, 5, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if p_request_id is not null then
    select * into v_row from public.return_requests where client_request_id = p_request_id;
    if found and v_row.order_id <> v_order.id then
      -- Dieselbe Formular-Id zu einer anderen Bestellung: nichts verraten, nichts anlegen.
      return jsonb_build_object('status', 'invalid_items');
    end if;
    if found then
      return jsonb_build_object('status', 'ok', 'duplicate', true, 'id', v_row.id, 'number', v_row.number,
        'order_number', v_order.number, 'email', v_row.email, 'locale', v_row.locale, 'items', v_row.items,
        'comment', v_row.comment, 'refund_method', v_row.refund_method);
    end if;
  end if;
  if v_order.status = 'refunded' then
    return jsonb_build_object('status', 'nothing_returnable');
  end if;
  v_deadline := coalesce(v_order.shipped_at + interval '7 days', v_order.paid_at) + make_interval(days => v_days);
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
    -- Sale-Stücke sind von der Rückgabe ausgenommen
    if not found or v_qty is null or v_qty < 1
       or v_item.id = any (v_seen)
       or v_item.on_sale
       or v_reason is null or v_reason not in ('too_small', 'too_large', 'style', 'quality', 'wrong_item', 'other')
       or v_qty > v_item.quantity
                  - greatest(private.return_requested_qty(v_order.id, v_item.id), v_item.restocked_quantity) then
      return jsonb_build_object('status', 'invalid_items');
    end if;
    v_seen := v_seen || v_item.id;
    v_snapshot := v_snapshot || jsonb_build_object(
      'order_item_id', v_item.id, 'title', v_item.title, 'size', v_item.size, 'color', v_item.color,
      'image', v_item.image, 'quantity', v_qty, 'reason', v_reason);
  end loop;
  insert into public.return_requests (order_id, email, locale, items, comment, client_request_id, refund_method)
  values (v_order.id, v_email, v_locale, v_snapshot, v_comment, p_request_id, v_refund)
  returning * into v_row;
  return jsonb_build_object('status', 'ok', 'duplicate', false, 'id', v_row.id, 'number', v_row.number,
    'order_number', v_order.number, 'email', v_row.email, 'locale', v_row.locale, 'items', v_row.items,
    'comment', v_row.comment, 'refund_method', v_row.refund_method);
end
$$;

-- Rechte (wie bisher: nur service_role, für die Edge Function return-request) -----------------------------------
revoke all on function public.return_submit(bigint, text, jsonb, text, text, text, int, uuid, text)
  from public, anon, authenticated;
grant execute on function public.return_submit(bigint, text, jsonb, text, text, text, int, uuid, text) to service_role;
