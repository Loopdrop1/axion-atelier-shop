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
