-- Startdaten: Kategorien, Beispielprodukte (Platzhalter) und Inhalte der Startseite.
-- Bildpfade «asset:…» zeigen auf die im Frontend eingebauten Bilder (src/lib/commerce/media.ts).

insert into public.categories (slug, name_de, name_en, description_de, description_en, image_path, sort) values
  ('anzuege', 'Anzüge', 'Suits', 'Klare Schnitte für die besonderen und die alltäglichen Momente.', 'Clean cuts for special and everyday moments.', 'asset:modelSuit', 10),
  ('westen', 'Westen', 'Waistcoats', 'Einzeln getragen. Oder als Teil des Ganzen.', 'Worn on its own. Or as part of the whole.', 'asset:modelVest', 20),
  ('schuhe', 'Schuhe', 'Shoes', 'Der passende Abschluss für deinen Auftritt.', 'The finishing touch for your look.', 'asset:modelShoes', 30);

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, fit_note_de, fit_note_en, fit,
  color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-limmat-marine', c.id, 'anzug-limmat', 'active', 'Anzug «Limmat»', 'Limmat Suit', 'Der Anzug «Limmat» besteht aus Sakko und Hose. Kombiniere ihn mit der passenden Weste zu einem Dreiteiler.', 'The Limmat suit consists of a jacket and trousers. Add the matching waistcoat for a three-piece look.',
  'Slim Fit', 'Slim Fit', 'Slim Fit', 'Marine', 'Navy', '#243448', array['neu']::text[], array['hochzeit','business']::text[], array['weste-limmat-marine','oxford-nero-schwarz']::text[],
  48900, null, 0, '2026-10-06T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 0, 30), ('54', 3, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'anzug-limmat-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:suit', 'Marineblauer Anzug von vorne', 'Navy suit, front view', 1024, 1280, 0), ('asset:modelSuit', 'Marineblauer Anzug am Modell, ohne sichtbares Gesicht', 'Navy suit on a model, face not shown', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-limmat-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, fit_note_de, fit_note_en, fit,
  color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'anzug-aare-anthrazit', c.id, 'anzug-aare', 'active', 'Anzug «Aare»', 'Aare Suit', 'Der Anzug «Aare» kombiniert ein Sakko mit einer passenden Hose. Anthrazit lässt sich mit hellen Hemden und dunklen Schuhen ergänzen.', 'The Aare suit pairs a jacket with matching trousers. Charcoal works well with light shirts and dark shoes.',
  'Regular Fit', 'Regular Fit', 'Regular Fit', 'Anthrazit', 'Charcoal', '#484946', '{}'::text[], array['business','gala']::text[], array['weste-limmat-salbeigruen','derby-lino-braun']::text[],
  45900, null, 10, '2026-10-03T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'anzuege';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 0, 40), ('56', 3, 50)) as v(size, stock, sort)
where p.handle = 'anzug-aare-anthrazit';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:charcoal', 'Anthrazitfarbener Anzug von vorne', 'Charcoal suit, front view', 1024, 1280, 0)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'anzug-aare-anthrazit';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, fit_note_de, fit_note_en, fit,
  color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-limmat-marine', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Die Weste «Limmat» ergänzt den marineblauen Anzug. Du kannst sie auch einzeln über einem Hemd tragen.', 'The Limmat waistcoat completes the navy suit. You can also wear it on its own over a shirt.',
  null, null, null, 'Marine', 'Navy', '#243448', array['neu']::text[], array['hochzeit','business']::text[], array['anzug-limmat-marine','oxford-nero-schwarz']::text[],
  12900, null, 20, '2026-10-05T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 3, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 3, 40), ('56', 0, 50)) as v(size, stock, sort)
where p.handle = 'weste-limmat-marine';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:vest', 'Marineblaue Weste von vorne', 'Navy waistcoat, front view', 1024, 1280, 0)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-limmat-marine';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, fit_note_de, fit_note_en, fit,
  color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'weste-limmat-salbeigruen', c.id, 'weste-limmat', 'active', 'Weste «Limmat»', 'Limmat Waistcoat', 'Die Weste «Limmat» in Salbeigrün setzt einen hellen Farbakzent. Kombiniere sie mit einem weissen Hemd und einer Anzughose.', 'The Limmat waistcoat in sage green adds a light touch of colour. Pair it with a white shirt and suit trousers.',
  null, null, null, 'Salbeigrün', 'Sage green', '#929881', array['sale']::text[], array['hochzeit','abschlussfeier']::text[], array['anzug-aare-anthrazit','derby-lino-braun']::text[],
  12900, 15900, 30, '2026-10-01T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'westen';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('46', 0, 0), ('48', 3, 10), ('50', 3, 20), ('52', 3, 30), ('54', 3, 40), ('56', 3, 50)) as v(size, stock, sort)
