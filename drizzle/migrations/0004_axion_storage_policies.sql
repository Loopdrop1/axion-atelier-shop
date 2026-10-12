-- Axion: Zugriff auf Produkt- und Startseitenbilder
-- Öffentlich lesbar (Bild-URLs im Shop), schreiben nur Admins.

create policy "Axion-Bilder: Admin liest" on storage.objects
  for select to authenticated
  using (bucket_id in ('product-images', 'site-media') and (select private.is_admin()));

create policy "Axion-Bilder: Admin lädt hoch" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images', 'site-media') and (select private.is_admin()));

create policy "Axion-Bilder: Admin ersetzt" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images', 'site-media') and (select private.is_admin()))
  with check (bucket_id in ('product-images', 'site-media') and (select private.is_admin()));

create policy "Axion-Bilder: Admin löscht" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images', 'site-media') and (select private.is_admin()));