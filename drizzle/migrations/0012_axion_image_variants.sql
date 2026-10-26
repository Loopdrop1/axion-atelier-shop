-- Verkleinerte Bildfassungen: Der Admin erzeugt beim Hochladen WebP-Fassungen (640 und 1200 px Breite) neben dem
-- Original und legt sie hier ab: [{"w": 640, "path": "ordner/abc-640.webp"}, ...] (Pfade im Bucket product-images).
-- Der Shop bietet sie dem Browser als srcset an. null = keine Fassungen (alle bisherigen Bilder, eingebaute «asset:»-Bilder).
-- Gleiche Datei in supabase/migrations (Test-DB). Mehrfach ausführbar.

alter table public.product_images add column if not exists variants jsonb;

alter table public.product_images drop constraint if exists product_images_variants_check;
alter table public.product_images add constraint product_images_variants_check
  check (variants is null or jsonb_typeof(variants) = 'array');
