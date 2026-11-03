# AXION Online-Shop: vollständiger Projekt-Prompt

> Dieser Prompt beschreibt den Shop so, wie er heute gebaut ist (Stand 3. November 2026, Commit `ab1a0e7` plus Block A bis D der Kundencheckliste). Er dient
> drei Zwecken: (1) einem neuen Entwickler oder einer KI das ganze Projekt in einem Stück übergeben, (2) den Shop
> von Grund auf neu bauen lassen, (3) als Prüfliste, ob bei Änderungen nichts verloren geht. Wo eine Regel mit
> «nie» oder «immer» formuliert ist, ist sie verbindlich. Platzhalter in eckigen Klammern liefert der Kunde
> (Liste: `docs/KUNDENDATEN.md`).

---

## 1. Auftrag und Rolle

Du baust und betreust den Online-Shop von **AXION**, einer Schweizer Herrenmarke für **Konfektion im
Luxussegment** (Anzüge, Sakkos, Hosen, Hemden, Westen, Mäntel und Jacken, Strick, Schuhe, Accessoires). Axion
verkauft **ab Lager, in festen Grössen**. Es gibt **keine Massanfertigung, keine Änderungen, keine Anproben und
keine Termine**: Nichts davon darf je in Texten, E-Mails, FAQ oder Rechtstexten auftauchen.

- Auftraggeber/Agentur: Flowrenix (Ben). Kunde: Axion. Vertrag: Offerte/Checkliste «axion_checkliste_online-shop»
  (Kundencheckliste ausgefüllt am 3.11.2026, **Unterschrift des Kunden ausstehend**); Anprobe und Änderungsservice
  gestrichen. Angekreuzte kostenpflichtige Optionen (Priority-Versand, Bewertungen, Messung) sind **preislich
  ungeklärt** («Paket: keines»); technisch vorbereitet, Bewertungen hinter einem Schalter. Betreuung: CHF 550 pro Jahr.
- Sprache der Kundschaft: **Deutsch (Schweiz, verbindlich)** und Englisch. Schweizer Schreibweise: **«ss» statt
  «ß»**, Guillemets «…», Beträge «CHF 1'290.00».
- Ton: ruhig, präzise, hochwertig, du-Form, keine Superlative, keine Füllwörter, keine Emojis.
- Lieferland: Schweiz (`CH`). Axion wünscht auch Liechtenstein; bleibt aus, bis die Fachperson die Klauseln (Platzhalter in den AGB) freigibt.

## 2. Technik-Stack

| Bereich          | Wahl                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend         | TanStack Start (SSR, Nitro, Preset `cloudflare-module`), React, TypeScript strikt, Tailwind CSS v4, shadcn/ui (Radix) |
| Daten im Browser | TanStack Query (Katalog, Loader), Zustand mit `persist` (Warenkorb, Merkliste)                                        |
| Backend          | **Lovable Cloud** (Supabase, Region Europa): Postgres, Auth, Storage, 11 Deno Edge Functions                          |
| Zahlung          | **Stripe Checkout** (gehostet), Webhooks, Stripe Tax nicht nötig (MWST selbst)                                        |
| E-Mail           | **Resend** (Transaktionsmails), Konto-Mails verschickt Lovable Cloud selbst                                           |
| Versand          | Optional Schweizerische Post, Digital Commerce API (Etiketten), noch ungetestet gegen echte API                       |
| KI               | Lovable AI Gateway (Gemini Flash) für Übersetzung DE→EN im Admin und Such-Assistent                                   |
| 3D               | Three.js, nur lazy im Markenbereich der Startseite                                                                    |
| Karussell        | Embla                                                                                                                 |
| Tests            | Vitest (Unit, ~377), Vitest Backend gegen lokale Postgres 16 (~501), Playwright E2E (58, Fake-Supabase)               |
| Hosting          | Lovable (veröffentlicht unter `https://axion-atelier-shop.lovable.app`), später eigene Domain `[www.axion-shop.ch]`   |
| Paketmanager     | bun                                                                                                                   |

Befehle: `bun run dev`, `bun run build`, `bun run test`, `bun run db:reset`, `bun run test:backend`,
`bun run typecheck:backend`, `bun run test:e2e`, `bun run launch:check`, `bun scripts/sync-robots.ts`,
`bun scripts/db/gen-sample-catalog.ts`, `tsc --noEmit`, `eslint .`.

## 3. Arbeitsregeln (verbindlich)

