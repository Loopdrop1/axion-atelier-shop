// Edge Function «checkout»: Kasse: reserviert Bestand und erstellt die Stripe-Checkout-Session.
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createCheckoutHandler } from "./handler.ts";

Deno.serve(createCheckoutHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
