// Edge Function «account-delete»: Kundenkonto löschen (nur das eigene).
// Die Logik steckt in handler.ts (mit Tests in handler.test.ts); hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createAccountDeleteHandler } from "./handler.ts";

Deno.serve(createAccountDeleteHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
