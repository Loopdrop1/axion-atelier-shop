-- Muster-Sortiment entfernen (vor dem Start, wenn die echten Produkte im Admin erfasst sind).
-- Löscht alle Produkte mit dem Kennzeichen «muster» samt Grössen und Bildern. Bestellungen bleiben erhalten
-- (sie speichern Titel, Grösse und Preis selbst). Kategorien bleiben, verlieren aber die Zeichnungen als Bild
-- (ohne Bild fehlt eine Kategorie nur in der Reihe auf der Startseite, bis im Admin ein Foto hinterlegt ist), und
-- Kategorien ohne aktive Produkte werden ausgeschaltet (im Admin wieder einschalten, sobald Produkte darin sind).
-- Startseite und Grössentabellen bleiben; zeigen die Punkte im «Kompletten Outfit» danach auf keine Produkte mehr,
-- blendet der Shop den Abschnitt aus, bis im Admin neue Punkte gesetzt sind.
-- Vorher prüfen, welche Stücke wegfallen (Admin → Produkte zeigt sie mit «Muster»; wer ein Musterstück mit echten
-- Fotos und Texten weiterführen will, entfernt dort das Häkchen «Muster»):
--   select handle, title_de, status from public.products where 'muster' = any (tags) order by handle;

begin;

delete from public.products where 'muster' = any (tags);

update public.categories set image_path = null where image_path like 'asset:muster/%';

update public.categories c set active = false
where c.active
  and not exists (select 1 from public.products p where p.category_id = c.id and p.status = 'active');

commit;

-- Kontrolle: muss 0 ergeben
select count(*) as verbleibende_muster from public.products where 'muster' = any (tags);
-- Kategorien danach: aktiv nur mit Produkten, Bild nur, wo ein Foto hinterlegt ist
select slug, active, image_path from public.categories order by sort, slug;
