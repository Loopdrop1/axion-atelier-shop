# Edge Functions (Supabase)

Alle Funktionen laufen mit `verify_jwt = false` (siehe `supabase/config.toml`) und prüfen den Aufrufer selbst.
Aufruf aus dem Shop mit `supabase.functions.invoke(name, { body })`; eingeloggte Aufrufe schicken das Anmelde-Token automatisch mit.
Fehler kommen immer als `{ "error": "CODE" }` mit passendem HTTP-Status. Anfragen brauchen `Content-Type: application/json`
(sonst `415 UNSUPPORTED_MEDIA_TYPE`): So braucht jede Anfrage aus dem Browser eine CORS-Freigabe, auch von fremden Webseiten.
Für Rate-Limits in den Funktionen zählt die IP aus `cf-connecting-ip` (sonst der erste gültige Eintrag von X-Forwarded-For), IPv6 als /64-Netz.
In den SQL-Funktionen (`private.request_ip`, z. B. `check_discount`) gilt dieselbe Reihenfolge: Cloudflare setzt
`cf-connecting-ip` selbst, ein gefälschtes X-Forwarded-For zählt nur ohne diesen Header. `check_discount` hat zusätzlich ein globales Limit (300 pro 10 Minuten);
die Zähler stehen nur als Hash in `private.rate_limits` und werden nach rund zwei Tagen gelöscht.

| Funktion          | Aufrufer                        | Zweck                                                                                |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `checkout`        | Shop (Gast oder eingeloggt)     | Bestand reservieren, Stripe-Checkout starten                                         |
| `stripe-webhook`  | Stripe                          | Zahlung verbuchen, Ablauf/Fehlzahlung stornieren, Rückerstattung übernehmen, E-Mails |
| `newsletter`      | Shop                            | Anmelden (Double Opt-in), bestätigen, abmelden                                       |
| `admin-actions`   | Admin (Rolle `admin`)           | Versand melden, E-Mails erneut senden, Gutscheine ausstellen, Texte übersetzen       |
| `contact`         | Shop                            | Kontaktformular: Nachricht als E-Mail an den Shop                                    |
| `account-delete`  | eingeloggte Kundschaft          | eigenes Konto löschen                                                                |
| `stock-alert`     | Shop (Gast)                     | «Benachrichtigen, wenn wieder da»: Wunsch anlegen (Double Opt-in) und bestätigen     |
| `search-assist`   | Shop (Gast)                     | KI-Suche: Satz in Shop-Filter übersetzen (begrenzt pro IP und gesamt)                |
| `auth-email-hook` | Supabase Auth (Send Email Hook) | Konto-E-Mails in Axion-Optik, DE/EN                                                  |

## checkout

- `{ kind: "cart", lines: [{ variantId, quantity }], email?, discountCode?, giftCardCode?, locale }` → `200 { url, orderNumber }`
- `{ kind: "gift_card", amountCents, recipientName?, recipientEmail?, senderName?, message?, email?, locale }` → `200 { url, orderNumber }`
- `409 { error: "OUT_OF_STOCK", items: [{ variantId, available }] }`, `422 { error: "DISCOUNT_INVALID" | "GIFT_CARD_INVALID", reason }`, `400 INVALID_LINES | INVALID_EMAIL | INVALID_RECIPIENT_EMAIL | INVALID_AMOUNT | BAD_REQUEST`, `429 RATE_LIMITED | TOO_MANY_CHECKOUTS` (pro IP 20 in 30 Minuten, pro E-Mail 10, höchstens 3 offen), `502 PAYMENT_PROVIDER`
- Decken Gutschein oder Rabatt alles, läuft die Bestellung trotzdem über Stripe (Session ohne Zahlbetrag): Stripe verlangt keine Zahlung, erfasst aber die Lieferadresse.
- `{ kind: "release", token }` (nach Abbruch in Stripe): beendet zuerst die Stripe-Session und gibt die Reservierung nur frei, wenn Stripe sie als abgelaufen meldet. Eine schon bezahlte Session bleibt bestehen.

## newsletter

