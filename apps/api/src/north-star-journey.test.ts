import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  auditLogResponseSchema,
  outboxSummaryResponseSchema,
  patientSearchResponseSchema,
  patientSearchResultSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  receptionQueueEntrySchema,
  receptionQueueResponseSchema,
} from "@yrese/contracts";
import {
  pharmacyId,
  prescriptionId,
  tenantId,
} from "@yrese/shared-kernel";

import { InMemoryAuditRepository } from "./audit-repository.js";
import { operationsRoutes } from "./operations-routes.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { InMemoryOperationsReadService } from "./operations-service.js";
import { InMemoryPatientRepository } from "./patient-repository.js";
import { prescriptionDraftRoutes } from "./prescription-draft-routes.js";
import { InMemoryPrescriptionDraftService } from "./prescription-draft-service.js";
import {
  InMemoryReceptionOutbox,
  composeDefaultReceptionCreateCommand,
} from "./reception-command.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const businessDate = "2026-09-16";

const journeyScopes =
  "tenant:read,patient:read,reception:read,reception:write," +
  "prescription:read,prescription:write,audit-log:read,sync:read";

const journeyHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "pharmacist-syn-001",
  "x-dev-scopes": journeyScopes,
} as const;

const otherTenantHeaders = {
  "x-dev-tenant": "tenant-002",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "pharmacist-syn-001",
  "x-dev-scopes": journeyScopes,
} as const;

const draftBody = (expectedVersion: number, note: string) => ({
  patientId: "patient-syn-001",
  businessDate,
  expectedVersion,
  draft: {
    prescriptionType: "OUTPATIENT",
    sourceMetadata: null,
    prescriptionDate: "2026-09-15",
    defaultDays: 7,
    flags: [],
    note,
    rows: [
      {
        sequence: 1,
        drugText: "合成薬剤A 5mg",
        usageText: "1日1回 朝食後",
        days: 7,
        quantityText: "7錠",
      },
    ],
  },
});

/**
 * North Star 部分旅程 E2E ハーネス(WP-7104 layer 1)。
 * main.ts の in_memory composition を再現し、inject() で
 * 合成患者検索→紙受付→処方下書き→監査/outbox 証跡 を貫通させる。
 * 薬剤師確認・確定・調剤記録・算定は未実装のため対象外(Plans.md §18)。
 */
function buildJourneyServer() {
  const patientRepository = new InMemoryPatientRepository();
  const receptionRepository = new InMemoryReceptionRepository();
  const auditRepository = new InMemoryAuditRepository();
  const receptionOutbox = new InMemoryReceptionOutbox();
  const now = () => new Date("2026-09-16T02:00:00.000Z");
  const server = buildServer({
    patientRepository,
    receptionRepository,
    auditRepository,
    receptionOutbox,
    receptionCreateCommand: composeDefaultReceptionCreateCommand({
      receptionRepository,
      auditRepository,
      outbox: receptionOutbox,
    }),
    repositoryMode: "in_memory",
    tenantContextMode: "dev_headers",
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
    now,
  });
  server.register(prescriptionDraftRoutes, {
    service: new InMemoryPrescriptionDraftService(
      receptionRepository,
      auditRepository,
      () => prescriptionId("prescription-journey-001"),
    ),
    now,
  });
  server.register(operationsRoutes, {
    service: new InMemoryOperationsReadService(
      receptionOutbox,
      receptionRepository,
    ),
  });
  return { server, receptionOutbox, auditRepository };
}

