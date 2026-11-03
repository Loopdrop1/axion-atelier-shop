-- Kundencheckliste 3.11.2026: Gutscheine 30 Jahre gültig, Gültigkeit des Newsletter-Willkommenscodes einstellbar.
-- Gleiche Datei wie supabase/migrations/20261104002500_sortiment_gift_newsletter.sql. Mehrfach ausführbar.
-- Sortiment zum Start (Anzüge, Westen, Schuhe, Hosen, T-Shirts) braucht kein Schema (categories.active besteht):
-- dafür in Cloud nach dieser Migration supabase/demo/sortiment-start.sql ausführen.
--
-- 1. Gutscheine: Standard 30 Jahre. Die bestehende Zeile ändert sich nur, wenn sie noch auf dem alten Standard 5
--    steht; einen anderen Wert aus dem Admin lässt die Migration stehen. Bereits verkaufte Gutscheine behalten ihr
--    Ablaufdatum (gift_cards.expires_at).
-- 2. Newsletter: newsletter_welcome_days (1 bis 365, Standard 90 wie bisher fest), Rechte wie
--    newsletter_welcome_percent (lesen alle, ändern Admin über RLS).
-- 3. newsletter_confirm: Code gilt newsletter_welcome_days Tage; Rückgabe zusätzlich welcome_days. Bei einem
--    wiederholten Klick kommen Prozent und Gültigkeit vom bereits ausgestellten Code (nicht von der inzwischen
--    vielleicht geänderten Einstellung), damit die Willkommens-E-Mail zum Code passt.

alter table public.shop_settings alter column gift_card_valid_years set default 30;
update public.shop_settings set gift_card_valid_years = 30 where id = 1 and gift_card_valid_years = 5;

alter table public.shop_settings
  add column if not exists newsletter_welcome_days int not null default 90
    check (newsletter_welcome_days between 1 and 365);
grant select (newsletter_welcome_days) on public.shop_settings to anon, authenticated;
grant update (newsletter_welcome_days) on public.shop_settings to authenticated;

create or replace function public.newsletter_confirm(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.newsletter_subscribers;
  v_percent int;
  v_days int;
  v_code text;
  v_issued record;
begin
  select * into v_sub from public.newsletter_subscribers
    where token_hash = private.hash_token(coalesce(p_token, '')) for update;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  select newsletter_welcome_percent, newsletter_welcome_days into v_percent, v_days
    from public.shop_settings where id = 1;
  v_days := coalesce(v_days, 90);
  if v_sub.status = 'confirmed' then
    -- Kein neuer Code: nur der bereits ausgestellte, damit die Willkommens-E-Mail erneut zugestellt werden kann.
    if v_sub.welcome_code is null then
      return jsonb_build_object('status', 'confirmed', 'email', v_sub.email::text, 'locale', v_sub.locale,
        'newly_confirmed', false, 'welcome_code', null, 'welcome_percent', null, 'welcome_days', null);
    end if;
    select case when d.kind = 'percent' then d.value end as percent,
           case when d.ends_at is not null
             then greatest(1, round(extract(epoch from (d.ends_at - d.created_at)) / 86400)::int) end as days
      into v_issued
      from public.discount_codes d where lower(d.code::text) = lower(v_sub.welcome_code);
    return jsonb_build_object('status', 'confirmed', 'email', v_sub.email::text, 'locale', v_sub.locale,
      'newly_confirmed', false, 'welcome_code', v_sub.welcome_code,
      'welcome_percent', coalesce(v_issued.percent, v_percent),
      'welcome_days', coalesce(v_issued.days, v_days));
  end if;
  if v_sub.status = 'unsubscribed' then
    return jsonb_build_object('status', 'unsubscribed');
  end if;
  if v_percent is not null and v_sub.welcome_code is null then
    loop
      v_code := 'WILLKOMMEN-' || substr(replace(private.gift_card_code(), '-', ''), 4, 10);
      begin
        insert into public.discount_codes (code, kind, value, max_redemptions, ends_at, note)
        values (v_code, 'percent', v_percent, 1, now() + make_interval(days => v_days),
          'Newsletter-Willkommensrabatt');
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
    'locale', v_sub.locale, 'welcome_code', coalesce(v_sub.welcome_code, v_code), 'welcome_percent', v_percent,
    'welcome_days', case when coalesce(v_sub.welcome_code, v_code) is null then null else v_days end);
end
$$;

-- Rechte wie bisher (nur der Server).
revoke all on function public.newsletter_confirm(text) from public, anon, authenticated;
grant execute on function public.newsletter_confirm(text) to service_role;
