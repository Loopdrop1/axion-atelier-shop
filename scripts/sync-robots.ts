// public/robots.txt aus shopConfig.launched: vor dem Livegang alles gesperrt, danach offen mit Sitemap.
// Der Inhalt kommt aus scripts/robots-txt.ts; src/lib/commerce/launch-gate.test.ts prüft, dass die Datei dazu passt.
import { shopConfig } from "../src/config/shop";
import { robotsTxt } from "./robots-txt";

await Bun.write("public/robots.txt", robotsTxt(shopConfig));
