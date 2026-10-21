// «Benachrichtigen, wenn wieder da»: Wunsch anlegen (Bestätigungs-E-Mail) und bestätigen.
// Die Antwort auf «request» verrät nie, ob eine Adresse schon eingetragen ist. Den Versand nach dem Aufstocken
// übernimmt «admin-actions» (notify_restock).
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { sendEmail } from "../_shared/email/send.ts";
import { stockAlertConfirm } from "../_shared/email/templates.ts";
import { clientIp, HttpError, json, readJson, str, UUID, withHttp } from "../_shared/http.ts";
import { toLocale } from "../_shared/money.ts";
import { pruneRateLimitsSometimes } from "../_shared/rate-limits.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN = /^[0-9a-f]{48}$/;

interface RequestResult {
  status: "pending" | "confirmed" | "rate_limited" | "in_stock" | "invalid";
  token?: string;
  email?: string;
  locale?: string;
  title?: string;
  color?: string;
  size?: string;
}

async function request(deps: Deps, req: Request, body: Record<string, unknown>): Promise<Response> {
  // Verstecktes Feld: von Menschen leer gelassen, von Bots oft ausgefüllt.
  if (str(body["website"])) return json(200, { ok: true });
  const email = str(body["email"], 254);
  if (!email || !EMAIL.test(email)) throw new HttpError(400, "INVALID_EMAIL");
  const variantId = str(body["variantId"], 36);
  if (!variantId || !UUID.test(variantId)) throw new HttpError(400, "BAD_REQUEST");
  const result = await deps
    .rpc<RequestResult>("stock_alert_request", {
      p_variant_id: variantId,
      p_email: email,
      p_locale: toLocale(body["locale"]),
      p_ip: clientIp(req),
    })
    .catch((error: unknown) => {
      if (error instanceof RpcError && error.code === "INVALID_EMAIL")
        throw new HttpError(400, "INVALID_EMAIL");
      throw error;
    });
  await pruneRateLimitsSometimes(deps);
  if (result.status === "rate_limited") throw new HttpError(429, "RATE_LIMITED");
  if (result.status === "invalid") throw new HttpError(404, "VARIANT_NOT_FOUND");
  if (result.status === "in_stock") throw new HttpError(409, "IN_STOCK");
  if (result.status === "pending" && result.token && result.email) {
    const locale = toLocale(result.locale);
    const prefix = locale === "en" ? "/en" : "";
    await sendEmail(
      result.email,
      stockAlertConfirm(
        {
          locale,
          confirmUrl: `${deps.env.siteUrl}${prefix}/benachrichtigung/bestaetigen?token=${result.token}`,
          item: { title: result.title ?? "", color: result.color ?? "", size: result.size ?? "" },
        },
        deps.shop,
      ),
      deps.mail,
    );
  }
  return json(200, { ok: true });
}

async function confirm(deps: Deps, body: Record<string, unknown>): Promise<Response> {
  const t = typeof body["token"] === "string" ? body["token"].trim().toLowerCase() : "";
  if (!TOKEN.test(t)) throw new HttpError(400, "INVALID_TOKEN");
  const result = await deps.rpc<{ status: "confirmed" | "invalid" }>("stock_alert_confirm", {
    p_token: t,
  });
  return json(200, { status: result.status });
}

export function createStockAlertHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req, 5_000);
    switch (body["action"]) {
      case "request":
        return request(deps, req, body);
      case "confirm":
        return confirm(deps, body);
      default:
        throw new HttpError(400, "BAD_REQUEST");
    }
  });
}
