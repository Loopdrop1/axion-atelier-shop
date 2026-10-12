// Edge Function «auth-email-hook»: Supabase Send Email Hook: Konto-E-Mails in Axion-Optik.
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createAuthEmailHookHandler } from "./handler.ts";

Deno.serve(createAuthEmailHookHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
