// Edge Function «admin-actions»: Admin-Aktionen mit E-Mail (Versand, erneut senden, Gutscheine).
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createAdminActionsHandler } from "./handler.ts";

Deno.serve(createAdminActionsHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