where p.handle = 'weste-limmat-salbeigruen';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:sage', 'Salbeigrüne Weste von vorne', 'Sage green waistcoat, front view', 1024, 1280, 0), ('asset:modelVest', 'Salbeigrüne Weste mit weissem Hemd am Modell', 'Sage green waistcoat with a white shirt on a model', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'weste-limmat-salbeigruen';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, fit_note_de, fit_note_en, fit,
  color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'derby-lino-braun', c.id, 'derby-lino', 'active', 'Derby «Lino»', 'Lino Derby', 'Der Derby «Lino» zeigt eine offene Schnürung. Der braune Farbton ergänzt dunkle und helle Anzughosen.', 'The Lino derby has open lacing. Its brown tone goes with both dark and light suit trousers.',
  null, null, null, 'Braun', 'Brown', '#825834', array['neu']::text[], array['business','hochzeit']::text[], '{}'::text[],
  21900, null, 40, '2026-10-04T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 0, 0), ('41', 3, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 3, 50), ('46', 3, 60)) as v(size, stock, sort)
where p.handle = 'derby-lino-braun';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:derby', 'Braune Derby-Schuhe in Dreiviertelansicht', 'Brown derby shoes, three-quarter view', 1024, 1280, 0), ('asset:modelShoes', 'Braune Derby-Schuhe zu einer dunklen Anzughose', 'Brown derby shoes with dark suit trousers', 1024, 1280, 10)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'derby-lino-braun';

insert into public.products (handle, category_id, model, status, title_de, title_en, description_de, description_en, fit_note_de, fit_note_en, fit,
  color_name_de, color_name_en, color_hex, tags, occasions, outfit_handles, price_cents, compare_at_cents, sort, created_at)
select 'oxford-nero-schwarz', c.id, 'oxford-nero', 'active', 'Oxford «Nero»', 'Nero Oxford', 'Der Oxford «Nero» hat eine geschlossene Schnürung. Seine schwarze Farbe lässt sich mit den Anzügen der Kollektion kombinieren.', 'The Nero oxford has closed lacing. Its black colour goes with every suit in the collection.',
  null, null, null, 'Schwarz', 'Black', '#20211F', array['neu']::text[], array['gala','business','abschlussfeier']::text[], '{}'::text[],
  23900, null, 50, '2026-10-02T09:00:00+02:00'::timestamptz
from public.categories c where c.slug = 'schuhe';

insert into public.product_variants (product_id, size, stock, sort)
select p.id, v.size, v.stock, v.sort from public.products p, (values ('40', 3, 0), ('41', 0, 10), ('42', 3, 20), ('43', 3, 30), ('44', 3, 40), ('45', 3, 50), ('46', 3, 60)) as v(size, stock, sort)
where p.handle = 'oxford-nero-schwarz';

insert into public.product_images (product_id, path, alt_de, alt_en, width, height, sort)
select p.id, i.path, i.alt_de, i.alt_en, i.width, i.height, i.sort from public.products p, (values ('asset:oxford', 'Schwarze Oxford-Schuhe in Dreiviertelansicht', 'Black oxford shoes, three-quarter view', 1024, 1280, 0)) as i(path, alt_de, alt_en, width, height, sort)
where p.handle = 'oxford-nero-schwarz';

