import { describe, expect, it } from "vitest";

import {
  ELIGIBILITY_STATUSES,
  RECEPTION_STATUSES,
  patientId,
  pharmacyId,
  receptionId,
  tenantId,
} from "@yrese/shared-kernel";

import {
  InMemoryOperationsReadService,
  buildOutboxSummary,
  buildReceptionSummary,
  operationsSummaryInvariantErrorMessage,
  persistentStoreNotConfiguredMigrationState,
} from "./operations-service.js";
import {
  InMemoryReceptionOutbox,
  receptionCommandAggregateType,
  receptionCommandAuditEventType,
} from "./reception-command.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";

const scope = {
  tenantId: tenantId("tenant-001"),
  pharmacyId: pharmacyId("pharmacy-001"),
} as const;

function outboxIntent(overrides: {
  readonly outboxEventId: string;
  readonly aggregateId: string;
  readonly createdAt: string;
}) {
  return {
    outboxEventId: overrides.outboxEventId,
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    eventType: receptionCommandAuditEventType,
    aggregateType: receptionCommandAggregateType,
    aggregateId: receptionId(overrides.aggregateId),
    patientId: patientId("patient-syn-001"),
    createdAt: overrides.createdAt,
    deliveredAt: null,
  } as const;
}

describe("buildOutboxSummary", () => {
  it("sorts by eventType, sums the totals, and keeps the earliest pending instant", () => {
    const summary = buildOutboxSummary([
      {
        eventType: "reception.updated",
        pendingCount: 1,
        deliveredCount: 2,
        oldestPendingCreatedAt: "2026-07-09T09:00:00.000Z",
      },
      {
        eventType: "reception.created",
        pendingCount: 3,
        deliveredCount: 0,
        oldestPendingCreatedAt: "2026-07-09T08:30:00.000Z",
      },
    ]);

    expect(summary.byEventType.map((row) => row.eventType)).toEqual([
      "reception.created",
      "reception.updated",
    ]);
    expect(summary.pendingCount).toBe(4);
    expect(summary.deliveredCount).toBe(2);
    expect(summary.oldestPendingCreatedAt).toBe("2026-07-09T08:30:00.000Z");
    expect("legacyOrphanCount" in summary).toBe(false);
  });

  it("omits the oldest pending instant when nothing is pending", () => {
    const summary = buildOutboxSummary([
      { eventType: "reception.created", pendingCount: 0, deliveredCount: 5 },
    ]);

    expect(summary.oldestPendingCreatedAt).toBeUndefined();
    expect(summary.pendingCount).toBe(0);
    expect(summary.deliveredCount).toBe(5);
  });

  it("carries legacyOrphanCount only when it was derived", () => {
    expect(
      "legacyOrphanCount" in buildOutboxSummary([], { legacyOrphanCount: 0 }),
    ).toBe(true);
    expect("legacyOrphanCount" in buildOutboxSummary([])).toBe(false);
  });
});

describe("buildReceptionSummary", () => {
  it("lists every enum member in declaration order with measured zeroes", () => {
    const summary = buildReceptionSummary("2026-07-09", [
      { receptionStatus: "WAITING", eligibilityStatus: "VERIFIED", count: 2 },
      {
        receptionStatus: "COMPLETED",
        eligibilityStatus: "LOCAL_ONLY_UNVERIFIED",
        count: 1,
      },
    ]);

    expect(summary.totalCount).toBe(3);
    expect(summary.byReceptionStatus).toEqual([
      { status: "WAITING", count: 2 },
      { status: "IN_PROGRESS", count: 0 },
      { status: "COMPLETED", count: 1 },
      { status: "CANCELLED", count: 0 },
    ]);
    expect(summary.byEligibilityStatus.map((row) => row.status)).toEqual([
      ...ELIGIBILITY_STATUSES,
    ]);
    expect(summary.byReceptionStatus.map((row) => row.status)).toEqual([
      ...RECEPTION_STATUSES,
    ]);
  });

  it("returns every member at zero for a date with no receptions", () => {
    const summary = buildReceptionSummary("2026-07-10", []);

    expect(summary.totalCount).toBe(0);
    expect(summary.byReceptionStatus.every((row) => row.count === 0)).toBe(true);
    expect(summary.byEligibilityStatus.every((row) => row.count === 0)).toBe(true);
  });

  it.each([
    { receptionStatus: "SOMETHING_ELSE", eligibilityStatus: "VERIFIED", count: 1 },
    { receptionStatus: "WAITING", eligibilityStatus: "SOMETHING_ELSE", count: 1 },
    { receptionStatus: "WAITING", eligibilityStatus: "VERIFIED", count: -1 },
    { receptionStatus: "WAITING", eligibilityStatus: "VERIFIED", count: 1.5 },
  ] as const)("rejects the unusable tally %j instead of dropping it", (tally) => {
    expect(() => buildReceptionSummary("2026-07-09", [tally])).toThrow(
      operationsSummaryInvariantErrorMessage,
    );
  });
});