- `{ action: "subscribe", email, consent: true, locale, source?: "footer" | "account" | "checkout", website?: "" }` → immer `200 { ok: true }` (verrät nicht, ob die Adresse schon eingetragen ist). `website` ist ein verstecktes Feld gegen Bots und muss leer bleiben. Wortlaut und Version der Einwilligung legt der Server fest (`_shared/consent.ts`, gespeichert als «[newsletter-v2] Text»); der Formulartext in `src/i18n/messages` muss dazu passen (Test `consent.test.ts`). `400 INVALID_EMAIL | CONSENT_REQUIRED`, `429 RATE_LIMITED`.
- `{ action: "confirm", token }` → `200 { status: "confirmed" | "unsubscribed" | "invalid" }`
- `{ action: "unsubscribe", token }` → `200 { status: "unsubscribed" | "invalid" }`
- Links in den E-Mails: `/newsletter/bestaetigen?token=…` und `/newsletter/abmelden?token=…` (mit `/en` davor auf Englisch). Die Seiten lösen die Aktion erst per Klick aus, damit Link-Scanner von Mailprogrammen nichts bestätigen.

## stock-alert

«Benachrichtigen, wenn wieder da» mit Double Opt-in (Tabelle `stock_alerts`, Migration `20261021000900_stock_alerts.sql` bzw. Cloud `0008`).

- `{ action: "request", variantId, email, locale, website }` → `200 { ok: true }` (verrät nie, ob die Adresse schon eingetragen ist; schickt die Bestätigungs-E-Mail mit Link auf `/benachrichtigung/bestaetigen?token=…`). Nur aktive, ausverkaufte Grössen: `409 IN_STOCK`, `404 VARIANT_NOT_FOUND`, `400 INVALID_EMAIL | BAD_REQUEST`, `429 RATE_LIMITED` (5 pro Adresse, 10 pro IP, 200 gesamt pro Stunde).
- `{ action: "confirm", token }` → `200 { status: "confirmed" | "invalid" }`.
- Versand nach dem Aufstocken: `admin-actions` → `notify_restock` (unten). Nach dem Versand wird die Adresse entfernt; unbestätigte und benachrichtigte Einträge nach 30 Tagen gelöscht.

## search-assist

KI-Suche ohne Anmeldung: übersetzt längere Suchanfragen in Filter des Shops (Kategorien, Farbgruppen, Anlässe, Passform, Preis, Stichworte). Gleiches Gateway wie `translate` (`LOVABLE_API_KEY`).

- `{ q, locale }` → `200 { intent: {...} | null }`. Die Antwort des Modells wird auf bekannte Werte beschränkt (`_shared/search-intent.ts`); ist die KI nicht verfügbar, kommt `intent: null` und der Shop zeigt die lokalen Ergebnisse.
- Ratenlimit `search_assist_guard` (Migration `20261021001000_search_assist.sql` bzw. Cloud `0009`): 20 pro IP und Stunde, 2000 pro Tag gesamt → `429 RATE_LIMITED`. `400 BAD_REQUEST` bei Anfragen unter 8 Zeichen.
- Der Shop fragt nur, wenn die lokale Suche einen Satz ab drei Wörtern nicht sicher versteht, und merkt sich Antworten pro Sitzung.

## admin-actions (nur Admin)

