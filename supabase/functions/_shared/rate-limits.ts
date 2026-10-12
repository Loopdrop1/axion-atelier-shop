// Zähler der Missbrauchsbremsen aufräumen: gelegentlich (Standard bei 5 % der Anfragen) und in eigener Transaktion
// (RPC prune_rate_limits), damit das Löschen nie mit einer laufenden Bremse kollidiert. Fehler sind hier egal.
import type { Deps } from "./deps.ts";

export async function pruneRateLimitsSometimes(
  deps: Pick<Deps, "rpc">,
  chance = 0.05,
  random: () => number = Math.random,
): Promise<void> {
  if (random() >= chance) return;
  try {
    await deps.rpc("prune_rate_limits");
  } catch (error) {
    console.error("Zähler der Missbrauchsbremsen: Aufräumen fehlgeschlagen", error);
  }
}
