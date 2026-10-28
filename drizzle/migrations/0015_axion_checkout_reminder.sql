-- Erinnerung an abgebrochene Kassen (nur mit ausdrücklicher Einwilligung, UWG Art. 3 Abs. 1 lit. o) und
-- Rückerstattungs-E-Mail (einmal pro Betrag).
-- 1. orders.reminder_opt_in: Häkchen «Erinnere mich per E-Mail …» im Warenkorb (Standard: nein), von der Kasse
--    nach der Reservierung über set_order_reminder gesetzt (reserve_checkout bleibt unverändert).
-- 2. orders.reminder_sent_at: Erinnerung höchstens einmal; mark_order_email_sent kennt dafür die Art «reminder».
-- 3. get_cart_reminder: liefert die abgelaufene Bestellung nur, wenn Einwilligung da, noch nicht gesendet und die
--    Person nicht inzwischen anderweitig bestellt hat.
-- 4. restore_cart_by_token: öffentlich, gibt für eine abgebrochene Warenkorb-Bestellung (7 Tage) nur Variante und Menge zurück.
-- 5. orders.refund_notified_cents, get_refund_notice, mark_refund_notified: pro Rückerstattungsbetrag eine E-Mail.
-- Gleiche Datei in supabase/migrations (Test-DB). Mehrfach ausführbar.

alter table public.orders
  add column if not exists reminder_opt_in boolean default false,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists refund_notified_cents int not null default 0;

-- Einwilligung festhalten: nur für offene Warenkorb-Bestellungen.
create or replace function public.set_order_reminder(p_order_id uuid, p_opt_in boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders set reminder_opt_in = coalesce(p_opt_in, false)
  where id = p_order_id and kind = 'cart' and status = 'pending'
$$;

-- Wie bisher, dazu die Art «reminder».
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
    shipping_sent_at = case when p_kind = 'shipping' then now() else shipping_sent_at end,
    reminder_sent_at = case when p_kind = 'reminder' then now() else reminder_sent_at end
  where id = p_order_id;
  if p_kind not in ('confirmation', 'notification', 'gift_card', 'shipping', 'reminder') then
    raise exception 'INVALID_KIND' using errcode = '22023';
  end if;
end
$$;

-- Bestellung für die Erinnerung, sonst null. Nur Ablauf der Kasse («expired»): Wer selbst zurückgekehrt ist
-- («customer_cancelled») oder dessen Zahlung scheiterte, bekommt keine Erinnerung.
create or replace function public.get_cart_reminder(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.order_json(o.id)
  from public.orders o
  where o.id = p_order_id
    and o.kind = 'cart'
    and o.status = 'cancelled'
    and o.cancel_reason = 'expired'
    and coalesce(o.reminder_opt_in, false)
    and o.reminder_sent_at is null
    and not exists (
      select 1 from public.orders later
      where lower(later.email) = lower(o.email)
        and later.status in ('paid', 'shipped')
        and later.created_at >= o.created_at
    )
$$;

-- Warenkorb aus dem Erinnerungslink: nur Variante und Menge, keine Personendaten. Das Token ist das Status-Token
-- der Bestellung (zufällige UUID), es gilt 7 Tage und nur für abgebrochene Warenkorb-Bestellungen.
create or replace function public.restore_cart_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity) order by i.created_at, i.id)
       from public.order_items i
       join public.orders o on o.id = i.order_id
      where o.status_token = p_token
        and o.kind = 'cart'
        and o.status = 'cancelled'
        and o.created_at > now() - interval '7 days'
        and i.variant_id is not null),
    '[]'::jsonb)
$$;

-- Rückerstattung: Bestellung samt bisher gemeldetem Betrag; null, wenn nichts Neues zu melden ist.
create or replace function public.get_refund_notice(p_payment_intent_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.order_json(o.id) || jsonb_build_object('refund_notified_cents', o.refund_notified_cents)
  from public.orders o
  where o.stripe_payment_intent_id = p_payment_intent_id
    and o.refunded_cents > o.refund_notified_cents
$$;

create or replace function public.mark_refund_notified(p_order_id uuid, p_cents int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders set refund_notified_cents = greatest(refund_notified_cents, coalesce(p_cents, 0))
  where id = p_order_id
$$;

revoke all on function
  public.set_order_reminder(uuid, boolean),
  public.mark_order_email_sent(uuid, text),
  public.get_cart_reminder(uuid),
  public.restore_cart_by_token(uuid),
  public.get_refund_notice(text),
  public.mark_refund_notified(uuid, int)
from public, anon, authenticated;

grant execute on function
  public.set_order_reminder(uuid, boolean),
  public.mark_order_email_sent(uuid, text),
  public.get_cart_reminder(uuid),
  public.get_refund_notice(text),
  public.mark_refund_notified(uuid, int)
to service_role;

-- Öffentlich (Seite «Warenkorb wiederherstellen»)
grant execute on function public.restore_cart_by_token(uuid) to anon, authenticated, service_role;
