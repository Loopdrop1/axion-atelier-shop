import { describe, expect, it } from "vitest";
import { RETURN_REASONS } from "@/lib/returns";
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS,
  RETURN_STATUSES,
  parseReturnLines,
  returnPieces,
  returnReasonLabel,
  returnRef,
  returnStatusLabel,
} from "./returns";

describe("Retouren im Admin", () => {
  it("jeder Status und jeder Grund hat eine Beschriftung", () => {
    for (const s of RETURN_STATUSES) expect(RETURN_STATUS[s].label).not.toBe("");
    expect([...RETURN_REASONS].sort()).toEqual(Object.keys(RETURN_REASON_LABELS).sort());
    expect(returnStatusLabel("refunded")).toBe("Erstattet");
    expect(returnStatusLabel("unbekannt")).toBe("unbekannt");
    expect(returnReasonLabel("too_large")).toBe("Zu gross");
    expect(returnReasonLabel("neu")).toBe("neu");
  });

  it("liest Positionen und überspringt Unbrauchbares", () => {
    const lines = parseReturnLines([
      {
        order_item_id: "a",
        title: "Anzug",
        size: "50",
        color: "Blau",
        quantity: 2,
        reason: "style",
      },
      null,
      "x",
      { title: "Hemd", quantity: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ title: "Anzug", size: "50", quantity: 2, reason: "style" });
    expect(lines[1]).toMatchObject({ title: "Hemd", size: null, reason: "other", orderItemId: "" });
    expect(returnPieces([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
    expect(parseReturnLines(undefined)).toEqual([]);
    expect(returnRef(1001)).toBe("R-1001");
  });
});
