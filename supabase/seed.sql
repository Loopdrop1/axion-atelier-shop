-- Startdaten: Kategorien, Beispielprodukte (Platzhalter) und Inhalte der Startseite.
-- Bildpfade «asset:…» zeigen auf die im Frontend eingebauten Bilder (src/lib/commerce/media.ts).

insert into public.categories (slug, name_de, name_en, description_de, description_en, image_path, sort) values
  ('anzuege', 'Anzüge', 'Suits', 'Klare Schnitte für die besonderen und die alltäglichen Momente.', 'Clean cuts for special and everyday moments.', 'asset:modelSuit', 10),
  ('westen', 'Westen', 'Waistcoats', 'Einzeln getragen. Oder als Teil des Ganzen.', 'Worn on its own. Or as part of the whole.', 'asset:modelVest', 20),
  ('schuhe', 'Schuhe', 'Shoes', 'Der passende Abschluss für deinen Auftritt.', 'The finishing touch for your look.', 'asset:modelShoes', 30);

-- Muster-Sortiment (Kennzeichen «muster», Bilder = Illustrationen): dieselben 24 Produkte wie supabase/demo/muster-einspielen.sql.
insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-marine', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Der Anzug «Limmat» besteht aus Sakko und Hose. Kombiniere ihn mit der passenden Weste zu einem Dreiteiler.', 'The Limmat suit consists of a jacket and trousers. Add the matching waistcoat for a three-piece look.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations
Inside pocket with button', null, null, 'Slim Fit', 'Marine', 'Navy', '#243448', array['neu','muster']::text[], array['hochzeit','business']::text[], array['weste-limmat-marine','oxford-nero-schwarz']::text[], 48900, null, 0, '2026-10-06T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 0, 30), ('54', 3, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-limmat-marine-1', 'Anzug «Limmat» in Marine, vorne (Illustration)', 'Limmat Suit in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-limmat-marine-2', 'Anzug «Limmat» in Marine, hinten (Illustration)', 'Limmat Suit in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-anthrazit', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Der «Limmat» in Anthrazit ist der ruhige Begleiter fürs Büro. Mit weissem Hemd klassisch, mit Rollkragen modern.', 'The Limmat in charcoal is a calm companion for the office. Classic with a white shirt, modern with a roll neck.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations
Inside pocket with button', null, null, 'Slim Fit', 'Anthrazit', 'Charcoal', '#43464A', array['muster']::text[], array['business']::text[], array['weste-limmat-anthrazit','oxford-nero-schwarz']::text[], 48900, null, 1, '2026-09-28T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-limmat-anthrazit-1', 'Anzug «Limmat» in Anthrazit, vorne (Illustration)', 'Limmat Suit in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-limmat-anthrazit-2', 'Anzug «Limmat» in Anthrazit, hinten (Illustration)', 'Limmat Suit in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-mittelgrau', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Mittelgrau wirkt hell und freundlich und passt zu fast jeder Hemdfarbe. Ein Anzug für viele Anlässe.', 'Mid grey looks light and friendly and goes with almost any shirt colour. A suit for many occasions.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations
Inside pocket with button', null, null, 'Slim Fit', 'Mittelgrau', 'Mid grey', '#7A7C80', array['muster']::text[], array['business','abschlussfeier']::text[], array['weste-rhone-bordeaux','derby-lino-schwarz']::text[], 48900, null, 2, '2026-09-25T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-mittelgrau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-limmat-mittelgrau-1', 'Anzug «Limmat» in Mittelgrau, vorne (Illustration)', 'Limmat Suit in mid grey, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-limmat-mittelgrau-2', 'Anzug «Limmat» in Mittelgrau, hinten (Illustration)', 'Limmat Suit in mid grey, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-mittelgrau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-aare-anthrazit', c.id, 'anzug-aare', 'active', 'Anzug «Aare»', 'Aare Suit', 'Der Anzug «Aare» kombiniert ein Sakko mit einer passenden Hose. Anthrazit lässt sich mit hellen Hemden und dunklen Schuhen ergänzen.', 'The Aare suit pairs a jacket with matching trousers. Charcoal works well with light shirts and dark shoes.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und spitzem Revers
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen', 'Two-button jacket with peak lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations', null, null, 'Regular Fit', 'Anthrazit', 'Charcoal', '#484946', array['muster']::text[], array['business','gala']::text[], array['weste-limmat-salbeigruen','derby-lino-braun']::text[], 45900, null, 10, '2026-10-03T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 0, 40), ('56', 3, 50)) as v(size, stock, sort)
where p.handle = 'anzug-aare-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-aare-anthrazit-1', 'Anzug «Aare» in Anthrazit, vorne (Illustration)', 'Aare Suit in charcoal, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-aare-anthrazit-2', 'Anzug «Aare» in Anthrazit, hinten (Illustration)', 'Aare Suit in charcoal, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-aare-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-aare-marine', c.id, 'anzug-aare', 'active', 'Anzug «Aare»', 'Aare Suit', 'Gerade geschnitten mit spitzem Revers: Der «Aare» in Marine gibt Halt und bleibt bequem über einen langen Tag.', 'Straight cut with peak lapels: the Aare in navy looks sharp and stays comfortable through a long day.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und spitzem Revers
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen', 'Two-button jacket with peak lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations', null, null, 'Regular Fit', 'Marine', 'Navy', '#2A3550', array['muster']::text[], array['business','hochzeit']::text[], array['weste-limmat-marine','monk-sion-espresso']::text[], 45900, null, 11, '2026-09-20T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 3, 40), ('56', 2, 50)) as v(size, stock, sort)
where p.handle = 'anzug-aare-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-aare-marine-1', 'Anzug «Aare» in Marine, vorne (Illustration)', 'Aare Suit in navy, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-aare-marine-2', 'Anzug «Aare» in Marine, hinten (Illustration)', 'Aare Suit in navy, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-aare-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-rhone-nachtblau', c.id, 'anzug-rhone', 'active', 'Zweireiher «Rhone»', 'Rhone Double-Breasted Suit', 'Der Zweireiher «Rhone» ist für Abende, an denen du auffallen willst. Sechs Knöpfe, spitzes Revers, schmaler Schnitt.', 'The Rhone double-breasted suit is made for evenings when you want to stand out. Six buttons, peak lapels, slim cut.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Zweireihiges Sakko mit sechs Knöpfen und spitzem Revers
Brusttasche, zwei Pattentaschen
Hose mit Bundfalte, Saum zum Anpassen', 'Double-breasted jacket with six buttons and peak lapels
Breast pocket, two flap pockets
Pleated trousers, unfinished hem for alterations', null, null, 'Slim Fit', 'Nachtblau', 'Midnight blue', '#1F2638', array['neu','muster']::text[], array['gala','hochzeit']::text[], array['oxford-nero-schwarz']::text[], 58900, null, 12, '2026-10-07T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 3, 20), ('52', 2, 30), ('54', 1, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-rhone-nachtblau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-rhone-nachtblau-1', 'Zweireiher «Rhone» in Nachtblau, vorne (Illustration)', 'Rhone Double-Breasted Suit in midnight blue, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-rhone-nachtblau-2', 'Zweireiher «Rhone» in Nachtblau, hinten (Illustration)', 'Rhone Double-Breasted Suit in midnight blue, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-rhone-nachtblau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-reuss-sand', c.id, 'anzug-reuss', 'active', 'Anzug «Reuss»', 'Reuss Suit', 'Leicht und hell für Hochzeiten im Sommer. Der «Reuss» trägt sich luftig und sieht auch am Abend noch gepflegt aus.', 'Light and pale for summer weddings. The Reuss feels airy and still looks neat in the evening.', 'Leinen mit Schurwolle, halb gefüttert', 'Linen with wool, half lined', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations
Inside pocket with button', null, null, 'Regular Fit', 'Sand', 'Sand', '#CDBB9B', array['neu','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['weste-reuss-sand','loafer-lugano-cognac']::text[], 42900, null, 13, '2026-10-08T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 2, 20), ('52', 3, 30), ('54', 3, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'anzug-reuss-sand';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-reuss-sand-1', 'Anzug «Reuss» in Sand, vorne (Illustration)', 'Reuss Suit in sand, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-reuss-sand-2', 'Anzug «Reuss» in Sand, hinten (Illustration)', 'Reuss Suit in sand, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-reuss-sand';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-reuss-hellblau', c.id, 'anzug-reuss', 'active', 'Anzug «Reuss»', 'Reuss Suit', 'Ein helles Blau für Trauzeugen, Abschlussfeiern und Feste im Freien. Dazu braune Schuhe und ein weisses Hemd.', 'A light blue for best men, graduations and outdoor parties. Pair it with brown shoes and a white shirt.', 'Leinen mit Schurwolle, halb gefüttert', 'Linen with wool, half lined', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations
Inside pocket with button', null, null, 'Regular Fit', 'Hellblau', 'Light blue', '#8FA7C0', array['sale','muster']::text[], array['hochzeit','abschlussfeier']::text[], array['loafer-lugano-cognac']::text[], 42900, 49900, 14, '2026-09-10T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 2, 10), ('50', 3, 20), ('52', 1, 30), ('54', 0, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-reuss-hellblau';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-reuss-hellblau-1', 'Anzug «Reuss» in Hellblau, vorne (Illustration)', 'Reuss Suit in light blue, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-reuss-hellblau-2', 'Anzug «Reuss» in Hellblau, hinten (Illustration)', 'Reuss Suit in light blue, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-reuss-hellblau';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'smoking-thur-schwarz', c.id, 'smoking-thur', 'active', 'Smoking «Thur»', 'Thur Tuxedo', 'Der Smoking «Thur» mit Schalkragen aus Satin ist gemacht für Galas und Hochzeiten am Abend. Dazu die passende Weste und eine Fliege.', 'The Thur tuxedo with a satin shawl collar is made for galas and evening weddings. Add the matching waistcoat and a bow tie.', 'Schurwolle, Schalkragen mit Satin, Futter aus Viskose', 'Wool, satin shawl collar, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Ein Knopf, Schalkragen mit Satin
Hose mit Galonstreifen
Passend zur Smoking-Weste «Thur»', 'One button, satin shawl collar
Trousers with satin side stripe
Matches the Thur dinner waistcoat', null, null, 'Slim Fit', 'Schwarz', 'Black', '#151515', array['muster']::text[], array['gala','hochzeit']::text[], array['weste-thur-schwarz','oxford-nero-schwarz']::text[], 64900, null, 15, '2026-09-30T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 1, 0), ('48', 2, 10), ('50', 2, 20), ('52', 2, 30), ('54', 1, 40), ('56', 1, 50)) as v(size, stock, sort)
where p.handle = 'smoking-thur-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/smoking-thur-schwarz-1', 'Smoking «Thur» in Schwarz, vorne (Illustration)', 'Thur Tuxedo in black, front (illustration)', 1024, 1280, 0), ('asset:muster/smoking-thur-schwarz-2', 'Smoking «Thur» in Schwarz, hinten (Illustration)', 'Thur Tuxedo in black, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'smoking-thur-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-ticino-salbei', c.id, 'anzug-ticino', 'active', 'Anzug «Ticino»', 'Ticino Suit', 'Ein weiches Grün, das zu Holz, Stein und Sommerwiesen passt. Der «Ticino» ist der Anzug für Hochzeiten im Grünen.', 'A soft green that goes with wood, stone and summer meadows. The Ticino is the suit for weddings outdoors.', 'Schurwolle mit wenig Stretch, Futter aus Viskose', 'Wool with a little stretch, viscose lining', 'Chemische Reinigung. Nach dem Tragen auf einem breiten Bügel auslüften.', 'Dry clean. Air on a wide hanger after wearing.', 'Gefertigt in Europa', 'Made in Europe', 'Sakko mit zwei Knöpfen und Reverskragen
Brusttasche, zwei Pattentaschen
Hose ohne Bundfalte, Saum zum Anpassen
Innentasche mit Knopf', 'Two-button jacket with notch lapels
Breast pocket, two flap pockets
Flat-front trousers, unfinished hem for alterations
Inside pocket with button', null, null, 'Slim Fit', 'Salbei', 'Sage', '#7E8A72', array['neu','muster']::text[], array['hochzeit']::text[], array['weste-ticino-salbei','derby-lino-braun']::text[], 46900, null, 16, '2026-10-09T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 2, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 2, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-ticino-salbei';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/anzug-ticino-salbei-1', 'Anzug «Ticino» in Salbei, vorne (Illustration)', 'Ticino Suit in sage, front (illustration)', 1024, 1280, 0), ('asset:muster/anzug-ticino-salbei-2', 'Anzug «Ticino» in Salbei, hinten (Illustration)', 'Ticino Suit in sage, back (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-ticino-salbei';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-limmat-marine', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Die Weste «Limmat» ergänzt den marineblauen Anzug. Du kannst sie auch einzeln über einem Hemd tragen.', 'The Limmat waistcoat completes the navy suit. You can also wear it on its own over a shirt.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, zwei Paspeltaschen
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
select 'weste-limmat-salbeigruen', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Die Weste «Limmat» in Salbeigrün setzt einen hellen Farbakzent. Kombiniere sie mit einem weissen Hemd und einer Anzughose.', 'The Limmat waistcoat in sage green adds a light touch of colour. Pair it with a white shirt and suit trousers.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, zwei Paspeltaschen
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
select 'weste-limmat-anthrazit', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Macht aus dem «Limmat» in Anthrazit einen Dreiteiler. Einzeln getragen wirkt sie lässig zu Jeans und Hemd.', 'Turns the charcoal Limmat into a three-piece. On its own it looks relaxed with jeans and a shirt.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, zwei Paspeltaschen
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
select 'weste-reuss-sand', c.id, 'weste-reuss', 'active', 'Weste «Reuss»', 'Reuss Waistcoat', 'Die helle Weste zum «Reuss». Ideal für Trauzeugen, die nicht ganz gleich aussehen sollen wie der Bräutigam.', 'The light waistcoat for the Reuss. Ideal for best men who should not look exactly like the groom.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, zwei Paspeltaschen
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
select 'weste-rhone-bordeaux', c.id, 'weste-rhone', 'active', 'Weste «Rhone»', 'Rhone Waistcoat', 'Bordeaux mit schmalem Revers: ein Farbakzent unter grauen und blauen Anzügen. Schön zu Hochzeiten im Herbst.', 'Burgundy with slim lapels: a touch of colour under grey and blue suits. Lovely for autumn weddings.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, schmales Revers
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
select 'weste-thur-schwarz', c.id, 'weste-thur', 'active', 'Smoking-Weste «Thur»', 'Thur Dinner Waistcoat', 'Die Weste zum Smoking «Thur», mit Revers aus Satin. Macht den Abendanzug komplett.', 'The waistcoat for the Thur tuxedo, with satin lapels. Completes the evening suit.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, schmales Revers
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
select 'weste-ticino-salbei', c.id, 'weste-ticino', 'active', 'Weste «Ticino»', 'Ticino Waistcoat', 'Gehört zum Anzug «Ticino». Zusammen ergeben sie einen Dreiteiler in weichem Grün.', 'Belongs to the Ticino suit. Together they make a three-piece in soft green.', 'Schurwolle mit wenig Stretch, Rücken aus Viskose-Futter', 'Wool with a little stretch, viscose lining back', 'Chemische Reinigung.', 'Dry clean.', 'Gefertigt in Europa', 'Made in Europe', 'Fünf Knöpfe, zwei Paspeltaschen
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
select 'oxford-nero-schwarz', c.id, 'oxford-nero', 'active', 'Oxford «Nero»', 'Nero Oxford', 'Der Oxford «Nero» hat eine geschlossene Schnürung. Seine schwarze Farbe lässt sich mit den Anzügen der Kollektion kombinieren.', 'The Nero oxford has closed lacing. Its black colour goes with every suit in the collection.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Geschlossene Schnürung
Kappe mit Ziernaht
Rahmengenähte Ledersohle', 'Closed lacing
Toe cap with stitching
Welted leather sole', null, null, null, 'Schwarz', 'Black', '#20211F', array['neu','muster']::text[], array['gala','business','abschlussfeier']::text[], '{}'::text[], 23900, null, 50, '2026-10-02T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 3, 0), ('41', 0, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 3, 50), ('46', 3, 60)) as v(size, stock, sort)
where p.handle = 'oxford-nero-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/oxford-nero-schwarz-1', 'Oxford «Nero» in Schwarz, seitlich (Illustration)', 'Nero Oxford in black, side view (illustration)', 1024, 1280, 0), ('asset:muster/oxford-nero-schwarz-2', 'Oxford «Nero» in Schwarz, Innenseite (Illustration)', 'Nero Oxford in black, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'oxford-nero-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'oxford-nero-dunkelbraun', c.id, 'oxford-nero', 'active', 'Oxford «Nero»', 'Nero Oxford', 'Der «Nero» in Dunkelbraun passt zu Marine, Grau und Grün. Etwas weniger streng als Schwarz.', 'The Nero in dark brown goes with navy, grey and green. A little less formal than black.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Geschlossene Schnürung
Kappe mit Ziernaht
Rahmengenähte Ledersohle', 'Closed lacing
Toe cap with stitching
Welted leather sole', null, null, null, 'Dunkelbraun', 'Dark brown', '#4A3426', array['muster']::text[], array['business','hochzeit']::text[], '{}'::text[], 23900, null, 51, '2026-09-26T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 2, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 0, 60)) as v(size, stock, sort)
where p.handle = 'oxford-nero-dunkelbraun';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/oxford-nero-dunkelbraun-1', 'Oxford «Nero» in Dunkelbraun, seitlich (Illustration)', 'Nero Oxford in dark brown, side view (illustration)', 1024, 1280, 0), ('asset:muster/oxford-nero-dunkelbraun-2', 'Oxford «Nero» in Dunkelbraun, Innenseite (Illustration)', 'Nero Oxford in dark brown, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'oxford-nero-dunkelbraun';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'derby-lino-braun', c.id, 'derby-lino', 'active', 'Derby «Lino»', 'Lino Derby', 'Der Derby «Lino» zeigt eine offene Schnürung. Der braune Farbton ergänzt dunkle und helle Anzughosen.', 'The Lino derby has open lacing. Its brown tone goes with both dark and light suit trousers.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Offene Schnürung, bequem am Rist
Kappe mit Ziernaht
Ledersohle mit Gummiabsatz', 'Open lacing, comfortable at the instep
Toe cap with stitching
Leather sole with rubber heel', null, null, null, 'Braun', 'Brown', '#825834', array['neu','muster']::text[], array['business','hochzeit']::text[], '{}'::text[], 21900, null, 40, '2026-10-04T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 0, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 3, 50), ('46', 3, 60)) as v(size, stock, sort)
where p.handle = 'derby-lino-braun';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/derby-lino-braun-1', 'Derby «Lino» in Braun, seitlich (Illustration)', 'Lino Derby in brown, side view (illustration)', 1024, 1280, 0), ('asset:muster/derby-lino-braun-2', 'Derby «Lino» in Braun, Innenseite (Illustration)', 'Lino Derby in brown, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'derby-lino-braun';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'derby-lino-schwarz', c.id, 'derby-lino', 'active', 'Derby «Lino»', 'Lino Derby', 'Schwarz und offen geschnürt: bequem für lange Tage im Anzug, auch bei breitem Fuss.', 'Black with open lacing: comfortable for long days in a suit, even for wider feet.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Offene Schnürung, bequem am Rist
Kappe mit Ziernaht
Ledersohle mit Gummiabsatz', 'Open lacing, comfortable at the instep
Toe cap with stitching
Leather sole with rubber heel', null, null, null, 'Schwarz', 'Black', '#1E1E1E', array['muster']::text[], array['business']::text[], '{}'::text[], 21900, null, 41, '2026-09-22T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 1, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 2, 50), ('46', 1, 60)) as v(size, stock, sort)
where p.handle = 'derby-lino-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/derby-lino-schwarz-1', 'Derby «Lino» in Schwarz, seitlich (Illustration)', 'Lino Derby in black, side view (illustration)', 1024, 1280, 0), ('asset:muster/derby-lino-schwarz-2', 'Derby «Lino» in Schwarz, Innenseite (Illustration)', 'Lino Derby in black, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'derby-lino-schwarz';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'loafer-lugano-cognac', c.id, 'loafer-lugano', 'active', 'Loafer «Lugano»', 'Lugano Loafer', 'Zum Hineinschlüpfen: Der «Lugano» passt zu hellen Anzügen im Sommer und zu Chinos am Wochenende.', 'Simply slip in: the Lugano goes with light suits in summer and with chinos at the weekend.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Zum Hineinschlüpfen, Mokassinnaht
Steg mit Schlitz
Leicht und flexibel', 'Slip-on with moccasin seam
Strap with slot
Light and flexible', null, null, null, 'Cognac', 'Cognac', '#8A4E2A', array['neu','muster']::text[], array['hochzeit','abschlussfeier']::text[], '{}'::text[], 22900, null, 52, '2026-10-08T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 2, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 0, 60)) as v(size, stock, sort)
where p.handle = 'loafer-lugano-cognac';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/loafer-lugano-cognac-1', 'Loafer «Lugano» in Cognac, seitlich (Illustration)', 'Lugano Loafer in cognac, side view (illustration)', 1024, 1280, 0), ('asset:muster/loafer-lugano-cognac-2', 'Loafer «Lugano» in Cognac, Innenseite (Illustration)', 'Lugano Loafer in cognac, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'loafer-lugano-cognac';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'monk-sion-espresso', c.id, 'monk-sion', 'active', 'Monk «Sion»', 'Sion Monk Strap', 'Zwei Schnallen statt Schnürung: Der «Sion» ist für alle, die etwas mehr Charakter tragen wollen.', 'Two buckles instead of laces: the Sion is for anyone who wants to wear a little more character.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Zwei Schnallen statt Schnürung
Kappe mit Ziernaht
Ledersohle mit Gummiabsatz', 'Two buckles instead of laces
Toe cap with stitching
Leather sole with rubber heel', null, null, null, 'Espresso', 'Espresso', '#3E2A20', array['muster']::text[], array['business','gala']::text[], '{}'::text[], 25900, null, 53, '2026-09-18T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 1, 0), ('41', 2, 10), ('42', 3, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 1, 60)) as v(size, stock, sort)
where p.handle = 'monk-sion-espresso';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/monk-sion-espresso-1', 'Monk «Sion» in Espresso, seitlich (Illustration)', 'Sion Monk Strap in espresso, side view (illustration)', 1024, 1280, 0), ('asset:muster/monk-sion-espresso-2', 'Monk «Sion» in Espresso, Innenseite (Illustration)', 'Sion Monk Strap in espresso, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'monk-sion-espresso';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, material_de, material_en, care_de, care_en, origin_de, origin_en, features_de, features_en, fit_note_de, fit_note_en, fit, color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'chelsea-zug-schwarz', c.id, 'chelsea-zug', 'active', 'Chelsea Boot «Zug»', 'Zug Chelsea Boot', 'Schlank geschnitten und schnell angezogen. Der «Zug» passt zum Anzug im Winter und zu dunklen Jeans.', 'Slim cut and quick to put on. The Zug goes with a suit in winter and with dark jeans.', 'Glattleder, Futter aus Leder, Ledersohle mit Gummiabsatz', 'Smooth leather, leather lining, leather sole with rubber heel', 'Mit Schuhspanner lagern, regelmässig eincremen.', 'Store with shoe trees, polish regularly.', 'Gefertigt in Europa', 'Made in Europe', 'Elastischer Einsatz an der Seite
Zuglasche hinten
Profilierte Gummisohle', 'Elastic side panel
Pull tab at the back
Grip rubber sole', null, null, null, 'Schwarz', 'Black', '#1E1E1E', array['sale','muster']::text[], array['business']::text[], '{}'::text[], 22900, 26900, 54, '2026-09-05T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 0, 0), ('41', 1, 10), ('42', 2, 20), ('43', 3, 30), ('44', 2, 40), ('45', 1, 50), ('46', 0, 60)) as v(size, stock, sort)
where p.handle = 'chelsea-zug-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:muster/chelsea-zug-schwarz-1', 'Chelsea Boot «Zug» in Schwarz, seitlich (Illustration)', 'Zug Chelsea Boot in black, side view (illustration)', 1024, 1280, 0), ('asset:muster/chelsea-zug-schwarz-2', 'Chelsea Boot «Zug» in Schwarz, Innenseite (Illustration)', 'Zug Chelsea Boot in black, inner side (illustration)', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'chelsea-zug-schwarz';

insert into public.site_content (key, value) values
  ('size_guides', '{"tables": [{"id": "anzuege-westen", "title": {"de": "Anzüge und Westen", "en": "Suits and waistcoats"}, "categories": ["anzuege", "westen"], "columns": [{"de": "Grösse", "en": "Size"}, {"de": "Brust (cm)", "en": "Chest (cm)"}, {"de": "Taille (cm)", "en": "Waist (cm)"}, {"de": "Körpergrösse (cm)", "en": "Height (cm)"}], "rows": [["46", "92", "80", "170–176"], ["48", "96", "84", "173–179"], ["50", "100", "88", "176–182"], ["52", "104", "92", "179–185"], ["54", "108", "96", "182–188"], ["56", "112", "100", "185–191"]], "note": {"de": "Beispielwerte für die Vorschau. Die echten Masse ersetzt ihr im Admin unter «Grössentabellen».", "en": "Sample values for the preview."}}, {"id": "schuhe", "title": {"de": "Schuhe", "en": "Shoes"}, "categories": ["schuhe"], "columns": [{"de": "EU-Grösse", "en": "EU size"}, {"de": "Fusslänge (cm)", "en": "Foot length (cm)"}], "rows": [["40", "25.3"], ["41", "26.0"], ["42", "26.7"], ["43", "27.4"], ["44", "28.1"], ["45", "28.8"], ["46", "29.5"]], "note": {"de": "Beispielwerte für die Vorschau.", "en": "Sample values for the preview."}}]}'::jsonb),
  ('announcements', '{"items": [{"de": "Gratisversand in der ganzen Schweiz", "en": "Free shipping throughout Switzerland"}, {"de": "Lieferung in 2 bis 5 Arbeitstagen", "en": "Delivery in 2 to 5 working days"}, {"de": "Bezahlen mit TWINT, Karte, Apple Pay, Google Pay oder Klarna", "en": "Pay with TWINT, card, Apple Pay, Google Pay or Klarna"}]}'::jsonb),
  ('home.hero', '{"de": {"eyebrow": "Anzüge · Westen · Schuhe", "title": "Präzise geschnitten.\nFür jeden Auftritt.", "text": "Anzüge, Westen und Schuhe für Hochzeit, Business und alles dazwischen.", "primary": "Kollektion entdecken", "secondary": "Anzüge ansehen"}, "en": {"eyebrow": "Suits · Waistcoats · Shoes", "title": "Precisely cut.\nFor every occasion.", "text": "Suits, waistcoats and shoes for weddings, business and everything in between.", "primary": "Discover the collection", "secondary": "View suits"}}'::jsonb),
  ('home.collections', '{"de": {"eyebrow": "Die Kollektionen", "title": "Ein Auftritt. Dein Stil."}, "en": {"eyebrow": "The collections", "title": "One look. Your style."}}'::jsonb),
  ('home.new', '{"de": {"eyebrow": "Frisch in der Kollektion", "title": "Neu eingetroffen", "link": "Alle Neuheiten"}, "en": {"eyebrow": "New in the collection", "title": "New arrivals", "link": "All new arrivals"}}'::jsonb),
  ('home.look', '{"image": "asset:look", "image_alt": {"de": "Marineblauer Dreiteiler mit schwarzen Oxford-Schuhen in einem hellen Gang", "en": "Navy three-piece suit with black oxford shoes in a bright hallway"}, "image_width": 960, "image_height": 1280, "hotspots": [{"handle": "anzug-limmat-marine", "key": "sakko", "label": {"de": "Sakko", "en": "Jacket"}, "x": 37, "y": 25}, {"handle": "weste-limmat-marine", "key": "weste", "label": {"de": "Weste", "en": "Waistcoat"}, "x": 50, "y": 31}, {"handle": "oxford-nero-schwarz", "key": "schuhe", "label": {"de": "Schuhe", "en": "Shoes"}, "x": 47, "y": 89}], "de": {"eyebrow": "Stücke, die zusammenpassen", "title": "Komplettes Outfit.\nGanz du.", "text": "Vom ersten Knopf bis zum letzten Schritt.", "total": "Ganzes Outfit"}, "en": {"eyebrow": "Pieces that go together", "title": "The complete outfit.\nAll you.", "text": "From the first button to the last step.", "total": "Complete outfit"}}'::jsonb),
  ('home.occasions', '{"de": {"eyebrow": "Für deine Momente", "title": "Der Anlass ist deiner.", "hochzeit": "Für euren besonderen Tag.", "business": "Klar auftreten. Jeden Tag.", "abschlussfeier": "Ein neuer Abschnitt beginnt.", "gala": "Für die grossen Abende."}, "en": {"eyebrow": "For your moments", "title": "The occasion is yours.", "hochzeit": "For your special day.", "business": "Make a clear impression. Every day.", "abschlussfeier": "A new chapter begins.", "gala": "For the big evenings."}}'::jsonb),
  ('home.story', '{"image": "asset:fabric", "image_alt": {"de": "Detail von dunklem Anzugstoff mit messingfarbenem Knopf", "en": "Close-up of dark suit fabric with a brass-coloured button"}, "image_width": 1536, "image_height": 1024, "de": {"eyebrow": "Axion", "title": "Das Ganze beginnt\nmit den Details.", "text": "Axion steht für klare Schnitte und Stücke, die zusammenpassen. Kombiniere Anzug, Weste und Schuhe zu deinem Auftritt.", "link": "Über uns"}, "en": {"eyebrow": "Axion", "title": "It all starts\nwith the details.", "text": "Axion stands for clean cuts and pieces that go together. Combine suit, waistcoat and shoes into your look.", "link": "About us"}}'::jsonb);
