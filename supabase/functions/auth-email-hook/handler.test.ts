import { randomBytes, randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeps } from "../_shared/deps.ts";
import { readEnv } from "../_shared/env.ts";
import { ANON_KEY, SERVICE_KEY, startFakeResend } from "../../tests/fakes/servers";
import { createAuthEmailHookHandler, type HookPayload } from "./handler.ts";

const SECRET = `v1,whsec_${randomBytes(32).toString("base64")}`;
let resend: Awaited<ReturnType<typeof startFakeResend>>;
let handler: (req: Request) => Promise<Response>;

function makeHandler(overrides: Record<string, string> = {}) {
  const env = readEnv(
    (k) =>
      ({
        SUPABASE_URL: "https://ref.supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: ANON_KEY,
        SITE_URL: "https://shop.test",
        RESEND_API_KEY: "re_test",
        RESEND_API_BASE: resend.url,
        SEND_EMAIL_HOOK_SECRET: SECRET,
        SHOP_CONTACT_EMAIL: "hallo@shop.test",
        ...overrides,
      })[k],
  );
  return createAuthEmailHookHandler(createDeps(env));
}

beforeAll(async () => {
  resend = await startFakeResend();
  handler = makeHandler();
});

afterAll(async () => {
  await resend.close();
});

function payload(
  type: string,
  opts: {
    locale?: string;
    redirect?: string;
    user?: Partial<HookPayload["user"]>;
    data?: Partial<HookPayload["email_data"]>;
  } = {},
): HookPayload {
  return {
    user: {
      id: randomUUID(),
      email: "anna@example.ch",
      user_metadata: { locale: opts.locale ?? "de" },
      ...opts.user,
    },
    email_data: {
      token: "123456",
      token_hash: "hash-abc",
      redirect_to: opts.redirect ?? "https://shop.test/konto",
      email_action_type: type,
      site_url: "https://shop.test",
      token_new: "",
      token_hash_new: "",
      ...opts.data,
    },
  };
}

async function deliver(body: HookPayload, h = handler, secret = SECRET) {
  const raw = JSON.stringify(body);
  const id = `msg_${randomUUID()}`;
  const signature = new Webhook(secret.replace(/^v1,/, "")).sign(id, new Date(), raw);
  const res = await h(
    new Request("https://fn.test/auth-email-hook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": id,
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": signature,
      },
      body: raw,
    }),
  );
  return { res, id };
}

function sentSince(before: number) {
  return resend.sent.slice(before);
}

describe("auth-email-hook: Sicherheit", () => {
  it("falsche Signatur: 401 im Format von Supabase", async () => {
    const other = `v1,whsec_${randomBytes(32).toString("base64")}`;
    const { res } = await deliver(payload("signup"), handler, other);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { http_code: 401, message: "Ungültige Signatur" } });
  });

  it("ohne Secret: 500 statt ungeprüft zu senden", async () => {
    const { res } = await deliver(payload("signup"), makeHandler({ SEND_EMAIL_HOOK_SECRET: "" }));
    expect(res.status).toBe(500);
  });
});

