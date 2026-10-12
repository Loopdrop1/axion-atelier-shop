# Edge Functions (Supabase)

Alle Funktionen laufen mit `verify_jwt = false` (siehe `supabase/config.toml`) und prüfen den Aufrufer selbst.
Aufruf aus dem Shop mit `supabase.functions.invoke(name, { body })`; eingeloggte Aufrufe schicken das Anmelde-Token automatisch mit.
Fehler kommen immer als `{ "error": "CODE" }` mit passendem HTTP-Status.

| Funktion          | Aufrufer                        | Zweck                                                                                |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `checkout`        | Shop (Gast oder eingeloggt)     | Bestand reservieren, Stripe-Checkout starten                                         |
| `stripe-webhook`  | Stripe                          | Zahlung verbuchen, Ablauf/Fehlzahlung stornieren, Rückerstattung übernehmen, E-Mails |
| `newsletter`      | Shop                            | Anmelden (Double Opt-in), bestätigen, abmelden                                       |
| `admin-actions`   | Admin (Rolle `admin`)           | Versand melden, E-Mails erneut senden, Gutscheine ausstellen                         |
| `account-delete`  | eingeloggte Kundschaft          | eigenes Konto löschen                                                                |
| `auth-email-hook` | Supabase Auth (Send Email Hook) | Konto-E-Mails in Axion-Optik, DE/EN                                                  |

## checkout

- `{ kind: "cart", lines: [{ variantId, quantity }], email?, discountCode?, giftCardCode?, locale }` → `200 { url, orderNumber }`
- `{ kind: "gift_card", amountCents, recipientName?, recipientEmail?, senderName?, message?, email?, locale }` → `200 { url, orderNumber }`
- `409 { error: "OUT_OF_STOCK", items: [{ variantId, available }] }`, `422 { error: "DISCOUNT_INVALID" | "GIFT_CARD_INVALID", reason }`, `400 INVALID_LINES | INVALID_EMAIL | INVALID_AMOUNT | BAD_REQUEST`, `429 RATE_LIMITED | TOO_MANY_CHECKOUTS` (pro IP 20 in 30 Minuten, pro E-Mail 10, höchstens 3 offen), `502 PAYMENT_PROVIDER`
- Decken Gutschein oder Rabatt alles, läuft die Bestellung trotzdem über Stripe (Session ohne Zahlbetrag): Stripe verlangt keine Zahlung, erfasst aber die Lieferadresse.
- `{ kind: "release", token }` (nach Abbruch in Stripe): beendet zuerst die Stripe-Session und gibt die Reservierung nur frei, wenn Stripe sie als abgelaufen meldet. Eine schon bezahlte Session bleibt bestehen.

## newsletter

- `{ action: "subscribe", email, consent, locale, source?: "footer" | "account" | "checkout", website?: "" }` → immer `200 { ok: true }` (verrät nicht, ob die Adresse schon eingetragen ist). `website` ist ein verstecktes Feld gegen Bots und muss leer bleiben. `400 INVALID_EMAIL | CONSENT_REQUIRED`, `429 RATE_LIMITED`.
- `{ action: "confirm", token }` → `200 { status: "confirmed" | "unsubscribed" | "invalid" }`
- `{ action: "unsubscribe", token }` → `200 { status: "unsubscribed" | "invalid" }`
- Links in den E-Mails: `/newsletter/bestaetigen?token=…` und `/newsletter/abmelden?token=…` (mit `/en` davor auf Englisch). Die Seiten lösen die Aktion erst per Klick aus, damit Link-Scanner von Mailprogrammen nichts bestätigen.

## admin-actions (nur Admin)

- `{ action: "ship", orderId, trackingNumber?, notify?: true }` → `200 { status, trackingNumber, emailed, emailError? }`
- `{ action: "resend_shipping", orderId }`, `{ action: "resend_confirmation", orderId, to? }` → `200 { emailed: true, to }`
- `{ action: "issue_gift_card", amountCents, locale?, recipientEmail?, recipientName?, senderName?, message?, note?, send?: true }` → `200 { giftCard, emailed, emailError? }`
- `{ action: "resend_gift_card", giftCardId, to? }` → `200 { emailed: true, to }`
- `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 ORDER_NOT_FOUND | GIFT_CARD_NOT_FOUND`, `409 ORDER_NOT_SHIPPABLE | ORDER_NOT_SHIPPED | ORDER_NOT_PAID`, `400 INVALID_TRACKING | INVALID_AMOUNT | INVALID_EMAIL`

## account-delete

- `{ confirm: true }` → `200 { deleted: true, ordersKept }`; `409 LAST_ADMIN` (letzter Admin kann sich nicht löschen). Danach im Shop `supabase.auth.signOut()`.

## auth-email-hook

Supabase ruft die Funktion statt eigener E-Mails auf. Links führen auf `/konto/bestaetigen?token_hash=…&type=…&next=…`
(mit `/en` davor auf Englisch); die Seite bestätigt per Klick mit `supabase.auth.verifyOtp({ token_hash, type })`
und leitet danach weiter (`recovery` → Passwort neu setzen). `next` ist ein Pfad ohne Sprachpräfix und muss auf der Seite
als interner Pfad geprüft werden (beginnt mit `/`, nicht mit `//`). Sprache: aus dem `redirect_to` der Anfrage
(`/en/…`), sonst aus `user_metadata.locale`.

## Secrets (Supabase → Edge Functions → Secrets)

`SITE_URL`, `STRIPE_SECRET_KEY` (eingeschränkter Schlüssel `rk_…`), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`SHOP_NOTIFY_EMAIL`, `SHOP_CONTACT_EMAIL`, `SHOP_ADDRESS`, `SEND_EMAIL_HOOK_SECRET`; optional `ALLOWED_ORIGINS`
(weitere Domains, Komma-getrennt), `STRIPE_REQUIRE_TERMS=1` (AGB-Häkchen in der Stripe-Kasse) und
`SHIPPING_COUNTRIES` (Liefergebiet, Standard `CH`; `CH,LI` erst nach Entscheid des Kunden, weil für Kundschaft in
Liechtenstein deren Konsumentenrecht mit Rücktrittsrecht gilt, Rechtstexte anpassen). `ALLOW_PREVIEW_ORIGINS=1`
erlaubt zusätzlich die Lovable-Vorschau und localhost (CORS und Konto-Links), nur für die Testphase.
`SUPABASE_URL` und die Schlüssel stellt Supabase selbst bereit.

## Prüfen

- `bun run test:backend` – alle Funktionen mit Fakes für Supabase, Stripe und Resend gegen die lokale Datenbank
- `deno check index.ts` im Ordner jeder Funktion
- `bun scripts/deno-smoke.ts` – startet die echten `index.ts` unter Deno gegen die Fakes
- `bun scripts/email-preview.ts` – alle E-Mails als HTML nach `.local/email-preview/`