describe("North Star partial journey (WP-7104)", () => {
  const instances: ReturnType<typeof buildJourneyServer>[] = [];

  afterEach(async () => {
    await Promise.all(
      instances.splice(0).map(({ server }) => server.close()),
    );
  });

  function server() {
    const instance = buildJourneyServer();
    instances.push(instance);
    return instance;
  }

  it("patient search → paper reception → draft save → audit/outbox evidence", async () => {
    const { server: instance, receptionOutbox, auditRepository } = server();

    const search = await instance.inject({
      method: "GET",
      url: "/patients/search?q=" + encodeURIComponent("合成患者A"),
      headers: journeyHeaders,
    });
    expect(search.statusCode).toBe(200);
    expect(search.headers["cache-control"]).toBe("no-store");
    const searchBody = patientSearchResponseSchema.parse(search.json());
    expect(searchBody.results.map((r) => r.patientId)).toContain(
      "patient-syn-001",
    );

    const patient = await instance.inject({
      method: "GET",
      url: "/patients/patient-syn-001",
      headers: journeyHeaders,
    });
    expect(patient.statusCode).toBe(200);
    expect(
      patientSearchResultSchema.parse(patient.json()).patientNumber,
    ).toBe("SYN-001");

    const reception = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-journey-001",
      },
    });
    expect(reception.statusCode).toBe(201);
    const createdReception = receptionQueueEntrySchema.parse(
      reception.json(),
    );
    expect(createdReception.receptionStatus).toBe("WAITING");
    expect(createdReception.prescriptionIntakeType).toBe("paper");
    const receptionId = createdReception.receptionId;

    const queue = await instance.inject({
      method: "GET",
      url: `/reception/queue?date=${businessDate}`,
      headers: journeyHeaders,
    });
    expect(queue.statusCode).toBe(200);
    const queueBody = receptionQueueResponseSchema.parse(queue.json());
    expect(
      queueBody.entries.map((entry) => entry.receptionId),
    ).toContain(receptionId);

    const emptyDraft = await instance.inject({
      method: "GET",
      url:
        `/prescription-drafts/by-reception/${receptionId}` +
        `?date=${businessDate}`,
      headers: journeyHeaders,
    });
    expect(emptyDraft.statusCode).toBe(204);

    const created = await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: journeyHeaders,
      payload: draftBody(0, "初回保存"),
    });
    expect(created.statusCode).toBe(201);
    expect(
      prescriptionDraftSaveResponseSchema.parse(created.json()),
    ).toMatchObject({
      receptionId,
      patientId: "patient-syn-001",
      version: 1,
      saveDisposition: "created",
    });

    const updated = await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: draftBody(1, "修正保存"),
    });
    expect(updated.statusCode).toBe(200);
    expect(
      prescriptionDraftSaveResponseSchema.parse(updated.json()).version,
    ).toBe(2);

    const read = await instance.inject({
      method: "GET",
      url:
        `/prescription-drafts/by-reception/${receptionId}` +
        `?date=${businessDate}`,
      headers: journeyHeaders,
    });
    expect(read.statusCode).toBe(200);
    expect(
      prescriptionDraftResponseSchema.parse(read.json()),
    ).toMatchObject({ version: 2, receptionId });

    const outbox = await instance.inject({
      method: "GET",
      url: "/operations/outbox-summary",
      headers: journeyHeaders,
    });
    expect(outbox.statusCode).toBe(200);
    const outboxBody = outboxSummaryResponseSchema.parse(outbox.json());
    expect(outboxBody.byEventType).toContainEqual(
      expect.objectContaining({
        eventType: "reception.created",
        pendingCount: 1,
      }),
    );
    expect(
      receptionOutbox.list({
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
      }),
    ).toHaveLength(1);

    const audit = await instance.inject({
      method: "GET",
      url: "/audit/events?limit=200",
      headers: journeyHeaders,
    });
    expect(audit.statusCode).toBe(200);
    const auditBody = auditLogResponseSchema.parse(audit.json());
    expect(auditBody.chainVerification.ok).toBe(true);
    expect(auditBody.totalCount).toBe(7);
    // 固定時計で wallClock が同一のため、順序ではなく種別集合を検証する。
    expect(
      auditBody.entries.map((entry) => entry.auditEventType).sort(),
    ).toEqual(
      [
        "patient.searched",
        "patient.viewed",
        "prescription.created",
        "prescription.draft.viewed",
        "prescription.updated",
        "reception.created",
        "reception.queue.viewed",
      ].sort(),
    );
    // 応答確定後に audit.viewed が append されるため保存件数は 8。
    await expect(
      auditRepository.list({
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
      }),
    ).resolves.toHaveLength(8);
  });

  it("converges response-loss retries to one durable reception", async () => {
    const { server: instance } = server();

    const first = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-journey-retry-001",
      },
    });
    expect(first.statusCode).toBe(201);

    const retry = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-journey-retry-001",
      },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());

    const queue = await instance.inject({
      method: "GET",
      url: `/reception/queue?date=${businessDate}`,
      headers: journeyHeaders,
    });
    const entries = receptionQueueResponseSchema
      .parse(queue.json())
      .entries.filter(
        (entry) => entry.patient.patientId === "patient-syn-001",
      );
    expect(entries).toHaveLength(1);
  });

  it("rejects stale draft versions and out-of-tenant reads fail-closed", async () => {
    const { server: instance } = server();

    const reception = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-journey-003",
      },
    });
    const { receptionId } = receptionQueueEntrySchema.parse(
      reception.json(),
    );

    await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: journeyHeaders,
      payload: draftBody(0, "v1"),
    });
    await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: draftBody(1, "v2"),
    });

    const stale = await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: draftBody(1, "stale retry"),
    });
    expect(stale.statusCode).toBe(409);

    const crossTenantDraft = await instance.inject({
      method: "GET",
      url:
        `/prescription-drafts/by-reception/${receptionId}` +
        `?date=${businessDate}`,
      headers: otherTenantHeaders,
    });
    expect(crossTenantDraft.statusCode).toBe(404);

    const crossTenantPatient = await instance.inject({
      method: "GET",
      url: "/patients/patient-syn-001",
      headers: otherTenantHeaders,
    });
    expect(crossTenantPatient.statusCode).toBe(404);

    const queue = await instance.inject({
      method: "GET",
      url: `/reception/queue?date=${businessDate}`,
      headers: journeyHeaders,
    });
    const entries = receptionQueueResponseSchema.parse(queue.json())
      .entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.receptionId).toBe(receptionId);

    const denied = await instance.inject({
      method: "GET",
      url: `/reception/queue?date=${businessDate}`,
      headers: {
        "x-dev-tenant": "tenant-001",
        "x-dev-pharmacy": "pharmacy-001",
        "x-dev-actor": "viewer-syn-001",
        "x-dev-scopes": "patient:read",
      },
    });
    expect(denied.statusCode).toBe(403);
  });
});
