-- Audit, zweite Runde. Gleiche Datei wie supabase/migrations/20261030002200_audit_round2.sql. Mehrfach ausführbar.
-- 1. checkout_guard: pro E-Mail 30 Kassen in 30 Minuten (vorher 10); die Grenze «höchstens 3 offene Kassen pro Adresse»
--    entfällt, weil jede fremde Person sie mit der Adresse einer Kundin auslösen und deren Kasse sperren konnte.
--    Gegen Bestandsblockade bleibt die Grenze pro IP (8 neue Kassen in 35 Minuten) und der gemeinsame noip-Zähler.
-- 2. return_lookup / return_submit: die Zähler pro Adresse laufen erst, wenn Bestellnummer und Adresse zusammenpassen
--    (Fremde sperren niemanden aus); Fristbeginn ab Versand plus 7 Tage Zustellung (Lieferzeit 2–5 Werktage).
-- 3. record_dispute: Stripe-Streitfall oder Radar-Betrugswarnung an der Bestellung vermerken (needs_attention, Notiz);
--    ein gekaufter Gutschein wird gesperrt. Nur service_role (stripe-webhook).
-- 4. reserve_checkout: Rabatt so kürzen, dass mindestens CHF 0.50 zu zahlen bleiben (Stripe-Minimum).
-- 5. admin_restock_order: sperrt die Bestellung; nur bezahlte/versendete/erstattete Warenkorb-Bestellungen.
-- 6. prune_abandoned_orders: abgebrochene, nie bezahlte Bestellungen nach 30 Tagen löschen (höchstens 500 je Aufruf,
--    nichts mit Gutschein-Buchungen, Gutscheinbezug, Retouren, Erstattung oder Admin-Vermerk); läuft gelegentlich
--    über prune_rate_limits mit.
-- 7. newsletter_subscribe: unbestätigte Anmeldungen, älter als 30 Tage, werden zuerst gelöscht.

