-- Startdaten: Kategorien, Beispielprodukte (Platzhalter) und Inhalte der Startseite.
-- Bildpfade «asset:…» zeigen auf die im Frontend eingebauten Bilder (src/lib/commerce/media.ts).

insert into public.categories (slug, name_de, name_en, description_de, description_en, image_path, sort) values
  ('anzuege', 'Anzüge', 'Suits', 'Zweiteiler und Dreiteiler aus feiner Schurwolle, ab Lager lieferbar.', 'Two- and three-piece suits in fine wool, ready to ship.', 'asset:muster/anzug-limmat-marine-1', 10),
  ('sakkos', 'Sakkos', 'Blazers', 'Blazer und Sakkos für Büro, Abend und Wochenende.', 'Blazers and jackets for the office, the evening and the weekend.', 'asset:muster/sakko-engadin-marine-1', 20),
  ('hosen', 'Hosen', 'Trousers', 'Anzughosen und Chinos, die zu allem passen.', 'Suit trousers and chinos that go with everything.', 'asset:muster/hose-sihl-anthrazit-1', 30),
  ('hemden', 'Hemden', 'Shirts', 'Hemden aus feiner Baumwolle, vom Büro bis zum Smoking.', 'Shirts in fine cotton, from the office to black tie.', 'asset:muster/hemd-rigi-hellblau-1', 40),
  ('westen', 'Westen', 'Waistcoats', 'Einzeln getragen. Oder als Teil des Ganzen.', 'Worn on its own. Or as part of the whole.', 'asset:muster/weste-limmat-marine-1', 50),
  ('maentel-jacken', 'Mäntel & Jacken', 'Coats & jackets', 'Mäntel und Jacken aus Wolle und Kaschmir für die kalten Monate.', 'Coats and jackets in wool and cashmere for the colder months.', 'asset:muster/mantel-gotthard-kamel-1', 60),
  ('strick', 'Strick', 'Knitwear', 'Pullover aus Kaschmir und Merino, weich und leicht.', 'Cashmere and merino knitwear, soft and light.', 'asset:muster/pullover-arosa-kamel-1', 70),
  ('schuhe', 'Schuhe', 'Shoes', 'Der passende Abschluss für deinen Auftritt.', 'The finishing touch for your look.', 'asset:muster/oxford-nero-schwarz-1', 80),
  ('accessoires', 'Accessoires', 'Accessories', 'Krawatten, Einstecktücher, Manschettenknöpfe und Gürtel.', 'Ties, pocket squares, cufflinks and belts.', 'asset:muster/krawatte-morcote-bordeaux-1', 90);

