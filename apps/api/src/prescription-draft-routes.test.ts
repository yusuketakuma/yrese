import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  frameworkErrorResponseSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftContent,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import { InMemoryMasterRepository } from "./master-repository.js";
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
    sourceMetadata: null,
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
    // rows-only 入力は UNRESOLVED_TEXT 構造へ読み替えて応答する(DOM-002 §4.2b)。
    expect(prescriptionDraftResponseSchema.parse(read.json())).toMatchObject({
      prescriptionId: "prescription-route-test-001",
      version: 1,
      draft: {
        rows: [],
        rpGroups: [
          {
            sequence: 1,
            dosageForm: "UNSPECIFIED",
            usage: { kind: "unresolved", text: "1日1回 朝食後" },
            items: [
              {
                sequence: 1,
                medication: {
                  kind: "unresolved",
                  text: "合成薬剤 5mg",
                },
              },
            ],
          },
        ],
      },
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

  it("round-trips structured rpGroups and rejects rows+rpGroups dual input", async () => {
    const instance = server();
    const structuredBody = {
      ...baseBody,
      draft: {
        ...baseBody.draft,
        rows: [],
        rpGroups: [
          {
            rpGroupId: "00000000-0000-4000-8000-000000000001",
            sequence: 1,
            dosageForm: "ORAL",
            usage: {
              kind: "resolved",
              usageItemId: "00000000-0000-4000-8000-000000000002",
            },
            daysOrCount: 7,
            items: [
              {
                rpItemId: "00000000-0000-4000-a000-000000000001",
                sequence: 1,
                medication: {
                  kind: "resolved",
                  masterVersionId:
                    "00000000-0000-4000-8000-000000000003",
                  medicationItemId:
                    "00000000-0000-4000-8000-000000000004",
                },
                doseOnce: "1錠",
                dosePerDay: "3錠",
                doseTotal: "21錠",
                unit: "錠",
                genericNamePrescription: false,
                genericSubstitutionPermitted: true,
              },
            ],
          },
        ],
      },
    };

    const created = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: structuredBody,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      draft: {
        rows: [],
        rpGroups: [
          {
            sequence: 1,
            dosageForm: "ORAL",
            usage: { kind: "resolved" },
            items: [
              {
                medication: {
                  kind: "resolved",
                  medicationItemId:
                    "00000000-0000-4000-8000-000000000004",
                },
              },
            ],
          },
        ],
      },
    });

    // rows と rpGroups の両方を含む書込は曖昧なため 400 で拒否する。
    const dual = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: {
        ...baseBody,
        draft: {
          ...baseBody.draft,
          rpGroups: structuredBody.draft.rpGroups,
        },
      },
    });
    expect(dual.statusCode).toBe(400);
    expect(dual.headers["cache-control"]).toBe("no-store");
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
      createFromPrior: async () => {
        throw new Error(rawSentinel);
      },
      confirm: async () => {
        throw new Error(rawSentinel);
      },
      finalize: async () => {
        throw new Error(rawSentinel);
      },
      createInquiry: async () => {
        throw new Error(rawSentinel);
      },
      answerInquiry: async () => {
        throw new Error(rawSentinel);
      },
      amend: async () => {
        throw new Error(rawSentinel);
      },
      listVersions: async () => {
        throw new Error(rawSentinel);
      },
      getVersion: async () => {
        throw new Error(rawSentinel);
      },
      listInquiries: async () => {
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

  it("serves fixed failures without request-time schema validation (WP-5270)", async () => {
    const instance = server();
    await instance.ready();
    const parseSpy = vi.spyOn(frameworkErrorResponseSchema, "parse");
    try {
      const response = await instance.inject({
        method: "PUT",
        url: "/prescription-drafts/by-reception/reception-syn-001",
        headers: authorizedHeaders,
        payload: { ...baseBody, businessDate: "2026-02-30" },
      });

      expect(response.statusCode).toBe(400);
      expect(parseSpy).not.toHaveBeenCalled();
      expect(response.json()).toEqual({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid prescription draft request",
      });
    } finally {
      parseSpy.mockRestore();
    }
  });

  // ---- WP-7304 / PRD-001 M4: 前回 Do route ----

  describe("from-prior copy (WP-7304)", () => {
    const COPY_MED_VERSION = "00000000-0000-4000-8000-0000000000c1";
    const COPY_MED_ITEM = "00000000-0000-4000-8000-0000000000d1";
    const COPY_USAGE_ITEM = "00000000-0000-4000-8000-0000000000e4";

    function copyService() {
      const receptionRepository = new InMemoryReceptionRepository();
      const auditRepository = new InMemoryAuditRepository();
      const qualification = new InMemoryActorQualificationRepository();
      qualification.grant({
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
        actorId: userId("actor-prescription-001"),
        kind: "PHARMACIST_LICENSE",
      });
      const masters = new InMemoryMasterRepository();
      let counter = 0;
      const service = new InMemoryPrescriptionDraftService(
        receptionRepository,
        auditRepository,
        () =>
          prescriptionId(
            `prescription-route-copy-${String(++counter).padStart(2, "0")}`,
          ),
        { qualificationRepository: qualification, masterRepository: masters },
      );
      return { masters, service };
    }

    async function seedCopyMasters(masters: InMemoryMasterRepository) {
      const seedScope = {
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
      };
      await masters.seedVersion({
        ...seedScope,
        masterVersionId: COPY_MED_VERSION,
        masterKind: "medication",
        version: "2026-07-01",
        validFrom: "2026-07-01",
        recordedAt: "2026-07-01T00:00:00.000Z",
      });
      await masters.seedMedicationItem({
        ...seedScope,
        medicationItemId: COPY_MED_ITEM,
        masterVersionId: COPY_MED_VERSION,
        localCode: "MED001",
        name: "合成薬剤 5mg",
        unit: "錠",
        genericFlag: "unclassified",
      });
      await masters.seedVersion({
        ...seedScope,
        masterVersionId: "00000000-0000-4000-8000-0000000000e3",
        masterKind: "usage",
        version: "2026-07-01",
        validFrom: "2026-07-01",
        recordedAt: "2026-07-01T00:00:00.000Z",
      });
      await masters.seedUsageItem({
        ...seedScope,
        usageItemId: COPY_USAGE_ITEM,
        masterVersionId: "00000000-0000-4000-8000-0000000000e3",
        localCode: "U001",
        text: "1日1回 朝食後",
      });
    }

    const sourceDraft: PrescriptionDraftContent = {
      prescriptionType: "OUTPATIENT",
      sourceMetadata: {
        medicalInstitution: { code: "1234567", name: "合成病院" },
        prescriberName: "合成 医師",
        issueDate: "2026-07-01",
        validUntil: "2026-07-10",
        refill: null,
        splitDispensing: null,
      },
      prescriptionDate: "2026-07-09",
      defaultDays: 7,
      flags: [],
      note: "",
      rows: [],
      rpGroups: [
        {
          rpGroupId: "00000000-0000-4000-8000-0000000000a1",
          sequence: 1,
          dosageForm: "ORAL",
          usage: { kind: "resolved", usageItemId: COPY_USAGE_ITEM },
          daysOrCount: 7,
          items: [
            {
              rpItemId: "00000000-0000-4000-a000-0000000000a1",
              sequence: 1,
              medication: {
                kind: "resolved",
                masterVersionId: COPY_MED_VERSION,
                medicationItemId: COPY_MED_ITEM,
              },
              doseOnce: null,
              dosePerDay: null,
              doseTotal: "7錠",
              unit: "錠",
              genericNamePrescription: false,
              genericSubstitutionPermitted: null,
            },
          ],
        },
      ],
    };

    async function finalizedSource(service: InMemoryPrescriptionDraftService) {
      const lifecycleScope = {
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
        actorId: userId("actor-prescription-001"),
        wallClock: "2026-07-09T10:00:00.000Z",
      };
      await service.save({
        ...lifecycleScope,
        receptionId: receptionId("reception-syn-001"),
        patientId: patientId("patient-syn-001"),
        businessDate: "2026-07-09",
        expectedVersion: 0,
        draft: sourceDraft,
      });
      for (const [method, key] of [
        ["confirm", "confirm-key-000001"],
        ["finalize", "finalize-key-00001"],
      ] as const) {
        await service[method]({
          ...lifecycleScope,
          prescriptionId: prescriptionId("prescription-route-copy-01"),
          idempotencyKey: key,
        });
      }
    }

    const copyBody = {
      patientId: "patient-syn-002",
      businessDate: "2026-07-09",
      sourcePrescriptionId: "prescription-route-copy-01",
    } as const;

    it("creates a copied draft with copiedFrom provenance", async () => {
      const { masters, service } = copyService();
      await seedCopyMasters(masters);
      await finalizedSource(service);
      const instance = server(service);

      const response = await instance.inject({
        method: "POST",
        url: "/prescription-drafts/by-reception/reception-syn-002/from-prior",
        headers: authorizedHeaders,
        payload: copyBody,
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(
        prescriptionDraftSaveResponseSchema.parse(response.json()),
      ).toMatchObject({
        prescriptionId: "prescription-route-copy-02",
        saveDisposition: "created",
        copiedFrom: {
          prescriptionId: "prescription-route-copy-01",
          version: 1,
        },
        draft: { sourceMetadata: null, prescriptionDate: null },
      });
    });

    it("maps source/context misses to 404 and existing draft to 409", async () => {
      const { masters, service } = copyService();
      await seedCopyMasters(masters);
      await finalizedSource(service);
      const instance = server(service);

      const missingSource = await instance.inject({
        method: "POST",
        url: "/prescription-drafts/by-reception/reception-syn-002/from-prior",
        headers: authorizedHeaders,
        payload: { ...copyBody, sourcePrescriptionId: "prescription-none" },
      });
      expect(missingSource.statusCode).toBe(404);
      const missingVersion = await instance.inject({
        method: "POST",
        url: "/prescription-drafts/by-reception/reception-syn-002/from-prior",
        headers: authorizedHeaders,
        payload: { ...copyBody, sourceVersion: 9 },
      });
      expect(missingVersion.statusCode).toBe(404);
      const patientMismatch = await instance.inject({
        method: "POST",
        url: "/prescription-drafts/by-reception/reception-syn-002/from-prior",
        headers: authorizedHeaders,
        payload: { ...copyBody, patientId: "patient-syn-003" },
      });
      expect(patientMismatch.statusCode).toBe(404);
      const conflictResponse = await instance.inject({
        method: "POST",
        url: "/prescription-drafts/by-reception/reception-syn-001/from-prior",
        headers: authorizedHeaders,
        payload: { ...copyBody, patientId: "patient-syn-001" },
      });
      expect(conflictResponse.statusCode).toBe(409);
      expect(conflictResponse.headers["cache-control"]).toBe("no-store");
    });

    it("rejects invalid bodies with a fixed PHI-free 400", async () => {
      const { masters, service } = copyService();
      await seedCopyMasters(masters);
      await finalizedSource(service);
      const instance = server(service);

      for (const payload of [
        { ...copyBody, sourcePrescriptionId: undefined },
        { ...copyBody, sourceVersion: 0 },
        { ...copyBody, extra: "key" },
        { ...copyBody, businessDate: "2026-02-30" },
      ]) {
        const response = await instance.inject({
          method: "POST",
          url: "/prescription-drafts/by-reception/reception-syn-002/from-prior",
          headers: authorizedHeaders,
          payload,
        });
        expect(response.statusCode).toBe(400);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.json()).toEqual({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid prescription draft request",
        });
      }
    });

    it("requires prescription:write plus read scopes", async () => {
      const { masters, service } = copyService();
      await seedCopyMasters(masters);
      await finalizedSource(service);
      const instance = server(service);

      const response = await instance.inject({
        method: "POST",
        url: "/prescription-drafts/by-reception/reception-syn-002/from-prior",
        headers: {
          ...authorizedHeaders,
          "x-dev-scopes": "prescription:read,reception:read,patient:read",
        },
        payload: copyBody,
      });
      expect(response.statusCode).toBe(403);
      expect(response.headers["cache-control"]).toBe("no-store");
    });
  });
});
