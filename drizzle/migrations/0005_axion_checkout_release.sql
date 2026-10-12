-- Kasse abgebrochen: Kommt die Kundschaft von Stripe zurück (cancel_url mit Status-Token), wird die Reservierung
-- sofort freigegeben statt erst nach Ablauf der Stripe-Session. Sonst wäre das letzte Stück bis zu 30 Minuten
-- blockiert, auch für dieselbe Person beim zweiten Versuch.
create or replace function public.cancel_checkout_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where status_token = p_token for update;
  if not found or v_order.status <> 'pending' then
    return jsonb_build_object('cancelled', false);
  end if;
  return jsonb_build_object(
    'cancelled', private.cancel_pending(v_order.id, 'customer_cancelled'),
    'session_id', v_order.stripe_session_id
  );
end
$$;

revoke all on function public.cancel_checkout_by_token(uuid) from public, anon, authenticated;
grant execute on function public.cancel_checkout_by_token(uuid) to service_role;

-- Offene Bestellung zum Status-Token mit ihrer Stripe-Session. Die Kasse beendet zuerst die Session bei Stripe
-- und gibt die Reservierung nur frei, wenn Stripe sie als abgelaufen meldet. Sonst könnte eine schon bezahlte
-- Session freigegeben und Gutschein oder Rabattcode ein zweites Mal eingesetzt werden.
create or replace function public.pending_checkout_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('order_id', o.id, 'session_id', o.stripe_session_id)
       from public.orders o where o.status_token = p_token and o.status = 'pending'),
    jsonb_build_object('order_id', null, 'session_id', null))
$$;

revoke all on function public.pending_checkout_by_token(uuid) from public, anon, authenticated;
grant execute on function public.pending_checkout_by_token(uuid) to service_role;

-- Schutz der Kasse vor Missbrauch: Bestand blockieren oder Codes durchprobieren.
-- Pro IP 20 Kassen in 30 Minuten (nur wenn die IP bekannt ist), pro E-Mail 10 in 30 Minuten
-- und höchstens 3 gleichzeitig offene Kassen pro E-Mail.
create or replace function public.checkout_guard(p_email text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_open int;
begin
  if coalesce(btrim(p_ip), '') <> ''
     and not private.hit_rate_limit('checkout-ip:' || btrim(p_ip), 20, interval '30 minutes') then
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

revoke all on function public.checkout_guard(text, text) from public, anon, authenticated;
grant execute on function public.checkout_guard(text, text) to service_role;

-- Bestellung mit interner Notiz fürs Admin (die Spalte admin_note ist für «authenticated» nicht lesbar).
create or replace function public.admin_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return private.order_json(p_order_id);
end
$$;

revoke all on function public.admin_get_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_order(uuid) to authenticated;