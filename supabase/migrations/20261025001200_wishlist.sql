-- Merkliste für angemeldete Kundinnen und Kunden: pro Konto die Produkt-Handles, serverseitig gespeichert.
-- Gäste behalten die Merkliste im Browser. Beim Anmelden führt die Seite beide Listen zusammen.
-- Eigene Zeilen lesen, anlegen und löschen (RLS); höchstens 200 pro Konto (Trigger); beim Löschen des Kontos
-- verschwinden die Zeilen (on delete cascade). Gleiche Datei in drizzle/migrations als 0011. Mehrfach ausführbar.

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  handle text not null check (char_length(handle) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, handle)
);

alter table public.wishlist_items enable row level security;
revoke all on public.wishlist_items from anon, authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;

drop policy if exists "Merkliste: eigene lesen" on public.wishlist_items;
create policy "Merkliste: eigene lesen" on public.wishlist_items
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Merkliste: eigene anlegen" on public.wishlist_items;
create policy "Merkliste: eigene anlegen" on public.wishlist_items
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Merkliste: eigene löschen" on public.wishlist_items;
create policy "Merkliste: eigene löschen" on public.wishlist_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- Höchstens 200 Stücke pro Konto
create or replace function private.wishlist_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('wishlist:' || new.user_id::text, 0));
  if (select count(*) from public.wishlist_items where user_id = new.user_id) >= 200 then
    raise exception 'wishlist_full' using errcode = 'check_violation';
  end if;
  return new;
end
$$;

revoke all on function private.wishlist_limit() from public, anon, authenticated;

drop trigger if exists wishlist_items_limit on public.wishlist_items;
create trigger wishlist_items_limit before insert on public.wishlist_items
  for each row execute function private.wishlist_limit();
