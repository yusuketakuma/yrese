import { ELIGIBILITY_STATUSES, RECEPTION_STATUSES } from "@yrese/shared-kernel";
import { describe, expect, it } from "vitest";

import {
  MIGRATION_STATE_RESULTS,
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryQuerySchema,
  receptionSummaryResponseSchema,
} from "./operations-status.js";

const receptionStatusZeroes = RECEPTION_STATUSES.map((status) => ({
  status,
  count: 0,
}));
const eligibilityStatusZeroes = ELIGIBILITY_STATUSES.map((status) => ({
  status,
  count: 0,
}));

describe("outboxSummaryResponseSchema", () => {
  it("accepts a count-only summary with an omitted legacyOrphanCount", () => {
    const parsed = outboxSummaryResponseSchema.parse({
      pendingCount: 2,
      deliveredCount: 0,
      oldestPendingCreatedAt: "2026-07-09T08:30:00.000Z",
      byEventType: [{ eventType: "reception.created", pendingCount: 2, deliveredCount: 0 }],
    });

    expect(parsed).toEqual({
      pendingCount: 2,
      deliveredCount: 0,
      oldestPendingCreatedAt: "2026-07-09T08:30:00.000Z",
      byEventType: [{ eventType: "reception.created", pendingCount: 2, deliveredCount: 0 }],
    });
    expect("legacyOrphanCount" in parsed).toBe(false);
  });

  it("accepts an empty summary with no oldest pending instant", () => {
    const parsed = outboxSummaryResponseSchema.parse({
      pendingCount: 0,
      deliveredCount: 0,
      byEventType: [],
      legacyOrphanCount: 0,
    });

    expect(parsed.legacyOrphanCount).toBe(0);
    expect(parsed.oldestPendingCreatedAt).toBeUndefined();
  });

  it("rejects byEventType that is unsorted or duplicated", () => {
    const unsorted = {
      pendingCount: 2,
      deliveredCount: 0,
      byEventType: [
        { eventType: "reception.updated", pendingCount: 1, deliveredCount: 0 },
        { eventType: "reception.created", pendingCount: 1, deliveredCount: 0 },
      ],
    };
    const duplicated = {
      pendingCount: 2,
      deliveredCount: 0,
      byEventType: [
        { eventType: "reception.created", pendingCount: 1, deliveredCount: 0 },
        { eventType: "reception.created", pendingCount: 1, deliveredCount: 0 },
      ],
    };

    expect(() => outboxSummaryResponseSchema.parse(unsorted)).toThrow(/byEventType/);
    expect(() => outboxSummaryResponseSchema.parse(duplicated)).toThrow(/byEventType/);
  });

  it.each([
    { pendingCount: -1 },
    { deliveredCount: 1.5 },
    { legacyOrphanCount: -1 },
  ] as const)("rejects a non-negative-integer count %j", (override) => {
    expect(() =>
      outboxSummaryResponseSchema.parse({
        pendingCount: 0,
        deliveredCount: 0,
        byEventType: [],
        ...override,
      }),
    ).toThrow();
  });

  it("rejects control characters in eventType", () => {
    expect(() =>
      outboxSummaryResponseSchema.parse({
        pendingCount: 0,
        deliveredCount: 0,
        byEventType: [
          { eventType: "reception.created\u0000", pendingCount: 0, deliveredCount: 0 },
        ],
      }),
    ).toThrow(/control characters/);
  });
});

describe("receptionSummaryQuerySchema", () => {
  it("accepts a real calendar date", () => {
    expect(receptionSummaryQuerySchema.parse({ date: "2026-07-09" })).toEqual({
      date: "2026-07-09",
    });
  });

  it.each([{ date: "20260709" }, { date: "2026-07-09T00:00:00Z" }, {}])(
    "rejects a malformed business date %j",
    (query) => {
      expect(() => receptionSummaryQuerySchema.parse(query)).toThrow();
    },
  );
});

