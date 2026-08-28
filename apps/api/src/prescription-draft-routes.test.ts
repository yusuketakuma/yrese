import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  frameworkErrorResponseSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  pharmacyId,
  prescriptionId,
  tenantId,
} from "@yrese/shared-kernel";

import { InMemoryAuditRepository } from "./audit-repository.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { prescriptionDraftRoutes } from "./prescription-draft-routes.js";
import {
  InMemoryPrescriptionDraftService,
  type PrescriptionDraftService,
} from "./prescription-draft-service.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const authorizedHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "actor-prescription-001",
  "x-dev-scopes": "prescription:read,prescription:write,reception:read,patient:read",
} as const;

const baseBody = {
  patientId: "patient-syn-001",
  businessDate: "2026-07-09",
  expectedVersion: 0,
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: "2026-07-09",
    defaultDays: 7,
    flags: ["PACKAGING"],
    note: "合成テスト用",
    rows: [
      {
        sequence: 1,
        drugText: "合成薬剤 5mg",
        usageText: "1日1回 朝食後",
        days: 7,
        quantityText: "7錠",
      },
    ],
  },
} as const;

const auditByServer = new WeakMap<object, InMemoryAuditRepository>();

function buildPrescriptionDraftTestServer(
  service?: PrescriptionDraftService,
  now: () => Date = () => new Date("2026-08-25T00:00:00.000Z"),
) {
  const receptionRepository = new InMemoryReceptionRepository();
  const auditRepository = new InMemoryAuditRepository();
  const server = buildServer({
    receptionRepository,
    auditRepository,
    repositoryMode: "in_memory",
    tenantContextMode: "dev_headers",
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
  });
  server.register(prescriptionDraftRoutes, {
    service:
      service ??
      new InMemoryPrescriptionDraftService(
        receptionRepository,
        auditRepository,
        () => prescriptionId("prescription-route-test-001"),
      ),
    now,
  });
  auditByServer.set(server, auditRepository);
  return server;
}

