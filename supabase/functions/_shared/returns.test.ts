import { describe, expect, it } from "vitest";
import {
  parseOrderNumber,
  parseReturnItems,
  reasonLabel,
  REASON_LABELS,
  RETURN_REASONS,
  returnRef,
} from "./returns.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("parseOrderNumber", () => {
  it("liest AX-10001, #10001 und 10001; auch als Zahl", () => {
    for (const v of ["AX-10001", "ax-10001", "AX10001", " #10001 ", "10001", 10001])
      expect(parseOrderNumber(v), String(v)).toBe(10001);
  });
  it("lehnt alles andere ab", () => {
    for (const v of ["", "AX-", "x1", "1.5", "-5", "AX-1 2", "1234567890123", null, undefined, {}])
      expect(parseOrderNumber(v), String(v)).toBeNull();
  });
});

describe("parseReturnItems", () => {
  const ok = { orderItemId: A, quantity: 2, reason: "style" };
  it("nimmt gültige Positionen und schreibt die Kennung klein", () => {
    expect(parseReturnItems([ok, { ...ok, orderItemId: B.toUpperCase() }])).toEqual([
      { orderItemId: A, quantity: 2, reason: "style" },
      { orderItemId: B, quantity: 2, reason: "style" },
    ]);
  });
  it("lehnt leere, zu lange, doppelte und fehlerhafte Listen ab", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      ...ok,
      orderItemId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    for (const v of [
      undefined,
      "x",
      [],
      many,
      [ok, ok],
      [null],
      [{ ...ok, orderItemId: "x" }],
      [{ ...ok, quantity: 0 }],
      [{ ...ok, quantity: 11 }],
      [{ ...ok, quantity: 1.5 }],
      [{ ...ok, quantity: "2" }],
      [{ ...ok, reason: "weil" }],
      [{ ...ok, reason: undefined }],
    ])
      expect(parseReturnItems(v), JSON.stringify(v)).toBeNull();
  });
});

describe("Beschriftungen", () => {
  it("jeder Grund ist in beiden Sprachen beschriftet", () => {
    for (const r of RETURN_REASONS) {
      expect(REASON_LABELS.de[r]).toBeTruthy();
      expect(REASON_LABELS.en[r]).toBeTruthy();
    }
    expect(reasonLabel("too_small", "en")).toBe("Too small");
    expect(reasonLabel("unbekannt", "de")).toBe("unbekannt");
    expect(returnRef(1001)).toBe("R-1001");
  });
});
