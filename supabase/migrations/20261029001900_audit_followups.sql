-- Nachbesserungen aus dem Audit.
-- 1. get_cart_reminder: höchstens eine Warenkorb-Erinnerung pro Adresse und 7 Tage (an der Kasse kann jemand
--    eine fremde Adresse eintragen und das Häkchen setzen; so lässt sich damit nicht spammen).
-- 2. prepare_account_deletion: löscht zusätzlich Newsletter-Eintrag und «Wieder da»-Wünsche zur E-Mail-Adresse
--    des Kontos (ohne Gross-/Kleinschreibung). Die Prüfungen (USER_NOT_FOUND, LAST_ADMIN) laufen vorher.
-- 3. newsletter_confirm: auch der Zweig «bereits bestätigt» liefert welcome_code und welcome_percent (ohne neuen
--    Code), damit ein wiederholter Klick die Willkommens-E-Mail mit demselben Code erneut zustellen kann.
-- Gleiche Datei in drizzle/migrations (Cloud) als 0018. Mehrfach ausführbar.

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
    and not exists (
      select 1 from public.orders r
      where lower(r.email) = lower(o.email)
        and r.reminder_sent_at > now() - interval '7 days'
    )
$$;

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'admin')
     and not exists (select 1 from public.user_roles r where r.role = 'admin' and r.user_id <> p_user_id) then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email <> '' then
    delete from public.newsletter_subscribers n where lower(n.email::text) = lower(v_email);
    delete from public.stock_alerts s where lower(s.email) = lower(v_email);
  end if;
  return jsonb_build_object(
    'orders_kept', (select count(*) from public.orders o where o.user_id = p_user_id)
  );
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
  select newsletter_welcome_percent into v_percent from public.shop_settings where id = 1;
  if v_sub.status = 'confirmed' then
    -- Kein neuer Code: nur der bereits ausgestellte, damit die Willkommens-E-Mail erneut zugestellt werden kann.
    return jsonb_build_object('status', 'confirmed', 'email', v_sub.email::text, 'locale', v_sub.locale,
      'newly_confirmed', false, 'welcome_code', v_sub.welcome_code,
      'welcome_percent', case when v_sub.welcome_code is null then null else v_percent end);
  end if;
  if v_sub.status = 'unsubscribed' then
    return jsonb_build_object('status', 'unsubscribed');
  end if;
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

-- Rechte wie in den ursprünglichen Migrationen (nur der Server).
revoke all on function
  public.get_cart_reminder(uuid),
  public.prepare_account_deletion(uuid),
  public.newsletter_confirm(text)
from public, anon, authenticated;

grant execute on function
  public.get_cart_reminder(uuid),
  public.prepare_account_deletion(uuid),
  public.newsletter_confirm(text)
to service_role;
