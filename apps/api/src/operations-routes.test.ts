import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  errorResponseSchema,
  frameworkErrorResponseSchema,
  migrationStateResponseSchema,
  outboxSummaryResponseSchema,
  receptionSummaryResponseSchema,
} from "@yrese/contracts";
import { AUTH_PERMISSION_DENIED_ERROR_CODE } from "@yrese/shared-kernel";

import {
  operationsMigrationStateReadErrorMessage,
  operationsOutboxSummaryReadErrorMessage,
  operationsReceptionSummaryReadErrorMessage,
  operationsRoutes,
} from "./operations-routes.js";
import {
  InMemoryOperationsReadService,
  type OperationsReadService,
} from "./operations-service.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { InMemoryReceptionOutbox } from "./reception-command.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const operationsHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "actor-operations-001",
  "x-dev-scopes": "sync:read,reception:read,tenant:admin",
} as const;

const receptionWriteHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "actor-operations-001",
  "x-dev-scopes": "reception:write,reception:read,patient:read",
} as const;

const rawSentinel = "raw operations failure secret be1";

function buildOperationsTestServer(service?: OperationsReadService) {
  const receptionRepository = new InMemoryReceptionRepository();
  const receptionOutbox = new InMemoryReceptionOutbox();
  const server = buildServer({
    receptionRepository,
    receptionOutbox,
    repositoryMode: "in_memory",
    tenantContextMode: "dev_headers",
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
  });
  server.register(operationsRoutes, {
    service:
      service ??
      new InMemoryOperationsReadService(receptionOutbox, receptionRepository),
  });
  return server;
}

const failingService: OperationsReadService = {
  outboxSummary: async () => {
    throw new Error(rawSentinel);
  },
  receptionSummary: async () => {
    throw new Error(rawSentinel);
  },
  migrationState: async () => {
    throw new Error(rawSentinel);
  },
};

