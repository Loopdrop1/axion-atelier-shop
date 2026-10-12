import { describe, expect, it } from "vitest";
import { authProblem, isOtpType, trackingUrl } from "./api";

const apiError = (message: string, code?: string, status?: number) =>
  Object.assign(new Error(message), { code, status }) as Error;

describe("Kundenkonto: Fehler von Supabase Auth", () => {
  it("ordnet bekannte Codes und Meldungen einem Grund zu", () => {
    expect(authProblem(apiError("Invalid login credentials", "invalid_credentials", 400))).toBe(
      "invalid_credentials",
    );
    expect(authProblem(apiError("Invalid login credentials"))).toBe("invalid_credentials");
    expect(authProblem(apiError("Email not confirmed", "email_not_confirmed"))).toBe(
      "email_not_confirmed",
    );
    expect(
      authProblem(apiError("Password should be at least 10 characters.", "weak_password")),
    ).toBe("weak_password");
    expect(
      authProblem(
        apiError("New password should be different from the old password.", "same_password"),
      ),
    ).toBe("same_password");
    expect(
      authProblem(apiError("Email rate limit exceeded", "over_email_send_rate_limit", 429)),
    ).toBe("rate_limited");
    expect(authProblem(apiError("Too many requests", undefined, 429))).toBe("rate_limited");
    expect(
      authProblem(
        apiError("A user with this email address has already been registered", "email_exists"),
      ),
    ).toBe("email_exists");
    expect(
      authProblem(
        apiError("Unable to validate email address: invalid format", "validation_failed"),
      ),
    ).toBe("invalid_email");
    expect(
      authProblem(apiError("Password update requires reauthentication", "reauthentication_needed")),
    ).toBe("reauth_needed");
    expect(authProblem(new TypeError("Failed to fetch"))).toBe("network");
    expect(authProblem(apiError("Something else", "unexpected_failure", 500))).toBe("unknown");
    expect(authProblem(null)).toBe("unknown");
  });

  it("lässt nur die Link-Typen aus den Konto-E-Mails zu", () => {
    for (const type of ["signup", "invite", "magiclink", "recovery", "email_change", "email"])
      expect(isOtpType(type)).toBe(true);
    expect(isOtpType("sms")).toBe(false);
    expect(isOtpType(undefined)).toBe(false);
    expect(isOtpType(["signup"])).toBe(false);
  });

  it("baut den Link zur Sendungsverfolgung wie die Versandmeldung", () => {
    expect(trackingUrl("99.00.123456.12345678")).toBe(
      "https://www.post.ch/swisspost-tracking?formattedParcelCodes=99.00.123456.12345678",
    );
    expect(trackingUrl("AB 12/3")).toBe(
      "https://www.post.ch/swisspost-tracking?formattedParcelCodes=AB%2012%2F3",
    );
  });
});
