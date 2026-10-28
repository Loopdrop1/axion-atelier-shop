# Edge Functions (Supabase)

Alle Funktionen laufen mit `verify_jwt = false` (siehe `supabase/config.toml`) und prüfen den Aufrufer selbst.
Aufruf aus dem Shop mit `supabase.functions.invoke(name, { body })`; eingeloggte Aufrufe schicken das Anmelde-Token automatisch mit.
Fehler kommen immer als `{ "error": "CODE" }` mit passendem HTTP-Status. Anfragen brauchen `Content-Type: application/json`
(sonst `415 UNSUPPORTED_MEDIA_TYPE`): So braucht jede Anfrage aus dem Browser eine CORS-Freigabe, auch von fremden Webseiten.
Für Rate-Limits in den Funktionen zählt die IP aus `cf-connecting-ip` (sonst der erste gültige Eintrag von X-Forwarded-For), IPv6 als /64-Netz.
In den SQL-Funktionen (`private.request_ip`, z. B. `check_discount`) gilt dieselbe Reihenfolge: Cloudflare setzt
`cf-connecting-ip` selbst, ein gefälschtes X-Forwarded-For zählt nur ohne diesen Header. `check_discount` hat zusätzlich ein globales Limit (300 pro 10 Minuten);
die Zähler stehen nur als Hash in `private.rate_limits` und werden nach rund zwei Tagen gelöscht.

| Funktion          | Aufrufer                        | Zweck                                                                                                                  |
| ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `checkout`        | Shop (Gast oder eingeloggt)     | Bestand reservieren, Stripe-Checkout starten                                                                           |
| `stripe-webhook`  | Stripe                          | Zahlung verbuchen, Ablauf/Fehlzahlung stornieren (Erinnerung nur mit Einwilligung), Rückerstattung übernehmen, E-Mails |
| `newsletter`      | Shop                            | Anmelden (Double Opt-in), bestätigen, abmelden                                                                         |
| `admin-actions`   | Admin (Rolle `admin`)           | Versand melden, E-Mails erneut senden, Gutscheine ausstellen, Rückerstatten, Texte übersetzen                          |
| `contact`         | Shop                            | Kontaktformular: Nachricht als E-Mail an den Shop                                                                      |
| `account-delete`  | eingeloggte Kundschaft          | eigenes Konto löschen                                                                                                  |
| `stock-alert`     | Shop (Gast)                     | «Benachrichtigen, wenn wieder da»: Wunsch anlegen (Double Opt-in) und bestätigen                                       |
| `search-assist`   | Shop (Gast)                     | KI-Suche: Satz in Shop-Filter übersetzen (begrenzt pro IP und gesamt)                                                  |
| `client-error`    | Shop (Browser, Gast)            | technische Fehlerberichte ohne Personendaten (Admin → Fehler)                                                          |
| `return-request`  | Shop (Gast oder eingeloggt)     | «Retoure anmelden»: Bestellung per Nummer und E-Mail finden (lookup), Stücke und Grund speichern (submit), E-Mails     |
| `auth-email-hook` | Supabase Auth (Send Email Hook) | Konto-E-Mails in Axion-Optik, DE/EN                                                                                    |

## checkout

- `{ kind: "cart", lines: [{ variantId, quantity }], email?, discountCode?, giftCardCode?, locale }` → `200 { url, orderNumber }`
- `remind?: true` (nur beim Warenkorb, ausdrückliche Einwilligung aus dem unangekreuzten Häkchen «Erinnere mich per E-Mail, falls ich den Kauf nicht abschliesse»; jeder andere Wert gilt als Nein): Die Kasse speichert nach der Reservierung `orders.reminder_opt_in = true` (RPC `set_order_reminder`, `service_role`). Scheitert das, läuft die Kasse trotzdem weiter.
- `{ kind: "gift_card", amountCents, recipientName?, recipientEmail?, senderName?, message?, email?, locale }` → `200 { url, orderNumber }`
- `409 { error: "OUT_OF_STOCK", items: [{ variantId, available }] }`, `422 { error: "DISCOUNT_INVALID" | "GIFT_CARD_INVALID", reason }`, `400 INVALID_LINES | INVALID_EMAIL | INVALID_RECIPIENT_EMAIL | INVALID_AMOUNT | BAD_REQUEST`, `429 RATE_LIMITED | TOO_MANY_CHECKOUTS` (pro IP 20 in 30 Minuten, pro E-Mail 10, höchstens 3 offen), `502 PAYMENT_PROVIDER`
- Decken Gutschein oder Rabatt alles, läuft die Bestellung trotzdem über Stripe (Session ohne Zahlbetrag): Stripe verlangt keine Zahlung, erfasst aber die Lieferadresse.
- `{ kind: "release", token }` (nach Abbruch in Stripe): beendet zuerst die Stripe-Session und gibt die Reservierung nur frei, wenn Stripe sie als abgelaufen meldet. Eine schon bezahlte Session bleibt bestehen.