1. **Git/Lovable:** Repo `Loopdrop1/axion-atelier-shop`, Lovable-Projekt `81384fd7-77a8-4809-b8c3-48b5a9ee05e8`.
   Arbeiten auf einem Feature-Branch, PR nach `main`, mergen; Lovable synchronisiert `main`. **Nie force-pushen,
   rebasen, amenden oder squashen, was schon gepusht ist** (zerstört die Lovable-Historie). `main` muss immer
   lauffähig sein.
2. **Secrets nur in Lovable Cloud → Secrets**, nie im Repo, nie im Chat.
3. **Migrationen:** neue Datei in `supabase/migrations/` (Quelle für lokale Test-DB) **und** in
   `drizzle/migrations/` (+ Journal und Snapshot; das läuft in Cloud), dann einmal manuell in Cloud ausführen.
   **Nie eine angewendete Migration ändern.** Cloud kennt kein `citext` (→ `text` + Unique-Index auf
   `lower(...)`) und erlaubt kein `INSERT INTO storage.buckets` (Buckets mit dem Storage-Tool, Policies per
   Migration). Nach jeder Migration Schema-Fingerabdruck Cloud vs. lokal vergleichen.
4. `supabase/config.toml`: **`verify_jwt = false` für jede Funktion** (sie prüfen Aufrufer selbst). Nach
   Cloud-Änderungen kontrollieren, sonst Funktionen neu deployen.
5. **Nie** `src/integrations/supabase/client.ts` (generiert) bearbeiten; `backendConfigured` und `supabaseUrl`
   leben in `src/lib/backend.ts`.
6. Bestand **nur** über RPC `admin_adjust_stock`, nie `product_variants.stock` direkt schreiben.
7. Kasse **immer** über die Edge Function `checkout`; nie Zahlungslinks fest in die UI schreiben.
8. **Nie «Gratisversand» hart codieren**; Versandtexte kommen aus `shop_settings` via `shippingLabel`.
9. Lovable-Credits sparen: Code-Änderungen lokal, Lovable nur für Deploy, Veröffentlichen, DB-Abfragen.
10. Vor jedem Push: Typecheck, Lint, Unit- und Backend-Tests grün; E2E bei UI-Änderungen.
11. Kommentare und Doku auf Deutsch, knapp, im Stil des bestehenden Codes.

## 4. Architektur

- **Eine Quelle für Shop-Einstellungen:** `src/config/shop.ts` (Marke, `siteUrl`, `launched`, `vatRegistered`,
  `vatRate` 8.1, Kontakt mit Platzhaltern, Social-Links, `analytics.plausibleDomain`, `verification` Google/Bing,
  `returnDays` 14, Lieferung: Annahmeschluss 14:00 Europe/Zurich, 0 Bearbeitungstage, Laufzeit 2–5 Arbeitstage,
  Zahlarten TWINT/Visa/Mastercard/Amex/Apple Pay/Google Pay/Klarna, Feature-Schalter Newsletter, Kundenkonten,
  Gutscheine).
- **Commerce-Adapter:** Die UI liest Daten **nur** über async Exporte aus `src/lib/commerce/index.ts`. Katalog aus
  Supabase via `source.ts` (Server-Cache 30 s). Verträge in `types.ts`, Zeilen-Mapping in `mapping.ts`,
  Bildmetadaten in `media.ts`. Seiten fragen nie Tabellen direkt ab.
- **Ohne Backend** lädt `source.ts` lazy `sample-catalog.ts` (generiert aus dem Seed); der Live-Shop lädt es nie.
- **Persistente Stores** speichern nur Varianten-IDs/Mengen (Warenkorb) und Produkt-Handles (Merkliste); alles
  Angezeigte wird über den Adapter aufgelöst. Hydrierung erst nach dem Mount, nie im SSR. Leere Zustände erst nach
  Hydrierung und Datenladen zeigen (kein falsches «leer»-Flackern).
- **Ladebudget:** Supabase-Client (`getSupabase()`), sonner, Seitentexte (`src/content/pages*.ts`) und die Panels
  Warenkorb/Menü/Suche (`shell-overlays.tsx`, nach Idle oder beim ersten Öffnen) sind eigene Chunks; nie statisch
  in Shell, `start.ts`, Route-`head`/`loader` oder gemeinsame Lib-Module importieren (Route-`head` nutzt
  `content-meta.ts`). Fonts Inter und Jost nur als Latin-Subset vorgeladen, metrikangepasste Fallbacks gegen
  Layout-Shift; erste Produktkarte eines Rasters mit `fetchpriority=high`.
