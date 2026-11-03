-- Retoure: Wahl der Rückerstattung. Gleiche Datei wie supabase/migrations/20261103002300_return_refund_method.sql. Mehrfach ausführbar.
-- Die Kundschaft wählt bei der Anmeldung, ob der Betrag aufs ursprüngliche Zahlungsmittel ('original') oder als
-- Gutschein ('gift_card') zurückkommt; mit einem Gutschein bezahlte Anteile gehen ohnehin auf den Gutschein.
-- 1. return_requests.refund_method (Standard 'original'; bestehende Anmeldungen bleiben beim Zahlungsmittel).
-- 2. return_submit: neuer letzter Parameter p_refund_method (unbekannte Werte → 'original'); speichert die Wahl und
--    gibt sie in jeder Antwort zurück (auch bei derselben Formular-Id). Sonst unverändert wie in 20261030002200.
--    Die alte Fassung mit acht Parametern wird entfernt, damit es nur eine Signatur gibt.

-- 1 ------------------------------------------------------------------------------------------------
alter table public.return_requests
  add column if not exists refund_method text not null default 'original'
    check (refund_method in ('original', 'gift_card'));

-- 2 ------------------------------------------------------------------------------------------------
drop function if exists public.return_submit(bigint, text, jsonb, text, text, text, int, uuid);

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
