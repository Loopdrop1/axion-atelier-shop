-- Review-Korrekturen (F06 Rabatt-Limit, F15, F16, F17, F18, F19). Text statt citext (Lovable Cloud kennt citext nicht);
-- gleiche Datei in drizzle/migrations als 0010. Mehrfach ausführbar.

-- F06: Rabattcodes zusätzlich global begrenzt (wie newsletter-global), gegen verteiltes Erraten.
create or replace function public.check_discount(p_code text, p_subtotal_cents int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.hit_rate_limit('discount:' || private.request_ip(), 30, interval '10 minutes')
     or not private.hit_rate_limit('discount-global', 300, interval '10 minutes') then
    return jsonb_build_object('valid', false, 'reason', 'rate_limited');
  end if;
  if nullif(btrim(coalesce(p_code, '')), '') is null or p_subtotal_cents is null or p_subtotal_cents < 0 then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  v := private.evaluate_discount(p_code, p_subtotal_cents, false);
  return v - 'id';
end
$$;

-- F15: MWST-Satz der Bestellung (Prozent). Null bei Altbestellungen und ohne MWST-Pflicht; der Beleg fällt dann
-- auf den Satz aus der Shop-Konfiguration zurück.
alter table public.orders add column if not exists vat_rate numeric(5, 2);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_vat_rate_check') then
    alter table public.orders add constraint orders_vat_rate_check
      check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));
  end if;
end
$$;

create or replace function public.set_order_vat_rate(p_order_id uuid, p_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_rate is null or p_rate < 0 or p_rate > 100 then
    raise exception 'INVALID_VAT_RATE' using errcode = '22023';
  end if;
  update public.orders set vat_rate = round(p_rate, 2) where id = p_order_id and vat_rate is null;
end
$$;

-- F15/F16: Bestellung als JSON mit MWST-Satz und bereits gutgeschriebenem Gutscheinbetrag.
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
        'quantity', i.quantity, 'line_total_cents', i.line_total_cents, 'restocked_quantity', i.restocked_quantity
      ) order by i.created_at, i.id)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o where o.id = p_order_id
$$;

-- F16: Gutscheinanteil einer erstatteten Bestellung wieder auf den Gutschein buchen.
-- Die Rückerstattung selbst läuft über Stripe und deckt nur den Kartenanteil; der Gutscheinanteil bleibt sonst verloren.
create or replace function public.admin_credit_gift_card(p_order_id uuid, p_cents int, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_order public.orders;
  v_card public.gift_cards;
  v_credited int;
  v_max int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.gift_card_id is null or v_order.gift_card_cents <= 0
     or v_order.status not in ('paid', 'shipped', 'refunded') then
    raise exception 'NO_GIFT_CARD' using errcode = 'P0001';
  end if;
  select * into v_card from public.gift_cards where id = v_order.gift_card_id for update;
  if not found then
    raise exception 'NO_GIFT_CARD' using errcode = 'P0001';
  end if;
  select coalesce(sum(delta_cents), 0) into v_credited from public.gift_card_transactions
    where order_id = p_order_id and gift_card_id = v_card.id and kind = 'adjust' and delta_cents > 0;
  v_max := least(v_order.gift_card_cents - v_credited, v_card.initial_cents - v_card.balance_cents);
  if p_cents is null or p_cents < 1 or p_cents > v_max then
    raise exception 'INVALID_AMOUNT' using errcode = '22023', detail = jsonb_build_object('max', greatest(v_max, 0))::text;
  end if;
  update public.gift_cards set balance_cents = balance_cents + p_cents where id = v_card.id;
  insert into public.gift_card_transactions (gift_card_id, order_id, delta_cents, kind, note, created_by)
  values (v_card.id, p_order_id, p_cents, 'adjust',
    left(coalesce(nullif(btrim(p_note), ''), 'Gutscheinanteil der Bestellung gutgeschrieben'), 500), v_admin);
  return jsonb_build_object('credited_cents', v_credited + p_cents, 'balance_cents', v_card.balance_cents + p_cents);
end
$$;

-- F17: Inventur. Der gezählte Bestand wird serverseitig verbucht; das Delta entsteht unter Zeilensperre.
-- Hat sich der Bestand seit dem Öffnen des Dialogs verändert (p_expected), gibt es STOCK_CHANGED.
create or replace function public.admin_set_stock(
  p_variant_id uuid,
  p_count int,
  p_expected int,
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
  if p_count is null or p_count < 0 or p_count > 100000 then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected is not null and p_expected <> v_stock then
    raise exception 'STOCK_CHANGED' using errcode = 'P0001', detail = jsonb_build_object('available', v_stock)::text;
  end if;
  if p_count = v_stock then
    raise exception 'INVALID_DELTA' using errcode = '22023';
  end if;
  update public.product_variants set stock = p_count where id = p_variant_id;
  insert into public.stock_movements (variant_id, delta, reason, note, created_by)
  values (p_variant_id, p_count - v_stock, 'correction', left(p_note, 500), v_admin);
  return p_count;
end
$$;

-- F18: Retoure einlagern meldet zusätzlich die Varianten, die von 0 auf mehr als 0 gingen (für «Wieder da»-Mails).
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

-- F19: Die Gast-Statusseite zeigt die Sendungsnummer, sobald die Bestellung versandt ist.
create or replace function public.get_order_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', o.number, 'status', o.status, 'kind', o.kind, 'total_cents', o.total_cents,
    'email_hint', left(o.email, 1) || '***@' || split_part(o.email, '@', 2),
    'tracking_number', case when o.status = 'shipped' then o.tracking_number end
  )
  from public.orders o where o.status_token = p_token
$$;

-- Rechte
revoke all on function
  public.set_order_vat_rate(uuid, numeric),
  public.admin_credit_gift_card(uuid, int, text),
  public.admin_set_stock(uuid, int, int, text)
from public, anon, authenticated;
grant execute on function public.set_order_vat_rate(uuid, numeric) to service_role;
grant execute on function
  public.admin_credit_gift_card(uuid, int, text),
  public.admin_set_stock(uuid, int, int, text)
to authenticated;
