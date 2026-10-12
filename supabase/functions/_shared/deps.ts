import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createRpc, createSupabase, type Rpc } from "./db.ts";
import type { FunctionEnv } from "./env.ts";
import { createStripe } from "./stripe.ts";
import type { SendConfig } from "./email/send.ts";
import type { ShopInfo } from "./email/layout.ts";

export interface Deps {
  env: FunctionEnv;
  rpc: Rpc;
  /** Client mit Server-Schlüssel (Auth-Admin, RPC) */
  service: SupabaseClient;
  /** Client mit öffentlichem Schlüssel (Token prüfen) */
  authClient: SupabaseClient;
  stripe: Stripe;
  mail: SendConfig;
  shop: ShopInfo;
  now: () => Date;
}

export function createDeps(env: FunctionEnv, overrides: Partial<Deps> = {}): Deps {
  const service = createSupabase(env.supabaseUrl, env.serviceKey);
  return {
    env,
    service,
    rpc: createRpc(service),
    authClient: createSupabase(env.supabaseUrl, env.publicKey),
    stripe: createStripe(env.stripeSecretKey || "sk_test_missing", env.stripeApiBase),
    mail: {
      apiKey: env.resendApiKey,
      from: env.emailFrom,
      replyTo: env.shopContactEmail || undefined,
      baseUrl: env.resendApiBase,
    },
    shop: {
      name: env.shopName,
      siteUrl: env.siteUrl,
      contactEmail: env.shopContactEmail,
      address: env.shopAddress,
    },
    now: () => new Date(),
    ...overrides,
  };
}