- **Suche/URL:** Search-Params als einfache Strings, Defaults löst der Konsument auf (keine Redirects sauberer URLs).
- **Metadaten:** jede Inhaltsroute hat eigene deutsche (bzw. englische) Metadaten, Canonical und Bild-URLs aus der
  konfigurierten Site-URL; fehlende Produkte/Kategorien rendern eine Leaf-Not-Found-Komponente mit HTTP 404.
- **Sicherheitsheader:** CSP `frame-ancestors`, `nosniff`, Referrer-Policy (`src/lib/security-headers.ts`).

## 5. Design (AXION-Stil)

- Farben: Grün `#1e3a2f`, Tiefgrün `#12261d`, Sand `#e9e1d2`, Papier `#f5f1e8` (Hintergrund), Gold `#b8955a`
  (Fokus/Akzent), Tinte `#141414`, Grau `#625f58`, Linie `#dcd5c8`. **Radius 0** (eckig).
- Schrift: Jost (Display, Titel, weit gesperrte Versalien-Labels 11 px) und Inter (Text 15 px, klein 13 px).
- Logo: «Λ AXION» (Dach-Zeichen plus gesperrter Schriftzug), flaches SVG.
- Bildsprache: ruhig, viel Weissraum, Vollbild-Hero, Produktbilder 4:5.
- **Motion CSS-first** (Block «Motion» am Ende von `src/styles.css`): Hero setzt sich und Zeilen erscheinen,
  Scroll-Timeline-Parallax unter `@supports`, `reveal-image`-Vorhang, gestaffeltes `.product-grid` in `Reveal`.
  Karte → Produktbild fliegt per View Transition (`vt-product-image`, Name nur auf der geklickten Karte).
  Seitenwechsel mit View Transitions nur bei Pfadwechsel, nicht bei Filter/Suche, nie bei reduzierter Bewegung.
- **Reduced Motion** wird überall respektiert; Reveal-Sichtbarkeit über `html.js`-Klasse, ohne JS ist alles sichtbar.
- Markenbereich: 3D-Logo (Three.js) erst nach Sichtbarkeit und Fähigkeitsprüfung, sonst exakt das flache SVG;
  Canvas pausiert ausserhalb des Sichtfelds.
- Barrierefreiheit: WCAG 2.2 AA, Fokusringe, Dialoge geben Fokus an den Auslöser zurück, Filter/Anlass-Dropdowns
  als kontrollierte nicht-modale Radix-Popover, Pause-Knopf fürs Hero-Video (2.2.2), Statusregionen.

## 6. Seiten (Shop, DE ohne Präfix, EN unter `/en`)

