// Retoure anmelden. Schritt 1 «lookup»: Bestellnummer + E-Mail → zurückgebbare Stücke. Schritt 2 «submit»: Auswahl
// speichern, Bestätigung an die Kundschaft, Meldung an den Shop. Die Regeln (Status, Frist, Mengen, Bremsen) stehen
// in den RPCs return_lookup / return_submit; hier nur Eingaben, Antworten und E-Mails.
// Die Antwort verrät nie, ob eine Bestellung existiert: unbekannte Nummer und falsche Adresse sind beide NOT_FOUND.
import type { Deps } from "../_shared/deps.ts";
import { RpcError } from "../_shared/db.ts";
import { sendEmail } from "../_shared/email/send.ts";
import { returnConfirmation, returnNotification } from "../_shared/email/returns.ts";
import { clientIp, HttpError, json, readJson, str, UUID, withHttp } from "../_shared/http.ts";
import { toLocale } from "../_shared/money.ts";
import { pruneRateLimitsSometimes } from "../_shared/rate-limits.ts";
import {
  MAX_RETURN_COMMENT,
  parseOrderNumber,
  parseReturnItems,
  returnRef,
} from "../_shared/returns.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface OpenItem {
  order_item_id: string;
  title: string;
  size: string | null;
  color: string | null;
  image: string | null;
  quantity: number;
}

interface LookupResult {
  status: "ok" | "not_found" | "expired" | "nothing_returnable" | "rate_limited";
  number?: number;
  locale?: string;
  deadline?: string;
  return_days?: number;
  items?: OpenItem[];
}

interface SubmitResult {
  status: LookupResult["status"] | "invalid_items";
  duplicate?: boolean;
  id?: string;
  number?: number;
  order_number?: number;
  email?: string;
  locale?: string;
  comment?: string | null;
  return_days?: number;
  items?: {
    order_item_id: string;
    title: string;
    size: string | null;
    color: string | null;
    quantity: number;
    reason: string;
  }[];
}

/** Gemeinsame Eingaben: Bestellnummer und E-Mail-Adresse (Fehler einheitlich, ohne Hinweis auf Bestellungen). */
function credentials(body: Record<string, unknown>): { orderNumber: number; email: string } {
  const orderNumber = parseOrderNumber(body["orderNumber"]);
  const email = str(body["email"], 254)?.toLowerCase();
  if (orderNumber === null || !email || !EMAIL.test(email)) throw new HttpError(400, "BAD_REQUEST");
  return { orderNumber, email };
}

/** Status der RPC → HTTP-Fehler. «ok» wirft nicht. */
function failFor(result: { status: string; return_days?: number | undefined }): void {
  switch (result.status) {
    case "ok":
      return;
    case "rate_limited":
      throw new HttpError(429, "RATE_LIMITED");
    case "expired":
      throw new HttpError(409, "RETURN_WINDOW_CLOSED", { returnDays: result.return_days ?? null });
    case "nothing_returnable":
      throw new HttpError(409, "NOTHING_RETURNABLE");
    case "invalid_items":
      throw new HttpError(409, "ITEMS_NOT_RETURNABLE");
    default:
      throw new HttpError(404, "NOT_FOUND");
  }
}

async function lookup(deps: Deps, req: Request, body: Record<string, unknown>): Promise<Response> {
  const { orderNumber, email } = credentials(body);
  const result = await deps.rpc<LookupResult>("return_lookup", {
    p_order_number: orderNumber,
    p_email: email,
    p_ip: clientIp(req),
    p_days: deps.env.shopReturnDays,
  });
  await pruneRateLimitsSometimes(deps);
  failFor({ status: result.status, return_days: result.return_days });
  return json(200, {
    status: "ok",
    orderNumber: result.number,
    deadline: result.deadline,
    items: (result.items ?? []).map((i) => ({
      orderItemId: i.order_item_id,
      title: i.title,
      size: i.size,
      color: i.color,
      image: i.image,
      quantity: i.quantity,
    })),
  });
}

async function notifyAddress(deps: Deps): Promise<string> {
  const fromDb = await deps.rpc<string | null>("get_shop_notify_email").catch(() => null);
  return fromDb || deps.env.shopNotifyEmail || deps.env.shopContactEmail;
}

async function submit(deps: Deps, req: Request, body: Record<string, unknown>): Promise<Response> {
  const { orderNumber, email } = credentials(body);
  const items = parseReturnItems(body["items"]);
  if (!items) throw new HttpError(400, "BAD_REQUEST");
  const rawComment = typeof body["comment"] === "string" ? body["comment"].trim() : "";
  if (rawComment.length > MAX_RETURN_COMMENT) throw new HttpError(400, "COMMENT_TOO_LONG");
  const requestId = str(body["requestId"], 36);
  if (requestId !== undefined && !UUID.test(requestId)) throw new HttpError(400, "BAD_REQUEST");
  const result = await deps
    .rpc<SubmitResult>("return_submit", {
      p_order_number: orderNumber,
      p_email: email,
      p_items: items.map((i) => ({
        order_item_id: i.orderItemId,
        quantity: i.quantity,
        reason: i.reason,
      })),
      p_comment: rawComment || null,
      p_locale: toLocale(body["locale"]),
      p_ip: clientIp(req),
      p_days: deps.env.shopReturnDays,
      p_request_id: requestId ?? null,
    })
    .catch((error: unknown) => {
      // Ungültige Positions-IDs oder Mengen, die die Datenbank nicht umwandeln kann
      if (error instanceof RpcError && ["22P02", "22023"].includes(error.pgCode ?? ""))
        throw new HttpError(409, "ITEMS_NOT_RETURNABLE");
      throw error;
    });
  await pruneRateLimitsSometimes(deps);
  failFor(result);

  const locale = toLocale(result.locale);
  const id = result.id ?? "";
  const mail = {
    locale,
    returnNumber: result.number ?? 0,
    orderNumber: result.order_number ?? orderNumber,
    email: result.email ?? email,
    items: result.items ?? [],
    comment: result.comment ?? null,
  };
  // Beide Mails mit Idempotency-Key; scheitert eine, ist die Anmeldung trotzdem gespeichert (sichtbar im Admin).
  let emailed = true;
  try {
    await sendEmail(
      mail.email,
      returnConfirmation(mail, deps.shop),
      deps.mail,
      `return-${id}-customer`,
    );
  } catch (error) {
    emailed = false;
    console.error("Retoure: Bestätigung fehlgeschlagen", error);
  }
  try {
    const to = await notifyAddress(deps);
    if (to)
      await sendEmail(
        to,
        returnNotification(mail, deps.shop, `${deps.env.siteUrl}/admin/retouren`),
        { ...deps.mail, replyTo: mail.email },
        `return-${id}-shop`,
      );
  } catch (error) {
    console.error("Retoure: Meldung an den Shop fehlgeschlagen", error);
  }
  return json(200, {
    status: "ok",
    returnNumber: returnRef(mail.returnNumber),
    orderNumber: mail.orderNumber,
    emailed,
  });
}

export function createReturnRequestHandler(deps: Deps) {
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