-- Muster-Sortiment (Kennzeichen «muster», Bilder = Illustrationen): dieselben 52 Produkte wie supabase/demo/muster-einspielen.sql.
insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-marine', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Der Anzug «Limmat» besteht aus Sakko und Hose. Kombiniere ihn mit der passenden Weste zu einem Dreiteiler.', 'The Limmat suit consists of a jacket and trousers. Add the matching waistcoat for a three-piece look.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem
Inside pocket with button', null, null, 'Slim Fit', 'Marine', 'Navy', '#243448', array['neu','muster']::text[], array['hochzeit','business']::text[], array['weste-limmat-marine','oxford-nero-schwarz']::text[], 48900, null, 0, '2026-10-06T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 0, 30), ('54', 3, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-limmat-marine-1', 'Anzug «Limmat» in Marine, vorne (Illustration)', 'Limmat Suit in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-limmat-marine-2', 'Anzug «Limmat» in Marine, hinten (Illustration)', 'Limmat Suit in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-anthrazit', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Der «Limmat» in Anthrazit ist der ruhige Begleiter fürs Büro. Mit weissem Hemd klassisch, mit Rollkragen modern.', 'The Limmat in charcoal is a calm companion for the office. Classic with a white shirt, modern with a roll neck.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem
Inside pocket with button', null, null, 'Slim Fit', 'Anthrazit', 'Charcoal', '#43464A', array['muster']::text[], array['business']::text[], array['weste-limmat-anthrazit','oxford-nero-schwarz']::text[], 48900, null, 1, '2026-09-28T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-limmat-anthrazit-1', 'Anzug «Limmat» in Anthrazit, vorne (Illustration)', 'Limmat Suit in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-limmat-anthrazit-2', 'Anzug «Limmat» in Anthrazit, hinten (Illustration)', 'Limmat Suit in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-mittelgrau', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Mittelgrau wirkt hell und freundlich und passt zu fast jeder Hemdfarbe. Ein Anzug für viele Anlässe.', 'Mid grey looks light and friendly and goes with almost any shirt colour. A suit for many occasions.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem
Inside pocket with button', null, null, 'Slim Fit', 'Mittelgrau', 'Mid grey', '#7A7C80', array['muster']::text[], array['business','abschlussfeier']::text[], array['weste-rhone-bordeaux','derby-lino-schwarz']::text[], 48900, null, 2, '2026-09-25T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-mittelgrau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-limmat-mittelgrau-1', 'Anzug «Limmat» in Mittelgrau, vorne (Illustration)', 'Limmat Suit in mid grey, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-limmat-mittelgrau-2', 'Anzug «Limmat» in Mittelgrau, hinten (Illustration)', 'Limmat Suit in mid grey, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-mittelgrau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-aare-anthrazit', c.id, 'anzug-aare', 'active', 'Anzug «Aare»', 'Aare Suit', 'Der Anzug «Aare» kombiniert ein Sakko mit einer passenden Hose. Anthrazit lässt sich mit hellen Hemden und dunklen Schuhen ergänzen.', 'The Aare suit pairs a jacket with matching trousers. Charcoal works well with light shirts and dark shoes.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und spitzem Revers
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt', 'Two-button jacket with peak lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem', null, null, 'Regular Fit', 'Anthrazit', 'Charcoal', '#484946', array['muster']::text[], array['business','gala']::text[], array['weste-limmat-salbeigruen','derby-lino-braun']::text[], 45900, null, 10, '2026-10-03T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 0, 40), ('56', 3, 50)) as v(size, stock, sort)
where p.handle = 'anzug-aare-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-aare-anthrazit-1', 'Anzug «Aare» in Anthrazit, vorne (Illustration)', 'Aare Suit in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-aare-anthrazit-2', 'Anzug «Aare» in Anthrazit, hinten (Illustration)', 'Aare Suit in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-aare-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-aare-marine', c.id, 'anzug-aare', 'active', 'Anzug «Aare»', 'Aare Suit', 'Spitzes Revers und eine gerade Linie: Der «Aare» in Marine wirkt klar und bleibt bequem über einen langen Tag.', 'Peak lapels and a straight line: the Aare in navy looks sharp and stays comfortable through a long day.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und spitzem Revers
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt', 'Two-button jacket with peak lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem', null, null, 'Regular Fit', 'Marine', 'Navy', '#2A3550', array['muster']::text[], array['business','hochzeit']::text[], array['weste-limmat-marine','monk-sion-espresso']::text[], 45900, null, 11, '2026-09-20T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 3, 40), ('56', 2, 50)) as v(size, stock, sort)
where p.handle = 'anzug-aare-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-aare-marine-1', 'Anzug «Aare» in Marine, vorne (Illustration)', 'Aare Suit in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-aare-marine-2', 'Anzug «Aare» in Marine, hinten (Illustration)', 'Aare Suit in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-aare-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-rhone-nachtblau', c.id, 'anzug-rhone', 'active', 'Zweireiher «Rhone»', 'Rhone Double-Breasted Suit', 'Der Zweireiher «Rhone» ist für Abende, an denen du auffallen willst. Sechs Knöpfe, spitzes Revers, schmale Linie.', 'The Rhone double-breasted suit is made for evenings when you want to stand out. Six buttons, peak lapels, slim line.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Zweireihiges Sakko mit sechs Knöpfen und spitzem Revers
Brusttasche, zwei Pattentaschen
Hose mit Bundfalte, fertig gesäumt', 'Double-breasted jacket with six buttons and peak lapels
Breast pocket, two flap pockets
Pleated trousers, finished hem', null, null, 'Slim Fit', 'Nachtblau', 'Midnight blue', '#1F2638', array['neu','muster']::text[], array['gala','hochzeit']::text[], array['hemd-rigi-weiss','oxford-nero-schwarz']::text[], 58900, null, 12, '2026-10-07T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-rhone-nachtblau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-rhone-nachtblau-1', 'Zweireiher «Rhone» in Nachtblau, vorne (Illustration)', 'Rhone Double-Breasted Suit in midnight blue, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-rhone-nachtblau-2', 'Zweireiher «Rhone» in Nachtblau, hinten (Illustration)', 'Rhone Double-Breasted Suit in midnight blue, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-rhone-nachtblau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-reuss-sand', c.id, 'anzug-reuss', 'active', 'Anzug «Reuss»', 'Reuss Suit', 'Leicht und hell für Hochzeiten im Sommer. Der «Reuss» trägt sich luftig und sieht auch am Abend noch gepflegt aus.', 'Light and pale for summer weddings. The Reuss feels airy and still looks neat in the evening.', 'Leinen mit Schurwolle, halb gefüttert', 'Linen with wool, half lined', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem
Inside pocket with button', null, null, 'Regular Fit', 'Sand', 'Sand', '#CDBB9B', array['neu','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['weste-reuss-sand','loafer-lugano-cognac']::text[], 42900, null, 13, '2026-10-08T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 2, 20), ('52', 3, 30), ('54', 3, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'anzug-reuss-sand';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-reuss-sand-1', 'Anzug «Reuss» in Sand, vorne (Illustration)', 'Reuss Suit in sand, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-reuss-sand-2', 'Anzug «Reuss» in Sand, hinten (Illustration)', 'Reuss Suit in sand, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-reuss-sand';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-reuss-hellblau', c.id, 'anzug-reuss', 'active', 'Anzug «Reuss»', 'Reuss Suit', 'Ein helles Blau für Trauzeugen, Abschlussfeiern und Feste im Freien. Dazu braune Schuhe und ein weisses Hemd.', 'A light blue for best men, graduations and outdoor parties. Pair it with brown shoes and a white shirt.', 'Leinen mit Schurwolle, halb gefüttert', 'Linen with wool, half lined', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem
Inside pocket with button', null, null, 'Regular Fit', 'Hellblau', 'Light blue', '#8FA7C0', array['sale','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['loafer-lugano-cognac']::text[], 42900, 49900, 14, '2026-09-10T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 2, 10), ('50', 3, 20), ('52', 1, 30), ('54', 0, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-reuss-hellblau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-reuss-hellblau-1', 'Anzug «Reuss» in Hellblau, vorne (Illustration)', 'Reuss Suit in light blue, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-reuss-hellblau-2', 'Anzug «Reuss» in Hellblau, hinten (Illustration)', 'Reuss Suit in light blue, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-reuss-hellblau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'smoking-thur-schwarz', c.id, 'smoking-thur', 'active', 'Smoking «Thur»', 'Thur Tuxedo', 'Der Smoking «Thur» mit Schalkragen aus Satin ist gemacht für Galas und Hochzeiten am Abend. Dazu die passende Weste und eine Fliege.', 'The Thur tuxedo with a satin shawl collar is made for galas and evening weddings. Add the matching waistcoat and a bow tie.', 'Schurwolle, Schalkragen mit Satin, Futter aus Cupro', 'Wool, satin shawl collar, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Ein Knopf, Schalkragen mit Satin
Hose mit Galonstreifen, fertig gesäumt
Passend zur Smoking-Weste «Thur»', 'One button, satin shawl collar
Trousers with satin side stripe, finished hem
Matches the Thur dinner waistcoat', null, null, 'Slim Fit', 'Schwarz', 'Black', '#151515', array['muster']::text[], array['gala','hochzeit']::text[], array['weste-thur-schwarz','hemd-pilatus-weiss','fliege-gandria-schwarz']::text[], 64900, null, 15, '2026-09-30T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 2, 20), ('52', 2, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'smoking-thur-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/smoking-thur-schwarz-1', 'Smoking «Thur» in Schwarz, vorne (Illustration)', 'Thur Tuxedo in black, front (illustration)', 1024, 1280, 0), ('asset:muster/smoking-thur-schwarz-2', 'Smoking «Thur» in Schwarz, hinten (Illustration)', 'Thur Tuxedo in black, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'smoking-thur-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-ticino-salbei', c.id, 'anzug-ticino', 'active', 'Anzug «Ticino»', 'Ticino Suit', 'Ein weiches Grün, das zu Holz, Stein und Sommerwiesen passt. Der «Ticino» ist der Anzug für Hochzeiten im Grünen.', 'A soft green that goes with wood, stone and summer meadows. The Ticino is the suit for weddings outdoors.', 'Schurwolle (Super 110’s) mit wenig Stretch, Futter aus Cupro', 'Wool (Super 110’s) with a little stretch, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, fertig gesäumt
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, finished hem
Inside pocket with button', null, null, 'Slim Fit', 'Salbei', 'Sage', '#7E8A72', array['neu','muster']::text[], array['hochzeit']::text[], array['weste-ticino-salbei','derby-lino-braun']::text[], 46900, null, 16, '2026-10-09T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-ticino-salbei';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-ticino-salbei-1', 'Anzug «Ticino» in Salbei, vorne (Illustration)', 'Ticino Suit in sage, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-ticino-salbei-2', 'Anzug «Ticino» in Salbei, hinten (Illustration)', 'Ticino Suit in sage, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-ticino-salbei';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'sakko-engadin-marine', c.id, 'sakko-engadin', 'active', 'Blazer «Engadin»', 'Engadin Blazer', 'Der klassische Blazer in Marine mit Knöpfen in Messingoptik. Zu grauer Hose fürs Büro, zu Chinos am Wochenende.', 'The classic navy blazer with brass-tone buttons. With grey trousers for the office, with chinos at the weekend.', 'Schurwolle, Futter aus Cupro', 'Wool, cupro lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Zwei Knöpfe in Messingoptik, Reverskragen
Aufgesetzte Taschen, Brusttasche
Drei Knöpfe am Ärmel, Rückenschlitz', 'Two brass-tone buttons, notch lapels
Patch pockets, breast pocket
Three buttons on the cuff, back vent', null, null, 'Slim Fit', 'Marine', 'Navy', '#26324A', array['neu','muster']::text[], array['business','abschlussfeier']::text[], array['hose-sihl-anthrazit','hemd-rigi-weiss','loafer-lugano-cognac']::text[], 39900, null, 100, '2026-10-11T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'sakkos';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'sakko-engadin-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/sakko-engadin-marine-1', 'Blazer «Engadin» in Marine, vorne (Illustration)', 'Engadin Blazer in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/sakko-engadin-marine-2', 'Blazer «Engadin» in Marine, hinten (Illustration)', 'Engadin Blazer in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'sakko-engadin-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'sakko-davos-hellgrau', c.id, 'sakko-davos', 'active', 'Sakko «Davos»', 'Davos Jacket', 'Ein helles Grau aus Wolle, Seide und Leinen. Leicht genug für den Sommer, ruhig genug fürs Büro.', 'A light grey in wool, silk and linen. Light enough for summer, calm enough for the office.', 'Schurwolle mit Seide und Leinen', 'Wool with silk and linen', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Zwei Knöpfe, Reverskragen
Brusttasche, zwei Pattentaschen
Halb gefüttert, leicht und luftig', 'Two buttons, notch lapels
Breast pocket, two flap pockets
Half lined, light and airy', null, null, 'Regular Fit', 'Hellgrau', 'Light grey', '#9A9C9E', array['muster']::text[], array['business','hochzeit']::text[], array['hose-sihl-marine','hemd-rigi-hellblau','krawatte-morcote-bordeaux']::text[], 37900, null, 101, '2026-09-24T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'sakkos';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 2, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'sakko-davos-hellgrau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/sakko-davos-hellgrau-1', 'Sakko «Davos» in Hellgrau, vorne (Illustration)', 'Davos Jacket in light grey, front (illustration)', 1024, 1280, 0), ('asset:muster/sakko-davos-hellgrau-2', 'Sakko «Davos» in Hellgrau, hinten (Illustration)', 'Davos Jacket in light grey, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'sakko-davos-hellgrau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'sakko-bernina-bordeaux', c.id, 'sakko-bernina', 'active', 'Samtsakko «Bernina»', 'Bernina Velvet Jacket', 'Samt in Bordeaux mit Schalkragen aus Satin: das Sakko für Weihnachtsfeiern, Galas und lange Abende.', 'Burgundy velvet with a satin shawl collar: the jacket for Christmas parties, galas and long evenings.', 'Baumwollsamt, Schalkragen mit Satin, Futter aus Viskose', 'Cotton velvet, satin shawl collar, viscose lining', 'Nur chemisch reinigen. Mit der Kleiderbürste pflegen.', 'Dry clean only. Care with a clothes brush.', 'Gefertigt in Italien', 'Made in Italy', 'Ein Knopf, Schalkragen mit Satin
Paspeltaschen
Passt zum Smokinghemd «Pilatus» und zur Fliege «Gandria»', 'One button, satin shawl collar
Welt pockets
Goes with the Pilatus dress shirt and the Gandria bow tie', null, null, 'Slim Fit', 'Bordeaux', 'Burgundy', '#5A1E2C', array['neu','muster']::text[], array['gala','hochzeit']::text[], array['hemd-pilatus-weiss','fliege-gandria-schwarz','oxford-nero-schwarz']::text[], 44900, null, 102, '2026-10-10T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'sakkos';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 2, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'sakko-bernina-bordeaux';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/sakko-bernina-bordeaux-1', 'Samtsakko «Bernina» in Bordeaux, vorne (Illustration)', 'Bernina Velvet Jacket in burgundy, front (illustration)', 1024, 1280, 0), ('asset:muster/sakko-bernina-bordeaux-2', 'Samtsakko «Bernina» in Bordeaux, hinten (Illustration)', 'Bernina Velvet Jacket in burgundy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'sakko-bernina-bordeaux';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'sakko-maloja-oliv', c.id, 'sakko-maloja', 'active', 'Sakko «Maloja»', 'Maloja Jacket', 'Weich, ohne Schulterpolster und mit aufgesetzten Taschen: Der «Maloja» ist das Sakko für Tage ohne Krawatte.', 'Soft, without shoulder pads and with patch pockets: the Maloja is the jacket for days without a tie.', 'Schurwolle mit 10 % Kaschmir, halb gefüttert', 'Wool with 10% cashmere, half lined', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Weich verarbeitet, ohne Schulterpolster
Zwei Knöpfe aus Horn, aufgesetzte Taschen
Zu Hemd, Rollkragen oder T-Shirt', 'Soft construction without shoulder pads
Two horn buttons, patch pockets
Wear it with a shirt, a roll neck or a T-shirt', null, null, 'Regular Fit', 'Oliv', 'Olive', '#5C5F45', array['sale','muster']::text[], array['business']::text[], array['chino-emme-sand','rollkragen-saas-schwarz','chelsea-zug-schwarz']::text[], 34900, 42900, 103, '2026-09-15T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'sakkos';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 2, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'sakko-maloja-oliv';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/sakko-maloja-oliv-1', 'Sakko «Maloja» in Oliv, vorne (Illustration)', 'Maloja Jacket in olive, front (illustration)', 1024, 1280, 0), ('asset:muster/sakko-maloja-oliv-2', 'Sakko «Maloja» in Oliv, hinten (Illustration)', 'Maloja Jacket in olive, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'sakko-maloja-oliv';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'hose-sihl-anthrazit', c.id, 'hose-sihl', 'active', 'Anzughose «Sihl»', 'Sihl Trousers', 'Die Anzughose mit einer Bundfalte passt zu Blazer, Strick und Hemd. Ein Grundstück für jeden Schrank.', 'The single-pleat trousers go with a blazer, knitwear and shirts. A staple for every wardrobe.', 'Schurwolle mit wenig Stretch', 'Wool with a little stretch', 'Chemische Reinigung. Nach dem Tragen an der Bügelfalte aufhängen.', 'Dry clean. Hang by the crease after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Eine Bundfalte, Bügelfalte
Schrägtaschen, zwei Gesässtaschen mit Knopf
Fertig gesäumt', 'Single pleat, pressed crease
Slanted pockets, two buttoned back pockets
Finished hem', null, null, 'Regular Fit', 'Anthrazit', 'Charcoal', '#3F4145', array['muster']::text[], array['business']::text[], array['sakko-engadin-marine','hemd-rigi-weiss']::text[], 16900, null, 200, '2026-09-27T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hosen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'hose-sihl-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/hose-sihl-anthrazit-1', 'Anzughose «Sihl» in Anthrazit, vorne (Illustration)', 'Sihl Trousers in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/hose-sihl-anthrazit-2', 'Anzughose «Sihl» in Anthrazit, hinten (Illustration)', 'Sihl Trousers in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'hose-sihl-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'hose-sihl-marine', c.id, 'hose-sihl', 'active', 'Anzughose «Sihl»', 'Sihl Trousers', 'Marine zu hellem Sakko oder Kaschmirpullover: die «Sihl» bringt Ruhe in jede Kombination.', 'Navy with a light jacket or a cashmere jumper: the Sihl brings calm to any combination.', 'Schurwolle mit wenig Stretch', 'Wool with a little stretch', 'Chemische Reinigung. Nach dem Tragen an der Bügelfalte aufhängen.', 'Dry clean. Hang by the crease after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Eine Bundfalte, Bügelfalte
Schrägtaschen, zwei Gesässtaschen mit Knopf
Fertig gesäumt', 'Single pleat, pressed crease
Slanted pockets, two buttoned back pockets
Finished hem', null, null, 'Regular Fit', 'Marine', 'Navy', '#27324A', array['muster']::text[], array['business','abschlussfeier']::text[], array['sakko-davos-hellgrau','hemd-rigi-hellblau']::text[], 16900, null, 201, '2026-09-21T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hosen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 2, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'hose-sihl-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/hose-sihl-marine-1', 'Anzughose «Sihl» in Marine, vorne (Illustration)', 'Sihl Trousers in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/hose-sihl-marine-2', 'Anzughose «Sihl» in Marine, hinten (Illustration)', 'Sihl Trousers in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'hose-sihl-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'chino-emme-sand', c.id, 'chino-emme', 'active', 'Chino «Emme»', 'Emme Chinos', 'Leichter Baumwoll-Twill in Sand, schmal und mit Umschlag. Zum Sakko am Freitag und zum Pullover am Wochenende.', 'Light cotton twill in sand, slim with a turn-up. With a jacket on Friday and with a jumper at the weekend.', 'Baumwolle mit wenig Stretch', 'Cotton with a little stretch', 'Bei 30 °C auf links waschen.', 'Wash inside out at 30 °C.', 'Gefertigt in Portugal', 'Made in Portugal', 'Leichter Baumwoll-Twill
Schrägtaschen, Gesässtaschen mit Knopf
Saum mit Umschlag', 'Light cotton twill
Slanted pockets, buttoned back pockets
Turn-up hem', null, null, 'Slim Fit', 'Sand', 'Sand', '#C9B48E', array['neu','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['sakko-maloja-oliv','hemd-saentis-dunkelblau']::text[], 12900, null, 202, '2026-10-09T11:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hosen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'chino-emme-sand';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/chino-emme-sand-1', 'Chino «Emme» in Sand, vorne (Illustration)', 'Emme Chinos in sand, front (illustration)', 1024, 1280, 0), ('asset:muster/chino-emme-sand-2', 'Chino «Emme» in Sand, hinten (Illustration)', 'Emme Chinos in sand, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'chino-emme-sand';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'chino-emme-oliv', c.id, 'chino-emme', 'active', 'Chino «Emme»', 'Emme Chinos', 'Oliv passt zu Marine, Kamel und Weiss. Die «Emme» ist die Hose für lässige Tage mit gutem Stil.', 'Olive goes with navy, camel and white. The Emme is the pair for relaxed days in good style.', 'Baumwolle mit wenig Stretch', 'Cotton with a little stretch', 'Bei 30 °C auf links waschen.', 'Wash inside out at 30 °C.', 'Gefertigt in Portugal', 'Made in Portugal', 'Leichter Baumwoll-Twill
Schrägtaschen, Gesässtaschen mit Knopf
Saum mit Umschlag', 'Light cotton twill
Slanted pockets, buttoned back pockets
Turn-up hem', null, null, 'Slim Fit', 'Oliv', 'Olive', '#5E6248', array['muster']::text[], array['business']::text[], array['pullover-arosa-marine','loafer-lugano-cognac']::text[], 12900, null, 203, '2026-09-19T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hosen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'chino-emme-oliv';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/chino-emme-oliv-1', 'Chino «Emme» in Oliv, vorne (Illustration)', 'Emme Chinos in olive, front (illustration)', 1024, 1280, 0), ('asset:muster/chino-emme-oliv-2', 'Chino «Emme» in Oliv, hinten (Illustration)', 'Emme Chinos in olive, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'chino-emme-oliv';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'hemd-rigi-weiss', c.id, 'hemd-rigi', 'active', 'Hemd «Rigi»', 'Rigi Shirt', 'Weisse Popeline mit Haifischkragen und Perlmuttknöpfen. Das Hemd, das zu jedem Anzug passt.', 'White poplin with a cutaway collar and mother-of-pearl buttons. The shirt that goes with every suit.', 'Baumwoll-Popeline (100 %)', 'Cotton poplin (100%)', 'Bei 40 °C waschen, feucht aufhängen, warm bügeln.', 'Wash at 40 °C, hang up damp, iron warm.', 'Gefertigt in Portugal', 'Made in Portugal', 'Haifischkragen
Perlmuttknöpfe
Brusttasche, abgerundeter Saum', 'Cutaway collar
Mother-of-pearl buttons
Breast pocket, curved hem', null, null, 'Slim Fit', 'Weiss', 'White', '#F4F2EC', array['neu','muster']::text[], array['business','hochzeit','abschlussfeier']::text[], array['krawatte-morcote-marine','einstecktuch-ascona-weiss']::text[], 11900, null, 300, '2026-10-09T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hemden';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('38', 2, 0), ('39', 3, 10), ('40', 3, 20), ('41', 3, 30), ('42', 3, 40), ('43', 2, 50), ('44', 1, 60), ('45', 1, 70)) as v(size, stock, sort)
where p.handle = 'hemd-rigi-weiss';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/hemd-rigi-weiss-1', 'Hemd «Rigi» in Weiss, vorne (Illustration)', 'Rigi Shirt in white, front (illustration)', 1024, 1280, 0), ('asset:muster/hemd-rigi-weiss-2', 'Hemd «Rigi» in Weiss, hinten (Illustration)', 'Rigi Shirt in white, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'hemd-rigi-weiss';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'hemd-rigi-hellblau', c.id, 'hemd-rigi', 'active', 'Hemd «Rigi»', 'Rigi Shirt', 'Hellblau wirkt frisch zu Marine und Grau. Mit Krawatte im Büro, offen am Abend.', 'Light blue looks fresh with navy and grey. With a tie at the office, open-collared in the evening.', 'Baumwoll-Popeline (100 %)', 'Cotton poplin (100%)', 'Bei 40 °C waschen, feucht aufhängen, warm bügeln.', 'Wash at 40 °C, hang up damp, iron warm.', 'Gefertigt in Portugal', 'Made in Portugal', 'Haifischkragen
Perlmuttknöpfe
Brusttasche, abgerundeter Saum', 'Cutaway collar
Mother-of-pearl buttons
Breast pocket, curved hem', null, null, 'Slim Fit', 'Hellblau', 'Light blue', '#BFD0E4', array['muster']::text[], array['business']::text[], array['krawatte-morcote-bordeaux','sakko-davos-hellgrau']::text[], 11900, null, 301, '2026-09-23T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hemden';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('38', 1, 0), ('39', 3, 10), ('40', 3, 20), ('41', 3, 30), ('42', 2, 40), ('43', 2, 50), ('44', 1, 60), ('45', 0, 70)) as v(size, stock, sort)
where p.handle = 'hemd-rigi-hellblau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/hemd-rigi-hellblau-1', 'Hemd «Rigi» in Hellblau, vorne (Illustration)', 'Rigi Shirt in light blue, front (illustration)', 1024, 1280, 0), ('asset:muster/hemd-rigi-hellblau-2', 'Hemd «Rigi» in Hellblau, hinten (Illustration)', 'Rigi Shirt in light blue, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'hemd-rigi-hellblau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'hemd-pilatus-weiss', c.id, 'hemd-pilatus', 'active', 'Smokinghemd «Pilatus»', 'Pilatus Dress Shirt', 'Kläppchenkragen, Plastron mit feinen Biesen und Umschlagmanschetten: das Hemd zum Smoking.', 'Wing collar, a finely pleated bib and French cuffs: the shirt for your tuxedo.', 'Baumwoll-Popeline, Plastron mit feinen Biesen', 'Cotton poplin, pleated bib', 'Bei 40 °C waschen, feucht aufhängen, warm bügeln.', 'Wash at 40 °C, hang up damp, iron warm.', 'Gefertigt in Portugal', 'Made in Portugal', 'Kläppchenkragen
Plastron mit feinen Biesen
Leiste für Hemdknöpfe, Umschlagmanschetten', 'Wing collar
Bib with fine pleats
Placket for shirt studs, French cuffs', null, null, 'Slim Fit', 'Weiss', 'White', '#F6F4EF', array['muster']::text[], array['gala','hochzeit']::text[], array['fliege-gandria-schwarz','manschettenknoepfe-sils-onyx','smoking-thur-schwarz']::text[], 14900, null, 302, '2026-09-29T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hemden';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('38', 1, 0), ('39', 2, 10), ('40', 2, 20), ('41', 3, 30), ('42', 2, 40), ('43', 1, 50), ('44', 1, 60), ('45', 0, 70)) as v(size, stock, sort)
where p.handle = 'hemd-pilatus-weiss';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/hemd-pilatus-weiss-1', 'Smokinghemd «Pilatus» in Weiss, vorne (Illustration)', 'Pilatus Dress Shirt in white, front (illustration)', 1024, 1280, 0), ('asset:muster/hemd-pilatus-weiss-2', 'Smokinghemd «Pilatus» in Weiss, hinten (Illustration)', 'Pilatus Dress Shirt in white, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'hemd-pilatus-weiss';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'hemd-saentis-dunkelblau', c.id, 'hemd-saentis', 'active', 'Oxfordhemd «Säntis»', 'Säntis Oxford Shirt', 'Kräftiger Oxford-Stoff in Dunkelblau. Unter dem Sakko oder allein zur Chino.', 'Sturdy oxford cloth in dark blue. Under a jacket or on its own with chinos.', 'Baumwolle Oxford (100 %)', 'Cotton oxford (100%)', 'Bei 40 °C waschen, feucht aufhängen, warm bügeln.', 'Wash at 40 °C, hang up damp, iron warm.', 'Gefertigt in Portugal', 'Made in Portugal', 'Kentkragen
Etwas kräftigerer Stoff, auch ohne Krawatte
Brusttasche, abgerundeter Saum', 'Spread collar
Slightly sturdier cloth, also without a tie
Breast pocket, curved hem', null, null, 'Regular Fit', 'Dunkelblau', 'Dark blue', '#2B3550', array['muster']::text[], array['business']::text[], array['chino-emme-sand','sakko-maloja-oliv']::text[], 12900, null, 303, '2026-09-17T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'hemden';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('38', 2, 0), ('39', 3, 10), ('40', 3, 20), ('41', 3, 30), ('42', 2, 40), ('43', 2, 50), ('44', 1, 60), ('45', 1, 70)) as v(size, stock, sort)
where p.handle = 'hemd-saentis-dunkelblau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/hemd-saentis-dunkelblau-1', 'Oxfordhemd «Säntis» in Dunkelblau, vorne (Illustration)', 'Säntis Oxford Shirt in dark blue, front (illustration)', 1024, 1280, 0), ('asset:muster/hemd-saentis-dunkelblau-2', 'Oxfordhemd «Säntis» in Dunkelblau, hinten (Illustration)', 'Säntis Oxford Shirt in dark blue, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'hemd-saentis-dunkelblau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-limmat-marine', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Die Weste «Limmat» ergänzt den marineblauen Anzug. Du kannst sie auch einzeln über einem Hemd tragen.', 'The Limmat waistcoat completes the navy suit. You can also wear it on its own over a shirt.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, zwei Paspeltaschen
Verstellbarer Riegel am Rücken
Passt zum gleichfarbigen Anzug', 'Five buttons, two welt pockets
Adjustable strap at the back
Matches the suit in the same colour', null, null, null, 'Marine', 'Navy', '#243448', array['neu','muster']::text[], array['hochzeit','business']::text[], array['anzug-limmat-marine','oxford-nero-schwarz']::text[], 12900, null, 20, '2026-10-05T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 3, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'weste-limmat-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-limmat-marine-1', 'Weste «Limmat» in Marine, vorne (Illustration)', 'Limmat Waistcoat in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-limmat-marine-2', 'Weste «Limmat» in Marine, hinten (Illustration)', 'Limmat Waistcoat in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-limmat-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-limmat-salbeigruen', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Die Weste «Limmat» in Salbeigrün setzt einen hellen Farbakzent. Kombiniere sie mit einem weissen Hemd und einer Anzughose.', 'The Limmat waistcoat in sage green adds a light touch of colour. Pair it with a white shirt and suit trousers.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, zwei Paspeltaschen
Verstellbarer Riegel am Rücken
Passt zum gleichfarbigen Anzug', 'Five buttons, two welt pockets
Adjustable strap at the back
Matches the suit in the same colour', null, null, null, 'Salbeigrün', 'Sage green', '#929881', array['sale','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['anzug-aare-anthrazit','derby-lino-braun']::text[], 12900, 15900, 30, '2026-10-01T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 3, 40), ('56', 3, 50)) as v(size, stock, sort)
where p.handle = 'weste-limmat-salbeigruen';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-limmat-salbeigruen-1', 'Weste «Limmat» in Salbeigrün, vorne (Illustration)', 'Limmat Waistcoat in sage green, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-limmat-salbeigruen-2', 'Weste «Limmat» in Salbeigrün, hinten (Illustration)', 'Limmat Waistcoat in sage green, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-limmat-salbeigruen';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-limmat-anthrazit', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Macht aus dem «Limmat» in Anthrazit einen Dreiteiler. Einzeln getragen wirkt sie lässig zu Jeans und Hemd.', 'Turns the charcoal Limmat into a three-piece. On its own it looks relaxed with jeans and a shirt.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, zwei Paspeltaschen
Verstellbarer Riegel am Rücken
Passt zum gleichfarbigen Anzug', 'Five buttons, two welt pockets
Adjustable strap at the back
Matches the suit in the same colour', null, null, null, 'Anthrazit', 'Charcoal', '#43464A', array['muster']::text[], array['business']::text[], array['anzug-limmat-anthrazit','oxford-nero-schwarz']::text[], 12900, null, 31, '2026-09-28T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'weste-limmat-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-limmat-anthrazit-1', 'Weste «Limmat» in Anthrazit, vorne (Illustration)', 'Limmat Waistcoat in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-limmat-anthrazit-2', 'Weste «Limmat» in Anthrazit, hinten (Illustration)', 'Limmat Waistcoat in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-limmat-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-reuss-sand', c.id, 'weste-reuss', 'active', 'Weste «Reuss»', 'Reuss Waistcoat', 'Die helle Weste zum «Reuss». Ideal für Trauzeugen, die nicht ganz gleich aussehen sollen wie der Bräutigam.', 'The light waistcoat for the Reuss. Ideal for best men who should not look exactly like the groom.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, zwei Paspeltaschen
Verstellbarer Riegel am Rücken
Passt zum gleichfarbigen Anzug', 'Five buttons, two welt pockets
Adjustable strap at the back
Matches the suit in the same colour', null, null, null, 'Sand', 'Sand', '#CDBB9B', array['neu','muster']::text[], array['hochzeit']::text[], array['anzug-reuss-sand','loafer-lugano-cognac']::text[], 11900, null, 32, '2026-10-08T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'weste-reuss-sand';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-reuss-sand-1', 'Weste «Reuss» in Sand, vorne (Illustration)', 'Reuss Waistcoat in sand, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-reuss-sand-2', 'Weste «Reuss» in Sand, hinten (Illustration)', 'Reuss Waistcoat in sand, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-reuss-sand';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-rhone-bordeaux', c.id, 'weste-rhone', 'active', 'Weste «Rhone»', 'Rhone Waistcoat', 'Bordeaux mit schmalem Revers: ein Farbakzent unter grauen und blauen Anzügen. Schön zu Hochzeiten im Herbst.', 'Burgundy with slim lapels: a touch of colour under grey and blue suits. Lovely for autumn weddings.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, schmales Revers
Zwei Paspeltaschen, Riegel am Rücken
Einzeln oder zum Anzug getragen', 'Five buttons, slim lapels
Two welt pockets, strap at the back
Worn on its own or with a suit', null, null, null, 'Bordeaux', 'Burgundy', '#6B2737', array['neu','muster']::text[], array['hochzeit','gala']::text[], array['anzug-limmat-mittelgrau','derby-lino-schwarz']::text[], 13900, null, 33, '2026-10-07T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'weste-rhone-bordeaux';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-rhone-bordeaux-1', 'Weste «Rhone» in Bordeaux, vorne (Illustration)', 'Rhone Waistcoat in burgundy, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-rhone-bordeaux-2', 'Weste «Rhone» in Bordeaux, hinten (Illustration)', 'Rhone Waistcoat in burgundy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-rhone-bordeaux';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-thur-schwarz', c.id, 'weste-thur', 'active', 'Smoking-Weste «Thur»', 'Thur Dinner Waistcoat', 'Die Weste zum Smoking «Thur», mit Revers aus Satin. Macht den Abendanzug komplett.', 'The waistcoat for the Thur tuxedo, with satin lapels. Completes the evening suit.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, schmales Revers
Zwei Paspeltaschen, Riegel am Rücken
Einzeln oder zum Anzug getragen', 'Five buttons, slim lapels
Two welt pockets, strap at the back
Worn on its own or with a suit', null, null, null, 'Schwarz', 'Black', '#151515', array['muster']::text[], array['gala']::text[], array['smoking-thur-schwarz','oxford-nero-schwarz']::text[], 14900, null, 34, '2026-09-30T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 2, 20), ('52', 2, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'weste-thur-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-thur-schwarz-1', 'Smoking-Weste «Thur» in Schwarz, vorne (Illustration)', 'Thur Dinner Waistcoat in black, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-thur-schwarz-2', 'Smoking-Weste «Thur» in Schwarz, hinten (Illustration)', 'Thur Dinner Waistcoat in black, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-thur-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-ticino-salbei', c.id, 'weste-ticino', 'active', 'Weste «Ticino»', 'Ticino Waistcoat', 'Gehört zum Anzug «Ticino». Zusammen ergeben sie einen Dreiteiler in weichem Grün.', 'Belongs to the Ticino suit. Together they make a three-piece in soft green.', 'Schurwolle mit wenig Stretch, Rücken aus Cupro', 'Wool with a little stretch, cupro back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Italien', 'Made in Italy', 'Fünf Knöpfe, zwei Paspeltaschen
Verstellbarer Riegel am Rücken
Passt zum gleichfarbigen Anzug', 'Five buttons, two welt pockets
Adjustable strap at the back
Matches the suit in the same colour', null, null, null, 'Salbei', 'Sage', '#7E8A72', array['muster']::text[], array['hochzeit']::text[], array['anzug-ticino-salbei','derby-lino-braun']::text[], 12900, null, 35, '2026-10-09T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 2, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'weste-ticino-salbei';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/weste-ticino-salbei-1', 'Weste «Ticino» in Salbei, vorne (Illustration)', 'Ticino Waistcoat in sage, front (illustration)', 1024, 1280, 0), ('asset:muster/weste-ticino-salbei-2', 'Weste «Ticino» in Salbei, hinten (Illustration)', 'Ticino Waistcoat in sage, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-ticino-salbei';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'mantel-gotthard-kamel', c.id, 'mantel-gotthard', 'active', 'Mantel «Gotthard»', 'Gotthard Coat', 'Kamel ist die Farbe des klassischen Wintermantels. Wolle mit Kaschmir, knapp übers Knie, über Anzug oder Strick.', 'Camel is the colour of the classic winter coat. Wool with cashmere, just above the knee, over a suit or knitwear.', 'Schurwolle mit 10 % Kaschmir, Futter aus Viskose', 'Wool with 10% cashmere, viscose lining', 'Chemische Reinigung. Auf einem breiten Bügel lagern.', 'Dry clean. Store on a wide hanger.', 'Gefertigt in Italien', 'Made in Italy', 'Drei Knöpfe, Reverskragen
Pattentaschen, Brusttasche
Rückenschlitz und Riegel, Länge bis knapp übers Knie', 'Three buttons, notch lapels
Flap pockets, breast pocket
Back vent and half belt, just above the knee', null, null, 'Regular Fit', 'Kamel', 'Camel', '#B08A5C', array['neu','muster']::text[], array['business','gala']::text[], array['rollkragen-saas-schwarz','hose-sihl-anthrazit','chelsea-zug-schwarz']::text[], 69900, null, 400, '2026-10-12T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'maentel-jacken';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'mantel-gotthard-kamel';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/mantel-gotthard-kamel-1', 'Mantel «Gotthard» in Kamel, vorne (Illustration)', 'Gotthard Coat in camel, front (illustration)', 1024, 1280, 0), ('asset:muster/mantel-gotthard-kamel-2', 'Mantel «Gotthard» in Kamel, hinten (Illustration)', 'Gotthard Coat in camel, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'mantel-gotthard-kamel';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'mantel-gotthard-marine', c.id, 'mantel-gotthard', 'active', 'Mantel «Gotthard»', 'Gotthard Coat', 'Der «Gotthard» in Marine passt über jeden Anzug der Kollektion und wirkt auch zu Jeans gepflegt.', 'The Gotthard in navy fits over every suit in the collection and still looks polished with jeans.', 'Schurwolle mit 10 % Kaschmir, Futter aus Viskose', 'Wool with 10% cashmere, viscose lining', 'Chemische Reinigung. Auf einem breiten Bügel lagern.', 'Dry clean. Store on a wide hanger.', 'Gefertigt in Italien', 'Made in Italy', 'Drei Knöpfe, Reverskragen
Pattentaschen, Brusttasche
Rückenschlitz und Riegel, Länge bis knapp übers Knie', 'Three buttons, notch lapels
Flap pockets, breast pocket
Back vent and half belt, just above the knee', null, null, 'Regular Fit', 'Marine', 'Navy', '#23304A', array['muster']::text[], array['business']::text[], array['pullover-arosa-kamel','chino-emme-sand']::text[], 69900, null, 401, '2026-09-26T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'maentel-jacken';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 2, 20), ('52', 3, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'mantel-gotthard-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/mantel-gotthard-marine-1', 'Mantel «Gotthard» in Marine, vorne (Illustration)', 'Gotthard Coat in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/mantel-gotthard-marine-2', 'Mantel «Gotthard» in Marine, hinten (Illustration)', 'Gotthard Coat in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'mantel-gotthard-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'mantel-albula-anthrazit', c.id, 'mantel-albula', 'active', 'Zweireiher-Mantel «Albula»', 'Albula Double-Breasted Coat', 'Zweireihig mit sechs Knöpfen und spitzem Revers: der Mantel für dunkle Anzüge und kalte Abende.', 'Double-breasted with six buttons and peak lapels: the coat for dark suits and cold evenings.', 'Schurwolle mit 10 % Kaschmir, Futter aus Viskose', 'Wool with 10% cashmere, viscose lining', 'Chemische Reinigung. Auf einem breiten Bügel lagern.', 'Dry clean. Store on a wide hanger.', 'Gefertigt in Italien', 'Made in Italy', 'Zweireihig mit sechs Knöpfen, spitzes Revers
Pattentaschen, Brusttasche
Rückenschlitz und Riegel', 'Double-breasted with six buttons, peak lapels
Flap pockets, breast pocket
Back vent and half belt', null, null, 'Regular Fit', 'Anthrazit', 'Charcoal', '#3E4044', array['muster']::text[], array['business','gala']::text[], array['anzug-limmat-anthrazit','oxford-nero-schwarz']::text[], 79900, null, 402, '2026-09-12T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'maentel-jacken';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 1, 10), ('50', 2, 20), ('52', 2, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'mantel-albula-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/mantel-albula-anthrazit-1', 'Zweireiher-Mantel «Albula» in Anthrazit, vorne (Illustration)', 'Albula Double-Breasted Coat in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/mantel-albula-anthrazit-2', 'Zweireiher-Mantel «Albula» in Anthrazit, hinten (Illustration)', 'Albula Double-Breasted Coat in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'mantel-albula-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'jacke-flims-oliv', c.id, 'jacke-flims', 'active', 'Feldjacke «Flims»', 'Flims Field Jacket', 'Vier Taschen, Stehkragen und Tunnelzug: die Feldjacke für Herbsttage in der Stadt und am Wochenende.', 'Four pockets, a stand collar and a drawstring: the field jacket for autumn days in town and at the weekend.', 'Baumwolle, wasserabweisend ausgerüstet', 'Cotton with a water-repellent finish', 'Bei 30 °C waschen, nicht in den Trockner.', 'Wash at 30 °C, do not tumble dry.', 'Gefertigt in Portugal', 'Made in Portugal', 'Stehkragen, Zwei-Wege-Reissverschluss
Vier Taschen mit Patte
Tunnelzug in der Taille', 'Stand collar, two-way zip
Four flap pockets
Drawstring at the waist', null, null, 'Regular Fit', 'Oliv', 'Olive', '#55593F', array['neu','muster']::text[], array['business']::text[], array['pullover-arosa-marine','chino-emme-sand']::text[], 44900, null, 403, '2026-10-10T11:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'maentel-jacken';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'jacke-flims-oliv';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/jacke-flims-oliv-1', 'Feldjacke «Flims» in Oliv, vorne (Illustration)', 'Flims Field Jacket in olive, front (illustration)', 1024, 1280, 0), ('asset:muster/jacke-flims-oliv-2', 'Feldjacke «Flims» in Oliv, hinten (Illustration)', 'Flims Field Jacket in olive, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'jacke-flims-oliv';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'jacke-flims-marine', c.id, 'jacke-flims', 'active', 'Feldjacke «Flims»', 'Flims Field Jacket', 'Die «Flims» in Marine: ruhig, wasserabweisend und mit genug Taschen für alles, was du dabeihast.', 'The Flims in navy: understated, water-repellent and with enough pockets for everything you carry.', 'Baumwolle, wasserabweisend ausgerüstet', 'Cotton with a water-repellent finish', 'Bei 30 °C waschen, nicht in den Trockner.', 'Wash at 30 °C, do not tumble dry.', 'Gefertigt in Portugal', 'Made in Portugal', 'Stehkragen, Zwei-Wege-Reissverschluss
Vier Taschen mit Patte
Tunnelzug in der Taille', 'Stand collar, two-way zip
Four flap pockets
Drawstring at the waist', null, null, 'Regular Fit', 'Marine', 'Navy', '#2A3548', array['sale','muster']::text[], array['business']::text[], array['rollkragen-saas-schwarz','chino-emme-oliv']::text[], 44900, 52900, 404, '2026-09-08T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'maentel-jacken';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 2, 10), ('50', 2, 20), ('52', 3, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'jacke-flims-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/jacke-flims-marine-1', 'Feldjacke «Flims» in Marine, vorne (Illustration)', 'Flims Field Jacket in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/jacke-flims-marine-2', 'Feldjacke «Flims» in Marine, hinten (Illustration)', 'Flims Field Jacket in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'jacke-flims-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'pullover-arosa-kamel', c.id, 'pullover-arosa', 'active', 'Kaschmirpullover «Arosa»', 'Arosa Cashmere Jumper', 'Reiner Kaschmir in Kamel, fein und zweifädig gestrickt. Allein zur Chino oder unter dem Mantel.', 'Pure cashmere in camel, finely knitted in two-ply yarn. On its own with chinos or under a coat.', 'Kaschmir (100 %)', 'Cashmere (100%)', 'Von Hand waschen, liegend trocknen.', 'Hand wash, dry flat.', 'Gestrickt in Italien', 'Knitted in Italy', 'Rundhals, Rippbündchen
Feiner Strick, zweifädig
Leicht und warm', 'Crew neck, ribbed trims
Fine two-ply knit
Light and warm', null, null, 'Regular Fit', 'Kamel', 'Camel', '#B9956A', array['neu','muster']::text[], array['business']::text[], array['chino-emme-oliv','loafer-lugano-cognac']::text[], 29900, null, 500, '2026-10-12T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'strick';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('S', 2, 0), ('M', 3, 10), ('L', 3, 20), ('XL', 2, 30), ('XXL', 1, 40)) as v(size, stock, sort)
where p.handle = 'pullover-arosa-kamel';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/pullover-arosa-kamel-1', 'Kaschmirpullover «Arosa» in Kamel, vorne (Illustration)', 'Arosa Cashmere Jumper in camel, front (illustration)', 1024, 1280, 0), ('asset:muster/pullover-arosa-kamel-2', 'Kaschmirpullover «Arosa» in Kamel, hinten (Illustration)', 'Arosa Cashmere Jumper in camel, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'pullover-arosa-kamel';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'pullover-arosa-marine', c.id, 'pullover-arosa', 'active', 'Kaschmirpullover «Arosa»', 'Arosa Cashmere Jumper', 'Marine passt zu fast allem: der «Arosa» ist der Pullover, den du am häufigsten trägst.', 'Navy goes with almost everything: the Arosa is the jumper you will wear most often.', 'Kaschmir (100 %)', 'Cashmere (100%)', 'Von Hand waschen, liegend trocknen.', 'Hand wash, dry flat.', 'Gestrickt in Italien', 'Knitted in Italy', 'Rundhals, Rippbündchen
Feiner Strick, zweifädig
Leicht und warm', 'Crew neck, ribbed trims
Fine two-ply knit
Light and warm', null, null, 'Regular Fit', 'Marine', 'Navy', '#28334A', array['muster']::text[], array['business']::text[], array['chino-emme-sand','jacke-flims-oliv']::text[], 29900, null, 501, '2026-09-22T11:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'strick';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('S', 1, 0), ('M', 3, 10), ('L', 3, 20), ('XL', 2, 30), ('XXL', 1, 40)) as v(size, stock, sort)
where p.handle = 'pullover-arosa-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/pullover-arosa-marine-1', 'Kaschmirpullover «Arosa» in Marine, vorne (Illustration)', 'Arosa Cashmere Jumper in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/pullover-arosa-marine-2', 'Kaschmirpullover «Arosa» in Marine, hinten (Illustration)', 'Arosa Cashmere Jumper in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'pullover-arosa-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'rollkragen-saas-schwarz', c.id, 'rollkragen-saas', 'active', 'Rollkragenpullover «Saas»', 'Saas Roll Neck', 'Feine Merinowolle in Schwarz: unter dem Sakko statt Hemd und Krawatte, modern und warm.', 'Fine merino wool in black: under a jacket instead of a shirt and tie, modern and warm.', 'Extrafeine Merinowolle (100 %)', 'Extra-fine merino wool (100%)', 'Wollwaschgang bei 30 °C, liegend trocknen.', 'Wool cycle at 30 °C, dry flat.', 'Gestrickt in Italien', 'Knitted in Italy', 'Rollkragen
Feiner Strick, auch unter dem Sakko
Rippbündchen', 'Roll neck
Fine knit, also under a jacket
Ribbed trims', null, null, 'Slim Fit', 'Schwarz', 'Black', '#1C1C1C', array['muster']::text[], array['business','gala']::text[], array['sakko-maloja-oliv','hose-sihl-anthrazit']::text[], 17900, null, 502, '2026-10-04T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'strick';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('S', 2, 0), ('M', 3, 10), ('L', 3, 20), ('XL', 2, 30), ('XXL', 1, 40)) as v(size, stock, sort)
where p.handle = 'rollkragen-saas-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/rollkragen-saas-schwarz-1', 'Rollkragenpullover «Saas» in Schwarz, vorne (Illustration)', 'Saas Roll Neck in black, front (illustration)', 1024, 1280, 0), ('asset:muster/rollkragen-saas-schwarz-2', 'Rollkragenpullover «Saas» in Schwarz, hinten (Illustration)', 'Saas Roll Neck in black, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'rollkragen-saas-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'oxford-nero-schwarz', c.id, 'oxford-nero', 'active', 'Oxford «Nero»', 'Nero Oxford', 'Der Oxford «Nero» hat eine geschlossene Schnürung. Seine schwarze Farbe lässt sich mit den Anzügen der Kollektion kombinieren.', 'The Nero oxford has closed lacing. Its black colour goes with every suit in the collection.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Geschlossene Schnürung
Kappe mit Ziernaht
Rahmengenähte Ledersohle', 'Closed lacing
Toe cap with stitching
Welted leather sole', null, null, null, 'Schwarz', 'Black', '#20211F', array['neu','muster']::text[], array['gala','business','abschlussfeier']::text[], array['socken-vals-marine']::text[], 23900, null, 50, '2026-10-02T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 3, 0), ('41', 0, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 3, 50), ('46', 3, 60)) as v(size, stock, sort)
where p.handle = 'oxford-nero-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/oxford-nero-schwarz-1', 'Oxford «Nero» in Schwarz, seitlich (Illustration)', 'Nero Oxford in black, side view (illustration)', 1024, 1280, 0), ('asset:muster/oxford-nero-schwarz-2', 'Oxford «Nero» in Schwarz, Innenseite (Illustration)', 'Nero Oxford in black, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'oxford-nero-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'oxford-nero-dunkelbraun', c.id, 'oxford-nero', 'active', 'Oxford «Nero»', 'Nero Oxford', 'Der «Nero» in Dunkelbraun passt zu Marine, Grau und Grün. Etwas weniger streng als Schwarz.', 'The Nero in dark brown goes with navy, grey and green. A little less formal than black.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Geschlossene Schnürung
Kappe mit Ziernaht
Rahmengenähte Ledersohle', 'Closed lacing
Toe cap with stitching
Welted leather sole', null, null, null, 'Dunkelbraun', 'Dark brown', '#4A3426', array['muster']::text[], array['business','hochzeit']::text[], array['guertel-chur-braun']::text[], 23900, null, 51, '2026-09-26T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 2, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 0, 60)) as v(size, stock, sort)
where p.handle = 'oxford-nero-dunkelbraun';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/oxford-nero-dunkelbraun-1', 'Oxford «Nero» in Dunkelbraun, seitlich (Illustration)', 'Nero Oxford in dark brown, side view (illustration)', 1024, 1280, 0), ('asset:muster/oxford-nero-dunkelbraun-2', 'Oxford «Nero» in Dunkelbraun, Innenseite (Illustration)', 'Nero Oxford in dark brown, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'oxford-nero-dunkelbraun';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'derby-lino-braun', c.id, 'derby-lino', 'active', 'Derby «Lino»', 'Lino Derby', 'Der Derby «Lino» zeigt eine offene Schnürung. Der braune Farbton ergänzt dunkle und helle Hosen.', 'The Lino derby has open lacing. Its brown tone goes with both dark and light trousers.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Offene Schnürung, bequem am Rist
Kappe mit Ziernaht
Ledersohle mit Gummiabsatz', 'Open lacing, comfortable at the instep
Toe cap with stitching
Leather sole with rubber heel', null, null, null, 'Braun', 'Brown', '#825834', array['neu','muster']::text[], array['business','hochzeit']::text[], array['guertel-chur-braun']::text[], 21900, null, 40, '2026-10-04T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 0, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 3, 50), ('46', 3, 60)) as v(size, stock, sort)
where p.handle = 'derby-lino-braun';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/derby-lino-braun-1', 'Derby «Lino» in Braun, seitlich (Illustration)', 'Lino Derby in brown, side view (illustration)', 1024, 1280, 0), ('asset:muster/derby-lino-braun-2', 'Derby «Lino» in Braun, Innenseite (Illustration)', 'Lino Derby in brown, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'derby-lino-braun';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'derby-lino-schwarz', c.id, 'derby-lino', 'active', 'Derby «Lino»', 'Lino Derby', 'Schwarz und offen geschnürt: bequem für lange Tage im Anzug, auch bei breitem Fuss.', 'Black with open lacing: comfortable for long days in a suit, even for wider feet.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Offene Schnürung, bequem am Rist
Kappe mit Ziernaht
Ledersohle mit Gummiabsatz', 'Open lacing, comfortable at the instep
Toe cap with stitching
Leather sole with rubber heel', null, null, null, 'Schwarz', 'Black', '#1E1E1E', array['muster']::text[], array['business']::text[], array['guertel-chur-schwarz']::text[], 21900, null, 41, '2026-09-22T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 1, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 2, 50), ('46', 1, 60)) as v(size, stock, sort)
where p.handle = 'derby-lino-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/derby-lino-schwarz-1', 'Derby «Lino» in Schwarz, seitlich (Illustration)', 'Lino Derby in black, side view (illustration)', 1024, 1280, 0), ('asset:muster/derby-lino-schwarz-2', 'Derby «Lino» in Schwarz, Innenseite (Illustration)', 'Lino Derby in black, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'derby-lino-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'loafer-lugano-cognac', c.id, 'loafer-lugano', 'active', 'Loafer «Lugano»', 'Lugano Loafer', 'Zum Hineinschlüpfen: Der «Lugano» passt zu hellen Anzügen im Sommer und zu Chinos am Wochenende.', 'Simply slip in: the Lugano goes with light suits in summer and with chinos at the weekend.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Zum Hineinschlüpfen, Mokassinnaht
Steg mit Schlitz
Leicht und flexibel', 'Slip-on with moccasin seam
Strap with slot
Light and flexible', null, null, null, 'Cognac', 'Cognac', '#8A4E2A', array['neu','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['chino-emme-sand']::text[], 22900, null, 52, '2026-10-08T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 2, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 0, 60)) as v(size, stock, sort)
where p.handle = 'loafer-lugano-cognac';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/loafer-lugano-cognac-1', 'Loafer «Lugano» in Cognac, seitlich (Illustration)', 'Lugano Loafer in cognac, side view (illustration)', 1024, 1280, 0), ('asset:muster/loafer-lugano-cognac-2', 'Loafer «Lugano» in Cognac, Innenseite (Illustration)', 'Lugano Loafer in cognac, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'loafer-lugano-cognac';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'monk-sion-espresso', c.id, 'monk-sion', 'active', 'Monk «Sion»', 'Sion Monk Strap', 'Zwei Schnallen statt Schnürung: Der «Sion» ist für alle, die etwas mehr Charakter tragen wollen.', 'Two buckles instead of laces: the Sion is for anyone who wants to wear a little more character.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Zwei Schnallen statt Schnürung
Kappe mit Ziernaht
Ledersohle mit Gummiabsatz', 'Two buckles instead of laces
Toe cap with stitching
Leather sole with rubber heel', null, null, null, 'Espresso', 'Espresso', '#3E2A20', array['muster']::text[], array['business','gala']::text[], array['guertel-chur-braun']::text[], 25900, null, 53, '2026-09-18T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 1, 0), ('41', 2, 10), ('42', 3, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 1, 60)) as v(size, stock, sort)
where p.handle = 'monk-sion-espresso';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/monk-sion-espresso-1', 'Monk «Sion» in Espresso, seitlich (Illustration)', 'Sion Monk Strap in espresso, side view (illustration)', 1024, 1280, 0), ('asset:muster/monk-sion-espresso-2', 'Monk «Sion» in Espresso, Innenseite (Illustration)', 'Sion Monk Strap in espresso, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'monk-sion-espresso';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'chelsea-zug-schwarz', c.id, 'chelsea-zug', 'active', 'Chelsea Boot «Zug»', 'Zug Chelsea Boot', 'Schlank und schnell angezogen. Der «Zug» passt zum Anzug im Winter und zu dunklen Jeans.', 'Slim and quick to put on. The Zug goes with a suit in winter and with dark jeans.', 'Kalbsleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Calf leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Spanien', 'Made in Spain', 'Elastischer Einsatz an der Seite
Zuglasche hinten
Profilierte Gummisohle', 'Elastic side panel
Pull tab at the back
Grip rubber sole', null, null, null, 'Schwarz', 'Black', '#1E1E1E', array['sale','muster']::text[], array['business']::text[], array['mantel-gotthard-kamel']::text[], 22900, 26900, 54, '2026-09-05T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 0, 0), ('41', 1, 10), ('42', 2, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 0, 60)) as v(size, stock, sort)
where p.handle = 'chelsea-zug-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/chelsea-zug-schwarz-1', 'Chelsea Boot «Zug» in Schwarz, seitlich (Illustration)', 'Zug Chelsea Boot in black, side view (illustration)', 1024, 1280, 0), ('asset:muster/chelsea-zug-schwarz-2', 'Chelsea Boot «Zug» in Schwarz, Innenseite (Illustration)', 'Zug Chelsea Boot in black, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'chelsea-zug-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'krawatte-morcote-bordeaux', c.id, 'krawatte-morcote', 'active', 'Seidenkrawatte «Morcote»', 'Morcote Silk Tie', 'Reine Seide mit feinem Punktmuster, von Hand vernäht. Bordeaux bringt Wärme zu Grau und Marine.', 'Pure silk with a fine dot pattern, hand-finished. Burgundy brings warmth to grey and navy.', 'Seide (100 %)', 'Silk (100%)', 'Nur chemisch reinigen. Nach dem Tragen aufrollen.', 'Dry clean only. Roll up after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Breite 7.5 cm, Länge 148 cm
Feines Punktmuster
Von Hand vernäht', 'Width 7.5 cm, length 148 cm
Fine dot pattern
Hand-finished', null, null, null, 'Bordeaux', 'Burgundy', '#6A2333', array['neu','muster']::text[], array['business','hochzeit']::text[], array['hemd-rigi-hellblau','einstecktuch-ascona-weiss']::text[], 8900, null, 600, '2026-10-11T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('One Size', 6, 0)) as v(size, stock, sort)
where p.handle = 'krawatte-morcote-bordeaux';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/krawatte-morcote-bordeaux-1', 'Seidenkrawatte «Morcote» in Bordeaux, ausgelegt (Illustration)', 'Morcote Silk Tie in burgundy, laid flat (illustration)', 1024, 1280, 0), ('asset:muster/krawatte-morcote-bordeaux-2', 'Seidenkrawatte «Morcote» in Bordeaux, gebunden (Illustration)', 'Morcote Silk Tie in burgundy, knotted (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'krawatte-morcote-bordeaux';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'krawatte-morcote-marine', c.id, 'krawatte-morcote', 'active', 'Seidenkrawatte «Morcote»', 'Morcote Silk Tie', 'Marine mit hellen Punkten: die Krawatte, die zu weissen und hellblauen Hemden immer passt.', 'Navy with light dots: the tie that always goes with white and light blue shirts.', 'Seide (100 %)', 'Silk (100%)', 'Nur chemisch reinigen. Nach dem Tragen aufrollen.', 'Dry clean only. Roll up after wearing.', 'Gefertigt in Italien', 'Made in Italy', 'Breite 7.5 cm, Länge 148 cm
Feines Punktmuster
Von Hand vernäht', 'Width 7.5 cm, length 148 cm
Fine dot pattern
Hand-finished', null, null, null, 'Marine', 'Navy', '#24304C', array['muster']::text[], array['business','hochzeit','abschlussfeier']::text[], array['hemd-rigi-weiss','einstecktuch-ascona-weiss']::text[], 8900, null, 601, '2026-09-25T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('One Size', 5, 0)) as v(size, stock, sort)
where p.handle = 'krawatte-morcote-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/krawatte-morcote-marine-1', 'Seidenkrawatte «Morcote» in Marine, ausgelegt (Illustration)', 'Morcote Silk Tie in navy, laid flat (illustration)', 1024, 1280, 0), ('asset:muster/krawatte-morcote-marine-2', 'Seidenkrawatte «Morcote» in Marine, gebunden (Illustration)', 'Morcote Silk Tie in navy, knotted (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'krawatte-morcote-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'fliege-gandria-schwarz', c.id, 'fliege-gandria', 'active', 'Fliege «Gandria»', 'Gandria Bow Tie', 'Schwarze Seide zum Selberbinden: Die «Gandria» gehört zum Smoking wie der Satin zum Revers.', 'Black self-tie silk: the Gandria belongs with a tuxedo like satin with its lapels.', 'Seide (100 %)', 'Silk (100%)', 'Nur chemisch reinigen.', 'Dry clean only.', 'Gefertigt in Italien', 'Made in Italy', 'Zum Selberbinden
Halsband verstellbar
Passt zum Smoking «Thur»', 'Self-tie
Adjustable neckband
Goes with the Thur tuxedo', null, null, null, 'Schwarz', 'Black', '#151515', array['muster']::text[], array['gala','hochzeit']::text[], array['hemd-pilatus-weiss','manschettenknoepfe-sils-onyx']::text[], 6900, null, 602, '2026-09-29T11:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('One Size', 4, 0)) as v(size, stock, sort)
where p.handle = 'fliege-gandria-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/fliege-gandria-schwarz-1', 'Fliege «Gandria» in Schwarz, vorne (Illustration)', 'Gandria Bow Tie in black, front (illustration)', 1024, 1280, 0), ('asset:muster/fliege-gandria-schwarz-2', 'Fliege «Gandria» in Schwarz, hinten (Illustration)', 'Gandria Bow Tie in black, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'fliege-gandria-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'einstecktuch-ascona-weiss', c.id, 'einstecktuch-ascona', 'active', 'Einstecktuch «Ascona»', 'Ascona Pocket Square', 'Weisses Leinen mit marineblauem Rand, von Hand gerollt. Gefaltet mit Spitzen oder locker eingesteckt.', 'White linen with a navy edge, hand-rolled. Folded into points or tucked in loosely.', 'Leinen (100 %), von Hand gerollter Rand', 'Linen (100%), hand-rolled edge', 'Bei 30 °C waschen, feucht bügeln.', 'Wash at 30 °C, iron while damp.', 'Gefertigt in Italien', 'Made in Italy', '33 × 33 cm
Marineblauer Rand
Passt zu jedem Sakko', '33 × 33 cm
Navy edge
Goes with any jacket', null, null, null, 'Weiss', 'White', '#F2EEE6', array['muster']::text[], array['hochzeit','gala','business']::text[], array['krawatte-morcote-marine']::text[], 4900, null, 603, '2026-09-16T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('One Size', 8, 0)) as v(size, stock, sort)
where p.handle = 'einstecktuch-ascona-weiss';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/einstecktuch-ascona-weiss-1', 'Einstecktuch «Ascona» in Weiss, ausgelegt (Illustration)', 'Ascona Pocket Square in white, laid flat (illustration)', 1024, 1280, 0), ('asset:muster/einstecktuch-ascona-weiss-2', 'Einstecktuch «Ascona» in Weiss, in der Brusttasche (Illustration)', 'Ascona Pocket Square in white, in the breast pocket (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'einstecktuch-ascona-weiss';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'manschettenknoepfe-sils-onyx', c.id, 'manschettenknoepfe-sils', 'active', 'Manschettenknöpfe «Sils»', 'Sils Cufflinks', 'Sterlingsilber mit schwarzem Onyx, rund und schlicht. Für Umschlagmanschetten am Abend.', 'Sterling silver with black onyx, round and simple. For French cuffs in the evening.', 'Sterlingsilber 925 mit Onyx', 'Sterling silver 925 with onyx', 'Mit einem weichen Tuch polieren.', 'Polish with a soft cloth.', 'Gefertigt in Italien', 'Made in Italy', 'Durchmesser 18 mm
Knebelverschluss
Im Etui geliefert', 'Diameter 18 mm
Toggle fastening
Delivered in a case', null, null, null, 'Silber mit Onyx', 'Silver with onyx', '#1A1A1A', array['neu','muster']::text[], array['gala','hochzeit']::text[], array['hemd-pilatus-weiss']::text[], 14900, null, 604, '2026-10-08T11:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('One Size', 3, 0)) as v(size, stock, sort)
where p.handle = 'manschettenknoepfe-sils-onyx';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/manschettenknoepfe-sils-onyx-1', 'Manschettenknöpfe «Sils» in Silber mit Onyx, von vorne (Illustration)', 'Sils Cufflinks in silver with onyx, front (illustration)', 1024, 1280, 0), ('asset:muster/manschettenknoepfe-sils-onyx-2', 'Manschettenknöpfe «Sils» in Silber mit Onyx, von der Seite (Illustration)', 'Sils Cufflinks in silver with onyx, side view (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'manschettenknoepfe-sils-onyx';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'guertel-chur-braun', c.id, 'guertel-chur', 'active', 'Ledergürtel «Chur»', 'Chur Leather Belt', 'Glattes Kalbsleder mit Schliesse in Goldoptik. Passt zu braunen Schuhen und hellen Hosen.', 'Smooth calf leather with a gold-tone buckle. Goes with brown shoes and light trousers.', 'Kalbsleder, Schliesse aus Messing', 'Calf leather, brass buckle', 'Ab und zu mit Lederpflege einreiben.', 'Treat with leather balm from time to time.', 'Gefertigt in Italien', 'Made in Italy', 'Breite 3.5 cm
Schliesse in Goldoptik
Grösse = Länge bis zum mittleren Loch in cm', 'Width 3.5 cm
Gold-tone buckle
Size = length to the middle hole in cm', null, null, null, 'Braun', 'Brown', '#6B4428', array['muster']::text[], array['business','hochzeit']::text[], array['derby-lino-braun']::text[], 12900, null, 605, '2026-09-14T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('85', 1, 0), ('90', 2, 10), ('95', 3, 20), ('100', 2, 30), ('105', 1, 40)) as v(size, stock, sort)
where p.handle = 'guertel-chur-braun';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/guertel-chur-braun-1', 'Ledergürtel «Chur» in Braun, ausgelegt (Illustration)', 'Chur Leather Belt in brown, laid out (illustration)', 1024, 1280, 0), ('asset:muster/guertel-chur-braun-2', 'Ledergürtel «Chur» in Braun, gerollt (Illustration)', 'Chur Leather Belt in brown, rolled (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'guertel-chur-braun';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'guertel-chur-schwarz', c.id, 'guertel-chur', 'active', 'Ledergürtel «Chur»', 'Chur Leather Belt', 'Schwarzes Kalbsleder zu schwarzen Schuhen: der Gürtel für dunkle Anzüge.', 'Black calf leather for black shoes: the belt for dark suits.', 'Kalbsleder, Schliesse aus Messing in Silberoptik', 'Calf leather, silver-tone brass buckle', 'Ab und zu mit Lederpflege einreiben.', 'Treat with leather balm from time to time.', 'Gefertigt in Italien', 'Made in Italy', 'Breite 3.5 cm
Schliesse in Silberoptik
Grösse = Länge bis zum mittleren Loch in cm', 'Width 3.5 cm
Silver-tone buckle
Size = length to the middle hole in cm', null, null, null, 'Schwarz', 'Black', '#1E1E1E', array['muster']::text[], array['business','gala']::text[], array['oxford-nero-schwarz']::text[], 12900, null, 606, '2026-09-11T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('85', 2, 0), ('90', 3, 10), ('95', 3, 20), ('100', 2, 30), ('105', 0, 40)) as v(size, stock, sort)
where p.handle = 'guertel-chur-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/guertel-chur-schwarz-1', 'Ledergürtel «Chur» in Schwarz, ausgelegt (Illustration)', 'Chur Leather Belt in black, laid out (illustration)', 1024, 1280, 0), ('asset:muster/guertel-chur-schwarz-2', 'Ledergürtel «Chur» in Schwarz, gerollt (Illustration)', 'Chur Leather Belt in black, rolled (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'guertel-chur-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'socken-vals-marine', c.id, 'socken-vals', 'active', 'Socken «Vals»', 'Vals Socks', 'Feine Merinowolle in Marine, wadenlang. Damit beim Sitzen nie Haut zwischen Hose und Schuh zu sehen ist.', 'Fine merino wool in navy, mid-calf length. So no skin shows between trousers and shoe when you sit.', 'Merinowolle mit Polyamid', 'Merino wool with polyamide', 'Bei 30 °C waschen.', 'Wash at 30 °C.', 'Gestrickt in Italien', 'Knitted in Italy', 'Wadenlang
Verstärkte Ferse und Spitze
Von Hand gekettelte Spitze', 'Mid-calf length
Reinforced heel and toe
Hand-linked toe', null, null, null, 'Marine', 'Navy', '#24304C', array['muster']::text[], array['business','hochzeit','gala']::text[], array['oxford-nero-schwarz']::text[], 2900, null, 607, '2026-09-09T10:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'accessoires';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('39–42', 6, 0), ('43–46', 6, 10)) as v(size, stock, sort)
where p.handle = 'socken-vals-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/socken-vals-marine-1', 'Socken «Vals» in Marine, als Paar (Illustration)', 'Vals Socks in navy, pair (illustration)', 1024, 1280, 0), ('asset:muster/socken-vals-marine-2', 'Socken «Vals» in Marine, einzeln (Illustration)', 'Vals Socks in navy, single (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'socken-vals-marine';

insert into public.site_content (key, value) values
  ('size_guides', '{"tables": [{"id": "anzuege-sakkos", "title": {"de": "Anzüge, Sakkos, Westen und Mäntel", "en": "Suits, jackets, waistcoats and coats"}, "categories": ["anzuege", "sakkos", "westen", "maentel-jacken"], "columns": [{"de": "Grösse", "en": "Size"}, {"de": "Brust (cm)", "en": "Chest (cm)"}, {"de": "Taille (cm)", "en": "Waist (cm)"}, {"de": "Körpergrösse (cm)", "en": "Height (cm)"}], "rows": [["46", "92", "80", "170–176"], ["48", "96", "84", "173–179"], ["50", "100", "88", "176–182"], ["52", "104", "92", "179–185"], ["54", "108", "96", "182–188"], ["56", "112", "100", "185–191"]], "note": {"de": "Beispielwerte für die Vorschau. Die echten Masse ersetzt ihr im Admin unter «Grössentabellen».", "en": "Sample values for the preview."}}, {"id": "hosen", "title": {"de": "Hosen", "en": "Trousers"}, "categories": ["hosen"], "columns": [{"de": "Grösse", "en": "Size"}, {"de": "Bundweite (cm)", "en": "Waist (cm)"}, {"de": "Hüfte (cm)", "en": "Hip (cm)"}, {"de": "Schrittlänge (cm)", "en": "Inside leg (cm)"}], "rows": [["46", "80", "96", "80"], ["48", "84", "100", "81"], ["50", "88", "104", "82"], ["52", "92", "108", "83"], ["54", "96", "112", "84"], ["56", "100", "116", "85"]], "note": {"de": "Beispielwerte für die Vorschau.", "en": "Sample values for the preview."}}, {"id": "hemden", "title": {"de": "Hemden", "en": "Shirts"}, "categories": ["hemden"], "columns": [{"de": "Kragenweite (cm)", "en": "Collar (cm)"}, {"de": "Brust (cm)", "en": "Chest (cm)"}, {"de": "Ärmellänge (cm)", "en": "Sleeve (cm)"}], "rows": [["38", "98", "63"], ["39", "102", "64"], ["40", "106", "64"], ["41", "110", "65"], ["42", "114", "65"], ["43", "118", "66"], ["44", "122", "66"], ["45", "126", "67"]], "note": {"de": "Beispielwerte für die Vorschau.", "en": "Sample values for the preview."}}, {"id": "strick", "title": {"de": "Strick", "en": "Knitwear"}, "categories": ["strick"], "columns": [{"de": "Grösse", "en": "Size"}, {"de": "Brust (cm)", "en": "Chest (cm)"}, {"de": "Länge (cm)", "en": "Length (cm)"}], "rows": [["S", "96", "68"], ["M", "102", "70"], ["L", "108", "72"], ["XL", "114", "74"], ["XXL", "120", "76"]], "note": {"de": "Beispielwerte für die Vorschau.", "en": "Sample values for the preview."}}, {"id": "schuhe", "title": {"de": "Schuhe", "en": "Shoes"}, "categories": ["schuhe"], "columns": [{"de": "EU-Grösse", "en": "EU size"}, {"de": "Fusslänge (cm)", "en": "Foot length (cm)"}], "rows": [["40", "25.3"], ["41", "26.0"], ["42", "26.7"], ["43", "27.4"], ["44", "28.1"], ["45", "28.8"], ["46", "29.5"]], "note": {"de": "Beispielwerte für die Vorschau.", "en": "Sample values for the preview."}}, {"id": "guertel-socken", "title": {"de": "Gürtel und Socken", "en": "Belts and socks"}, "categories": ["accessoires"], "columns": [{"de": "Gürtelgrösse", "en": "Belt size"}, {"de": "Bundweite (cm)", "en": "Waist (cm)"}], "rows": [["85", "72–78"], ["90", "78–84"], ["95", "84–90"], ["100", "90–96"], ["105", "96–102"]], "note": {"de": "Socken: Die Grösse entspricht der Schuhgrösse (EU 39–42 oder 43–46). Beispielwerte für die Vorschau.", "en": "Socks: the size matches your EU shoe size (39–42 or 43–46). Sample values for the preview."}}]}'::jsonb),
  ('announcements', '{"items": [{"de": "Gratisversand in der ganzen Schweiz", "en": "Free shipping throughout Switzerland"}, {"de": "Lieferung in 2 bis 5 Arbeitstagen", "en": "Delivery in 2 to 5 working days"}, {"de": "Bezahlen mit TWINT, Karte, Apple Pay, Google Pay oder Klarna", "en": "Pay with TWINT, card, Apple Pay, Google Pay or Klarna"}]}'::jsonb),
  ('home.hero', '{"de": {"eyebrow": "Neue Kollektion", "title": "Zeitlose Eleganz.\nBereit für dich.", "text": "Anzüge, Mäntel, Strick und Accessoires in ausgesuchter Qualität, ab Lager lieferbar.", "primary": "Kollektion entdecken", "secondary": "Neuheiten ansehen"}, "en": {"eyebrow": "New collection", "title": "Timeless elegance.\nReady for you.", "text": "Suits, coats, knitwear and accessories, carefully chosen and ready to ship.", "primary": "Discover the collection", "secondary": "View new arrivals"}}'::jsonb),
  ('home.collections', '{"de": {"eyebrow": "Die Kollektionen", "title": "Ein Auftritt. Dein Stil."}, "en": {"eyebrow": "The collections", "title": "One look. Your style."}}'::jsonb),
  ('home.new', '{"de": {"eyebrow": "Frisch in der Kollektion", "title": "Neu eingetroffen", "link": "Alle Neuheiten"}, "en": {"eyebrow": "New in the collection", "title": "New arrivals", "link": "All new arrivals"}}'::jsonb),
  ('home.look', '{"image": "asset:look", "image_alt": {"de": "Marineblauer Dreiteiler mit schwarzen Oxford-Schuhen in einem hellen Gang", "en": "Navy three-piece suit with black oxford shoes in a bright hallway"}, "image_width": 960, "image_height": 1280, "hotspots": [{"handle": "anzug-limmat-marine", "key": "sakko", "label": {"de": "Sakko", "en": "Jacket"}, "x": 37, "y": 25}, {"handle": "weste-limmat-marine", "key": "weste", "label": {"de": "Weste", "en": "Waistcoat"}, "x": 50, "y": 31}, {"handle": "oxford-nero-schwarz", "key": "schuhe", "label": {"de": "Schuhe", "en": "Shoes"}, "x": 47, "y": 89}], "de": {"eyebrow": "Stücke, die zusammenpassen", "title": "Komplettes Outfit.\nGanz du.", "text": "Vom ersten Knopf bis zum letzten Schritt.", "total": "Ganzes Outfit"}, "en": {"eyebrow": "Pieces that go together", "title": "The complete outfit.\nAll you.", "text": "From the first button to the last step.", "total": "Complete outfit"}}'::jsonb),
  ('home.occasions', '{"de": {"eyebrow": "Für deine Momente", "title": "Der Anlass ist deiner.", "hochzeit": "Für euren besonderen Tag.", "business": "Klar auftreten. Jeden Tag.", "abschlussfeier": "Ein neuer Abschnitt beginnt.", "gala": "Für die grossen Abende."}, "en": {"eyebrow": "For your moments", "title": "The occasion is yours.", "hochzeit": "For your special day.", "business": "Make a clear impression. Every day.", "abschlussfeier": "A new chapter begins.", "gala": "For the big evenings."}}'::jsonb),
  ('home.story', '{"image": "asset:fabric", "image_alt": {"de": "Detail von dunklem Anzugstoff mit messingfarbenem Knopf", "en": "Close-up of dark suit fabric with a brass-coloured button"}, "image_width": 1536, "image_height": 1024, "de": {"eyebrow": "Axion", "title": "Das Ganze beginnt\nmit den Details.", "text": "Axion steht für ausgesuchte Herrenmode und Accessoires, die zusammenpassen. Vom Anzug bis zum Einstecktuch, ab Lager lieferbar.", "link": "Über uns"}, "en": {"eyebrow": "Axion", "title": "It all starts\nwith the details.", "text": "Axion stands for carefully chosen menswear and accessories that go together. From the suit to the pocket square, ready to ship.", "link": "About us"}}'::jsonb);
