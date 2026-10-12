-- Axion: Speicher für Produkt- und Startseitenbilder
-- Öffentlich lesbar (Bild-URLs im Shop), schreiben nur Admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-media', 'site-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
