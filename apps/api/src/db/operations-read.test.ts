import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import { pharmacyId, tenantId } from "@yrese/shared-kernel";

import { operationsSummaryInvariantErrorMessage } from "../operations-service.js";
import {
  PostgresOperationsReadService,
  type ReceptionLegacyOrphanSource,
} from "./operations-read.js";
import type { MigrationFile } from "./migrations.js";

const scope = {
  tenantId: tenantId("tenant-operations-read-test"),
  pharmacyId: pharmacyId("pharmacy-operations-read-test"),
};
const businessDate = "2026-08-28";

const noLegacyOrphans: ReceptionLegacyOrphanSource = {
  listLegacyOrphans: vi.fn(async () => []),
};

const migration: MigrationFile = {
  version: "000001",
  name: "synthetic_migration",
  filename: "000001_synthetic_migration.sql",
  sql: "SELECT 1;",
  checksumSha256: "a".repeat(64),
};

function createService(queryResult: unknown) {
  const query = vi.fn(
    async (_sql: string, _values?: readonly unknown[]) => queryResult,
  );
  return {
    query,
    service: new PostgresOperationsReadService({
      pool: { query } as unknown as Pool,
      migrations: [],
      legacyOrphanSource: noLegacyOrphans,
    }),
  };
}

function createMigrationService(options: {
  readonly latestResult: unknown;
  readonly migrations?: readonly MigrationFile[];
  readonly appliedRows?: readonly unknown[];
}) {
  const clientQuery = vi.fn(async () => ({ rows: options.appliedRows ?? [] }));
  const release = vi.fn();
  const client = {
    query: clientQuery as unknown as PoolClient["query"],
    release,
  } as unknown as PoolClient;
  const query = vi.fn(async () => options.latestResult);
  const connect = vi.fn(async () => client);
  return {
    query,
    service: new PostgresOperationsReadService({
      pool: { connect, query } as unknown as Pool,
      migrations: options.migrations ?? [],
      legacyOrphanSource: noLegacyOrphans,
    }),
  };
}

function hostileQueryResults() {
  let accessorReads = 0;
  let proxyTraps = 0;

  const accessorResult = {};
  Object.defineProperty(accessorResult, "rows", {
    get() {
      accessorReads += 1;
      throw new Error("raw rows accessor detail");
    },
  });

  const indexAccessorRows = Array(1);
  Object.defineProperty(indexAccessorRows, "0", {
    get() {
      accessorReads += 1;
      throw new Error("raw row index accessor detail");
    },
  });

  const proxiedResult = new Proxy(
    { rows: [] },
    {
      get(target, property, receiver) {
        if (property === "then") return Reflect.get(target, property, receiver);
        proxyTraps += 1;
        throw new Error("raw query result Proxy detail");
      },
    },
  );
  const proxiedRows = new Proxy(
    [],
    {
      get() {
        proxyTraps += 1;
        throw new Error("raw rows Proxy detail");
      },
    },
  );
  const revokedRows = Proxy.revocable([], {});
  revokedRows.revoke();

  return {
    results: [
      {},
      Object.create({ rows: [] }),
      { rows: Array(1) },
      accessorResult,
      { rows: indexAccessorRows },
      proxiedResult,
      { rows: proxiedRows },
      { rows: revokedRows.proxy },
    ] as const,
    accessorReads: () => accessorReads,
    proxyTraps: () => proxyTraps,
  };
}

function inheritedField(
  row: Readonly<Record<string, unknown>>,
  property: string,
): object {
  const own = { ...row };
  const value = own[property];
  delete own[property];
  return Object.assign(Object.create({ [property]: value }), own);
}

function accessorField(
  row: Readonly<Record<string, unknown>>,
  property: string,
  onRead: () => void,
): object {
  const own = { ...row };
  delete own[property];
  Object.defineProperty(own, property, {
    enumerable: true,
    get() {
      onRead();
      throw new Error(`raw ${property} accessor detail`);
    },
  });
  return own;
}

async function expectInvariant(operation: () => Promise<unknown>): Promise<void> {
  await expect(operation()).rejects.toThrow(operationsSummaryInvariantErrorMessage);
}

describe("PostgresOperationsReadService outbox projection", () => {
  it("projects valid rows without invoking a Date instance override", async () => {
    let overrideCalls = 0;
    const oldest = new Date("2026-08-28T00:00:00.000Z");
    Object.defineProperty(oldest, "toISOString", {
      value() {
        overrideCalls += 1;
        throw new Error("raw Date override detail");
      },
    });
    const { query, service } = createService({
      rows: [
        {
          event_type: "reception.created",
          pending_count: "2",
          delivered_count: 1,
          oldest_pending_created_at: oldest,
        },
      ],
    });

    await expect(service.outboxSummary(scope)).resolves.toEqual({
      pendingCount: 2,
      deliveredCount: 1,
      oldestPendingCreatedAt: "2026-08-28T00:00:00.000Z",
      byEventType: [
        {
          eventType: "reception.created",
          pendingCount: 2,
          deliveredCount: 1,
        },
      ],
      legacyOrphanCount: 0,
    });
    expect(overrideCalls).toBe(0);
    expect(query.mock.calls[0]?.[1]).toEqual([scope.tenantId, scope.pharmacyId]);
  });

  it("rejects hostile row sets, fields, counts, and instants without invoking them", async () => {
    const hostile = hostileQueryResults();
    for (const result of hostile.results) {
      const { service } = createService(result);
      await expectInvariant(() => service.outboxSummary(scope));
    }

    let accessorReads = 0;
    let proxyTraps = 0;
    let coercions = 0;
    const validRow: Record<string, unknown> = {
      event_type: "reception.created",
      pending_count: "1",
      delivered_count: 0,
      oldest_pending_created_at: null,
    };
    const coercive = {
      [Symbol.toPrimitive]() {
        coercions += 1;
        throw new Error("raw count coercion detail");
      },
    };
    const proxiedRow = new Proxy(validRow, {
      get() {
        proxyTraps += 1;
        throw new Error("raw row Proxy detail");
      },
    });
    const invalidRows = [
      inheritedField(validRow, "event_type"),
      accessorField(validRow, "event_type", () => {
        accessorReads += 1;
      }),
      proxiedRow,
      ...["", " ", "1e2", "0x10", "1.0", "-1", coercive].map(
        (pending_count) => ({ ...validRow, pending_count }),
      ),
      { ...validRow, oldest_pending_created_at: coercive },
    ];
    for (const row of invalidRows) {
      const { service } = createService({ rows: [row] });
      await expectInvariant(() => service.outboxSummary(scope));
    }

    expect(hostile.accessorReads()).toBe(0);
    expect(hostile.proxyTraps()).toBe(0);
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(coercions).toBe(0);
  });
});

