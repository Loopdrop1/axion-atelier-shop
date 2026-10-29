import { afterEach, describe, expect, it, vi } from "vitest";

import { logStripeError } from "./stripe.ts";

describe("logStripeError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs only type, code and status, never the message or raw request values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("Invalid email address: kunde@example.com"), {
      type: "StripeInvalidRequestError",
      code: "email_invalid",
      statusCode: 400,
      raw: { message: "Invalid email address: kunde@example.com" },
    });
    logStripeError("Stripe-Session fehlgeschlagen", error);
    expect(spy).toHaveBeenCalledWith(
      "Stripe-Session fehlgeschlagen",
      "StripeInvalidRequestError",
      "email_invalid",
      400,
    );
    expect(JSON.stringify(spy.mock.calls)).not.toContain("kunde@example.com");
  });

  it("tolerates non-object errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logStripeError("Stripe-Coupon fehlgeschlagen", null);
    expect(spy).toHaveBeenCalledWith(
      "Stripe-Coupon fehlgeschlagen",
      undefined,
      undefined,
      undefined,
    );
  });
});
