// Edge Function «client-error»: technische Fehlerberichte aus dem Browser (ohne Personendaten).
// Die Logik steckt in handler.ts; hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createClientErrorHandler } from "./handler.ts";

Deno.serve(createClientErrorHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
