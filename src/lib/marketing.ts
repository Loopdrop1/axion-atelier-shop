// Marketing-Anbindungen aus shop.ts: Besucherstatistik (Plausible) und Inhaberschaftsnachweise für Suchmaschinen.
// Reine Funktionen ohne Seiteneffekt, damit ein Test sie prüfen kann. Nichts davon lädt vor dem Livegang.
import { shopConfig } from "@/config/shop";

interface MarketingConfig {
  launched: boolean;
  analytics: { plausibleDomain: string };
  verification: { google: string; bing: string };
}

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const TOKEN = /^[\w-]{10,200}$/;

/** Gültige Plausible-Domain (Hostname ohne Schema und Pfad) oder leer. */
export function plausibleDomain(config: Pick<MarketingConfig, "analytics"> = shopConfig): string {
  const domain = config.analytics.plausibleDomain.trim();
  return HOSTNAME.test(domain) ? domain : "";
}

/** Zusätze für den <head> der Wurzel-Route. Skript nur mit Domain, nach dem Livegang, ausserhalb von Entwicklung
 *  und Admin; Verifizierungs-Meta-Tags unabhängig davon (Search Console prüft meist vor dem Livegang). */
export function marketingHead(
  options: { admin?: boolean; dev?: boolean } = {},
  config: MarketingConfig = shopConfig,
) {
  const domain = plausibleDomain(config);
  const scripts =
    domain && config.launched && !options.admin && !options.dev
      ? [{ src: "https://plausible.io/js/script.js", defer: true, "data-domain": domain }]
      : [];
  const verify = (name: string, value: string) => {
    const token = value.trim();
    return TOKEN.test(token) ? [{ name, content: token }] : [];
  };
  return {
    scripts,
    meta: [
      ...verify("google-site-verification", config.verification.google),
      ...verify("msvalidate.01", config.verification.bing),
    ],
  };
}