describe("receptionSummaryResponseSchema", () => {
  it("accepts every status member in declaration order, including zero counts", () => {
    const parsed = receptionSummaryResponseSchema.parse({
      date: "2026-07-09",
      totalCount: 0,
      byReceptionStatus: receptionStatusZeroes,
      byEligibilityStatus: eligibilityStatusZeroes,
    });

    expect(parsed.byReceptionStatus.map((row) => row.status)).toEqual([
      ...RECEPTION_STATUSES,
    ]);
    expect(parsed.byEligibilityStatus.map((row) => row.status)).toEqual([
      ...ELIGIBILITY_STATUSES,
    ]);
  });

  it("rejects a partial status list", () => {
    expect(() =>
      receptionSummaryResponseSchema.parse({
        date: "2026-07-09",
        totalCount: 1,
        byReceptionStatus: receptionStatusZeroes.slice(0, 2),
        byEligibilityStatus: eligibilityStatusZeroes,
      }),
    ).toThrow(/byReceptionStatus/);
  });

  it("rejects a reordered status list", () => {
    expect(() =>
      receptionSummaryResponseSchema.parse({
        date: "2026-07-09",
        totalCount: 0,
        byReceptionStatus: receptionStatusZeroes,
        byEligibilityStatus: [...eligibilityStatusZeroes].reverse(),
      }),
    ).toThrow(/byEligibilityStatus/);
  });
});

describe("migrationStateResponseSchema", () => {
  it.each(MIGRATION_STATE_RESULTS)("accepts the %s result", (result) => {
    expect(
      migrationStateResponseSchema.parse({
        available: true,
        result,
        appliedCount: 13,
        availableCount: 13,
        pendingVersions: [],
        latestAppliedVersion: "000013",
        latestAppliedName: "create_prescription_drafts",
      }),
    ).toMatchObject({ available: true, result });
  });

  it("accepts a result that omits pendingVersions, keeping the field absent", () => {
    const parsed = migrationStateResponseSchema.parse({
      available: true,
      result: "checksum_mismatch",
      appliedCount: 4,
      availableCount: 13,
    });

    // 照合が途中停止した結果は未適用件数を導出していない。0 件と主張させない。
    expect("pendingVersions" in parsed).toBe(false);
    expect(parsed).toEqual({
      available: true,
      result: "checksum_mismatch",
      appliedCount: 4,
      availableCount: 13,
    });
  });

  it("keeps a derived empty pendingVersions distinct from an omitted one", () => {
    const parsed = migrationStateResponseSchema.parse({
      available: true,
      result: "up_to_date",
      appliedCount: 13,
      availableCount: 13,
      pendingVersions: [],
    });

    expect(parsed).toMatchObject({ pendingVersions: [] });
  });

  it("accepts the unavailable branch", () => {
    expect(
      migrationStateResponseSchema.parse({
        available: false,
        reason: "PERSISTENT_STORE_NOT_CONFIGURED",
      }),
    ).toEqual({ available: false, reason: "PERSISTENT_STORE_NOT_CONFIGURED" });
  });

  it("rejects an unavailable branch that smuggles in state", () => {
    expect(() =>
      migrationStateResponseSchema.parse({
        available: false,
        reason: "SOMETHING_ELSE",
      }),
    ).toThrow();
  });

  it.each(["13", "0000013", "abc123"] as const)(
    "rejects a malformed migration version %j",
    (version) => {
      expect(() =>
        migrationStateResponseSchema.parse({
          available: true,
          result: "unapplied_required",
          appliedCount: 0,
          availableCount: 1,
          pendingVersions: [version],
        }),
      ).toThrow();
    },
  );

  it("rejects an unregistered result value", () => {
    expect(() =>
      migrationStateResponseSchema.parse({
        available: true,
        result: "definitely_fine",
        appliedCount: 0,
        availableCount: 0,
        pendingVersions: [],
      }),
    ).toThrow();
  });
});