-- 1 ------------------------------------------------------------------------------------------------
create or replace function public.checkout_guard(p_email text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip text := btrim(coalesce(p_ip, ''));
begin
  if v_ip <> '' then
    if not private.hit_rate_limit('checkout-ip:' || v_ip, 20, interval '30 minutes') then
      return 'rate_limited';
    end if;
    -- Eine Reservierung hält 35 Minuten: von einer IP aus höchstens 8 neue Kassen in dieser Zeit (genug fürs Hin und Her einer echten Kundin, zu wenig, um Ware zu blockieren).
    if not private.hit_rate_limit('checkout-ip-open:' || v_ip, 8, interval '35 minutes') then
      return 'too_many_open';
    end if;
  elsif not private.hit_rate_limit('checkout-noip', 30, interval '30 minutes') then
    -- IP unbekannt (Proxy ohne Header): gemeinsamer Zähler für alle, damit das Fehlen der IP nichts umgeht.
    return 'rate_limited';
  end if;
  -- Pro Adresse nur eine grosszügige Bremse; keine Grenze für offene Kassen pro Adresse (sonst könnte jede fremde
  -- Person mit der Adresse einer Kundin deren Kasse sperren).
  if not private.hit_rate_limit('checkout-email:' || v_email, 30, interval '30 minutes') then
    return 'rate_limited';
  end if;
  return 'ok';
end
$$;

-- 2 ------------------------------------------------------------------------------------------------
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
     or not private.hit_rate_limit('return-order:' || coalesce(p_order_number, 0) || ':' || md5(v_email), 20, interval '1 hour')
     or not private.hit_rate_limit('return-global', 3000, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select * into v_order from public.orders
    where number = p_order_number and kind = 'cart' and status in ('paid', 'shipped', 'refunded')
      and lower(btrim(email)) = v_email;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- Pro Adresse erst nach passender Bestellung zählen: Fremde mit falscher Nummer sperren die Adresse nicht.
  if not private.hit_rate_limit('return-email:' || v_email, 15, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  v_deadline := coalesce(v_order.shipped_at + interval '7 days', v_order.paid_at) + make_interval(days => v_days);
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
        'comment', v_row.comment);
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
    if not found or v_qty is null or v_qty < 1
       or v_item.id = any (v_seen)
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
  insert into public.return_requests (order_id, email, locale, items, comment, client_request_id)
  values (v_order.id, v_email, v_locale, v_snapshot, v_comment, p_request_id)
  returning * into v_row;
  return jsonb_build_object('status', 'ok', 'duplicate', false, 'id', v_row.id, 'number', v_row.number,
    'order_number', v_order.number, 'email', v_row.email, 'locale', v_row.locale, 'items', v_row.items,
    'comment', v_row.comment);
end
$$;

-- 3 ------------------------------------------------------------------------------------------------
-- Streitfall (charge.dispute.created) oder Betrugswarnung (radar.early_fraud_warning.created): Bestellung markieren,
-- Notiz anhängen (dieselbe Notiz nur einmal, auch wenn Stripe wiederholt), gekauften Gutschein sperren.
create or replace function public.record_dispute(p_payment_intent_id text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_card_disabled boolean := false;
begin
  select * into v_order from public.orders
    where stripe_payment_intent_id = p_payment_intent_id and p_payment_intent_id is not null
    order by created_at desc limit 1
    for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.orders set
    needs_attention = true,
    admin_note = case
      when v_note is null or position(v_note in coalesce(admin_note, '')) > 0 then admin_note
      else left(concat_ws(E'\n', admin_note, v_note), 2000)
    end
  where id = v_order.id;
  if v_order.kind = 'gift_card' and v_order.issued_gift_card_id is not null then
    update public.gift_cards set status = 'disabled'
      where id = v_order.issued_gift_card_id and status <> 'disabled';
    v_card_disabled := found;
  end if;
  return jsonb_build_object('found', true, 'order_id', v_order.id, 'order_number', v_order.number,
    'gift_card_disabled', v_card_disabled);
end
$$;

-- 4 ------------------------------------------------------------------------------------------------
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

  -- Versand
  select * into v_settings from public.shop_settings where id = 1;
  v_shipping := case
    when v_settings.free_shipping_from_cents is not null and v_subtotal - v_discount >= v_settings.free_shipping_from_cents then 0
    else v_settings.shipping_cents
  end;
  -- Stripe verlangt mindestens CHF 0.50. Liesse der Rabatt weniger übrig, wird er gekürzt, sodass 50 Rappen bleiben.
  -- Weniger Rabatt kann die Gratisversand-Schwelle erreichen: dann ohne Versand nochmals auf 50 Rappen rechnen.
  if v_discount > 0 and v_subtotal - v_discount + v_shipping between 1 and 49 then
    v_discount := greatest(0, v_subtotal + v_shipping - 50);
    if v_settings.free_shipping_from_cents is not null and v_subtotal - v_discount >= v_settings.free_shipping_from_cents then
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

-- 5 ------------------------------------------------------------------------------------------------
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
  v_before int;
  v_back uuid[] := '{}';
  v_order public.orders;
begin
  -- Nur bezahlte Warenkorb-Bestellungen (auch versendet oder erstattet) kennen Retouren; die Sperre reiht parallele
  -- Einbuchungen derselben Bestellung hintereinander.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.kind <> 'cart' or v_order.status not in ('paid', 'shipped', 'refunded') then
    raise exception 'ORDER_NOT_PAID' using errcode = 'P0001';
  end if;
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
      select stock into v_before from public.product_variants where id = v_item.variant_id for update;
      update public.product_variants set stock = stock + v_qty where id = v_item.variant_id;
      insert into public.stock_movements (variant_id, delta, reason, order_id, created_by)
      values (v_item.variant_id, v_qty, 'return', p_order_id, v_admin);
      if v_before <= 0 and not v_item.variant_id = any (v_back) then
        v_back := v_back || v_item.variant_id;
      end if;
    end if;
    update public.order_items set restocked_quantity = restocked_quantity + v_qty where id = v_item.id;
    v_total := v_total + v_qty;
  end loop;
  return jsonb_build_object('restocked', v_total, 'back_in_stock', to_jsonb(v_back));
end
$$;

-- 6 ------------------------------------------------------------------------------------------------
-- Fremdschlüssel auf orders: order_items und return_requests (cascade), stock_movements, gift_card_transactions und
-- gift_cards.purchase_order_id (set null). Gelöscht wird nur, was keine Buchhaltung berührt: keine Gutschein-Buchungen
-- (Einlösung und Freigabe bleiben im Gutschein-Journal mit Bestellbezug), kein Gutscheinkauf, keine Retoure, nichts
-- erstattet, kein Admin-Vermerk. Lagerbewegungen (Reservierung und Freigabe heben sich auf) verlieren nur den Bezug.
create or replace function public.prune_abandoned_orders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.orders
  where id in (
    select o.id from public.orders o
    where o.status = 'cancelled' and o.paid_at is null and o.created_at < now() - interval '30 days'
      and o.refunded_cents = 0 and not o.needs_attention and o.issued_gift_card_id is null
      and not exists (select 1 from public.gift_card_transactions t where t.order_id = o.id)
      and not exists (select 1 from public.gift_cards g where g.purchase_order_id = o.id)
      and not exists (select 1 from public.return_requests r where r.order_id = o.id)
    order by o.created_at
    limit 500
    for update of o skip locked
  );
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Läuft gelegentlich mit (die Edge Functions rufen prune_rate_limits bei etwa 5 % der Anfragen auf). Ein Fehler beim
-- Löschen der Bestellungen bricht das Aufräumen der Zähler nicht ab.
create or replace function public.prune_rate_limits()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from private.rate_limits
  where key in (
    select key from private.rate_limits
    where window_start < now() - interval '2 days'
    limit 1000
    for update skip locked
  );
  get diagnostics v_count = row_count;
  begin
    perform public.prune_abandoned_orders();
  exception when others then
    raise warning 'prune_abandoned_orders: %', sqlerrm;
  end;
  return v_count;
end
$$;

-- 7 ------------------------------------------------------------------------------------------------
create index if not exists newsletter_subscribers_pending_idx on public.newsletter_subscribers (consent_at)
  where status = 'pending';

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
  -- Unbestätigte Anmeldungen (Einwilligung älter als 30 Tage) löschen; günstig über den Teilindex.
  delete from public.newsletter_subscribers where status = 'pending' and consent_at < now() - interval '30 days';
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

-- Rechte (wie bisher; neu: record_dispute und prune_abandoned_orders nur für service_role) -------------------------
revoke all on function
  public.checkout_guard(text, text),
  public.return_lookup(bigint, text, text, int),
  public.return_submit(bigint, text, jsonb, text, text, text, int, uuid),
  public.record_dispute(text, text),
  public.reserve_checkout(jsonb, text, text, text, text, uuid),
  public.admin_restock_order(uuid, jsonb),
  public.prune_abandoned_orders(),
  public.prune_rate_limits(),
  public.newsletter_subscribe(text, text, text, text, text)
from public, anon, authenticated;
grant execute on function
  public.checkout_guard(text, text),
  public.return_lookup(bigint, text, text, int),
  public.return_submit(bigint, text, jsonb, text, text, text, int, uuid),
  public.record_dispute(text, text),
  public.reserve_checkout(jsonb, text, text, text, text, uuid),
  public.prune_abandoned_orders(),
  public.prune_rate_limits(),
  public.newsletter_subscribe(text, text, text, text, text)
to service_role;
grant execute on function public.admin_restock_order(uuid, jsonb) to authenticated;
