// /sitemap.xml: alle öffentlichen Seiten auf Deutsch und Englisch, mit Kategorien und aktiven Produkten.
// robots.txt verweist erst nach dem Livegang darauf (scripts/sync-robots.ts).
import { createFileRoute } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { listCollections, listProducts } from "@/lib/commerce";
import { buildSitemap, sitemapPaths } from "@/lib/seo/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [collections, products] = await Promise.all([
          listCollections("de"),
          listProducts({}, "de"),
        ]);
        const xml = buildSitemap(
          shopConfig.siteUrl,
          sitemapPaths(
            collections.map((c) => c.handle),
            products.map((p) => p.handle),
          ),
        );
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
