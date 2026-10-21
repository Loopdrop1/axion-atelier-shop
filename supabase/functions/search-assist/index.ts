// Edge Function «search-assist»: KI-Suche, übersetzt längere Suchanfragen in Filter des Shops.
// Die Logik steckt in handler.ts; hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createSearchAssistHandler } from "./handler.ts";

Deno.serve(createSearchAssistHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
