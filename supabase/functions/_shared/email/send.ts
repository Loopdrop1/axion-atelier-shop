// Versand über Resend (https://resend.com/docs/api-reference/emails/send-email).
import type { EmailContent } from "./templates.ts";

export interface SendConfig {
  apiKey: string;
  from: string;
  replyTo?: string | undefined;
  baseUrl?: string | undefined;
  fetchImpl?: typeof fetch;
}

export class EmailError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Schickt eine E-Mail. idempotencyKey verhindert Doppelversand bei Wiederholungen (24 h). */
export async function sendEmail(
  to: string,
  content: EmailContent,
  cfg: SendConfig,
  idempotencyKey?: string,
): Promise<{ id: string }> {
  if (!cfg.apiKey) throw new EmailError(500, "RESEND_API_KEY fehlt");
  const res = await (cfg.fetchImpl ?? fetch)(`${(cfg.baseUrl ?? "https://api.resend.com").replace(/\/+$/, "")}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [to],
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new EmailError(res.status, `Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string };
}
