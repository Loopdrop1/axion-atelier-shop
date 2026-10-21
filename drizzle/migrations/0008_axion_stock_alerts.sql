-- «Benachrichtigen, wenn wieder da»: pro ausverkaufter Grösse eine einmalige E-Mail mit Double Opt-in.
-- Ablauf: Edge Function «stock-alert» legt den Wunsch an (pending, Bestätigungs-E-Mail), Klick bestätigt (confirmed).
-- Stockt das Admin die Grösse auf, liest «admin-actions» (notify_restock) die bestätigten Wünsche, schickt je eine
-- E-Mail und hakt nur die verschickten ab (notified, Adresse entfernt). Benachrichtigte und unbestätigte Einträge werden nach 30 Tagen gelöscht.
-- Text statt citext (Lovable Cloud kennt citext nicht); gleiche Datei in drizzle/migrations als 0008.
-- Mehrfach ausführbar.

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email like '%@%'),
  locale text not null default 'de' check (locale in ('de', 'en')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'notified')),
  token_hash text unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  notified_at timestamptz
);
-- Pro Grösse und Adresse höchstens ein offener Wunsch
create unique index if not exists stock_alerts_open_idx
  on public.stock_alerts (variant_id, lower(email)) where status in ('pending', 'confirmed');
create index if not exists stock_alerts_variant_idx on public.stock_alerts (variant_id) where status = 'confirmed';

alter table public.stock_alerts enable row level security;
revoke all on public.stock_alerts from anon, authenticated;
grant select on public.stock_alerts to authenticated;
drop policy if exists "Wieder-da: Admin liest" on public.stock_alerts;
create policy "Wieder-da: Admin liest" on public.stock_alerts
  for select to authenticated using ((select private.is_admin()));

-- Wunsch anlegen. Nur für aktive, ausverkaufte Grössen; begrenzt pro Adresse, IP und gesamt.
create or replace function public.stock_alert_request(
  p_variant_id uuid,
  p_email text,
  p_locale text,
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
  v_variant record;
  v_alert public.stock_alerts;
  v_token text;
begin
  select v.id, v.stock, v.size, p.title_de, p.title_en, p.color_name_de, p.color_name_en into v_variant
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = p_variant_id and v.active and p.status = 'active';
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_variant.stock > 0 then
    return jsonb_build_object('status', 'in_stock');
  end if;
  if not private.hit_rate_limit('stockalert:' || v_email, 5, interval '1 hour')
     or not private.hit_rate_limit('stockalert-ip:' || coalesce(p_ip, private.request_ip()), 10, interval '1 hour')
     or not private.hit_rate_limit('stockalert-global', 200, interval '1 hour') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  delete from public.stock_alerts
    where status <> 'confirmed' and created_at < now() - interval '30 days';
  select * into v_alert from public.stock_alerts
    where variant_id = p_variant_id and lower(email) = v_email and status in ('pending', 'confirmed') for update;
  if found and v_alert.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed');
  end if;
  v_token := private.random_token();
  if found then
    update public.stock_alerts set token_hash = private.hash_token(v_token), locale = v_locale, created_at = now()
      where id = v_alert.id;
  else
    insert into public.stock_alerts (variant_id, email, locale, token_hash)
    values (p_variant_id, v_email, v_locale, private.hash_token(v_token));
  end if;
  return jsonb_build_object('status', 'pending', 'token', v_token, 'email', v_email, 'locale', v_locale,
    'title', case when v_locale = 'en' then coalesce(nullif(v_variant.title_en, ''), v_variant.title_de) else v_variant.title_de end,
    'color', case when v_locale = 'en' then coalesce(nullif(v_variant.color_name_en, ''), v_variant.color_name_de) else v_variant.color_name_de end,
    'size', v_variant.size);
end
$$;

-- Bestätigen über den Link aus der E-Mail
create or replace function public.stock_alert_confirm(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert public.stock_alerts;
begin
  select * into v_alert from public.stock_alerts
    where token_hash = private.hash_token(coalesce(p_token, '')) for update;
  if not found or v_alert.status = 'notified' then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_alert.status = 'pending' then
    update public.stock_alerts set status = 'confirmed', confirmed_at = now() where id = v_alert.id;
  end if;
  return jsonb_build_object('status', 'confirmed');
end
$$;

-- Nach dem Aufstocken: bestätigte Wünsche einer vorrätigen Grösse zum Versand lesen (noch nicht abhaken).
create or replace function public.stock_alerts_pending(p_variant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant record;
begin
  select v.stock, v.size, p.handle, p.title_de, p.title_en, p.color_name_de, p.color_name_en into v_variant
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = p_variant_id and v.active and p.status = 'active';
  if not found or v_variant.stock <= 0 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'email', a.email, 'locale', a.locale, 'handle', v_variant.handle, 'size', v_variant.size,
      'title', case when a.locale = 'en' then coalesce(nullif(v_variant.title_en, ''), v_variant.title_de) else v_variant.title_de end,
      'color', case when a.locale = 'en' then coalesce(nullif(v_variant.color_name_en, ''), v_variant.color_name_de) else v_variant.color_name_de end
    ))
    from public.stock_alerts a where a.variant_id = p_variant_id and a.status = 'confirmed'
  ), '[]'::jsonb);
end
$$;

-- Erfolgreich verschickte Wünsche abhaken; die Adresse wird dabei entfernt (nur «benachrichtigt» bleibt).
-- Gescheiterte bleiben bestätigt und gehen beim nächsten Aufstocken erneut raus.
create or replace function public.stock_alerts_done(p_ids uuid[])
returns int
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.stock_alerts
       set status = 'notified', notified_at = now(), token_hash = null, email = 'entfernt@invalid'
     where id = any (coalesce(p_ids, '{}')) and status = 'confirmed'
     returning 1
  )
  select count(*)::int from done;
$$;

revoke all on function
  public.stock_alert_request(uuid, text, text, text),
  public.stock_alert_confirm(text),
  public.stock_alerts_pending(uuid),
  public.stock_alerts_done(uuid[])
from public, anon, authenticated;

grant execute on function
  public.stock_alert_request(uuid, text, text, text),
  public.stock_alert_confirm(text),
  public.stock_alerts_pending(uuid),
  public.stock_alerts_done(uuid[])
to service_role;
