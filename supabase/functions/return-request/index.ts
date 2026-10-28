// Edge Function «return-request»: Retoure anmelden (lookup, submit). Die Logik steckt in handler.ts;
// hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createReturnRequestHandler } from "./handler.ts";

Deno.serve(createReturnRequestHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
