import { beforeEach, describe, expect, it } from "vitest";
import {
  buildLabelRequest,
  createPostLabel,
  mapPostErrors,
  parseLabelResponse,
  parseSender,
  PostError,
  resetPostTokenCache,
  type PostOrder,
  type SwissPostConfig,
} from "./swiss-post.ts";

// Alles gegen einen Fake: Die echte Post-API ist nicht getestet (kein Geschäftskundenkonto).
const sender = parseSender("Axion", "Musterstrasse 1, 8000 Zürich");
const order: PostOrder = {
  number: 10042,
  email: "anna@example.ch",
  phone: "+41 79 000 00 00",
  shipping_name: "Anna Muster",
  shipping_address: {
    line1: "Bahnhofstrasse 1",
    line2: "c/o Meier",
    postal_code: "8001",
    city: "Zürich",
    country: "CH",
  },
};

interface Call {
  url: string;
  init: RequestInit;
}

function fakePost(script: (call: Call, n: number) => Response) {
  const calls: Call[] = [];
  const cfg: SwissPostConfig = {
    clientId: "id",
    clientSecret: "secret",
    frankingLicense: "60000000",
    product: "ECO",
    sendRecipientContact: false,
    sleep: async () => undefined,
    fetchImpl: (async (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return script(call, calls.length);
    }) as typeof fetch,
  };
  return { calls, cfg };
}

const token = (value = "tok", expires = 3600) =>
  new Response(JSON.stringify({ access_token: value, expires_in: expires }), { status: 200 });
const labelOk = () =>
  new Response(
    JSON.stringify({ item: { identCode: "99.60.123456.12345678", label: ["UERG"] }, warnings: [] }),
    { status: 200 },
  );
const isToken = (c: Call) => c.url.includes("/OAuth/token");
const reply = (c: Call, label: () => Response) => (isToken(c) ? token() : label());

beforeEach(() => resetPostTokenCache());

describe("buildLabelRequest", () => {
  it("baut die Anfrage laut Vorgabe (Inland ohne Land, ohne Kontaktdaten, Produkt aus der Konfiguration)", () => {
    const { cfg } = fakePost(() => token());
    const req = buildLabelRequest({ ...cfg, product: "PRI" }, order, sender);
    expect(req).toEqual({
      language: "DE",
      frankingLicense: "60000000",
      ppFranking: false,
      customer: {
        name1: "Axion",
        street: "Musterstrasse 1",
        zip: "8000",
        city: "Zürich",
        country: "CH",
      },
      customerSystem: "AXION",
      labelDefinition: {
        labelLayout: "A6",
        printAddresses: "RECIPIENT_AND_CUSTOMER",
        imageFileType: "PDF",
        imageResolution: 300,
        printPreview: false,
      },
      item: {
        itemID: "AX-10042",
        recipient: {
          name1: "Anna Muster",
          street: "Bahnhofstrasse 1, c/o Meier",
          zip: "8001",
          city: "Zürich",
        },
        attributes: { przl: ["PRI"] },
      },
    });
  });

  it("Liechtenstein mit Land; Telefon und E-Mail nur mit Freigabe; sendingID nur wenn angegeben", () => {
    const { cfg } = fakePost(() => token());
    const li = { ...order, shipping_address: { ...order.shipping_address!, country: "li" } };
    const req = buildLabelRequest({ ...cfg, sendRecipientContact: true }, li, sender, {
      sendingId: "S-1",
    });
    expect(req.item.recipient).toMatchObject({
      country: "LI",
      phone: "+41 79 000 00 00",
      email: "anna@example.ch",
    });
    expect(req.sendingID).toBe("S-1");
    expect(buildLabelRequest(cfg, li, sender).item.recipient).not.toHaveProperty("phone");
  });

  it("unvollständige Adresse: POST_ADDRESS_INVALID", () => {
    const { cfg } = fakePost(() => token());
    const bad = { ...order, shipping_address: { ...order.shipping_address!, postal_code: "" } };
    expect(() => buildLabelRequest(cfg, bad, sender)).toThrow(PostError);
    expect(() => buildLabelRequest(cfg, { ...order, shipping_address: null }, sender)).toThrow(
      "POST_ADDRESS_INVALID",
    );
  });
});