describe("prescription draft routes", () => {
  const servers: ReturnType<typeof buildPrescriptionDraftTestServer>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  function server(service?: PrescriptionDraftService, now?: () => Date) {
    const instance = buildPrescriptionDraftTestServer(service, now);
    servers.push(instance);
    return instance;
  }

  it("creates and reads a no-store versioned draft through authenticated scope", async () => {
    const instance = server();
    const empty = await instance.inject({
      method: "GET",
      url:
        "/prescription-drafts/by-reception/reception-syn-001" +
        "?date=2026-07-09",
      headers: authorizedHeaders,
    });

    expect(empty.statusCode).toBe(204);
    expect(empty.headers["cache-control"]).toBe("no-store");
    expect(empty.body).toBe("");

    const created = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: baseBody,
    });

    expect(created.statusCode).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(prescriptionDraftSaveResponseSchema.parse(created.json())).toMatchObject({
      prescriptionId: "prescription-route-test-001",
      receptionId: "reception-syn-001",
      patientId: "patient-syn-001",
      version: 1,
      saveDisposition: "created",
    });

    const read = await instance.inject({
      method: "GET",
      url:
        "/prescription-drafts/by-reception/reception-syn-001" +
        "?date=2026-07-09",
      headers: authorizedHeaders,
    });

    expect(read.statusCode).toBe(200);
    expect(read.headers["cache-control"]).toBe("no-store");
    expect(prescriptionDraftResponseSchema.parse(read.json())).toMatchObject({
      prescriptionId: "prescription-route-test-001",
      version: 1,
    });
    await expect(
      auditByServer.get(instance)?.list({
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
      }),
    ).resolves.toMatchObject([
      { auditEventType: "prescription.created" },
      { auditEventType: "prescription.draft.viewed" },
    ]);
  });

  it("uses the intrinsic wall clock without reading an own Date method", async () => {
    const rawSentinel = "raw own prescription clock method secret";
    const clock = new Date("2026-08-25T00:00:00.000Z");
    const ownToISOStringRead = vi.fn(() => {
      throw new Error(rawSentinel);
    });
    Object.defineProperty(clock, "toISOString", {
      configurable: true,
      get: ownToISOStringRead,
    });
    const now = vi.fn(() => clock);
    const instance = server(undefined, now);

    const response = await instance.inject({
      method: "GET",
      url:
        "/prescription-drafts/by-reception/reception-syn-001" +
        "?date=2026-07-09",
      headers: authorizedHeaders,
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(now).toHaveBeenCalledOnce();
    expect(ownToISOStringRead).not.toHaveBeenCalled();
    expect(response.body).not.toContain(rawSentinel);
  });

  it("returns 409 on stale content without echoing draft PHI", async () => {
    const instance = server();
    await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: baseBody,
    });

    const conflictingMarker = "raw-clinical-marker-must-not-leak";
    const response = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: {
        ...baseBody,
        draft: {
          ...baseBody.draft,
          rows: [{ ...baseBody.draft.rows[0], drugText: conflictingMarker }],
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).not.toContain(conflictingMarker);
    expect(response.json()).toEqual({
      statusCode: 409,
      error: "Conflict",
      message: "Prescription draft version conflict",
    });
  });

  it("requires a matching If-Match precondition for updates", async () => {
    const instance = server();
    await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: baseBody,
    });
    const update = {
      ...baseBody,
      expectedVersion: 1,
      draft: { ...baseBody.draft, note: "更新" },
    };

    const missing = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: update,
    });
    expect(missing.statusCode).toBe(400);

    const accepted = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: { ...authorizedHeaders, "if-match": '"1"' },
      payload: update,
    });
    expect(accepted.statusCode).toBe(200);
  });

  it("normalizes service failures without echoing raw details", async () => {
    const rawSentinel = "raw prescription repository failure secret";
    const instance = server({
      get: async () => {
        throw new Error(rawSentinel);
      },
      save: async () => {
        throw new Error(rawSentinel);
      },
    });

    const read = await instance.inject({
      method: "GET",
      url:
        "/prescription-drafts/by-reception/reception-syn-001" +
        "?date=2026-07-09",
      headers: authorizedHeaders,
    });
    const write = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: baseBody,
    });

    for (const response of [read, write]) {
      expect(response.statusCode).toBe(500);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(frameworkErrorResponseSchema.parse(response.json())).toEqual({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Prescription draft repository operation failed",
      });
      expect(response.body).not.toContain(rawSentinel);
    }
  });

  it("fails closed before data lookup when the tenant context cannot be constructed", async () => {
    const instance = server();
    const response = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: {
        "x-dev-tenant": authorizedHeaders["x-dev-tenant"],
        "x-dev-pharmacy": authorizedHeaders["x-dev-pharmacy"],
        "x-dev-scopes": authorizedHeaders["x-dev-scopes"],
      },
      payload: baseBody,
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
    });
  });

  it("returns not found for patient, date, or reception mismatches in a trusted scope", async () => {
    const instance = server();
    for (const body of [
      { ...baseBody, patientId: "patient-syn-002" },
      { ...baseBody, businessDate: "2026-07-10" },
    ]) {
      const response = await instance.inject({
        method: "PUT",
        url: "/prescription-drafts/by-reception/reception-syn-001",
        headers: authorizedHeaders,
        payload: body,
      });
      expect(response.statusCode).toBe(404);
      expect(response.headers["cache-control"]).toBe("no-store");
    }

    const wrongReception = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-002",
      headers: authorizedHeaders,
      payload: baseBody,
    });
    expect(wrongReception.statusCode).toBe(404);

    const patientIdInReadUrl = await instance.inject({
      method: "GET",
      url:
        "/prescription-drafts/by-reception/reception-syn-001" +
        "?patientId=patient-syn-002&date=2026-07-09",
      headers: authorizedHeaders,
    });
    expect(patientIdInReadUrl.statusCode).toBe(400);
  });

  it("requires all registered scopes and preserves the existing AUTH contract", async () => {
    const instance = server();
    const response = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: {
        ...authorizedHeaders,
        "x-dev-scopes": "prescription:write,reception:read",
      },
      payload: baseBody,
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      errorCode: AUTH_PERMISSION_DENIED_ERROR_CODE,
    });
  });

  it("rejects invalid IDs, dates, and body shapes with a fixed PHI-free 400", async () => {
    const instance = server();
    const marker = "raw-invalid-draft-marker";
    const response = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: {
        ...baseBody,
        businessDate: "2026-02-30",
        draft: {
          ...baseBody.draft,
          note: marker.repeat(300),
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).not.toContain(marker);
    expect(response.json()).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid prescription draft request",
    });
  });
});
