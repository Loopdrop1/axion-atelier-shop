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
  RETURN_POLICY,
  parseRefundMethod,
} from "../../supabase/functions/_shared/returns";
import {
  refundStep,
  returnConfirmation,
  sendBackStep,
} from "../../supabase/functions/_shared/email/returns";
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

describe("Rückgabe-Zusagen", () => {
  it("Shop-Konfiguration und Edge Functions sagen dasselbe zu", () => {
    expect(RETURN_POLICY).toEqual(shopConfig.returns);
    expect(REFUND_WITHIN_DAYS).toBe(shopConfig.returns.refundDays);
  });

  const all = [true, false].flatMap((freeReturn) =>
    [true, false].map((labelEnclosed) => ({ freeReturn, labelEnclosed })),
  );

  it("Texte im Shop folgen den Zusagen (gratis, Etikett) statt fester Sätze", () => {
    for (const p of all) {
      for (const locale of ["de", "en"] as const) {
        const r = messages[locale].returns;
        const free = locale === "de" ? /gratis/ : /free/i;
        const label = locale === "de" ? /rücksendeetikett|etikett liegt/i : /label/;
        const texts = [r.shippingPromise(p), r.doneMail(p), r.accountHint(14, p.freeReturn)];
        expect(free.test(r.shippingPromise(p)), JSON.stringify(p)).toBe(p.freeReturn);
        expect(label.test(r.shippingPromise(p)), JSON.stringify(p)).toBe(p.labelEnclosed);
        expect(free.test(r.doneMail(p))).toBe(p.freeReturn);
        expect(label.test(r.doneMail(p))).toBe(p.labelEnclosed);
        expect(free.test(r.accountHint(14, p.freeReturn))).toBe(p.freeReturn);
        expect(r.intro(r.shippingPromise(p))).toContain(r.shippingPromise(p));
        for (const text of texts) expect(text).not.toMatch(/ {2}|\. \.|^ | $/);
      }
    }
    expect(messages.de.sizeGuide.exchange(14, true)).toMatch(/gratis/);
    expect(messages.de.sizeGuide.exchange(14, false)).not.toMatch(/gratis|tausch/);
    expect(messages.en.sizeGuide.exchange(14, true)).toMatch(/free of charge/);
  });

  it("Retouren-Mail folgt denselben Zusagen", () => {
    for (const p of all) {
      const policy = { ...RETURN_POLICY, ...p };
      expect(/gratis/.test(sendBackStep(policy, "Adresse", true))).toBe(p.freeReturn);
      expect(/etikett/i.test(sendBackStep(policy, "Adresse", true))).toBe(p.labelEnclosed);
      expect(/free/.test(sendBackStep(policy, "Address", false))).toBe(p.freeReturn);
      expect(/label/.test(sendBackStep(policy, "Address", false))).toBe(p.labelEnclosed);
    }
    expect(refundStep({ ...RETURN_POLICY, refundDays: 10 }, true, true)).toMatch(
      /^Innert 10 Tagen .* als Gutschein\. Mit einem Gutschein bezahlte Beträge schreiben wir immer dem Gutschein gut\.$/,
    );
    const mail = returnConfirmation(
      {
        locale: "de",
        returnNumber: 1,
        orderNumber: 10001,
        email: "a@example.ch",
        items: [],
        comment: null,
        refundMethod: "original",
      },
      {
        name: "Axion",
        siteUrl: "https://shop.test",
        contactEmail: "hallo@shop.test",
        address: "Strasse 1, 8000 Zürich",
        returnDays: 14,
      },
      { freeReturn: false, labelEnclosed: false, freeExchange: false, refundDays: 7 },
    );
    expect(mail.text).not.toMatch(/gratis|rücksendeetikett/i);
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
    {
      orderItemId: "a",
      title: "Anzug",
      size: "50",
      color: "Blau",
      image: null,
      quantity: 2,
      onSale: false,
    },
    {
      orderItemId: "b",
      title: "Hemd",
      size: "41",
      color: null,
      image: null,
      quantity: 1,
      onSale: false,
    },
    {
      orderItemId: "s",
      title: "Gilet",
      size: "48",
      color: null,
      image: null,
      quantity: 1,
      onSale: true,
    },
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

  it("Sale-Stücke sind nie wählbar, auch wenn ein Entwurf sie markiert", () => {
    expect(selectionFrom(items, { s: draft({}) }).error).toBe("noItem");
    expect(selectionFrom(items, { s: draft({}), b: draft({}) }).selection).toEqual([
      { orderItemId: "b", quantity: 1, reason: "style" },
    ]);
  });
});
