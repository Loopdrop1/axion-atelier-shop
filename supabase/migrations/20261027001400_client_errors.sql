-- Technische Fehlerberichte aus dem Browser (Edge Function «client-error»). Gespeichert wird nur: Meldung, Pfad ohne
-- Query-String, Stack, Browser-Kennung, Version der Website und ein Zähler. Keine IP, keine E-Mail, keine Konto-ID.
-- Gleiche Fehler (Fingerprint) innerhalb von 24 Stunden erhöhen nur den Zähler. Zeilen älter als 30 Tage löscht die
-- Funktion beim Anlegen neuer Fehler (kein pg_cron im Projekt). Nur Admins lesen und löschen; Schreiben nur über
-- client_error_report (service_role). Gleiche Datei in drizzle/migrations (Cloud). Mehrfach ausführbar.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (char_length(fingerprint) between 8 and 64),
  message text not null check (char_length(message) between 1 and 500),
  path text not null default '/' check (char_length(path) <= 200),
  stack text check (stack is null or char_length(stack) <= 2000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  release text check (release is null or char_length(release) <= 64),
  count integer not null default 1 check (count >= 1),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists client_errors_fingerprint_idx on public.client_errors (fingerprint, last_seen_at desc);
create index if not exists client_errors_last_seen_idx on public.client_errors (last_seen_at desc);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select, delete on public.client_errors to authenticated;
drop policy if exists "Fehlerberichte: Admin liest" on public.client_errors;
create policy "Fehlerberichte: Admin liest" on public.client_errors
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "Fehlerberichte: Admin löscht" on public.client_errors;
create policy "Fehlerberichte: Admin löscht" on public.client_errors
  for delete to authenticated using ((select private.is_admin()));

-- Bericht verbuchen. Begrenzt pro IP (20 pro Stunde, nur als Hash gezählt) und gesamt (500 pro Tag): 'rate_limited'.
-- Gleicher Fingerprint innerhalb von 24 Stunden: Zähler erhöhen. Sonst neue Zeile und alte (30 Tage) aufräumen.
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
  if not private.hit_rate_limit('clienterr-ip:' || coalesce(nullif(btrim(p_ip), ''), 'unbekannt'), 20, interval '1 hour')
     or not private.hit_rate_limit('clienterr-global', 500, interval '1 day') then
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
  delete from public.client_errors
    where id in (select id from public.client_errors where last_seen_at < now() - interval '30 days' limit 500);
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
