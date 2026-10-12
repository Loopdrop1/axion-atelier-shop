-- Kontaktformular (Schutz vor Missbrauch), Herkunft der englischen Texte, weitere Einstellungen fürs Admin.

-- Zähler der Missbrauchsbremsen nur als Prüfwert speichern (keine E-Mail-Adressen oder IP-Adressen im Klartext).
create or replace function private.hit_rate_limit(p_key text, p_limit int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := private.hash_token(p_key);
  v_hits int;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (v_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end
$$;

-- Abgelaufene Zähler löschen (alle Zeitfenster sind höchstens einen Tag lang). Läuft als eigene Anfrage aus den Edge
-- Functions, nie innerhalb einer Bremse: Gesperrte Zeilen überspringt es (skip locked) und wartet danach auf nichts,
-- deshalb kann kein Deadlock mit gleichzeitigen Anfragen entstehen.
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
  return v_count;
end
$$;

revoke all on function public.prune_rate_limits() from public, anon, authenticated;
grant execute on function public.prune_rate_limits() to service_role;

-- Kontaktformular: Nachrichten gehen als E-Mail an den Shop, der Shop speichert sie nicht.
-- Pro IP (IPv6 als /64-Netz) 5 Nachrichten pro Stunde, pro E-Mail-Adresse 3 pro Stunde: 'rate_limited'.
-- Insgesamt höchstens 20 pro Stunde und 50 pro Tag: 'busy'. Das schützt das Postfach und vor allem das
-- E-Mail-Kontingent, über das auch Bestellbestätigungen und Versandmeldungen laufen.
create or replace function public.contact_guard(p_email text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if coalesce(btrim(p_ip), '') <> ''
     and not private.hit_rate_limit('contact-ip:' || btrim(p_ip), 5, interval '1 hour') then
    return 'rate_limited';
  end if;
  if not private.hit_rate_limit('contact-email:' || v_email, 3, interval '1 hour') then
    return 'rate_limited';
  end if;
  if not private.hit_rate_limit('contact-global', 20, interval '1 hour')
     or not private.hit_rate_limit('contact-global-day', 50, interval '1 day') then
    return 'busy';
  end if;
  return 'ok';
end
$$;

revoke all on function public.contact_guard(text, text) from public, anon, authenticated;
grant execute on function public.contact_guard(text, text) to service_role;

-- Automatische Übersetzung im Admin: höchstens 500 Anfragen pro Admin und Tag (schützt das AI-Guthaben, das
-- Lovable Cloud mit Datenbank und Login teilt).
create or replace function public.translate_guard(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.hit_rate_limit('translate:' || p_user_id::text, 500, interval '1 day')
$$;

revoke all on function public.translate_guard(uuid) from public, anon, authenticated;
grant execute on function public.translate_guard(uuid) to service_role;

-- Herkunft der englischen Texte: Felder, deren Englisch aus der automatischen Übersetzung stammt. Nur diese
-- übersetzt das Admin neu, wenn sich das Deutsch ändert; von Hand geschriebenes Englisch bleibt stehen.
alter table public.categories add column en_auto text[] not null default '{}';
alter table public.products add column en_auto text[] not null default '{}';
alter table public.product_images add column en_auto text[] not null default '{}';

-- Ausverkaufte Grössen im Shop ausblenden (Standard: als ausverkauft zeigen).
alter table public.shop_settings add column hide_sold_out boolean not null default false;
grant select (hide_sold_out) on public.shop_settings to anon, authenticated;
grant update (hide_sold_out) on public.shop_settings to authenticated;