// Kundenbewertung abgeben (Seite /bewertung/<schlüssel> aus der Versandmeldung). Schritt «lookup»: Stücke der
// Bestellung; Schritt «submit»: eine Bewertung für ein Stück speichern (erscheint erst nach Freigabe im Admin).
// Regeln (Schalter shop_settings.reviews_enabled, Gültigkeit des Links, eine Bewertung pro Stück, Bremsen pro IP und
// Bestellung) stehen in den RPCs review_lookup / review_submit; hier nur Eingaben und Antworten.
// Ist der Schalter aus, antwortet die Funktion immer REVIEWS_DISABLED (409). Unbekannter oder abgelaufener Link:
// einheitlich NOT_FOUND.
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { clientIp, HttpError, json, readJson, str, UUID, withHttp } from "../_shared/http.ts";
import { toLocale } from "../_shared/money.ts";
import { pruneRateLimitsSometimes } from "../_shared/rate-limits.ts";
import { parseReview, REVIEW_TOKEN } from "../_shared/reviews.ts";

interface ReviewItem {
  order_item_id: string;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  handle: string | null;
  reviewed: boolean;
}

interface RpcResult {
  status:
    "ok" | "disabled" | "rate_limited" | "not_found" | "invalid" | "invalid_item" | "duplicate";
  number?: number;
  locale?: string;
  items?: ReviewItem[];
}

function token(body: Record<string, unknown>): string {
  const value = str(body["token"], 64)?.toLowerCase();
  if (!value || !REVIEW_TOKEN.test(value)) throw new HttpError(404, "NOT_FOUND");
  return value;
}

/** Status der RPC → HTTP-Fehler. «ok» wirft nicht. */
function failFor(status: RpcResult["status"]): void {
  switch (status) {
    case "ok":
      return;
    case "disabled":
      throw new HttpError(409, "REVIEWS_DISABLED");
    case "rate_limited":
      throw new HttpError(429, "RATE_LIMITED");
    case "invalid":
      throw new HttpError(400, "INVALID_REVIEW");
    case "invalid_item":
      throw new HttpError(409, "ITEM_NOT_REVIEWABLE");
    case "duplicate":
      throw new HttpError(409, "ALREADY_REVIEWED");
    default:
      throw new HttpError(404, "NOT_FOUND");
  }
}

const items = (list: ReviewItem[] | undefined) =>
  (list ?? []).map((i) => ({
    orderItemId: i.order_item_id,
    title: i.title,
    size: i.size,
    color: i.color,
    image: i.image,
    handle: i.handle,
    reviewed: i.reviewed,
  }));

async function lookup(deps: Deps, req: Request, body: Record<string, unknown>): Promise<Response> {
  const result = await deps.rpc<RpcResult>("review_lookup", {
    p_token: token(body),
    p_ip: clientIp(req),
  });
  await pruneRateLimitsSometimes(deps);
  failFor(result.status);
  return json(200, {
    status: "ok",
    orderNumber: result.number,
    locale: toLocale(result.locale),
    items: items(result.items),
  });
}

async function submit(deps: Deps, req: Request, body: Record<string, unknown>): Promise<Response> {
  const key = token(body);
  const orderItemId = str(body["orderItemId"], 36);
  if (!orderItemId || !UUID.test(orderItemId)) throw new HttpError(400, "BAD_REQUEST");
  const review = parseReview(body);
  if (!review) throw new HttpError(400, "INVALID_REVIEW");
  const result = await deps
    .rpc<RpcResult>("review_submit", {
      p_token: key,
      p_order_item_id: orderItemId,
      p_rating: review.rating,
      p_title: review.title,
      p_body: review.body,
      p_display_name: review.displayName,
      p_locale: toLocale(body["locale"]),
      p_ip: clientIp(req),
    })
    .catch((error: unknown) => {
      // Werte, die die Datenbank nicht umwandeln oder speichern kann
      if (error instanceof RpcError && ["22P02", "22023", "23514"].includes(error.pgCode ?? ""))
        throw new HttpError(400, "INVALID_REVIEW");
      throw error;
    });
  await pruneRateLimitsSometimes(deps);
  failFor(result.status);
  return json(200, { status: "ok", items: items(result.items) });
}

export function createReviewHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req, 10_000);
    // Verstecktes Feld: von Menschen leer gelassen, von Bots oft ausgefüllt.
    if (str(body["website"])) throw new HttpError(404, "NOT_FOUND");
    switch (body["action"]) {
      case "lookup":
        return lookup(deps, req, body);
      case "submit":
        return submit(deps, req, body);
      default:
        throw new HttpError(400, "BAD_REQUEST");
    }
  });
}
