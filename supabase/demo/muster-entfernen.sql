-- Muster-Sortiment entfernen (vor dem Start, wenn die echten Produkte im Admin erfasst sind).
-- Löscht alle Produkte mit dem Kennzeichen «muster» samt Grössen und Bildern. Bestellungen bleiben erhalten
-- (sie speichern Titel, Grösse und Preis selbst). Kategorien, Startseite und Grössentabellen bleiben; zeigen die
-- Punkte im «Kompletten Outfit» danach auf keine Produkte mehr, blendet der Shop den Abschnitt aus, bis im Admin
-- neue Punkte gesetzt sind.
-- Vorher prüfen, welche Stücke wegfallen (Admin → Produkte zeigt sie mit «Muster»; wer ein Musterstück mit echten
-- Fotos und Texten weiterführen will, entfernt dort das Häkchen «Muster»):
--   select handle, title_de, status from public.products where 'muster' = any (tags) order by handle;

begin;

delete from public.products where 'muster' = any (tags);

commit;

-- Kontrolle: muss 0 ergeben
select count(*) as verbleibende_muster from public.products where 'muster' = any (tags);
