// Edge Function «stock-alert»: «Benachrichtigen, wenn wieder da» mit Double Opt-in (anlegen, bestätigen).
// Die Logik steckt in handler.ts; hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createStockAlertHandler } from "./handler.ts";

Deno.serve(createStockAlertHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
