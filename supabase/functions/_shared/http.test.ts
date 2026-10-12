import { describe, expect, it } from "vitest";
import { clientIp, HttpError, ipBucket, readJson } from "./http.ts";

describe("ipBucket", () => {
  it("IPv4 einzeln, auch mit Port oder als IPv4 in IPv6", () => {
    expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket(" 203.0.113.9:8080 ")).toBe("203.0.113.9");
    expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("::FFFF:203.0.113.9")).toBe("203.0.113.9");
  });

  it("IPv6 als /64-Netz: alle Adressen eines Anschlusses zählen zusammen", () => {
    const net = "2001:db8:1:2::/64";
    expect(ipBucket("2001:db8:1:2:3:4:5:6")).toBe(net);
    expect(ipBucket("2001:0DB8:0001:0002:ffff::1")).toBe(net);
    expect(ipBucket("2001:db8:1:2::7")).toBe(net);
    expect(ipBucket("[2001:db8:1:2::9]:443")).toBe(net);
    expect(ipBucket("2001:db8:1:2::9%eth0")).toBe(net);
    expect(ipBucket("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64");
    expect(ipBucket("::1")).toBe("0:0:0:0::/64");
    expect(ipBucket("64:ff9b::198.51.100.7")).toBe("64:ff9b:0:0::/64");
  });

  it("keine gültige IP: null", () => {
    for (const raw of [
      null,
      undefined,
      "",
      " ",
      "unknown",
      "999.1.1.1",
      "1.2.3",
      "1:2:3",
      "1::2::3",
      "1:2:3:4:5:6:7:8::",
      "12345::1",
      "<script>",
    ])
      expect(ipBucket(raw)).toBeNull();
  });
});

function req(headers: Record<string, string>) {
  return new Request("https://fn.test", { method: "POST", headers });
}

describe("clientIp", () => {
  it("Cloudflare-Header zuerst, sonst der erste gültige Eintrag von X-Forwarded-For", () => {
    expect(
      clientIp(req({ "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "10.0.0.1" })),
    ).toBe("198.51.100.1");
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
  });

  it("leerer erster Eintrag hebelt die IP-Bremse nicht aus", () => {
    expect(clientIp(req({ "x-forwarded-for": ", 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "unknown, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("ohne IP: null", () => {
    expect(clientIp(req({}))).toBeNull();
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBeNull();
  });
});

describe("readJson", () => {
  const post = (body: string, type?: string) =>
    new Request("https://fn.test", {
      method: "POST",
      headers: type ? { "content-type": type } : {},
      body,
    });

  it("liest JSON-Objekte, auch mit charset", async () => {
    expect(await readJson(post('{"a":1}', "application/json"))).toEqual({ a: 1 });
    expect(await readJson(post('{"a":2}', "Application/JSON; charset=utf-8"))).toEqual({ a: 2 });
  });

  it("anderer Content-Type: 415 (fremde Seiten kommen nicht ohne CORS-Prüfung durch)", async () => {
    for (const type of [undefined, "text/plain", "text/plain;charset=UTF-8", "application/jsonx"]) {
      const error = await readJson(post('{"a":1}', type)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(415);
      expect((error as HttpError).code).toBe("UNSUPPORTED_MEDIA_TYPE");
    }
  });

  it("kein Objekt oder zu gross: 400 bzw. 413", async () => {
    const bad = await readJson(post("[1]", "application/json")).catch((e: unknown) => e);
    expect((bad as HttpError).code).toBe("BAD_REQUEST");
    const big = await readJson(post(`{"a":"${"x".repeat(50)}"}`, "application/json"), 20).catch(
      (e: unknown) => e,
    );
    expect((big as HttpError).status).toBe(413);
  });
});
