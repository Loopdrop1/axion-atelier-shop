// Projektseitige Werte rund um die Backend-Anbindung.
// Der Client in @/integrations/supabase/client.ts wird von Lovable erzeugt und darf nicht ergänzt
// werden, deshalb liegen «backendConfigured» und «supabaseUrl» hier.
// Wie im Client: im Browser die Vite-Werte, beim Rendern auf dem Server die Prozess-Umgebung.

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || "";

// true, sobald eine Backend-Verbindung eingerichtet ist (Vorschau und Publikation).
export const backendConfigured: boolean = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

// Basisadresse für öffentliche Bild-URLs aus dem Speicher, ohne abschliessenden Schrägstrich.
export const supabaseUrl: string = SUPABASE_URL.replace(/\/+$/, "");
