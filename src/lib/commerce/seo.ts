import { shopConfig } from "@/config/shop";
export function pageHead(title: string, description: string, path: string) {
  return {
    links: [{ rel: "canonical", href: new URL(path, shopConfig.siteUrl).href }],
    meta: [
      { title: `${title} · Axion` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · Axion` },
      { property: "og:description", content: description },
      { property: "og:url", content: new URL(path, shopConfig.siteUrl).href },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(!shopConfig.launched ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
  };
}
