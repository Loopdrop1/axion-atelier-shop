import { beforeEach, describe, expect, it, vi } from "vitest";

const resend = vi.hoisted(() => vi.fn());
vi.mock("@/lib/backend", () => ({ backendConfigured: true, supabaseUrl: "" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { resend } } }));

import { resendConfirmation } from "./api";

describe("Bestätigungslink erneut senden", () => {
  beforeEach(() => resend.mockReset());

  it("fordert über Supabase einen neuen Registrierungslink an", async () => {
    resend.mockResolvedValue({ error: null });
    await expect(resendConfirmation("  a@b.ch ", "de")).resolves.toEqual({ ok: true });
    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "a@b.ch" }),
    );
  });

  it("meldet den Grund bei einem Fehler", async () => {
    resend.mockResolvedValue({
      error: Object.assign(new Error("Email rate limit exceeded"), {
        code: "over_email_send_rate_limit",
        status: 429,
      }),
    });
    await expect(resendConfirmation("a@b.ch", "en")).resolves.toEqual({
      ok: false,
      problem: "rate_limited",
    });
  });
});