## stripe-webhook: E-Mails an die Kundschaft

- `checkout.session.expired` storniert die Bestellung (`cancel_reason = 'expired'`). Hat die Person zugestimmt (`reminder_opt_in`), geht danach **eine** Erinnerung «Dein Warenkorb wartet auf dich» (Artikel mit Bild, Knopf «Zum Warenkorb» auf `/warenkorb/wiederherstellen/<status_token>`, kein Rabatt). RPC `get_cart_reminder` liefert die Bestellung nur bei Ablauf (nicht bei `customer_cancelled`, `payment_failed`), ohne bisherigen Versand (`reminder_sent_at`, gesetzt über `mark_order_email_sent(…, 'reminder')`, dazu Resend-Schlüssel `order-<id>-reminder`) und nur, wenn dieselbe Adresse nicht inzwischen bezahlt hat. Ein Fehler beim Versand wird protokolliert und bricht die Stornierung nicht ab; ein späteres Ereignis kann nachholen.
- `public.restore_cart_by_token(uuid)` (für `anon` aufrufbar): liefert für eine abgebrochene Warenkorb-Bestellung (Status `cancelled`, jünger als 7 Tage) nur `[{variant_id, quantity}]`. Die Seite `/warenkorb/wiederherstellen/:token` legt die noch verfügbaren Stücke (Menge auf den Bestand gekürzt) in den Warenkorb und leitet zur Warenkorbseite weiter.
- `charge.refunded` übernimmt die Rückerstattung (`record_refund`) und schickt «Deine Rückerstattung zur Bestellung AX-…» (Betrag dieser Rückerstattung, ganz oder teilweise, Hinweis auf einige Tage bei der Bank; bei Vollrückerstattung vor dem Versand der Hinweis, dass die Bestellung storniert ist). Pro Betrag genau eine E-Mail: `orders.refund_notified_cents` (RPC `get_refund_notice`, `mark_refund_notified`) und Resend-Schlüssel `order-<id>-refund-<Gesamtbetrag>`. Ein Versandfehler gibt 500, Stripe wiederholt. Rückerstattungen und Stornierungen bezahlter Bestellungen löst das Admin im Stripe-Dashboard aus; sie laufen deshalb alle über diesen Weg, es gibt keine zweite Admin-Funktion dafür.

- **Bestandsmeldung an den Shop:** Bei einer neu verbuchten Zahlung (`complete_order` → `newly_paid`) meldet `sendLowStockAlert` («Bestand knapp: …», «Ausverkauft: …», Bestand 0) per E-Mail an die Bestelladresse (`shop_settings.notify_email`, sonst `SHOP_NOTIFY_EMAIL`), welche Grössen mit dieser Bestellung auf `LOW_STOCK_THRESHOLD` (Secret, Standard 2, 0 = nur ausverkauft) oder darunter gefallen sind. Der Bestand wird schon beim Reservieren der Kasse abgebucht; gemeldet wird trotzdem erst bei Zahlungseingang (abgelaufene Kassen lösen nichts aus). RPC `low_stock_after_order` (Migration `20261029001800_low_stock_alert.sql` bzw. Cloud `0017`, nur `service_role`) liefert nur Grössen, die die Schwelle mit dieser Bestellung erreicht haben (Bestand jetzt <= Schwelle, Bestand + bestellte Menge > Schwelle), also nicht jede weitere Bestellung; Bestellungen anderer Kundschaft zwischen Reservierung und Zahlung können das um eine Stufe verschieben (Näherung, kein Verlust: schlimmstenfalls eine Meldung mehr oder weniger). Resend-Schlüssel `order-<id>-lowstock`; die Meldung geht vor den Kundenmails raus, und ein Fehler dabei wird nur protokolliert, die Verbuchung bleibt gültig.

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

## return-request

«Retoure anmelden» (Seite `/retoure`, Tabelle `return_requests`, Migration `20261029001700_return_requests.sql` bzw. Cloud `0016`). Nur JSON (`415` sonst). Alle Regeln stehen in den RPCs `return_lookup` und `return_submit` (nur `service_role`).

