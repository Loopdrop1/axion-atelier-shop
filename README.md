# AXION Atelier Shop

Online-Shop für **AXION**, eine Schweizer Herrenmarke (Anzüge, Westen, Schuhe, Accessoires). TanStack Start und React im Frontend, Lovable Cloud (Supabase, Region Europa) im Backend, Zahlung über Stripe Checkout.

## Überblick

- `src/config/shop.ts`: Marke, Kontakt, Launch, MWST, Versand und Funktionen an einer Stelle.
- `src/lib/commerce/`: Katalog und Warenkorb; die Oberfläche liest Daten nur über diese Adapter.
- `src/routes/`: Seiten des Shops und das Admin unter `/admin`.
- `supabase/`: Migrationen, Seed, Edge Functions (`functions/README.md`) und Tests.
- `docs/KUNDENDATEN.md`: Checkliste aller Angaben und Entscheide, die vor dem Livegang noch von Axion kommen.
- `docs/DEPLOYMENT.md`: Veröffentlichung und Betrieb. `docs/brief-v1.md`: der ursprüngliche erste Auftrag (veraltet: kein Backend, Beispieldaten).
- `AGENTS.md`: Architekturregeln und Konventionen für dieses Projekt.

## Befehle

| Befehl                       | Zweck                                            |
| ---------------------------- | ------------------------------------------------ |
| `bun run dev`                | Entwicklungsserver                               |
| `bun run build`              | Produktions-Build                                |
| `bun run test`               | Unit-Tests (Vitest)                              |
| `bun run db:reset`           | Lokale Test-Datenbank neu aufsetzen              |
| `bun run test:backend`       | Datenbank- und Edge-Function-Tests               |
| `bun run typecheck:backend`  | Typprüfung der Edge Functions                    |
| `bun run launch:check`       | Prüfung vor dem Launch                           |
| `bun scripts/sync-robots.ts` | `public/robots.txt` nach Änderung von `launched` |
