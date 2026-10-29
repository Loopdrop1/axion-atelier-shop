-- Kasse gegen Bestandsblockade absichern.
-- 1. reserve_checkout: höchstens 3 Stück je Grösse (vorher 10), 20 Stück und 20 Positionen je Bestellung (vorher 30
--    Positionen, kein Gesamtlimit). Zu viel: INVALID_LINES mit detail reason «quantity» bzw. «order_quantity».
--    Sonst unverändert (gleiche Signatur und Rechte).
-- 2. checkout_guard: ohne erkennbare IP gilt ein gemeinsamer Zähler «checkout-noip» (30 Kassen in 30 Minuten für
--    alle); mit IP zusätzlich höchstens 3 Kassen in 35 Minuten (so lange hält eine Reservierung) → 'too_many_open'.
--    Rückgabewerte unverändert: 'ok', 'rate_limited', 'too_many_open'.
-- Gleiche Datei in drizzle/migrations (Cloud) als 0019. Mehrfach ausführbar.

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

create or replace function public.checkout_guard(p_email text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip text := btrim(coalesce(p_ip, ''));
  v_open int;
begin
  if v_ip <> '' then
    if not private.hit_rate_limit('checkout-ip:' || v_ip, 20, interval '30 minutes') then
      return 'rate_limited';
    end if;
    -- Eine Reservierung hält 35 Minuten: von einer IP aus höchstens 3 neue Kassen in dieser Zeit.
    if not private.hit_rate_limit('checkout-ip-open:' || v_ip, 3, interval '35 minutes') then
      return 'too_many_open';
    end if;
  elsif not private.hit_rate_limit('checkout-noip', 30, interval '30 minutes') then
    -- IP unbekannt (Proxy ohne Header): gemeinsamer Zähler für alle, damit das Fehlen der IP nichts umgeht.
    return 'rate_limited';
  end if;
  if not private.hit_rate_limit('checkout-email:' || v_email, 10, interval '30 minutes') then
    return 'rate_limited';
  end if;
  select count(*) into v_open from public.orders
    where lower(email) = v_email and status = 'pending' and (expires_at is null or expires_at > now());
  if v_open >= 3 then
    return 'too_many_open';
  end if;
  return 'ok';
end
$$;

revoke all on function
  public.reserve_checkout(jsonb, text, text, text, text, uuid),
  public.checkout_guard(text, text)
from public, anon, authenticated;
grant execute on function
  public.reserve_checkout(jsonb, text, text, text, text, uuid),
  public.checkout_guard(text, text)
to service_role;