describe("persistentStoreNotConfiguredMigrationState", () => {
  it("states the reason instead of implying an up-to-date schema", () => {
    expect(persistentStoreNotConfiguredMigrationState()).toEqual({
      available: false,
      reason: "PERSISTENT_STORE_NOT_CONFIGURED",
    });
  });
});

describe("InMemoryOperationsReadService", () => {
  function service() {
    const outbox = new InMemoryReceptionOutbox();
    const receptionRepository = new InMemoryReceptionRepository();
    return {
      outbox,
      receptionRepository,
      read: new InMemoryOperationsReadService(outbox, receptionRepository),
    };
  }

  it("counts the intents the outbox actually holds, scoped to the tenant", async () => {
    const { outbox, read } = service();
    outbox.append(
      outboxIntent({
        outboxEventId: "outbox-001",
        aggregateId: "reception-syn-001",
        createdAt: "2026-07-09T08:45:00.000Z",
      }),
    );
    outbox.append(
      outboxIntent({
        outboxEventId: "outbox-002",
        aggregateId: "reception-syn-002",
        createdAt: "2026-07-09T08:30:00.000Z",
      }),
    );

    const summary = await read.outboxSummary(scope);

    expect(summary.pendingCount).toBe(2);
    expect(summary.deliveredCount).toBe(0);
    expect(summary.oldestPendingCreatedAt).toBe("2026-07-09T08:30:00.000Z");
    expect(summary.byEventType).toEqual([
      { eventType: "reception.created", pendingCount: 2, deliveredCount: 0 },
    ]);
  });

  it("reports an empty summary for a scope with no intents", async () => {
    const { read } = service();

    const summary = await read.outboxSummary({
      tenantId: tenantId("tenant-other"),
      pharmacyId: pharmacyId("pharmacy-other"),
    });

    expect(summary).toEqual({
      pendingCount: 0,
      deliveredCount: 0,
      byEventType: [],
    });
  });

  it("omits legacyOrphanCount because in-memory mode does not derive it", async () => {
    const { read } = service();

    expect("legacyOrphanCount" in (await read.outboxSummary(scope))).toBe(false);
  });

  it("folds the reception queue into counts without returning patient data", async () => {
    const { read } = service();

    const summary = await read.receptionSummary({ ...scope, date: "2026-07-09" });

    expect(summary.date).toBe("2026-07-09");
    expect(summary.totalCount).toBe(3);
    expect(summary.byReceptionStatus).toEqual([
      { status: "WAITING", count: 1 },
      { status: "IN_PROGRESS", count: 1 },
      { status: "COMPLETED", count: 1 },
      { status: "CANCELLED", count: 0 },
    ]);
    expect(summary.byEligibilityStatus).toEqual([
      { status: "VERIFIED", count: 1 },
      { status: "PENDING_REVERIFY", count: 1 },
      { status: "LOCAL_ONLY_UNVERIFIED", count: 1 },
      { status: "NOT_CHECKED", count: 0 },
    ]);
    expect(JSON.stringify(summary)).not.toContain("合成患者");
    expect(JSON.stringify(summary)).not.toContain("patient-syn-001");
  });

  it("reports zeroes for a business date with no receptions", async () => {
    const { read } = service();

    const summary = await read.receptionSummary({ ...scope, date: "2026-07-10" });

    expect(summary.totalCount).toBe(0);
    expect(summary.byReceptionStatus.every((row) => row.count === 0)).toBe(true);
  });

  it("declares the migration state unavailable in in-memory mode", async () => {
    const { read } = service();

    expect(await read.migrationState()).toEqual({
      available: false,
      reason: "PERSISTENT_STORE_NOT_CONFIGURED",
    });
  });
});
