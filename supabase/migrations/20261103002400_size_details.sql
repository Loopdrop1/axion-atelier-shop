-- Grössen: Model-Angaben pro Produkt («Das Model ist 1,86 m gross und trägt Grösse 50»). Gleiche Datei wie
-- drizzle/migrations/0023_axion_size_details.sql. Mehrfach ausführbar.
-- Beide Spalten sind freiwillig (null = keine Angabe, die Zeile auf der Produktseite entfällt). Rechte: products
-- hat Tabellenrechte (lesen: alle, schreiben: Admin über RLS), neue Spalten sind damit wie die übrigen freigegeben.
-- Die Zuordnung Zahl ↔ Buchstabe steht im site_content-Block «size_guides» (Feld «letters») und braucht keine Spalte.

alter table public.products
  add column if not exists model_height_cm smallint
    check (model_height_cm between 120 and 230),
  add column if not exists model_size text
    check (char_length(model_size) <= 20);

comment on column public.products.model_height_cm is 'Körpergrösse des Models auf den Bildern in cm (freiwillig)';
comment on column public.products.model_size is 'Grösse, die das Model trägt, z. B. «50» (freiwillig)';
