/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Projekt-URL von Supabase. Fehlt sie, läuft der Shop mit Beispieldaten. */
  readonly VITE_SUPABASE_URL?: string;
  /** Öffentlicher Schlüssel (sb_publishable_…). Alternativ der alte anon-Schlüssel. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
