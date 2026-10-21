-- KI-Suche («search-assist»): Ratenlimit pro IP und gesamt, damit Bots das KI-Guthaben nicht aufbrauchen.
-- Gleiche Datei in drizzle/migrations als 0009. Mehrfach ausführbar.

create or replace function public.search_assist_guard(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.hit_rate_limit('searchai-ip:' || coalesce(nullif(p_ip, ''), 'unbekannt'), 20, interval '1 hour')
     and private.hit_rate_limit('searchai-global', 2000, interval '1 day');
end
$$;

revoke all on function public.search_assist_guard(text) from public, anon, authenticated;
grant execute on function public.search_assist_guard(text) to service_role;
