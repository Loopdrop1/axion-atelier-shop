// Erzeugt den Inhalt von public/robots.txt aus der Shop-Konfiguration (ohne Nebenwirkung, damit ein Test ihn prüfen kann).
// Private Seiten (Konto, Warenkorb, Bestellstatus, Bestätigungslinks, Retoure, Suche, Admin) bleiben auch nach dem Livegang gesperrt.
// KI-Suchen (z. B. OAI-SearchBot, PerplexityBot, ClaudeBot) fallen unter «*» und dürfen die öffentlichen Seiten lesen.
export const PRIVATE_PATHS = [
  "/admin",
  "/api/",
  "/konto",
  "/warenkorb",
  "/merkliste",
  "/suche",
  "/bestellung/",
  "/newsletter/",
  "/benachrichtigung/",
  "/retoure",
];

export function robotsTxt(config: { launched: boolean; siteUrl: string }): string {
  const disallow = PRIVATE_PATHS.flatMap((p) => [`Disallow: ${p}`, `Disallow: /en${p}`]).join("\n");
  return config.launched
    ? `User-agent: *\nAllow: /\n${disallow}\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
}
