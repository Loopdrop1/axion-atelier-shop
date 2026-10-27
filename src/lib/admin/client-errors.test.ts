import { describe, expect, it } from "vitest";
import type { ClientErrorRow } from "./api";
import { groupClientErrors } from "./client-errors";

const row = (over: Partial<ClientErrorRow>): ClientErrorRow => ({
  id: crypto.randomUUID(),
  fingerprint: "fp1",
  message: "Boom",
  path: "/",
  stack: null,
  user_agent: null,
  release: null,
  count: 1,
  created_at: "2026-10-01T10:00:00Z",
  last_seen_at: "2026-10-01T10:00:00Z",
  ...over,
});

describe("groupClientErrors", () => {
  it("fasst gleiche Fingerprints zusammen, summiert Zähler und nimmt die Angaben des jüngsten Eintrags", () => {
    const groups = groupClientErrors([
      row({ count: 3, path: "/alt", last_seen_at: "2026-10-01T12:00:00Z" }),
      row({
        count: 2,
        path: "/neu",
        created_at: "2026-10-03T09:00:00Z",
        last_seen_at: "2026-10-03T11:00:00Z",
      }),
      row({
        fingerprint: "fp2",
        message: "Andere",
        last_seen_at: "2026-10-02T00:00:00Z",
        created_at: "2026-10-02T00:00:00Z",
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      fingerprint: "fp1",
      count: 5,
      path: "/neu",
      firstSeen: "2026-10-01T10:00:00Z",
    });
    expect(groups[1]).toMatchObject({ fingerprint: "fp2", count: 1 });
  });

  it("leere Liste bleibt leer", () => {
    expect(groupClientErrors([])).toEqual([]);
  });
});
