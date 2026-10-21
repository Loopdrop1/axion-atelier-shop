// public/robots.txt aus shopConfig.launched: vor dem Livegang alles gesperrt, danach offen mit Sitemap.
// Private Seiten (Konto, Warenkorb, Bestellstatus, Bestätigungslinks, Suche, Admin) bleiben auch danach gesperrt.
// KI-Suchen (z. B. OAI-SearchBot, PerplexityBot, ClaudeBot) fallen unter «*» und dürfen die öffentlichen Seiten lesen.
import { shopConfig } from "../src/config/shop";

const PRIVATE = [
  "/admin",
  "/konto",
  "/warenkorb",
  "/merkliste",
  "/suche",
  "/bestellung/",
  "/newsletter/",
  "/benachrichtigung/",
];
const disallow = PRIVATE.flatMap((p) => [`Disallow: ${p}`, `Disallow: /en${p}`]).join("\n");

await Bun.write(
  "public/robots.txt",
  shopConfig.launched
    ? `User-agent: *\nAllow: /\n${disallow}\n\nSitemap: ${shopConfig.siteUrl}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n",
);
