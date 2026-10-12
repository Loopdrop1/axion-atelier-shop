// Edge Function «newsletter»: Newsletter: Anmeldung mit Double Opt-in, Bestätigung, Abmeldung.
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createNewsletterHandler } from "./handler.ts";

Deno.serve(createNewsletterHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