- `{ action: "lookup", orderNumber, email }` → `200 { status: "ok", orderNumber, deadline, items: [{ orderItemId, title, size, color, image, quantity }] }` mit den noch zurückgebbaren Stücken (`quantity` = bestellt minus bereits angemeldet; abgelehnte Anmeldungen zählen nicht). `orderNumber` darf `AX-10001`, `#10001` oder `10001` sein. Nur bezahlte oder versendete Warenkorb-Bestellungen, E-Mail ohne Beachtung der Schreibweise. `404 NOT_FOUND` ist **einheitlich** für unbekannte Nummer, falsche Adresse und nicht bezahlte Bestellungen (verrät nie, ob eine Bestellung existiert). Erst wenn die Adresse passt: `409 RETURN_WINDOW_CLOSED { returnDays }` (Frist ab `shipped_at`, sonst `paid_at`; `SHOP_RETURN_DAYS`, Standard 14, gleich wie `returnDays` in `src/config/shop.ts`, Test `src/lib/returns.test.ts`) und `409 NOTHING_RETURNABLE` (alles angemeldet oder ganz erstattet).
- `{ action: "submit", orderNumber, email, items: [{ orderItemId, quantity, reason }], comment?, locale, requestId?, website? }` → `200 { status: "ok", returnNumber: "R-1001", orderNumber, emailed }`. `reason`: `too_small | too_large | style | quality | wrong_item | other`; 1 bis 20 verschiedene Positionen, Menge 1 bis 10 (zusätzlich ≤ noch zurückgebbar), Kommentar höchstens 1000 Zeichen (`400 COMMENT_TOO_LONG`). Fehler wie bei lookup, dazu `409 ITEMS_NOT_RETURNABLE` (Menge, fremde oder doppelte Position) und `400 BAD_REQUEST`. `requestId` (UUID aus dem Formular) macht doppeltes Absenden unschädlich: dieselbe Anmeldung wird nochmals geliefert, nichts wird zweimal angelegt.
- Mails (Resend, Idempotency-Key `return-<id>-customer` und `return-<id>-shop`): Bestätigung an die Kundschaft mit allgemeinen Hinweisen (ungetragen einpacken, Bestell- und Retourennummer beilegen, an `SHOP_ADDRESS` schicken; **kein** Rücksendeetikett und keine Kostenübernahme versprochen) und Meldung an die Bestelladresse (Admin → Einstellungen, sonst `SHOP_NOTIFY_EMAIL`, sonst `SHOP_CONTACT_EMAIL`) mit Reply-To an die Kundschaft. Scheitert eine Mail, bleibt die Anmeldung gespeichert (`emailed: false`, sichtbar im Admin → Retouren).
- Bremsen (`private.hit_rate_limit`, nur als Hash gezählt): lookup pro IP 30, pro Adresse 15, pro Bestellnummer 20, gesamt 500 pro Stunde; submit pro IP 10 und pro Adresse 5 pro Stunde (dazu dieselben Bestellnummer- und Gesamtgrenzen) → `429 RATE_LIMITED`.
- Admin → Retouren (`/admin/retouren`) liest und ändert `status` (`requested → received → refunded | rejected`) und `admin_note` per RLS; Erstattung und «Retoure einbuchen» bleiben an der Bestellung.

## search-assist

KI-Suche ohne Anmeldung: übersetzt längere Suchanfragen in Filter des Shops (Kategorien, Farbgruppen, Anlässe, Passform, Preis, Stichworte). Gleiches Gateway wie `translate` (`LOVABLE_API_KEY`).

- `{ q, locale }` → `200 { intent: {...} | null }`. Die Antwort des Modells wird auf bekannte Werte beschränkt (`_shared/search-intent.ts`); ist die KI nicht verfügbar, kommt `intent: null` und der Shop zeigt die lokalen Ergebnisse.
- Ratenlimit `search_assist_guard` (Migration `20261021001000_search_assist.sql` bzw. Cloud `0009`): 20 pro IP und Stunde, 2000 pro Tag gesamt → `429 RATE_LIMITED`. `400 BAD_REQUEST` bei Anfragen unter 8 Zeichen.
- Der Shop fragt nur, wenn die lokale Suche einen Satz ab drei Wörtern nicht sicher versteht, und merkt sich Antworten pro Sitzung.