- `{ action: "ship", orderId, trackingNumber?, notify?: true }` → `200 { status, trackingNumber, emailed, emailError? }`; mit Benachrichtigung ist die Sendungsnummer Pflicht (`400 TRACKING_REQUIRED`)
- `{ action: "resend_shipping", orderId }`, `{ action: "resend_confirmation", orderId, to? }` → `200 { emailed: true, to }`
- `{ action: "issue_gift_card", amountCents, locale?, recipientEmail?, recipientName?, senderName?, message?, note?, send?: true }` → `200 { giftCard, emailed, emailError? }`
- `{ action: "resend_gift_card", giftCardId, to? }` → `200 { emailed: true, to }`
- `{ action: "translate", texts: string[] }` → `200 { translations: string[] }` (Deutsch → Englisch, gleiche Reihenfolge, leere Texte bleiben leer). Höchstens 60 Texte, je 4000 Zeichen, zusammen 16'000. Über das Lovable AI Gateway (`LOVABLE_API_KEY`, legt Lovable selbst an); anderer Dienst mit OpenAI-Schnittstelle über `TRANSLATE_API_BASE`, `TRANSLATE_API_KEY`, `TRANSLATE_MODEL`. `503 TRANSLATION_UNAVAILABLE` (kein Schlüssel oder AI-Guthaben leer), `429 RATE_LIMITED` (Gateway) oder `429 DAILY_LIMIT` (500 Anfragen pro Admin und Tag, `translate_guard`), `502 TRANSLATION_FAILED`, `400 BAD_REQUEST | TOO_MANY_TEXTS | TEXT_TOO_LONG`. Das Admin schickt höchstens 40 Texte pro Anfrage und übersetzt leeres Englisch sowie maschinelles, dessen Deutsch sich geändert hat; von Hand geschriebenes Englisch bleibt (Herkunft in `en_auto` bzw. `auto`).
- `{ action: "draft_copy", title, category, color, material?, fit?, notes? }` → `200 { description: string, features: string[] }` (Textvorschlag auf Deutsch für das Produktformular, nur aus den gelieferten Angaben, Schweizer Schreibweise; das Admin prüft vor dem Speichern). Gleiches Gateway und gleiches Tageslimit wie `translate`; `400 BAD_REQUEST` ohne Titel, Kategorie oder Farbe, `502 COPY_FAILED`, sonst Fehler wie bei `translate`.
- `{ action: "notify_restock", variantId }` → `200 { notified, failed }`: bestätigte «Wieder da»-Wünsche einer wieder vorrätigen Grösse per E-Mail benachrichtigen (`stock_alerts_pending` → E-Mail mit Idempotenz-Schlüssel → `stock_alerts_done` nur für verschickte). Gescheiterte bleiben vorgemerkt. Das Lager-Dialogfeld ruft das automatisch auf, wenn eine Grösse von 0 aufgestockt wird.
- `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 ORDER_NOT_FOUND | GIFT_CARD_NOT_FOUND`, `409 ORDER_NOT_SHIPPABLE | ORDER_NOT_SHIPPED | ORDER_NOT_PAID`, `400 INVALID_TRACKING | INVALID_AMOUNT | INVALID_EMAIL`

## contact

- `{ name, email, message, locale, website?: "" }` → `200 { sent: true }`. Die Nachricht geht an `SHOP_CONTACT_EMAIL` (sonst `SHOP_NOTIFY_EMAIL`), Antwort per Reply-To an die Kundschaft. Der Shop speichert sie nicht.
- `400 NAME_REQUIRED | INVALID_EMAIL | MESSAGE_TOO_SHORT | MESSAGE_TOO_LONG` (10 bis 4000 Zeichen), `429 RATE_LIMITED` (pro IP bzw. IPv6-/64-Netz 5 pro Stunde, pro Adresse 3), `503 BUSY` (für alle zusammen 20 pro Stunde und 50 pro Tag: schützt das E-Mail-Kontingent der Bestell-E-Mails), `503 NOT_CONFIGURED` (keine Shop-Adresse), `502 EMAIL_FAILED`. Verstecktes Feld `website` gegen Bots: ausgefüllt → `200`, aber keine E-Mail.

## account-delete

- `{ confirm: true }` → `200 { deleted: true, ordersKept }`; `409 LAST_ADMIN` (letzter Admin kann sich nicht löschen). Danach im Shop `supabase.auth.signOut()`.

## auth-email-hook

Mit Lovable Cloud nicht im Einsatz: Dort verschickt Lovable Cloud die Konto-E-Mails selbst (Cloud → Emails). Nur bei einem eigenen
Supabase-Projekt als «Send Email Hook» eintragen.

Supabase ruft die Funktion statt eigener E-Mails auf. Links führen auf `/konto/bestaetigen?token_hash=…&type=…&next=…`
(mit `/en` davor auf Englisch); die Seite bestätigt per Klick mit `supabase.auth.verifyOtp({ token_hash, type })`
und leitet danach weiter (`recovery` → Passwort neu setzen). `next` ist ein Pfad ohne Sprachpräfix und muss auf der Seite
als interner Pfad geprüft werden (beginnt mit `/`, nicht mit `//`). Sprache: aus dem `redirect_to` der Anfrage
(`/en/…`), sonst aus `user_metadata.locale`.

## Secrets (Supabase → Edge Functions → Secrets)