describe("PostgresOperationsReadService reception projection", () => {
  it("projects valid rows and preserves tenant, pharmacy, and date parameters", async () => {
    const { query, service } = createService({
      rows: [
        {
          reception_status: "WAITING",
          eligibility_status: "VERIFIED",
          entry_count: "2",
        },
      ],
    });

    await expect(
      service.receptionSummary({ ...scope, date: businessDate }),
    ).resolves.toEqual({
      date: businessDate,
      totalCount: 2,
      byReceptionStatus: [
        { status: "WAITING", count: 2 },
        { status: "IN_PROGRESS", count: 0 },
        { status: "COMPLETED", count: 0 },
        { status: "CANCELLED", count: 0 },
      ],
      byEligibilityStatus: [
        { status: "VERIFIED", count: 2 },
        { status: "PENDING_REVERIFY", count: 0 },
        { status: "LOCAL_ONLY_UNVERIFIED", count: 0 },
        { status: "NOT_CHECKED", count: 0 },
      ],
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      scope.tenantId,
      scope.pharmacyId,
      businessDate,
    ]);
  });

  it("rejects hostile row sets, fields, and count coercion without invoking them", async () => {
    const hostile = hostileQueryResults();
    for (const result of hostile.results) {
      const { service } = createService(result);
      await expectInvariant(() =>
        service.receptionSummary({ ...scope, date: businessDate }),
      );
    }

    let accessorReads = 0;
    let proxyTraps = 0;
    let coercions = 0;
    const validRow: Record<string, unknown> = {
      reception_status: "WAITING",
      eligibility_status: "VERIFIED",
      entry_count: "1",
    };
    const coercive = {
      valueOf() {
        coercions += 1;
        throw new Error("raw reception count coercion detail");
      },
    };
    const invalidRows = [
      inheritedField(validRow, "reception_status"),
      accessorField(validRow, "eligibility_status", () => {
        accessorReads += 1;
      }),
      new Proxy(validRow, {
        get() {
          proxyTraps += 1;
          throw new Error("raw reception row Proxy detail");
        },
      }),
      { ...validRow, entry_count: coercive },
    ];
    for (const row of invalidRows) {
      const { service } = createService({ rows: [row] });
      await expectInvariant(() =>
        service.receptionSummary({ ...scope, date: businessDate }),
      );
    }

    expect(hostile.accessorReads()).toBe(0);
    expect(hostile.proxyTraps()).toBe(0);
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(coercions).toBe(0);
  });
});

describe("PostgresOperationsReadService latest migration projection", () => {
  it("projects zero or one latest row", async () => {
    const empty = createMigrationService({ latestResult: { rows: [] } });
    await expect(empty.service.migrationState()).resolves.toEqual({
      available: true,
      result: "up_to_date",
      appliedCount: 0,
      availableCount: 0,
      pendingVersions: [],
    });

    const one = createMigrationService({
      latestResult: {
        rows: [{ version: migration.version, name: migration.name }],
      },
      migrations: [migration],
      appliedRows: [
        {
          version: migration.version,
          name: migration.name,
          checksum_sha256: migration.checksumSha256,
        },
      ],
    });
    await expect(one.service.migrationState()).resolves.toEqual({
      available: true,
      result: "up_to_date",
      appliedCount: 1,
      availableCount: 1,
      pendingVersions: [],
      latestAppliedVersion: migration.version,
      latestAppliedName: migration.name,
    });
  });

  it("rejects hostile latest row sets and fields without invoking them", async () => {
    const hostile = hostileQueryResults();
    for (const latestResult of hostile.results) {
      const { service } = createMigrationService({ latestResult });
      await expectInvariant(() => service.migrationState());
    }

    let accessorReads = 0;
    let proxyTraps = 0;
    const validRow: Record<string, unknown> = {
      version: migration.version,
      name: migration.name,
    };
    const invalidRows = [
      inheritedField(validRow, "version"),
      accessorField(validRow, "name", () => {
        accessorReads += 1;
      }),
      new Proxy(validRow, {
        get() {
          proxyTraps += 1;
          throw new Error("raw migration row Proxy detail");
        },
      }),
    ];
    for (const row of invalidRows) {
      const { service } = createMigrationService({ latestResult: { rows: [row] } });
      await expectInvariant(() => service.migrationState());
    }

    expect(hostile.accessorReads()).toBe(0);
    expect(hostile.proxyTraps()).toBe(0);
    expect(accessorReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it("rejects more than one latest row", async () => {
    const { service } = createMigrationService({
      latestResult: {
        rows: [
          { version: "000002", name: "second" },
          { version: migration.version, name: migration.name },
        ],
      },
    });

    await expectInvariant(() => service.migrationState());
  });
});