## admin-actions (nur Admin)

- `{ action: "ship", orderId, trackingNumber?, notify?: true }` → `200 { status, trackingNumber, emailed, emailError? }`; mit Benachrichtigung ist die Sendungsnummer Pflicht (`400 TRACKING_REQUIRED`)
- `{ action: "post_label", orderId }` → `200 { identCode, labelPdfBase64, warnings }`: A6-Etikett der Schweizerischen Post (Digital Commerce API «Barcode», `_shared/swiss-post.ts`). Nur für bezahlte, noch nicht versendete Warenkorb-Bestellungen mit Lieferadresse in CH oder LI. Markiert **nicht** als versendet: Das Admin trägt `identCode` als Sendungsnummer ein und löst «Versendet» (mit Versandmeldung) selbst aus. `409 POST_NOT_CONFIGURED | ORDER_NOT_PAID | POST_NOT_DOMESTIC | POST_SENDER_INVALID`, `422 POST_ADDRESS_INVALID`, `502 POST_AUTH_FAILED | POST_LICENSE_INVALID | POST_REJECTED | POST_BAD_RESPONSE`, `503 POST_UNAVAILABLE | POST_RATE_LIMITED`. **Noch nicht gegen die echte API getestet** (Axion hat noch kein Post-Geschäftskundenkonto); die Tests laufen gegen einen Fake. Der Absender kommt aus `SHOP_NAME` und `SHOP_ADDRESS` im Format «Strasse Nr, PLZ Ort». `system_status` meldet nur das Boolean `swissPost`.
- `{ action: "resend_shipping", orderId }`, `{ action: "resend_confirmation", orderId, to? }` → `200 { emailed: true, to }`
- `{ action: "issue_gift_card", amountCents, locale?, recipientEmail?, recipientName?, senderName?, message?, note?, send?: true }` → `200 { giftCard, emailed, emailError? }`
- `{ action: "resend_gift_card", giftCardId, to? }` → `200 { emailed: true, to }`
- `{ action: "translate", texts: string[] }` → `200 { translations: string[] }` (Deutsch → Englisch, gleiche Reihenfolge, leere Texte bleiben leer). Höchstens 60 Texte, je 4000 Zeichen, zusammen 16'000. Über das Lovable AI Gateway (`LOVABLE_API_KEY`, legt Lovable selbst an); anderer Dienst mit OpenAI-Schnittstelle über `TRANSLATE_API_BASE`, `TRANSLATE_API_KEY`, `TRANSLATE_MODEL`. `503 TRANSLATION_UNAVAILABLE` (kein Schlüssel oder AI-Guthaben leer), `429 RATE_LIMITED` (Gateway) oder `429 DAILY_LIMIT` (500 Anfragen pro Admin und Tag, `translate_guard`), `502 TRANSLATION_FAILED`, `400 BAD_REQUEST | TOO_MANY_TEXTS | TEXT_TOO_LONG`. Das Admin schickt höchstens 40 Texte pro Anfrage und übersetzt leeres Englisch sowie maschinelles, dessen Deutsch sich geändert hat; von Hand geschriebenes Englisch bleibt (Herkunft in `en_auto` bzw. `auto`).
- `{ action: "draft_copy", title, category, color, material?, fit?, notes? }` → `200 { description: string, features: string[] }` (Textvorschlag auf Deutsch für das Produktformular, nur aus den gelieferten Angaben, Schweizer Schreibweise; das Admin prüft vor dem Speichern). Gleiches Gateway und gleiches Tageslimit wie `translate`; `400 BAD_REQUEST` ohne Titel, Kategorie oder Farbe, `502 COPY_FAILED`, sonst Fehler wie bei `translate`.
- `{ action: "notify_restock", variantId }` → `200 { notified, failed }`: bestätigte «Wieder da»-Wünsche einer wieder vorrätigen Grösse per E-Mail benachrichtigen (`stock_alerts_pending` → E-Mail mit Idempotenz-Schlüssel → `stock_alerts_done` nur für verschickte). Gescheiterte bleiben vorgemerkt. Das Lager-Dialogfeld ruft das automatisch auf, wenn eine Grösse von 0 aufgestockt wird.
- `{ action: "refund", orderId, amountCents?, reason?: "requested_by_customer" | "duplicate" | "fraudulent" }` → `200 { refundId, status, amountCents, remainingCents }`: Kartenanteil einer bezahlten oder versendeten Bestellung über Stripe (`POST /v1/refunds` auf den PaymentIntent) zurückzahlen; ohne Betrag der ganze Rest (`total_cents - refunded_cents`; `total_cents` ist schon der Kartenanteil, ein Gutscheinanteil gehört nicht dazu und wird mit `admin_credit_gift_card` gutgeschrieben). Idempotency-Key `refund-<Bestellung>-<Betrag>-<bisher erstattet>`: ein Doppelklick erstattet nur einmal. Die Funktion schreibt `refunded_cents` nicht selbst: Das Ereignis `charge.refunded` im Webhook ruft `record_refund` auf (idempotent über `greatest`), setzt Status und schickt die Kundenmail. Der eingeschränkte Stripe-Schlüssel braucht dafür das Recht «Refunds: Schreiben». Fehler: `409 ORDER_NOT_PAID` (nicht bezahlt/versendet oder schon ganz erstattet), `409 NO_CARD_PAYMENT` (kein PaymentIntent), `409 ALREADY_REFUNDED | CHARGE_DISPUTED | AMOUNT_TOO_LARGE | INSUFFICIENT_BALANCE | REFUND_IN_PROGRESS` (von Stripe), `400 AMOUNT_TOO_LARGE` (mehr als der Rest, mit `remainingCents`), `400 INVALID_AMOUNT | BAD_REQUEST`, `502 STRIPE_PERMISSION` (Schlüssel darf nicht erstatten) und `502 PAYMENT_PROVIDER` (sonstiger Stripe-Fehler).
- `{ action: "system_status" }` → `200 { required: {SECRET: bool}, optional: {SECRET: bool}, stripeMode: "test" | "live" | "unknown" | "missing", emailFromIsOnboarding, previewOriginsAllowed }`: nur Ja/Nein, ob Secrets gesetzt sind, und der Stripe-Modus aus dem Schlüssel-Präfix (`sk_`/`rk_` + `test`/`live`); nie ein Wert. Speist den Kasten «Bereit für den Livegang» im Admin.
- `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 ORDER_NOT_FOUND | GIFT_CARD_NOT_FOUND`, `409 ORDER_NOT_SHIPPABLE | ORDER_NOT_SHIPPED | ORDER_NOT_PAID`, `400 INVALID_TRACKING | INVALID_AMOUNT | INVALID_EMAIL`

