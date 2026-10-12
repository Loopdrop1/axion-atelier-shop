// Kontaktformular: prüft die Eingaben, bremst Missbrauch (contact_guard) und schickt die Nachricht als E-Mail an den
// Shop. Antworten gehen per Reply-To direkt an die Kundschaft. Der Shop speichert die Nachricht nicht.
import type { Deps } from "../_shared/deps.ts";
import { sendEmail } from "../_shared/email/send.ts";
import { contactMessage } from "../_shared/email/templates.ts";
import { clientIp, HttpError, json, readJson, str, withHttp } from "../_shared/http.ts";
import { toLocale } from "../_shared/money.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

export function createContactHandler(deps: Deps) {
  return withHttp(deps.env.allowedOrigins, async (req) => {
    const body = await readJson(req);
    // Verstecktes Feld: von Menschen leer gelassen, von Bots oft ausgefüllt. Bots bekommen «gesendet».
    if (str(body["website"])) return json(200, { sent: true });
    const name = str(body["name"], 100)?.replace(/\s+/g, " ");
    if (!name) throw new HttpError(400, "NAME_REQUIRED");
    const email = str(body["email"], 254)?.toLowerCase();
    if (!email || !EMAIL.test(email)) throw new HttpError(400, "INVALID_EMAIL");
    const message = typeof body["message"] === "string" ? body["message"].trim() : "";
    if (message.length < MESSAGE_MIN) throw new HttpError(400, "MESSAGE_TOO_SHORT");
    if (message.length > MESSAGE_MAX) throw new HttpError(400, "MESSAGE_TOO_LONG");
    const to = deps.env.shopContactEmail || deps.env.shopNotifyEmail;
    if (!to) throw new HttpError(503, "NOT_CONFIGURED");
    const guard = await deps.rpc<string>("contact_guard", { p_email: email, p_ip: clientIp(req) });
    if (guard !== "ok") throw new HttpError(429, "RATE_LIMITED");
    try {
      await sendEmail(
        to,
        contactMessage({ name, email, message, locale: toLocale(body["locale"]) }, deps.shop),
        { ...deps.mail, replyTo: email },
      );
    } catch (error) {
      console.error("Kontakt-E-Mail fehlgeschlagen", error);
      throw new HttpError(502, "EMAIL_FAILED");
    }
    return json(200, { sent: true });
  });
}
