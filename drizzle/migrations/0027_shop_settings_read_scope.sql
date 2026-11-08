-- Scope the public read rule on shop_settings to the single settings row
-- (column GRANTs still hide notify_email etc.).
drop policy if exists "Einstellungen: alle lesen" on public.shop_settings;
create policy "Einstellungen: alle lesen" on public.shop_settings
  for select to anon, authenticated using (id = 1);
