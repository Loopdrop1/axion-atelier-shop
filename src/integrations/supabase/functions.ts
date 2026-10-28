// Aufruf der Edge Functions (supabase/functions) mit einheitlicher Fehlerform.
// Die Funktionen antworten bei Fehlern mit { error: "CODE", ... } und passendem HTTP-Status.
import { backendConfigured } from "@/lib/backend";
import { getSupabase } from "@/lib/supabase-client";

export type FunctionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; body: Record<string, unknown> };

export type FunctionName =
  | "checkout"
  | "newsletter"
  | "admin-actions"
  | "account-delete"
  | "contact"
  | "stock-alert"
  | "search-assist"
  | "client-error"
  | "return-request";

export async function callFunction<T>(
  name: FunctionName,
  body: unknown,
): Promise<FunctionResult<T>> {
  if (!backendConfigured) return { ok: false, status: 0, error: "NOT_CONFIGURED", body: {} };
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke<T>(name, {
      body: body as Record<string, unknown>,
    });
    if (!error) return { ok: true, data: data as T };
    // FunctionsHttpError des Clients, ohne ihn für den Vergleich laden zu müssen
    if (error.name === "FunctionsHttpError") {
      const response = (error as { context: Response }).context;
      const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: false,
        status: response.status,
        error: typeof parsed["error"] === "string" ? parsed["error"] : "INTERNAL",
        body: parsed,
      };
    }
    return { ok: false, status: 0, error: "NETWORK", body: {} };
  } catch {
    return { ok: false, status: 0, error: "NETWORK", body: {} };
  }
}
