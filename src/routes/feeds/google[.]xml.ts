// /feeds/google.xml: Produktfeed für Google Merchant Center und den Meta-/Instagram-Katalog (gleiches RSS-Format).
// Wie Sitemap und llms.txt erst nach dem Livegang; vorher 404. Anleitung: docs/MARKETING.md.
import { createFileRoute } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { listProducts } from "@/lib/commerce";
import { loadSettings } from "@/lib/commerce/source";
import { googleFeedResponse } from "@/lib/feeds/google";

export const Route = createFileRoute("/feeds/google.xml")({
  server: {
    handlers: {
      GET: () =>
        googleFeedResponse(shopConfig.launched, async () => {
          const [products, settings] = await Promise.all([listProducts({}, "de"), loadSettings()]);
          return { products, settings };
        }),
    },
  },
});
