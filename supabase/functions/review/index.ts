// Edge Function «review»: Kundenbewertung abgeben (lookup, submit). Die Logik steckt in handler.ts;
// hier wird sie nur mit den Secrets verbunden.
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { createReviewHandler } from "./handler.ts";

Deno.serve(createReviewHandler(createDeps(readEnv((key) => Deno.env.get(key)))));