## client-error

Technische Fehlerberichte aus dem Browser (Tabelle `client_errors`, Migrationen `20261027001400_client_errors.sql` und `20261027001500_client_errors_prune.sql` bzw. Cloud `0013` und `0014`).
Anzeige im Admin unter «Fehler»; Ablauf in `docs/BETRIEB.md`.

- `{ message, stack?, path?, release? }` → `200 { ok: true }`. Meldung auf 500, Stack auf 2000, Version auf 64 Zeichen gekürzt; der Browser-Typ kommt aus dem
  `User-Agent`-Header (300 Zeichen). Der Pfad wird ohne Host, Query-String und Fragment gespeichert; Adressen im Text verlieren ihren Query-String, E-Mail-Adressen werden durch `[email]` ersetzt. Dazu ersetzt `_shared/redact.ts` in Pfad, Meldung und Stack (auch in Adressen) Bestell-Token (`bestellung/:token`), Bestellnummern im Konto (`:nr`), UUIDs (`:id`), Hex-Folgen ab 24 Zeichen (`:hex`) und lange Zufallsfolgen ab 32 Zeichen (`:tok`); der Browser (`src/lib/redact.ts`) wendet dieselben Regeln schon vor dem Senden an, `src/lib/redact.test.ts` hält beide gleich.
  Es wird weder IP noch E-Mail noch Konto gespeichert.
