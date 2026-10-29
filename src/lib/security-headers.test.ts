import { describe, expect, it } from "vitest";

import { SECURITY_HEADERS, withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
  it("sets frame-ancestors, nosniff and referrer policy", () => {
    const response = withSecurityHeaders(new Response("<p>ok</p>", { status: 200 }));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors");
    expect(response.headers.get("Content-Security-Policy")).not.toContain("*.lovable.app");
  });

  it("keeps headers a route already set", () => {
    const response = withSecurityHeaders(
      new Response("", { headers: { "Referrer-Policy": "no-referrer" } }),
    );
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("copies responses with immutable headers and keeps status and location", () => {
    const redirect = Response.redirect("https://example.com/ziel", 307);
    const response = withSecurityHeaders(redirect);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/ziel");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
