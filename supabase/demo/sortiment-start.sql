-- Sortiment zum Start (Kundencheckliste 3.11.2026): im Shop sichtbar sind nur Anzüge, Westen, Schuhe, Hosen und
-- T-Shirts. Sakkos, Hemden, Mäntel & Jacken, Strick und Accessoires werden ausgeblendet, nicht gelöscht.
-- Wann: in Cloud einmal nach Migration 0024 und vor dem Livegang ausführen (Cloud → Datenbank → SQL oder durch
-- Claude). Mehrfach ausführbar.
-- Was es tut:
--   - legt die Kategorie «T-Shirts» an, falls sie fehlt (ohne Bild: Foto im Admin unter Kategorien hinterlegen;
--     ohne Bild fehlt sie nur in der Reihe auf der Startseite), ebenso eine der vier anderen Startkategorien, falls
--     sie fehlt. Bestehende Kategorien behalten Namen, Texte, Bild und Reihenfolge.
--   - schaltet die fünf Startkategorien ein und die fünf übrigen aus. Menü, Fusszeile, Startseite und Sitemap
--     zeigen nur eingeschaltete Kategorien; Produkte in ausgeschalteten Kategorien erscheinen nicht im Shop.
--   - Produkte, Grössen, Bilder und Bestellungen bleiben unverändert. «T-Shirts» steht im Menü, sobald das Skript
--     läuft, auch wenn noch keine T-Shirts erfasst sind.
-- Rückgängig machen (alle Kategorien wieder einschalten; T-Shirts entfernen, solange keine Produkte darin sind):
--   update public.categories set active = true
--     where slug in ('sakkos', 'hemden', 'maentel-jacken', 'strick', 'accessoires');
--   delete from public.categories c where c.slug = 't-shirts'
--     and not exists (select 1 from public.products p where p.category_id = c.id);
-- Einzelne Kategorien lassen sich auch im Admin unter Kategorien ein- und ausschalten.

begin;

insert into public.categories (slug, name_de, name_en, description_de, description_en, image_path, sort) values
  ('anzuege', 'Anzüge', 'Suits', 'Zweiteiler und Dreiteiler aus feiner Schurwolle, ab Lager lieferbar.', 'Two- and three-piece suits in fine wool, ready to ship.', null, 10),
  ('hosen', 'Hosen', 'Trousers', 'Anzughosen und Chinos, die zu allem passen.', 'Suit trousers and chinos that go with everything.', null, 30),
  ('t-shirts', 'T-Shirts', 'T-shirts', 'Schlichte T-Shirts, unter dem Sakko oder für sich getragen.', 'Simple T-shirts, worn under a jacket or on their own.', null, 45),
  ('westen', 'Westen', 'Waistcoats', 'Einzeln getragen. Oder als Teil des Ganzen.', 'Worn on its own. Or as part of the whole.', null, 50),
  ('schuhe', 'Schuhe', 'Shoes', 'Der passende Abschluss für deinen Auftritt.', 'The finishing touch for your look.', null, 80)
on conflict (slug) do nothing;

update public.categories set active = true
where slug in ('anzuege', 'westen', 'schuhe', 'hosen', 't-shirts') and not active;

update public.categories set active = false
where slug in ('sakkos', 'hemden', 'maentel-jacken', 'strick', 'accessoires') and active;

commit;

-- Kontrolle: eingeschaltet genau Anzüge, Hosen, T-Shirts, Westen, Schuhe
select slug, name_de, active, sort,
       (select count(*) from public.products p where p.category_id = c.id and p.status = 'active') as aktive_produkte
from public.categories c order by sort, slug;
