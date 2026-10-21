// /llms.txt: kurze Übersicht des Shops für KI-Assistenten und KI-Suchen (GEO), nach dem Vorschlag llmstxt.org.
// Erst nach dem Livegang (wie robots.txt und Sitemap); vorher 404.
import { createFileRoute } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { listCollections } from "@/lib/commerce";
import { shippingLabel } from "@/lib/commerce/shipping-text";
import { loadSettings } from "@/lib/commerce/source";
import { buildLlmsTxt } from "@/lib/seo/llms";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        if (!shopConfig.launched) return new Response("Not found", { status: 404 });
        const [collections, settings] = await Promise.all([listCollections("de"), loadSettings()]);
        return new Response(buildLlmsTxt(collections, shippingLabel(settings, "de")), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