`SITE_URL`, `STRIPE_SECRET_KEY` (eingeschränkter Schlüssel `rk_…`), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL` (auch Empfänger des Kontaktformulars), `SHOP_ADDRESS`; nur mit eigenem
Supabase-Projekt `SEND_EMAIL_HOOK_SECRET`. Für die Übersetzung `LOVABLE_API_KEY` (legt Lovable Cloud selbst an),
optional `TRANSLATE_MODEL` (Standard `google/gemini-2.5-flash`), `TRANSLATE_API_BASE` und `TRANSLATE_API_KEY` für einen
anderen Dienst mit OpenAI-Schnittstelle. Optional `ALLOWED_ORIGINS`
(weitere Domains, Komma-getrennt), `STRIPE_REQUIRE_TERMS=1` (AGB-Häkchen in der Stripe-Kasse) und
`SHIPPING_COUNTRIES` (Liefergebiet, Standard `CH`; `CH,LI` erst nach Entscheid des Kunden, weil für Kundschaft in
Liechtenstein deren Konsumentenrecht mit Rücktrittsrecht gilt, Rechtstexte anpassen). `ALLOW_PREVIEW_ORIGINS=1`
erlaubt zusätzlich die Lovable-Vorschau und localhost (CORS und Konto-Links), nur für die Testphase: **vor dem Livegang
entfernen** (Checkliste in `docs/DEPLOYMENT.md`). Optional `SHOP_VAT_RATE` (MWST-Satz in Prozent, z. B. `8.1`; nur bei MWST-Pflicht):
`checkout` speichert ihn pro Bestellung (`orders.vat_rate`), der Beleg im Admin rechnet damit.
`SUPABASE_URL` und die Schlüssel stellt Supabase selbst bereit.

## Migrationen: supabase und drizzle

`supabase/migrations/` ist die Quelle der lokalen Testdatenbank, `drizzle/migrations/` läuft in Cloud (Lovable führt Dateien aus Git
nicht aus; jede Migration wird einmal von Hand in Cloud ausgeführt). Gleiche Anweisungen, mit diesen bekannten Unterschieden
(der Test `src/test/backend-parity.test.ts` erzwingt das):

| supabase/migrations                    | drizzle/migrations (Cloud)         | Unterschied                                                                    |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `20261012000100_core`                  | `0000_axion_core`                  | ohne `create extension citext`                                                 |
| `20261012000200_commerce`              | `0001_axion_commerce`              | `citext` → `text` mit eindeutigem `lower(...)`-Index (Rabattcode, Newsletter)  |
| `20261012000300_rpc`                   | `0002_axion_rpc`                   | gleich                                                                         |
| `20261012000500_account`               | `0003_axion_account`               | gleich                                                                         |
| `20261012000400_storage`               | `0004_axion_storage_policies`      | ohne `INSERT INTO storage.buckets` (Buckets mit dem Speicher-Werkzeug anlegen) |
| `20261012000600_checkout_release`      | `0005_axion_checkout_release`      | gleich                                                                         |
| `20261012000700_contact_and_settings`  | `0006_axion_contact_and_settings`  | gleich                                                                         |
| `20261013000800_produktseite_und_hero` | `0007_axion_produktseite_und_hero` | gleich                                                                         |
| `20261021000900_stock_alerts`          | `0008_axion_stock_alerts`          | gleich                                                                         |
| `20261021001000_search_assist`         | `0009_axion_search_assist`         | gleich                                                                         |
| `20261024001100_review_fixes`          | `0010_axion_review_fixes`          | gleich                                                                         |

Eine neue Migration kommt in beide Ordner (neue Nummer, Eintrag in `drizzle/migrations/meta/_journal.json` und ein leerer
`NNNN_snapshot.json` mit der vorigen `id` als `prevId`).

## Prüfen

- `bun run test:backend` – alle Funktionen mit Fakes für Supabase, Stripe, Resend und das AI-Gateway gegen die lokale Datenbank
- `deno check index.ts` im Ordner jeder Funktion
- `bun scripts/deno-smoke.ts` – startet die echten `index.ts` unter Deno gegen die Fakes
- `bun scripts/email-preview.ts` – alle E-Mails als HTML nach `.local/email-preview/`