describe("auth-email-hook: Links und Sprache", () => {
  it("Registrierung DE: Bestätigungslink auf die Shop-Seite mit token_hash, Typ und Zielseite", async () => {
    const before = resend.sent.length;
    const { res, id } = await deliver(payload("signup"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    const [mail] = sentSince(before);
    expect(mail!.to).toEqual(["anna@example.ch"]);
    expect(mail!.subject).toBe("Bestätige dein Axion-Konto");
    expect(mail!.text).toContain(
      "https://shop.test/konto/bestaetigen?token_hash=hash-abc&type=signup&next=%2Fkonto",
    );
    expect(mail!.html).toContain(
      "https://shop.test/konto/bestaetigen?token_hash=hash-abc&amp;type=signup&amp;next=%2Fkonto",
    );
    expect(mail!.idempotencyKey).toBe(`auth-${id}-0`);
  });

  it("Passwort vergessen von der englischen Seite: englische E-Mail, /en-Link, Ziel ohne Sprachpräfix", async () => {
    const before = resend.sent.length;
    await deliver(
      payload("recovery", { locale: "de", redirect: "https://shop.test/en/konto/passwort-neu" }),
    );
    const [mail] = sentSince(before);
    expect(mail!.subject).toBe("New password for your Axion account");
    expect(mail!.text).toContain(
      "https://shop.test/en/konto/bestaetigen?token_hash=hash-abc&type=recovery&next=%2Fkonto%2Fpasswort-neu",
    );
  });

  it("Ziel nur Startseite: Sprache aus dem Konto (user_metadata.locale)", async () => {
    const before = resend.sent.length;
    await deliver(payload("magiclink", { locale: "en", redirect: "https://shop.test/" }));
    const [mail] = sentSince(before);
    expect(mail!.subject).toBe("Your Axion sign-in link");
    expect(mail!.text).toContain(
      "https://shop.test/en/konto/bestaetigen?token_hash=hash-abc&type=magiclink\n",
    );
  });

  it("fremde Redirect-Domain wird ignoriert: Link geht auf SITE_URL", async () => {
    const before = resend.sent.length;
    await deliver(payload("signup", { redirect: "https://boese.example/klau" }));
    const [mail] = sentSince(before);
    expect(mail!.text).toContain(
      "https://shop.test/konto/bestaetigen?token_hash=hash-abc&type=signup\n",
    );
    expect(mail!.text).not.toContain("boese.example");
  });

  it("Lovable-Vorschau als Redirect: Link bleibt in der Vorschau", async () => {
    const before = resend.sent.length;
    await deliver(payload("signup", { redirect: "https://id-preview--abc.lovable.app/konto" }));
    expect(sentSince(before)[0]!.text).toContain(
      "https://id-preview--abc.lovable.app/konto/bestaetigen?token_hash=hash-abc&type=signup",
    );
  });
});

describe("auth-email-hook: E-Mail-Adresse ändern", () => {
  it("mit «Secure email change»: je eine E-Mail an alte und neue Adresse mit den richtigen Hashes", async () => {
    const before = resend.sent.length;
    await deliver(
      payload("email_change", {
        user: { email: "alt@example.ch", new_email: "neu@example.ch" },
        data: {
          token: "111111",
          token_hash: "hash-fuer-neu",
          token_new: "222222",
          token_hash_new: "hash-fuer-alt",
        },
      }),
    );
    const mails = sentSince(before);
    expect(mails.map((m) => m.to[0])).toEqual(["alt@example.ch", "neu@example.ch"]);
    expect(mails[0]!.subject).toBe("Änderung deiner E-Mail-Adresse bestätigen");
    expect(mails[0]!.text).toContain("neu@example.ch");
    expect(mails[0]!.text).toContain("token_hash=hash-fuer-alt&type=email_change");
    expect(mails[1]!.subject).toBe("Neue E-Mail-Adresse bestätigen");
    expect(mails[1]!.text).toContain("token_hash=hash-fuer-neu&type=email_change");
  });

  it("ohne «Secure email change»: eine E-Mail an die neue Adresse", async () => {
    const before = resend.sent.length;
    await deliver(
      payload("email_change", {
        user: { email: "alt@example.ch", new_email: "neu@example.ch" },
        data: { token_hash: "nur-ein-hash" },
      }),
    );
    const mails = sentSince(before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toEqual(["neu@example.ch"]);
    expect(mails[0]!.text).toContain("token_hash=nur-ein-hash&type=email_change");
  });
});

describe("auth-email-hook: Code und Sicherheitshinweise", () => {
  it("Reauthentifizierung: nur der Code, kein Link", async () => {
    const before = resend.sent.length;
    await deliver(payload("reauthentication", { data: { token: "654321" } }));
    const [mail] = sentSince(before);
    expect(mail!.subject).toBe("Dein Bestätigungscode");
    expect(mail!.text).toContain("654321");
    expect(mail!.text).not.toContain("bestaetigen?");
  });

  it("Passwort geändert: Hinweis an die Kontoadresse mit Link zum Zurücksetzen", async () => {
    const before = resend.sent.length;
    await deliver(payload("password_changed_notification", { redirect: "" }));
    const [mail] = sentSince(before);
    expect(mail!.to).toEqual(["anna@example.ch"]);
    expect(mail!.subject).toBe("Dein Passwort wurde geändert");
    expect(mail!.text).toContain("https://shop.test/konto/passwort-vergessen");
    expect(mail!.text).toContain("hallo@shop.test");
  });

  it("E-Mail geändert: Hinweis an die alte Adresse mit beiden Adressen", async () => {
    const before = resend.sent.length;
    await deliver(
      payload("email_changed_notification", {
        locale: "en",
        redirect: "",
        user: { email: "neu@example.ch" },
        data: { old_email: "alt@example.ch" },
      }),
    );
    const [mail] = sentSince(before);
    expect(mail!.to).toEqual(["alt@example.ch"]);
    expect(mail!.subject).toBe("Your email address was changed");
    expect(mail!.text).toContain("from alt@example.ch to neu@example.ch");
  });

  it("andere Sicherheitshinweise: allgemeiner Text", async () => {
    const before = resend.sent.length;
    await deliver(payload("mfa_factor_enrolled_notification", { redirect: "" }));
    expect(sentSince(before)[0]!.subject).toBe("Sicherheitshinweis zu deinem Axion-Konto");
  });
});

describe("auth-email-hook: Fehler", () => {
  it("unbekannter Typ: 400, keine E-Mail", async () => {
    const before = resend.sent.length;
    const { res } = await deliver(payload("irgendwas_neues"));
    expect(res.status).toBe(400);
    expect(resend.sent.length).toBe(before);
  });

  it("Versand scheitert: 500, damit Supabase den Fehler anzeigt", async () => {
    resend.failNext();
    const { res } = await deliver(payload("signup"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { http_code: 500, message: "E-Mail konnte nicht gesendet werden" },
    });
  });
});
