import Stripe from "stripe";

/** Stripe-Client mit Fetch (läuft in Deno und Node). apiBase nur für Tests. */
export function createStripe(secretKey: string, apiBase?: string): Stripe {
  const config: ConstructorParameters<typeof Stripe>[1] = {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 15_000,
    appInfo: { name: "Axion Shop", url: "https://flowrenix.com" },
  };
  if (apiBase) {
    const u = new URL(apiBase);
    Object.assign(config, { host: u.hostname, port: Number(u.port || (u.protocol === "https:" ? 443 : 80)), protocol: u.protocol.replace(":", "") });
  }
  return new Stripe(secretKey, config);
}

export const stripeCrypto = Stripe.createSubtleCryptoProvider();

/** Festes Kennzeichen für Checkout-Sessions dieses Shops (Stripe empfiehlt 8 zufällige Buchstaben als Suffix). */
export const INTEGRATION_ID = "axion_shop_checkout_QZKMRWTB";

export type { Stripe };
