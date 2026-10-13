-- Produktseite: Herkunft und Ausstattung (Deutsch/Englisch, Englisch mit Herkunft in en_auto wie die übrigen Texte).
-- Startseite: Video für den Einstieg im Speicher «site-media» (MP4, WebM), deshalb dort bis 25 MB.
-- Mehrfach ausführbar (Lovable Cloud: von Hand eingespielt, danach in drizzle/migrations als 0007 vermerkt).

alter table public.products
  add column if not exists origin_de text check (char_length(origin_de) <= 120),
  add column if not exists origin_en text check (char_length(origin_en) <= 120),
  add column if not exists features_de text check (char_length(features_de) <= 1500),
  add column if not exists features_en text check (char_length(features_en) <= 1500);

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'],
       file_size_limit = 26214400
 where id = 'site-media';