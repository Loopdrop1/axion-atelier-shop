-- Kontaktformular (Schutz vor Missbrauch) und weitere Einstellungen fürs Admin.

-- Kontaktformular: Nachrichten gehen als E-Mail an den Shop, der Shop speichert sie nicht.
-- Pro IP 5 Nachrichten pro Stunde (nur wenn die IP bekannt ist), pro E-Mail-Adresse 3 pro Stunde,
-- insgesamt höchstens 60 pro Stunde (Schutz des Postfachs und des E-Mail-Kontingents).
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
  if not private.hit_rate_limit('contact-email:' || v_email, 3, interval '1 hour')
     or not private.hit_rate_limit('contact-global', 60, interval '1 hour') then
    return 'rate_limited';
  end if;
  return 'ok';
end
$$;

revoke all on function public.contact_guard(text, text) from public, anon, authenticated;
grant execute on function public.contact_guard(text, text) to service_role;

-- Ausverkaufte Grössen im Shop ausblenden (Standard: als ausverkauft zeigen).
alter table public.shop_settings add column hide_sold_out boolean not null default false;
grant select (hide_sold_out) on public.shop_settings to anon, authenticated;
grant update (hide_sold_out) on public.shop_settings to authenticated;
