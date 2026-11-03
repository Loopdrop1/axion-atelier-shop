import { describe, expect, it } from "vitest";
import {
  REFUND_METHODS,
  REFUND_WITHIN_DAYS,
  RETURN_REASONS,
  parseOrderNumber,
  returnProblem,
  selectionFrom,
  type Draft,
  type ReturnItem,
} from "./returns";
// Gleiche Regeln in der Edge Function; läuft hier mit, damit Formular und Server gleich entscheiden
import {
  RETURN_REASONS as SERVER_REASONS,
  parseOrderNumber as serverParse,
  REASON_LABELS,
  REFUND_METHODS as SERVER_REFUND_METHODS,
  REFUND_WITHIN_DAYS as SERVER_REFUND_DAYS,
  parseRefundMethod,
} from "../../supabase/functions/_shared/returns";
import { messages } from "@/i18n";
import { shopConfig } from "@/config/shop";
import { readEnv } from "../../supabase/functions/_shared/env";

describe("Bestellnummer", () => {
  it("nimmt AX-, # und die blosse Zahl; sonst nichts", () => {
    for (const input of ["AX-10001", "ax10001", " #10001 ", "10001", "AX- 10001"])
      expect(parseOrderNumber(input), input).toBe(10001);
    for (const input of ["", "AX-", "abc", "1.5", "AX-1-2", "1234567890123"])
      expect(parseOrderNumber(input), input).toBeNull();
  });

  it("Formular und Server lesen jede Eingabe gleich", () => {
    for (const input of ["AX-10001", "#7", "42", "x", "", "AX-", "AX 12", "12 34", "ax-0012"])
      expect(parseOrderNumber(input), input).toBe(serverParse(input));
  });
});

describe("Gründe", () => {
  it("Formular und Server kennen dieselben Gründe, alle in beiden Sprachen beschriftet", () => {
    expect([...RETURN_REASONS]).toEqual([...SERVER_REASONS]);
    for (const reason of RETURN_REASONS) {
      expect(messages.de.returns.reasons[reason]).toBe(REASON_LABELS.de[reason]);
      expect(messages.en.returns.reasons[reason]).toBe(REASON_LABELS.en[reason]);
    }
  });
});

describe("Rückerstattung", () => {
  it("Formular und Server kennen dieselben Arten, alle in beiden Sprachen beschriftet", () => {
    expect([...REFUND_METHODS]).toEqual([...SERVER_REFUND_METHODS]);
    expect(REFUND_WITHIN_DAYS).toBe(SERVER_REFUND_DAYS);
    for (const method of REFUND_METHODS) {
      expect(messages.de.returns.refundOptions[method].label).toBeTruthy();
      expect(messages.en.returns.refundOptions[method].label).toBeTruthy();
      expect(parseRefundMethod(method)).toBe(method);
    }
  });

  it("unbekannte Werte gelten als ursprüngliches Zahlungsmittel", () => {
    for (const value of [undefined, null, "", "voucher", "GIFT_CARD", 1])
      expect(parseRefundMethod(value)).toBe("original");
  });
});

describe("Rückgabefrist", () => {
  it("Standard der Edge Functions entspricht returnDays in der Shop-Konfiguration", () => {
    expect(readEnv(() => undefined).shopReturnDays).toBe(shopConfig.returnDays);
  });
});

describe("returnProblem", () => {
  it("ordnet Fehlercodes zu", () => {
    expect(returnProblem("NOT_FOUND", 404)).toBe("notFound");
    expect(returnProblem("RETURN_WINDOW_CLOSED", 409)).toBe("windowClosed");
    expect(returnProblem("RATE_LIMITED", 429)).toBe("rateLimited");
    expect(returnProblem("NETWORK", 0)).toBe("network");
    expect(returnProblem("INTERNAL", 500)).toBe("other");
  });
});

describe("selectionFrom", () => {
  const items: ReturnItem[] = [
    { orderItemId: "a", title: "Anzug", size: "50", color: "Blau", image: null, quantity: 2 },
    { orderItemId: "b", title: "Hemd", size: "41", color: null, image: null, quantity: 1 },
  ];
  const draft = (d: Partial<Draft>): Draft => ({
    checked: true,
    quantity: 1,
    reason: "style",
    ...d,
  });

  it("nimmt nur gewählte Stücke und begrenzt die Menge", () => {
    const { error, selection } = selectionFrom(items, {
      a: draft({ quantity: 9, reason: "too_small" }),
      b: draft({ checked: false }),
    });
    expect(error).toBeNull();
    expect(selection).toEqual([{ orderItemId: "a", quantity: 2, reason: "too_small" }]);
  });

  it("meldet fehlende Auswahl und fehlenden Grund", () => {
    expect(selectionFrom(items, {}).error).toBe("noItem");
    expect(selectionFrom(items, { a: draft({ checked: false }) }).error).toBe("noItem");
    expect(selectionFrom(items, { a: draft({ reason: "" }) }).error).toBe("noReason");
  });
});