describe("operations read routes", () => {
  const servers: ReturnType<typeof buildOperationsTestServer>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((instance) => instance.close()));
  });

  function server(service?: OperationsReadService) {
    const instance = buildOperationsTestServer(service);
    servers.push(instance);
    return instance;
  }

  it("counts the outbox intent that a real reception create actually appended", async () => {
    const instance = server();

    const empty = await instance.inject({
      method: "GET",
      url: "/operations/outbox-summary",
      headers: operationsHeaders,
    });
    expect(empty.statusCode).toBe(200);
    expect(outboxSummaryResponseSchema.parse(empty.json())).toEqual({
      pendingCount: 0,
      deliveredCount: 0,
      byEventType: [],
    });

    const created = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: receptionWriteHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "operations-routes-test-001",
      },
    });
    expect(created.statusCode).toBe(201);

    const response = await instance.inject({
      method: "GET",
      url: "/operations/outbox-summary",
      headers: operationsHeaders,
    });

    expect(response.statusCode).toBe(200);
    const summary = outboxSummaryResponseSchema.parse(response.json());
    expect(summary.pendingCount).toBe(1);
    expect(summary.deliveredCount).toBe(0);
    expect(summary.byEventType).toEqual([
      { eventType: "reception.created", pendingCount: 1, deliveredCount: 0 },
    ]);
    expect(typeof summary.oldestPendingCreatedAt).toBe("string");
    // 配送 worker が無い in-memory モードでは orphan 件数を導出していないので省略する。
    expect("legacyOrphanCount" in summary).toBe(false);
    // 識別子は一切運ばない(件数と時刻だけ)。
    expect(response.body).not.toContain("patient-syn-001");
    expect(response.body).not.toContain("reception-");
  });

  it("returns every reception and eligibility status member for a business date", async () => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url: "/operations/reception-summary?date=2026-07-09",
      headers: operationsHeaders,
    });

    expect(response.statusCode).toBe(200);
    const summary = receptionSummaryResponseSchema.parse(response.json());
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
  });

  it("never leaks patient identity through the reception summary", async () => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url: "/operations/reception-summary?date=2026-07-09",
      headers: operationsHeaders,
    });

    for (const forbidden of [
      "patient-syn-001",
      "patient-syn-002",
      "reception-syn-001",
      "合成患者",
      "ゴウセイカンジャ",
      "1980-01-01",
      "SYN-001",
    ]) {
      expect(response.body).not.toContain(forbidden);
    }
  });

  it("reports a measured zero summary for a date with no receptions", async () => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url: "/operations/reception-summary?date=2026-07-10",
      headers: operationsHeaders,
    });

    expect(response.statusCode).toBe(200);
    const summary = receptionSummaryResponseSchema.parse(response.json());
    expect(summary.totalCount).toBe(0);
    expect(summary.byReceptionStatus).toHaveLength(4);
    expect(summary.byEligibilityStatus).toHaveLength(4);
  });

  it.each([
    "/operations/reception-summary",
    "/operations/reception-summary?date=20260709",
    "/operations/reception-summary?date=2026-02-31",
    "/operations/reception-summary?date=2026-07-09T00:00:00Z",
  ])("rejects the malformed business date in %s as RCV-0001", async (url) => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url,
      headers: operationsHeaders,
    });

    expect(response.statusCode).toBe(400);
    expect(errorResponseSchema.parse(response.json()).errorCode).toBe("RCV-0001");
  });

  it("declares migration state unavailable in in-memory mode", async () => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url: "/operations/migration-state",
      headers: operationsHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(migrationStateResponseSchema.parse(response.json())).toEqual({
      available: false,
      reason: "PERSISTENT_STORE_NOT_CONFIGURED",
    });
    expect(response.body).not.toContain("postgres");
    expect(response.body).not.toContain("DATABASE_URL");
  });

  it.each([
    ["/operations/outbox-summary", "reception:read,tenant:admin"],
    ["/operations/reception-summary?date=2026-07-09", "sync:read,tenant:admin"],
    ["/operations/migration-state", "sync:read,reception:read"],
  ])("denies %s without its own scope as AUTH-0003", async (url, scopes) => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url,
      headers: { ...operationsHeaders, "x-dev-scopes": scopes },
    });

    expect(response.statusCode).toBe(403);
    expect(errorResponseSchema.parse(response.json()).errorCode).toBe(
      AUTH_PERMISSION_DENIED_ERROR_CODE,
    );
  });

  it("denies every operations route without any tenant context", async () => {
    const instance = server();

    for (const url of [
      "/operations/outbox-summary",
      "/operations/reception-summary?date=2026-07-09",
      "/operations/migration-state",
    ]) {
      const response = await instance.inject({ method: "GET", url });
      expect(response.statusCode).toBe(403);
    }
  });

  it("accepts reception:read alone for the reception summary (no patient scope)", async () => {
    const instance = server();

    const response = await instance.inject({
      method: "GET",
      url: "/operations/reception-summary?date=2026-07-09",
      headers: { ...operationsHeaders, "x-dev-scopes": "reception:read" },
    });

    expect(response.statusCode).toBe(200);
  });

  it.each([
    ["/operations/outbox-summary", operationsOutboxSummaryReadErrorMessage],
    [
      "/operations/reception-summary?date=2026-07-09",
      operationsReceptionSummaryReadErrorMessage,
    ],
    ["/operations/migration-state", operationsMigrationStateReadErrorMessage],
  ])(
    "normalizes a %s read failure to a constant-message framework 500",
    async (url, expectedMessage) => {
      const instance = server(failingService);

      const response = await instance.inject({
        method: "GET",
        url,
        headers: operationsHeaders,
      });

      expect(response.statusCode).toBe(500);
      expect(frameworkErrorResponseSchema.parse(response.json())).toMatchObject({
        statusCode: 500,
        error: "Internal Server Error",
        message: expectedMessage,
      });
      expect(response.body).not.toContain(rawSentinel);
    },
  );
});
