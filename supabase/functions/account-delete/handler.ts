// Kundenkonto löschen: nur das eigene Konto (aus dem Anmelde-Token, nie aus dem Request-Body).
// Bestellungen bleiben für die Buchhaltung erhalten, verlieren aber die Verknüpfung zum Konto.
import { requireUser } from "../_shared/auth.ts";
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { HttpError, json, readJson, withHttp } from "../_shared/http.ts";

export function createAccountDeleteHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const user = await requireUser(req, deps.authClient);
    const body = await readJson(req, 2_000);
    if (body["confirm"] !== true) throw new HttpError(400, "CONFIRMATION_REQUIRED");
    const check = await deps
      .rpc<{ orders_kept: number }>("prepare_account_deletion", { p_user_id: user.id })
      .catch((error: unknown) => {
        if (error instanceof RpcError && error.code === "LAST_ADMIN")
          throw new HttpError(409, "LAST_ADMIN");
        if (error instanceof RpcError && error.code === "USER_NOT_FOUND")
          throw new HttpError(404, "USER_NOT_FOUND");
        throw error;
      });
    const { error } = await deps.service.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Konto löschen fehlgeschlagen", error.message);
      throw new HttpError(500, "DELETE_FAILED");
    }
    return json(200, { deleted: true, ordersKept: check.orders_kept });
  });
}
