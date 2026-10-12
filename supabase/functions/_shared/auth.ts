import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./http.ts";
import type { Rpc } from "./db.ts";

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Liest den eingeloggten Benutzer aus dem Authorization-Header. Kein oder ungültiges Token: null. */
export async function getUser(req: Request, authClient: SupabaseClient): Promise<AuthUser | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.split(".").length !== 3) return null;
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(req: Request, authClient: SupabaseClient): Promise<AuthUser> {
  const user = await getUser(req, authClient);
  if (!user) throw new HttpError(401, "UNAUTHORIZED");
  return user;
}

export async function requireAdmin(req: Request, authClient: SupabaseClient, rpc: Rpc): Promise<AuthUser> {
  const user = await requireUser(req, authClient);
  const isAdmin = await rpc<boolean>("user_is_admin", { p_user_id: user.id });
  if (!isAdmin) throw new HttpError(403, "FORBIDDEN");
  return user;
}
