// Edge Function «stripe-webhook»: Stripe-Webhook: verbucht Zahlungen, Abläufe und Rückerstattungen.
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createStripeWebhookHandler } from "./handler.ts";

Deno.serve(createStripeWebhookHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
