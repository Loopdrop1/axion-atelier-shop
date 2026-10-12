// Edge Function «contact»: Kontaktformular. Die Nachricht geht als E-Mail an den Shop (Antwort per Reply-To).
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createContactHandler } from "./handler.ts";

Deno.serve(createContactHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