describe("parseSender", () => {
  it("liest «Strasse Nr, PLZ Ort», sonst POST_SENDER_INVALID", () => {
    expect(parseSender("Axion", "Gasse 5, 3011 Bern")).toMatchObject({
      street: "Gasse 5",
      zip: "3011",
      city: "Bern",
    });
    expect(() => parseSender("Axion", "")).toThrow("POST_SENDER_INVALID");
    expect(() => parseSender("Axion", "Zürich")).toThrow("POST_SENDER_INVALID");
  });
});

describe("parseLabelResponse / mapPostErrors", () => {
  it("liest identCode und erstes Etikett, Warnungen als Codes", () => {
    expect(
      parseLabelResponse({
        item: { identCode: " 99.1 ", label: ["QUJD"] },
        warnings: [{ code: "W1", message: "x" }],
      }),
    ).toEqual({ identCode: "99.1", labelPdfBase64: "QUJD", warnings: ["W1"] });
  });

  it("Fehlerliste oder fehlendes Etikett wirft", () => {
    expect(() => parseLabelResponse({ errors: [{ code: "E0100", message: "boom" }] })).toThrow(
      "POST_REJECTED",
    );
    expect(() => parseLabelResponse({ item: { identCode: "x", label: [] } })).toThrow(
      "POST_BAD_RESPONSE",
    );
    expect(() => parseLabelResponse(null)).toThrow("POST_BAD_RESPONSE");
  });

  it("übersetzt Fehler der Post in klare Codes", () => {
    expect(mapPostErrors([{ code: "E9994" }]).code).toBe("POST_UNAVAILABLE");
    expect(mapPostErrors([{ code: "E1", message: "Invalid franking licence" }]).code).toBe(
      "POST_LICENSE_INVALID",
    );
    expect(mapPostErrors([{ code: "E2", message: "recipient zip unknown" }]).code).toBe(
      "POST_ADDRESS_INVALID",
    );
    expect(mapPostErrors([{ code: "E3", message: "other" }]).detail).toEqual(["E3"]);
  });
});

