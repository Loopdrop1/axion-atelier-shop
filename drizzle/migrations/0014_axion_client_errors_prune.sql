-- client_error_report überarbeitet (ersetzt die Funktion aus 20261027001400_client_errors.sql, sonst gleich):
-- 1. Zeilen älter als 30 Tage werden bei jedem Aufruf gelöscht (bisher nur beim Anlegen eines neuen Fingerprints,
--    also nie, solange nur bekannte Fehler wiederkehren). Höchstens 500 pro Aufruf.
-- 2. Reihenfolge der Bremsen: zuerst pro IP (20 pro Stunde). Wiederholt sich ein bekannter Fingerprint (24 Stunden),
--    wird nur der Zähler erhöht und das Tageslimit für alle (500) nicht belastet; nur neue Fehler zählen dort.
--    So kann ein einzelner, ständig wiederholter Fehler das Tageslimit nicht aufbrauchen.
-- Gleiche Datei in supabase/migrations (Test-DB). Mehrfach ausführbar.

create or replace function public.client_error_report(
  p_ip text,
  p_fingerprint text,
  p_message text,
  p_path text,
  p_stack text,
  p_user_agent text,
  p_release text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  delete from public.client_errors
    where id in (select id from public.client_errors where last_seen_at < now() - interval '30 days' limit 500);
  if not private.hit_rate_limit('clienterr-ip:' || coalesce(nullif(btrim(p_ip), ''), 'unbekannt'), 20, interval '1 hour') then
    return 'rate_limited';
  end if;
  update public.client_errors set count = count + 1, last_seen_at = now()
    where id = (
      select id from public.client_errors
      where fingerprint = p_fingerprint and last_seen_at > now() - interval '24 hours'
      order by last_seen_at desc limit 1
      for update skip locked
    )
    returning id into v_id;
  if v_id is not null then
    return 'ok';
  end if;
  if not private.hit_rate_limit('clienterr-global', 500, interval '1 day') then
    return 'rate_limited';
  end if;
  insert into public.client_errors (fingerprint, message, path, stack, user_agent, release)
  values (
    left(p_fingerprint, 64),
    left(p_message, 500),
    left(coalesce(nullif(p_path, ''), '/'), 200),
    left(nullif(p_stack, ''), 2000),
    left(nullif(p_user_agent, ''), 300),
    left(nullif(p_release, ''), 64)
  );
  return 'ok';
end
$$;

revoke all on function public.client_error_report(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.client_error_report(text, text, text, text, text, text, text) to service_role;
