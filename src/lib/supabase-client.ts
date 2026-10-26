// Der Supabase-Client (rund 50 kB gzip) wird erst beim ersten Zugriff geladen, damit er den ersten Aufruf
// einer Seite nicht verzögert. Alle Aufrufer prüfen vorher `backendConfigured`.
export const getSupabase = () => import("@/integrations/supabase/client").then((m) => m.supabase);
