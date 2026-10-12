import { shopConfig } from "../src/config/shop";
await Bun.write(
  "public/robots.txt",
  `User-agent: *\n${shopConfig.launched ? `Allow: /\nSitemap: ${shopConfig.siteUrl}/sitemap.xml` : "Disallow: /"}\n`,
);