insert into public.site_content (key, value) values
  ('size_guides', '{"tables": [{"id": "anzuege-westen", "title": {"de": "Anzüge und Westen", "en": "Suits and waistcoats"}, "categories": ["anzuege", "westen"], "columns": [{"de": "Grösse", "en": "Size"}, {"de": "Brust (cm)", "en": "Chest (cm)"}, {"de": "Taille (cm)", "en": "Waist (cm)"}, {"de": "Körpergrösse (cm)", "en": "Height (cm)"}], "rows": [["46", "92", "80", "170–176"], ["48", "96", "84", "173–179"], ["50", "100", "88", "176–182"], ["52", "104", "92", "179–185"], ["54", "108", "96", "182–188"], ["56", "112", "100", "185–191"]], "note": {"de": "Beispielwerte für die Vorschau. Die echten Masse ersetzt ihr im Admin unter «Grössentabellen».", "en": "Sample values for the preview."}}, {"id": "schuhe", "title": {"de": "Schuhe", "en": "Shoes"}, "categories": ["schuhe"], "columns": [{"de": "EU-Grösse", "en": "EU size"}, {"de": "Fusslänge (cm)", "en": "Foot length (cm)"}], "rows": [["40", "25.3"], ["41", "26.0"], ["42", "26.7"], ["43", "27.4"], ["44", "28.1"], ["45", "28.8"], ["46", "29.5"]], "note": {"de": "Beispielwerte für die Vorschau.", "en": "Sample values for the preview."}}]}'::jsonb),
  ('announcements', '{"items": [{"de": "Gratisversand in der ganzen Schweiz", "en": "Free shipping throughout Switzerland"}, {"de": "Lieferung in 2 bis 5 Arbeitstagen", "en": "Delivery in 2 to 5 working days"}, {"de": "Bezahlen mit TWINT, Karte, Apple Pay, Google Pay oder Klarna", "en": "Pay with TWINT, card, Apple Pay, Google Pay or Klarna"}]}'::jsonb),
  ('home.hero', '{"de": {"eyebrow": "Anzüge · Westen · Schuhe", "title": "Präzise geschnitten.\nFür jeden Auftritt.", "text": "Anzüge, Westen und Schuhe für Hochzeit, Business und alles dazwischen. Gratisversand in der ganzen Schweiz.", "primary": "Kollektion entdecken", "secondary": "Anzüge ansehen"}, "en": {"eyebrow": "Suits · Waistcoats · Shoes", "title": "Precisely cut.\nFor every occasion.", "text": "Suits, waistcoats and shoes for weddings, business and everything in between. Free shipping throughout Switzerland.", "primary": "Discover the collection", "secondary": "View suits"}}'::jsonb),
  ('home.collections', '{"de": {"eyebrow": "Die Kollektionen", "title": "Ein Auftritt. Dein Stil."}, "en": {"eyebrow": "The collections", "title": "One look. Your style."}}'::jsonb),
  ('home.new', '{"de": {"eyebrow": "Frisch in der Kollektion", "title": "Neu eingetroffen", "link": "Alle Neuheiten"}, "en": {"eyebrow": "New in the collection", "title": "New arrivals", "link": "All new arrivals"}}'::jsonb),
  ('home.look', '{"image": "asset:look", "image_alt": {"de": "Marineblauer Dreiteiler mit schwarzen Oxford-Schuhen in einem hellen Gang", "en": "Navy three-piece suit with black oxford shoes in a bright hallway"}, "image_width": 960, "image_height": 1280, "hotspots": [{"handle": "anzug-limmat-marine", "key": "sakko", "label": {"de": "Sakko", "en": "Jacket"}, "x": 37, "y": 25}, {"handle": "weste-limmat-marine", "key": "weste", "label": {"de": "Weste", "en": "Waistcoat"}, "x": 50, "y": 31}, {"handle": "oxford-nero-schwarz", "key": "schuhe", "label": {"de": "Schuhe", "en": "Shoes"}, "x": 47, "y": 89}], "de": {"eyebrow": "Stücke, die zusammenpassen", "title": "Komplettes Outfit.\nGanz du.", "text": "Vom ersten Knopf bis zum letzten Schritt.", "total": "Ganzes Outfit"}, "en": {"eyebrow": "Pieces that go together", "title": "The complete outfit.\nAll you.", "text": "From the first button to the last step.", "total": "Complete outfit"}}'::jsonb),
  ('home.occasions', '{"de": {"eyebrow": "Für deine Momente", "title": "Der Anlass ist deiner.", "hochzeit": "Für euren besonderen Tag.", "business": "Klar auftreten. Jeden Tag.", "abschlussfeier": "Ein neuer Abschnitt beginnt.", "gala": "Für die grossen Abende."}, "en": {"eyebrow": "For your moments", "title": "The occasion is yours.", "hochzeit": "For your special day.", "business": "Make a clear impression. Every day.", "abschlussfeier": "A new chapter begins.", "gala": "For the big evenings."}}'::jsonb),
  ('home.story', '{"image": "asset:fabric", "image_alt": {"de": "Detail von dunklem Anzugstoff mit messingfarbenem Knopf", "en": "Close-up of dark suit fabric with a brass-coloured button"}, "image_width": 1536, "image_height": 1024, "de": {"eyebrow": "Axion", "title": "Das Ganze beginnt\nmit den Details.", "text": "Axion steht für klare Schnitte und Stücke, die zusammenpassen. Kombiniere Anzug, Weste und Schuhe zu deinem Auftritt.", "link": "Über uns"}, "en": {"eyebrow": "Axion", "title": "It all starts\nwith the details.", "text": "Axion stands for clean cuts and pieces that go together. Combine suit, waistcoat and shoes into your look.", "link": "About us"}}'::jsonb);
