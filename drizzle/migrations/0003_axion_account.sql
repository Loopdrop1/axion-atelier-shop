-- Konto löschen und Admin-Schutz, Hilfen für die Edge Functions «account-delete» und «admin-actions».

-- Mindestens ein Admin bleibt immer: gilt beim Entzug der Rolle und beim Löschen eines Kontos
-- (auth.users löscht user_roles per Kaskade, dabei greift dieser Trigger ebenfalls).
-- Die Sperre verhindert, dass sich zwei Admins gleichzeitig gegenseitig entfernen.
create or replace function private.keep_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'admin' then
    return old;
  end if;
  perform pg_advisory_xact_lock(hashtext('axion:admin-roles'));
  if not exists (
    select 1 from public.user_roles r where r.role = 'admin' and r.user_id <> old.user_id
  ) then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  return old;
end
$$;

revoke all on function private.keep_last_admin() from public, anon, authenticated;

create trigger user_roles_keep_last_admin
  before delete on public.user_roles
  for each row execute function private.keep_last_admin();

-- Vorprüfung vor dem Löschen eines Kontos (verständliche Fehlermeldung statt Datenbankfehler).
-- Bestellungen bleiben erhalten; orders.user_id wird beim Löschen automatisch leer (on delete set null).
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'admin')
     and not exists (select 1 from public.user_roles r where r.role = 'admin' and r.user_id <> p_user_id) then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'orders_kept', (select count(*) from public.orders o where o.user_id = p_user_id)
  );
end
$$;

-- Gutschein für den erneuten Versand per E-Mail (Admin).
create or replace function public.get_gift_card_for_email(p_gift_card_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.gift_card_json(g) from public.gift_cards g where g.id = p_gift_card_id
$$;

revoke all on function
  public.prepare_account_deletion(uuid),
  public.get_gift_card_for_email(uuid)
from public, anon, authenticated;

grant execute on function
  public.prepare_account_deletion(uuid),
  public.get_gift_card_for_email(uuid)
to service_role;