describe("createPostLabel", () => {
  it("holt ein Token (Formular mit client_credentials und Scope) und erzeugt das Etikett", async () => {
    const { cfg, calls } = fakePost((c) => reply(c, labelOk));
    const label = await createPostLabel(cfg, order, sender);
    expect(label.identCode).toBe("99.60.123456.12345678");
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe("https://api.post.ch/OAuth/token");
    const form = new URLSearchParams(String(calls[0]!.init.body));
    expect(Object.fromEntries(form)).toEqual({
      grant_type: "client_credentials",
      client_id: "id",
      client_secret: "secret",
      scope: "DCAPI_BARCODE_READ",
    });
    expect(calls[1]!.url).toBe("https://dcapi.apis.post.ch/barcode/v1/generateAddressLabel");
    expect((calls[1]!.init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok");
  });

  it("verwendet den Token bis zum Ablauf wieder", async () => {
    let now = 0;
    const { cfg, calls } = fakePost((c) => reply(c, labelOk));
    cfg.now = () => now;
    await createPostLabel(cfg, order, sender);
    await createPostLabel(cfg, order, sender);
    expect(calls.filter(isToken)).toHaveLength(1);
    now = 3600 * 1000; // abgelaufen (mit 60 s Reserve)
    await createPostLabel(cfg, order, sender);
    expect(calls.filter(isToken)).toHaveLength(2);
  });

  it("401: einmal mit neuem Token, danach POST_AUTH_FAILED", async () => {
    let apiCalls = 0;
    const ok = fakePost((c) => {
      if (isToken(c)) return token();
      return ++apiCalls === 1 ? new Response("{}", { status: 401 }) : labelOk();
    });
    await expect(createPostLabel(ok.cfg, order, sender)).resolves.toMatchObject({
      identCode: "99.60.123456.12345678",
    });
    expect(ok.calls.filter(isToken)).toHaveLength(2);
    resetPostTokenCache();
    const never = fakePost((c) => (isToken(c) ? token() : new Response("{}", { status: 401 })));
    await expect(createPostLabel(never.cfg, order, sender)).rejects.toThrow("POST_AUTH_FAILED");
    expect(never.calls.filter((c) => !isToken(c))).toHaveLength(2);
  });

  it("Token-Anfrage abgelehnt: POST_AUTH_FAILED", async () => {
    const { cfg } = fakePost(() => new Response("{}", { status: 400 }));
    await expect(createPostLabel(cfg, order, sender)).rejects.toThrow("POST_AUTH_FAILED");
  });

  it.each([
    [
      "E9993 in der Antwort",
      () => new Response(JSON.stringify({ errors: [{ code: "E9993" }] }), { status: 200 }),
    ],
    [
      "E9999 bei HTTP 400",
      () => new Response(JSON.stringify({ errors: [{ code: "E9999" }] }), { status: 400 }),
    ],
    ["HTTP 429", () => new Response("", { status: 429 })],
  ])("vorübergehend (%s): einmal wiederholen", async (_name, first) => {
    let n = 0;
    const { cfg, calls } = fakePost((c) =>
      isToken(c) ? token() : ++n === 1 ? first() : labelOk(),
    );
    await expect(createPostLabel(cfg, order, sender)).resolves.toMatchObject({
      identCode: "99.60.123456.12345678",
    });
    expect(calls.filter((c) => !isToken(c))).toHaveLength(2);
  });

  it("5xx ohne Fehlercode: keine Wiederholung (die Etikette könnte schon bestehen); 429 bleibt: POST_RATE_LIMITED", async () => {
    const down = fakePost((c) => (isToken(c) ? token() : new Response("", { status: 500 })));
    await expect(createPostLabel(down.cfg, order, sender)).rejects.toThrow("POST_UNAVAILABLE");
    expect(down.calls.filter((c) => !isToken(c))).toHaveLength(1);
    const e99 = fakePost((c) =>
      isToken(c)
        ? token()
        : new Response(JSON.stringify({ errors: [{ code: "E9997" }] }), { status: 400 }),
    );
    await expect(createPostLabel(e99.cfg, order, sender)).rejects.toThrow("POST_UNAVAILABLE");
    expect(e99.calls.filter((c) => !isToken(c))).toHaveLength(2);
    const busy = fakePost((c) => (isToken(c) ? token() : new Response("", { status: 429 })));
    await expect(createPostLabel(busy.cfg, order, sender)).rejects.toThrow("POST_RATE_LIMITED");
  });

  it("Netzfehler: POST_UNAVAILABLE ohne Wiederholung", async () => {
    let n = 0;
    const { cfg } = fakePost(() => token());
    const inner = cfg.fetchImpl!;
    cfg.fetchImpl = (async (url: string, init: RequestInit) => {
      if (!String(url).includes("OAuth") && ++n === 1) throw new TypeError("fetch failed");
      return isToken({ url, init }) ? token() : labelOk();
    }) as typeof fetch;
    void inner;
    await expect(createPostLabel(cfg, order, sender)).rejects.toThrow("POST_UNAVAILABLE");
    expect(n).toBe(1);
  });

  it("andere Fehler: kein Wiederholen, klarer Code", async () => {
    const { cfg, calls } = fakePost((c) =>
      isToken(c)
        ? token()
        : new Response(
            JSON.stringify({ errors: [{ code: "E0042", message: "recipient zip invalid" }] }),
            { status: 400 },
          ),
    );
    await expect(createPostLabel(cfg, order, sender)).rejects.toThrow("POST_ADDRESS_INVALID");
    expect(calls.filter((c) => !isToken(c))).toHaveLength(1);
  });

  it("ohne Secrets: POST_NOT_CONFIGURED, ohne einen Aufruf", async () => {
    const { cfg, calls } = fakePost(() => token());
    await expect(createPostLabel({ ...cfg, clientSecret: "" }, order, sender)).rejects.toThrow(
      "POST_NOT_CONFIGURED",
    );
    expect(calls).toHaveLength(0);
  });
});
