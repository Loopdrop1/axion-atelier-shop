// Datenbankzugriff der Edge Functions: nur über RPC-Funktionen (siehe supabase/migrations).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class RpcError extends Error {
  constructor(
    readonly code: string,
    readonly detail: unknown,
    readonly pgCode?: string,
  ) {
    super(code);
  }
}

export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

function parseDetail(detail: unknown): unknown {
  if (typeof detail !== "string" || !detail) return detail ?? null;
  try {
    return JSON.parse(detail);
  } catch {
    return detail;
  }
}

export function createSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "axion-edge" } },
  });
}

export function createRpc(client: SupabaseClient): Rpc {
  return async <T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await client.rpc(fn as never, args as never);
    if (error) throw new RpcError(error.message, parseDetail(error.details), error.code);
    return data as T;
  };
}