| Route                                                                                       | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                         | Startseite in fester Reihenfolge: Vollbild-Hero (Foto eager/high priority, optional stummes Loop-Video aus `site-media`: `video` für Desktop/Tablet, `video_mobile` hochkant für Phones, max. 25 MB, nie bei Reduced Motion/Datensparmodus, pausiert offscreen), **Neu eingetroffen** (8 neueste mit Tag `neu`, 6 auf Tablets), Kategorien-Reihe (Embla, Pfeile ab Tablet, Wischen am Phone), **Look** (Shop the Look neben dem Bild: Grössen wählen, ganzer Look oder Auswahl in den Warenkorb), Anlässe, Markenbereich (3D), Vorteile, Geschichte |
| `/kollektion/$handle`                                                                       | Kategorie bzw. «Alle Stücke», Neu, Sale, Anlass; Filter (Grösse, Farbe mit sprachneutralem Farbschlüssel, Passform, Preis), Sortierung                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/produkt/$handle`                                                                          | Desktop 3 Spalten (Text links sticky, Bilder Mitte, Kaufbox rechts sticky), Tablet 2, Phone gestapelt; Farben als Modell-Varianten, Grössenwahl, Grössentabelle (Dialog), Herkunft (`origin_*`), Merkmale (`features_*`, eine Zeile pro Merkmal), Pflege, Material, Passformhinweis; «Nur noch 2»-Hinweis bei ≤2 Stück (persistente `role=status`); ausverkaufte Grösse → «Benachrichtigen»; komplettes Outfit; Empfehlungen; Muster-Hinweis                                                                                                        |
| `/suche`                                                                                    | lokale Smart Search (siehe 9) mit entfernbaren verstandenen Begriffen, «Meintest du», KI-Assistent für längere Sätze                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/warenkorb`                                                                                | Zeilen, Mengen (max. 3 pro Grösse, 20 pro Bestellung), Rabattcode, Geschenkkarte, Versandschätzung, Lieferfenster («zwischen Mi., 4. und Mo., 9. November»), E-Mail, Häkchen «Erinnere mich per E-Mail» (Standard aus), «Weiter zur Zahlung»                                                                                                                                                                                                                                                                                                        |
| `/warenkorb/wiederherstellen/$token`                                                        | Warenkorb aus Erinnerungsmail (7 Tage gültig)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/bestellung/$token`                                                                        | Bestellstatus/Bestätigung (Token-Link, noindex)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/geschenkgutschein`                                                                        | Geschenkkarte kaufen (Betrag, Empfänger, Nachricht)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/merkliste`                                                                                | Merkliste (Browser, mit Konto synchronisiert)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/konto/*`                                                                                  | anmelden, registrieren, bestätigen, Passwort vergessen/neu, Übersicht, Bestellungen (+ Detail mit Retourenlink), Daten, Konto löschen                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/retoure`                                                                                  | öffentliches Retourenformular (Bestellnummer + E-Mail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/benachrichtigung/bestaetigen`, `/newsletter/bestaetigen`, `/newsletter/abmelden`          | Double-Opt-in-Seiten                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/ratgeber`, `/ratgeber/$slug`                                                              | 6 Ratgeber: Anzug zur Hochzeit, Slim oder Regular Fit, Business-Dresscode Schweiz, Abschlussfeier-Outfit, Anzug pflegen, Stoffe und Qualität (mit «Kurz gesagt», FAQ, Produkten)                                                                                                                                                                                                                                                                                                                                                                    |
| `/groessenberatung`, `/haeufige-fragen`, `/versand-und-rueckgabe`, `/ueber-uns`, `/kontakt` | Hilfe/Marke; Kontaktformular                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/agb`, `/datenschutz`, `/impressum`                                                        | Rechtstexte DE (verbindlich) + EN, gleiche Struktur (Test erzwingt), Platzhalter werden beim Rendern erkannt und als Entwurf markiert                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/sitemap.xml`, `/llms.txt`, `/feeds/google.xml`, `/api/health`                             | Server-Routen (siehe 12, 13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Navigation Desktop: «Neu», «Kollektion» (Popover: alle aktiven Kategorien + «Alle Stücke»), «Anlässe» (Popover:
Hochzeit, Business, Abschlussfeier, Gala), «Sale»; rechts Sprache, Suche, Konto, Merkliste, Warenkorb. Phone-Menü
listet alles. Laufband (Ankündigungen) oben aus `site_content`. Menüs kommen aus aktiven Kategorien (`navQuery`).

## 7. Katalog und Daten

**Tabellen:** `products` (Handle, Kategorie, `model` für Farbgeschwister, Status, Titel/Beschreibung/Material/
Pflege/Herkunft/Merkmale/Passformhinweis DE+EN mit `en_auto`, Passform, Farbe DE/EN + Hex, Tags, Anlässe,
`outfit_handles`, Preis, Streichpreis, Sortierung), `product_variants` (Grösse, SKU, Bestand), `product_images`
(Pfad, Varianten/Grössen, Alt DE/EN), `categories` (Slug, Name/Beschreibung DE/EN, Bild, Sortierung, aktiv),
`orders`, `order_items`, `gift_cards`, `gift_card_transactions`, `discount_codes`, `stock_movements`,
`stripe_events`, `newsletter_subscribers`, `stock_alerts`, `wishlist_items`, `return_requests`, `client_errors`,
`profiles`, `user_roles`, `shop_settings`, `site_content`, `private.rate_limits`. RLS überall; heikle RPCs nur für
`service_role`.

**Kategorien:** Muster-Sortiment mit 9 Kategorien (Anzüge, Sakkos, Hosen, Hemden, Westen, Mäntel & Jacken, Strick,
Schuhe, Accessoires). **Start laut Kundencheckliste:** aktiv Anzüge, Westen, Schuhe, Hosen, T-Shirts (neu, S bis XL);
Sakkos, Hemden, Mäntel & Jacken, Strick, Accessoires ausgeblendet, nicht gelöscht (Skript in `supabase/demo/`).
Anzug = Sakko und Hose als eigene Produkte, verknüpft über «Komplettes Outfit»; Sakkos stehen in «Anzüge», Hosen in
«Hosen». Anzüge, Westen und Hosen in Zahlengrössen 46 bis 56 (keine Buchstaben), Schuhe in ganzen EU-Grössen.
**Anlässe:** Hochzeit, Business, Abschlussfeier, Gala.

**Muster-Sortiment:** 52 Produkte mit Tag `muster` (Karten-Badge «Muster», Hinweis auf der Produktseite),
Illustrationen aus `src/assets/muster` als `asset:muster/<handle>-1|2`. `supabase/seed.sql` (lokal) und
`supabase/demo/muster-einspielen.sql` (Cloud) enthalten dasselbe; `muster-entfernen.sql` entfernt es vor dem
Launch (Admin-Checkbox «behalten» möglich). Nach Seed-Änderung `bun run db:reset` und
`bun scripts/db/gen-sample-catalog.ts`.

**Einheitsgrösse:** Einzige Variante «One Size»/«Einheitsgrösse»/«OS» → nichts zu wählen, vorausgewählt, Anzeige
«Einheitsgrösse»/«One size» (nie «Grösse One Size»); gleiche Regel in `src/lib/commerce/one-size.ts` und
`supabase/functions/_shared/size.ts` (Paritätstest). Eine einzige echte Grösse wählt die Kundschaft trotzdem.

**Outfits:** Produktseite und Home-Look teilen `src/components/shop/outfit.ts`: verfügbare Teile vorausgewählt,
ausverkaufte nicht wählbar, nichts in den Warenkorb, solange einem gewählten Teil die Grösse fehlt; Reset per
`key={outfitKey(...)}`.

## 8. Kasse, Zahlung, Bestellungen

1. Warenkorb → `checkout` (POST JSON). Reihenfolge: JSON lesen → E-Mail prüfen → **ohne `STRIPE_SECRET_KEY`
   `503 PAYMENTS_DISABLED`** (UI: «Die Kasse wird beim Livegang verbunden», nichts reserviert) → Zeilen prüfen
   (max. 3/Grösse, 20/Bestellung; `MAX_PER_LINE`/`MAX_PER_ORDER` in `stores.ts`, `parseLines`, `reserve_checkout`
   gleich halten) → `checkout_guard` (pro IP 20/30 min und höchstens 8 neue Kassen/35 min; ohne IP gemeinsamer
   Bucket 30/30 min; pro E-Mail nur Rate-Limit 30/30 min, nie Sperre offener Kassen pro Adresse) →
   `reserve_checkout` (Preise nur aus der DB, Bestand wird reserviert/abgebucht, 35 min) → Stripe-Coupon für
   Rabatt+Gutschein (Rabatt so gekürzt, dass mind. CHF 0.50 bleibt; `estimateTotals` spiegelt das) →
   Stripe-Checkout-Session (31 min, Idempotenz-Key pro Bestellung, Lieferadresse CH, Telefon, AGB optional) →
   URL + `statusToken` zurück.
2. Deckt ein Gutschein alles, läuft es trotzdem über Stripe (0 CHF, erfasst Lieferadresse).
3. Abbruch/Ablauf: `release` gibt Reservierung frei; Bestellung `cancelled` mit Grund.
4. **`stripe-webhook`** (Signatur geprüft, Ereignisse dedupliziert in `stripe_events`):
   `checkout.session.completed` → bezahlt, Bestätigung an Kundschaft, Meldung an Shop, Geschenkkarte ausstellen
   und mailen; Niedrigbestand-Mail (einmal pro Bestellung, Schwelle `LOW_STOCK_THRESHOLD`, Standard 2; wirft nie in
   den Webhook); `checkout.session.completed` mit `payment_status=unpaid` (asynchrone Zahlung) wartet;
   `checkout.session.async_payment_succeeded` → wie bezahlt (gleiche Funktion `onPaid`);
   `checkout.session.async_payment_failed` → storniert (`cancel_order`, Grund `payment_failed`, Bestand zurück, keine
   Erinnerung); `checkout.session.expired` → storniert (Grund `expired`), Bestand zurück, Erinnerungsmail nur mit
   Einwilligung;
   Rückerstattung → Betrag nachführen, Mail einmal pro Betrag (unbekannte Bestellung → Fehler, Stripe wiederholt);
   `charge.dispute.created` und `radar.early_fraud_warning.created` → `record_dispute`: `needs_attention`, Notiz
   in `admin_note`, gekaufte Geschenkkarte gesperrt.
5. Bestellstatus: pending → paid → shipped (mit Sendungsnummer, Versandmail mit Post-Tracking-Link) → ggf.
   refunded/cancelled; `needs_attention` als Flag.
6. Rabattcodes (Prozent/Betrag, Mindestbestellwert, Zeitraum, Einlösungen), Geschenkkarten (Code, Saldo,
   Transaktionen, Teil-Einlösung).
7. MWST: nur wenn `vatRegistered`/`SHOP_VAT_RATE` gesetzt; Satz pro Bestellung gespeichert, Beleg rechnet damit.

## 9. Suche

Lokal zuerst (`src/lib/commerce/smart-search.ts`, via `searchCatalog`): DE/EN-Synonyme, Tippfehlertoleranz,
Komposita, Farbgruppen, Kategorie, Anlass, Passform, Preis («unter 500»), Grösse, Absichten Sale/Neu/Geschenk,
Relevanz-Ranking, schrittweises Lockern, «Meintest du». Overlay zeigt verstandene Begriffe, Kategorien,
beliebte und letzte Suchen (`recent-searches.ts`, nur Browser). Suchseite: verstandene Begriffe entfernbar; bei
Sätzen ab 3 Wörtern, die lokal nicht ganz verstanden werden, fragt sie `search-assist` (KI, Rate-Limit,
Whitelist-bereinigt, pro Sitzung gecacht).

## 10. Kundenkonto, Merkliste, Benachrichtigungen, Retouren

- Supabase Auth (E-Mail + Passwort), Bestätigungsseite `/konto/bestaetigen` mit `verifyOtp`, Passwort-Reset;
  Bestellungen am Konto; Daten ändern; Konto löschen (`account-delete`, letzter Admin kann nicht).
- Merkliste im Browser, nach Login mit `wishlist_items` synchronisiert.
- **Wieder verfügbar:** ausverkaufte Grösse → «Benachrichtigen» (`stock-alert-form.tsx` → `stock-alert`,
  Double-Opt-in). Auffüllen von 0 im Admin (Lagerdialog) oder durch Retoure (`admin_restock_order` liefert
  `back_in_stock`) → `admin-actions` `notify_restock`: Mail, Eintrag als benachrichtigt markieren, Adresse löschen.
- **Retouren:** `/retoure` → `return-request` (`lookup` mit Bestellnummer + E-Mail, `submit` mit Teilen, Mengen,
  Grund; einheitliches `NOT_FOUND`; Frist `SHOP_RETURN_DAYS` ab `shipped_at` + 7 Tage, sonst ab `paid_at`;
  Rate-Limits pro E-Mail erst nach Treffer) → `return_requests` (requested → received → refunded/rejected).
  **Keine Versprechen zu Etikett oder Kosten.** Gründe in `_shared/returns.ts` und `src/lib/returns.ts` (Parität).
- **Newsletter:** Double-Opt-in, Willkommensmail, Abmeldelink; offene Anmeldungen nach 30 Tagen gelöscht.
- **Kontakt:** `contact` (5/IP bzw. IPv6-/64 und 3/Adresse pro Stunde, global 20/h und 50/Tag, Honeypot
  `website`, Nachrichten nicht gespeichert, Rate-Keys nur als Hash) → Mail an `SHOP_CONTACT_EMAIL`.

## 11. E-Mails (Resend, DE/EN, Axion-Layout, HTML + Text)

Bestellbestätigung · Meldung neue Bestellung an den Shop («Bitte prüfen:» bei `needs_attention`) · Versandmeldung
mit Tracking · Geschenkkarte · Rückerstattung · Warenkorb-Erinnerung (nur mit Einwilligung, einmal) · Newsletter
bestätigen · Newsletter willkommen · Benachrichtigung bestätigen · Wieder verfügbar · Niedrigbestand (an Shop) ·
Kontaktformular (an Shop) · Sicherheitshinweis · Konto-Mails (`authEmail`; mit Lovable Cloud verschickt Lovable
sie selbst, `auth-email-hook` nur für eigenes Supabase). Idempotenz-Keys pro Mail (z. B. `order-<id>-lowstock`).

## 12. Admin (`/admin`, Rolle `admin` in `user_roles`)

Übersicht (Kennzahlen, Checkliste «Bereit für den Livegang» via `system_status`: nur Booleans + Stripe-Modus, nie
Secret-Werte) · Bestellungen (Liste, Detail, Notiz, Versendet mit Sendungsnummer, Post-Etikett, Rückerstattung,
Retoure einbuchen, Beleg drucken `receipt.tsx`, Versanddokumente) · Retouren · Produkte (Formular DE/EN, Bilder mit
Varianten-Zuordnung, Varianten/Grössen, Muster-Badge) · Kategorien · Lager (`admin_adjust_stock`, Bewegungen) ·
Rabattcodes · Gutscheine · Newsletter (Export) · Startseite und Laufband (`site_content`: Hero-Bild/Video,
Ankündigungen, Look, Texte) · Grössentabellen (`size_guides`) · Fehler (`client_errors`) · Zugänge (Admins) ·
Einstellungen (`shop_settings`: Versandkosten, Gratis-ab-Schwelle usw.) · Anleitung.

**Auto-Übersetzung:** Beim Speichern füllt `src/lib/admin/auto-translate.ts` leeres Englisch und übersetzt
Maschinen-Englisch neu, wenn sich das Deutsch ändert (`admin-actions` `translate`, 500 Anfragen pro Admin und Tag).
Herkunft pro Feld (`en_auto`, `auto`). Von Hand geschriebenes Englisch wird nie überschrieben; fehlgeschlagene
Übersetzung leert nur veraltetes Maschinen-Englisch (Shop zeigt dann Deutsch).

## 13. SEO, GEO, Marketing, Betrieb

- `launched` (in `shop.ts`) steuert Indexierung; danach `bun scripts/sync-robots.ts` → `public/robots.txt`.
  Nach dem Launch erlaubt robots öffentliche Seiten, sperrt Konto, Warenkorb, Bestellstatus, Bestätigungslinks,
  Suche, Admin, Retoure, `/api/health`.
- `/sitemap.xml`, `/llms.txt` (Zusammenfassung für KI-Suche, vor Launch 404), strukturierte Daten
  (`src/lib/seo/structured.ts`: Organization + WebSite-Suche auf Home, BreadcrumbList, Product mit Marke, SKU,
  Farbe, Material, Rückgaberichtlinie, FAQPage ohne Platzhalter-Fragen).
- `/feeds/google.xml` (RSS 2.0 mit `g:`, ein Eintrag pro Grösse, ohne `muster`, vor Launch 404) für Google
  Merchant Center und Meta.
- Plausible (ohne Cookies) nur mit Domain und `launched`, nie im Admin/Dev; Datenschutzabsatz erscheint nur dann.
  Ereignisse über `trackEvent`. Search-Console/Bing-Verifizierung über `shopConfig.verification`.
- Fehlerberichte: `client-error` + `client_errors` (ohne Personendaten, Fingerprint/24 h, 30 Tage), Reporter
  klein, nach Idle, max. 5 pro Seitenaufruf, nie in Dev/ohne Backend.
- `/api/health` → `{ok, catalogue, time}`, `no-store`.
- Aufbewahrung: abgebrochene, nie bezahlte Bestellungen nach 30 Tagen gelöscht (ausser mit Gutschein, Retoure,
  Rückerstattung, `needs_attention`); in der Datenschutzerklärung erwähnt.
- Runbooks: `docs/BETRIEB.md`, `docs/TESTKAUF.md`, `docs/IPHONE-CHECK.md`, `docs/MARKETING.md`,
  `docs/DEPLOYMENT.md`, `docs/KUNDENDATEN.md`.

## 14. Edge Functions (11, Deno)

`checkout`, `stripe-webhook`, `newsletter`, `admin-actions` (Admin-Aktionen, `system_status`, `translate`,
`notify_restock`, `post_label`, Rückerstattung …), `contact`, `account-delete`, `stock-alert`, `search-assist`,
`client-error`, `return-request`, `auth-email-hook`. Gemeinsamer Rahmen `_shared/http.ts`: CORS nur für
`SITE_URL` + `ALLOWED_ORIGINS` (+ Vorschau nur mit `ALLOW_PREVIEW_ORIGINS=1`, vor Launch entfernen), CORS-Header
auch auf Fehlerantworten, JSON-Fehler `{error: CODE}`, nur `Content-Type: application/json` (sonst 415),
Grössenlimit 20 KB. Logik in `handler.ts` mit Tests, `index.ts` verbindet nur Secrets.

**Secrets (Lovable Cloud → Secrets):** `SITE_URL` (veröffentlichte Adresse, ohne sie meldet der Browser «Keine
Verbindung»), `ALLOWED_ORIGINS` (Editor-Vorschau), `STRIPE_SECRET_KEY` (eingeschränkt `rk_…`),
`STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SHOP_NAME`, `SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL`,
`SHOP_ADDRESS` («Strasse Nr, PLZ Ort»), **`STRIPE_REQUIRE_TERMS=1` (Pflicht für den Livegang: AGB-Häkchen in der
Stripe-Kasse; die Admin-Checkliste prüft es als Ja/Nein)**, optional `SHOP_RETURN_DAYS`, `SHOP_VAT_RATE`,
`SHIPPING_COUNTRIES`, `LOW_STOCK_THRESHOLD`, `TRANSLATE_MODEL`, `POST_CLIENT_ID`, `POST_CLIENT_SECRET`,
`POST_FRANKING_LICENSE`, `POST_PRODUCT` (ECO/PRI). `LOVABLE_API_KEY` legt Lovable selbst an.
Stripe-Webhook-Ereignisse: `checkout.session.completed`, `checkout.session.expired`,
`checkout.session.async_payment_succeeded/failed`, `charge.refunded`, `charge.dispute.created`,
`radar.early_fraud_warning.created` auf `…/functions/v1/stripe-webhook`.

## 15. Migrationen (Reihenfolge)

core · commerce · rpc · storage · account · checkout_release · contact_and_settings · produktseite_und_hero ·
stock_alerts · search_assist · review_fixes · wishlist · image_variants · client_errors · client_errors_prune ·
checkout_reminder · return_requests · low_stock_alert · audit_followups · checkout_limits · receipt_vat ·
audit_round2 (in `supabase/migrations/2026…` und als `drizzle/migrations/0000…0021`; alle in Cloud angewendet) ·
return_refund_method (`0022`, in Cloud angewendet) · weitere ab `0023` aus Block B bis D der Kundencheckliste
(Liste und Cloud-Status in `docs/KUNDENDATEN.md`).

## 16. Stand und offene Punkte

**Fertig:** alles oben; Cloud-Schema identisch mit lokal; 11 Funktionen deployt; Shop veröffentlicht; zwei
Audit-Runden (Sicherheit, Kasse, Rechtstexte, Texte, Design) abgeschlossen.

**Offen, vom Kunden/Ben:**

1. `SITE_URL` in Cloud setzen.
2. Nach Zahlungseingang: Stripe-Konto von **Axion** (Testmodus), Schlüssel und Webhook, Resend mit eigener
   Absenderdomain (SPF/DKIM/DMARC), dann Testkauf nach `docs/TESTKAUF.md`, eigenes Konto zum Admin machen.
3. Alle Platzhalter in `shop.ts` und Rechtstexten (Firma, Adresse, UID, E-Mail, Telefon, Rückgabefrist,
   MWST-Pflicht, Lieferzeiten, Social, Plausible) aus `docs/KUNDENDATEN.md`.
4. Echte Produkte, Fotos und Hero-Video statt Muster; `muster-entfernen.sql` ausführen.
5. Eigene Domain verbinden, `SITE_URL`/`ALLOWED_ORIGINS`/Auth-Redirects anpassen, `ALLOW_PREVIEW_ORIGINS`
   entfernen, `launched: true`, robots synchronisieren, Search Console, Merchant Center.
6. Optional: Post-Geschäftskundenkonto für Etiketten (bisher nur gegen Fake getestet), Liechtenstein (nach Freigabe der
   Klauseln durch die Fachperson).
7. `STRIPE_REQUIRE_TERMS=1` setzen (Pflicht vor dem Livegang).
8. Unterschrift des Kunden unter Checkliste und Konditionen; Preise der angekreuzten Optionen klären.

## 17. Definition of Done für jede Änderung

Typecheck (Frontend + Backend), Lint, Unit-, Backend- und bei UI E2E-Tests grün; DE und EN gepflegt; keine
verbotenen Inhalte (Massanfertigung, Änderungen, Anproben, Termine, hart codierter Gratisversand); AGENTS.md und
Doku nachgeführt; bei Schemaänderung beide Migrationsordner und Cloud angewendet und verglichen; bei
Funktionsänderung Funktion neu deployt; PR gemergt; Lovable synchron; veröffentlichte Seite geprüft.