- Gleicher Fehler (Fingerprint aus Meldung ohne Zahlen und erster Stack-Stelle) innerhalb von 24 Stunden erhöht nur den Zähler (`count`). Einträge älter als 30 Tage löscht die RPC `client_error_report` bei jedem Aufruf (höchstens 500 pro Aufruf).
- `400 BAD_REQUEST` (ohne Meldung), `413 PAYLOAD_TOO_LARGE` (über 12 KB), `429 RATE_LIMITED` (20 pro IP bzw. IPv6-/64-Netz und Stunde, 500 pro Tag gesamt; zuerst die IP-Bremse, danach zählt nur ein neuer Fingerprint zum Tageslimit: Wiederholungen eines bekannten Fehlers erhöhen den Zähler, ohne das Tageslimit zu belasten; Schlüssel `clienterr-ip:…`, `clienterr-global` nur als Hash). Lesen und Löschen nur für Admins (RLS), Schreiben nur über die RPC mit `service_role`.
- Der Shop meldet höchstens 5 verschiedene Fehler pro Seitenaufruf, nie in der Entwicklung und nie ohne Backend (`src/lib/client-errors.ts`); Netzwerkfehler («Failed to fetch», «Load failed», «NetworkError…», «The network connection was lost.», auch mit Fehlernamen davor) werden nicht gemeldet, Ladefehler von Skript-Teilen nach einem Update schon.

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
`SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL` (auch Empfänger des Kontaktformulars), `SHOP_ADDRESS`, `SHOP_RETURN_DAYS` (Rückgabefrist in Mails, Standard 14, gleich wie `returnDays` in `src/config/shop.ts`); nur mit eigenem
Supabase-Projekt `SEND_EMAIL_HOOK_SECRET`. Für die Übersetzung `LOVABLE_API_KEY` (legt Lovable Cloud selbst an),
optional `TRANSLATE_MODEL` (Standard `google/gemini-2.5-flash`), `TRANSLATE_API_BASE` und `TRANSLATE_API_KEY` für einen
anderen Dienst mit OpenAI-Schnittstelle. Optional `ALLOWED_ORIGINS`
(weitere Domains, Komma-getrennt), `STRIPE_REQUIRE_TERMS=1` (AGB-Häkchen in der Stripe-Kasse) und
`SHIPPING_COUNTRIES` (Liefergebiet, Standard `CH`; `CH,LI` erst nach Entscheid des Kunden, weil für Kundschaft in
Liechtenstein deren Konsumentenrecht mit Rücktrittsrecht gilt, Rechtstexte anpassen). `ALLOW_PREVIEW_ORIGINS=1`
erlaubt zusätzlich die Lovable-Vorschau und localhost (CORS und Konto-Links), nur für die Testphase: **vor dem Livegang
entfernen** (Checkliste in `docs/DEPLOYMENT.md`). Optional `SHOP_VAT_RATE` (MWST-Satz in Prozent, z. B. `8.1`; nur bei MWST-Pflicht):
`checkout` speichert ihn pro Bestellung (`orders.vat_rate`), der Beleg im Admin rechnet damit.
Optional `LOW_STOCK_THRESHOLD` (Bestandsmeldung an den Shop, Standard 2, `0` = nur ausverkauft).
Optional für Post-Etiketten (nur Cloud, nie ins Repo; ohne die ersten drei bleibt die Funktion aus und das Admin zeigt den Knopf deaktiviert): `POST_CLIENT_ID` und `POST_CLIENT_SECRET` (OAuth-Zugang zur Digital Commerce API, Scope `DCAPI_BARCODE_READ`), `POST_FRANKING_LICENSE` (Frankierlizenz), `POST_PRODUCT` (`ECO` = B-Post, Standard, oder `PRI` = A-Post), `POST_SEND_RECIPIENT_CONTACT=1` (Telefon und E-Mail der Kundschaft auf das Etikett; Standard aus, nur einschalten, wenn die Datenschutzerklärung die Post als Empfängerin nennt). Nur für Tests: `POST_OAUTH_URL`, `POST_LABEL_URL`.
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
| `20261025001200_wishlist`              | `0011_axion_wishlist`              | gleich                                                                         |
| `20261026001300_image_variants`        | `0012_axion_image_variants`        | gleich                                                                         |
| `20261027001400_client_errors`         | `0013_axion_client_errors`         | gleich                                                                         |
| `20261027001500_client_errors_prune`   | `0014_axion_client_errors_prune`   | gleich                                                                         |
| `20261028001600_checkout_reminder`     | `0015_axion_checkout_reminder`     | gleich                                                                         |

Eine neue Migration kommt in beide Ordner (neue Nummer, Eintrag in `drizzle/migrations/meta/_journal.json` und ein leerer
`NNNN_snapshot.json` mit der vorigen `id` als `prevId`).

## Prüfen

- `bun run test:backend` – alle Funktionen mit Fakes für Supabase, Stripe, Resend und das AI-Gateway gegen die lokale Datenbank
- `deno check index.ts` im Ordner jeder Funktion
- `bun scripts/deno-smoke.ts` – startet die echten `index.ts` unter Deno gegen die Fakes
- `bun scripts/email-preview.ts` – alle E-Mails als HTML nach `.local/email-preview/`
