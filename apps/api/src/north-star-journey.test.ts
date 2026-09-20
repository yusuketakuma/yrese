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
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  PRESCRIPTION_CODE_MAPPING_REVIEW_REQUIRED_ERROR_CODE,
  pharmacyId,
  prescriptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import { dispensingRoutes } from "./dispensing-routes.js";
import { InMemoryDispensingService } from "./dispensing-service.js";
import { InMemoryMasterRepository } from "./master-repository.js";
import { operationsRoutes } from "./operations-routes.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { InMemoryOperationsReadService } from "./operations-service.js";
import { InMemoryPatientRepository } from "./patient-repository.js";
import { prescriptionDraftRoutes } from "./prescription-draft-routes.js";
import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
} from "./prescription-draft-service.js";
import { prescriptionLifecycleRoutes } from "./prescription-lifecycle-routes.js";
import {
  InMemoryReceptionOutbox,
  composeDefaultReceptionCreateCommand,
} from "./reception-command.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const businessDate = "2026-09-16";

const journeyScopes =
  "tenant:read,patient:read,reception:read,reception:write," +
  "prescription:read,prescription:write,prescription:confirm," +
  "dispensing:write,dispensing:confirm,master:read," +
  "audit-log:read,sync:read";

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
 * North Star 旅程 E2E ハーネス(WP-7104 layer 1 → WP-7405 で全行程化)。
 * main.ts の in_memory composition を再現し、inject() で
 * 合成患者検索→紙受付→対応開始→処方下書き→薬剤師確認→確定→調剤記録→
 * 調剤確定→監査/outbox 証跡 を貫通させる。
 * 算定・請求は未接続のまま対象外(Plans.md §18、RB-008/RB-001)。
 */
// WP-7405: 全行程 journey で使う確定処方の参照先 master seed。
const JOURNEY_MASTER_MED_VERSION = "00000000-0000-4000-8000-00000000a001";
const JOURNEY_MASTER_USAGE_VERSION = "00000000-0000-4000-8000-00000000a002";
const JOURNEY_MEDICATION_ITEM = "00000000-0000-4000-8000-00000000a011";
const JOURNEY_USAGE_ITEM = "00000000-0000-4000-8000-00000000a021";
const JOURNEY_RP_GROUP = "00000000-0000-4000-8000-00000000a031";
const JOURNEY_RP_ITEM = "00000000-0000-4000-8000-00000000a041";

async function seedJourneyMasters(master: InMemoryMasterRepository) {
  const scope = {
    tenantId: tenantId("tenant-001"),
    pharmacyId: pharmacyId("pharmacy-001"),
  };
  const recordedAt = "2026-09-16T02:00:00.000Z";
  await master.seedVersion({
    ...scope,
    masterVersionId: JOURNEY_MASTER_MED_VERSION,
    masterKind: "medication",
    version: "2026-09",
    validFrom: "2026-01-01",
    recordedAt,
  });
  await master.seedVersion({
    ...scope,
    masterVersionId: JOURNEY_MASTER_USAGE_VERSION,
    masterKind: "usage",
    version: "2026-09",
    validFrom: "2026-01-01",
    recordedAt,
  });
  await master.seedMedicationItem({
    ...scope,
    masterVersionId: JOURNEY_MASTER_MED_VERSION,
    medicationItemId: JOURNEY_MEDICATION_ITEM,
    localCode: "SYN-JRN-MED",
    name: "合成薬剤A 5mg",
    unit: "錠",
    genericFlag: "originator",
    genericNameCode: "GN-JRN-001",
    controlCategories: [],
  });
  await master.seedUsageItem({
    ...scope,
    masterVersionId: JOURNEY_MASTER_USAGE_VERSION,
    usageItemId: JOURNEY_USAGE_ITEM,
    localCode: "SYN-JRN-USG",
    text: "1日1回 朝食後",
  });
}

/** 全 Rp 解決済み + 原本 metadata 充足の confirm 可能 draft。 */
const structuredDraftBody = (expectedVersion: number) => ({
  patientId: "patient-syn-001",
  businessDate,
  expectedVersion,
  draft: {
    prescriptionType: "OUTPATIENT",
    prescriptionDate: "2026-09-15",
    defaultDays: 7,
    flags: [],
    note: "",
    rows: [],
    sourceMetadata: {
      medicalInstitution: { code: "1234567", name: "合成病院" },
      prescriberName: "合成 医師",
      issueDate: "2026-09-15",
      validUntil: "2026-09-19",
      refill: null,
      splitDispensing: null,
    },
    rpGroups: [
      {
        rpGroupId: JOURNEY_RP_GROUP,
        sequence: 1,
        dosageForm: "ORAL",
        usage: { kind: "resolved", usageItemId: JOURNEY_USAGE_ITEM },
        daysOrCount: 7,
        items: [
          {
            rpItemId: JOURNEY_RP_ITEM,
            sequence: 1,
            medication: {
              kind: "resolved",
              masterVersionId: JOURNEY_MASTER_MED_VERSION,
              medicationItemId: JOURNEY_MEDICATION_ITEM,
            },
            doseOnce: null,
            dosePerDay: null,
            doseTotal: "7錠",
            unit: null,
            genericNamePrescription: false,
            genericSubstitutionPermitted: null,
          },
        ],
      },
    ],
  },
});

function buildJourneyServer() {
  const patientRepository = new InMemoryPatientRepository();
  const receptionRepository = new InMemoryReceptionRepository();
  const auditRepository = new InMemoryAuditRepository();
  const receptionOutbox = new InMemoryReceptionOutbox();
  const masterRepository = new InMemoryMasterRepository();
  const qualificationRepository = new InMemoryActorQualificationRepository();
  const finalizedOutbox = new InMemoryPrescriptionFinalizedOutbox();
  const now = () => new Date("2026-09-16T02:00:00.000Z");
  // 全行程の journey actor には薬剤師資格を付与(SEC-010)。
  qualificationRepository.grant({
    tenantId: tenantId("tenant-001"),
    pharmacyId: pharmacyId("pharmacy-001"),
    actorId: userId("pharmacist-syn-001"),
    kind: "PHARMACIST_LICENSE",
  });
  const server = buildServer({
    patientRepository,
    receptionRepository,
    auditRepository,
    receptionOutbox,
    masterRepository,
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
  const prescriptionDraftService = new InMemoryPrescriptionDraftService(
    receptionRepository,
    auditRepository,
    () => prescriptionId("prescription-journey-001"),
    {
      qualificationRepository,
      finalizedOutbox,
      masterRepository,
    },
  );
  server.register(prescriptionDraftRoutes, {
    service: prescriptionDraftService,
    now,
  });
  server.register(prescriptionLifecycleRoutes, {
    service: prescriptionDraftService,
    now,
  });
  server.register(dispensingRoutes, {
    service: new InMemoryDispensingService({
      prescriptionSource: prescriptionDraftService,
      auditRepository,
      qualificationRepository,
      masterRepository,
      dispensingOutbox: finalizedOutbox,
    }),
  });
  server.register(operationsRoutes, {
    service: new InMemoryOperationsReadService(
      receptionOutbox,
      receptionRepository,
      finalizedOutbox,
    ),
  });
  return {
    server,
    receptionOutbox,
    auditRepository,
    masterRepository,
    finalizedOutbox,
  };
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

/**
 * WP-7405: North Star 全行程 journey(in_memory)。
 * 受付 → IN_PROGRESS → 原本 metadata + Rp 構造化(resolved)→ 薬剤師確認 →
 * 確定 → 調剤記録 create/confirm → audit/outbox evidence を貫通し、
 * fail-closed 経路(非資格 actor・未解決行・終端受付)を併せて検証する。
 */
describe("North Star full journey (WP-7405)", () => {
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

  it("reception → structured draft → confirm → finalize → dispensing → evidence", async () => {
    const { server: instance, masterRepository, finalizedOutbox } = server();
    await seedJourneyMasters(masterRepository);

    const reception = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-full-journey-001",
      },
    });
    expect(reception.statusCode).toBe(201);
    const { receptionId } = receptionQueueEntrySchema.parse(reception.json());

    // 受付 IN_PROGRESS(実 route 経由 — North Star の実経路に乗せる)。
    const started = await instance.inject({
      method: "POST",
      url: `/reception/${receptionId}/transitions`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: { to: "IN_PROGRESS", expectedVersion: 1 },
    });
    expect(started.statusCode).toBe(200);

    // master read 経路(実 route)で参照先を確認してから構造化 draft を保存。
    const masters = await instance.inject({
      method: "GET",
      url: `/masters/medications?asOf=${businessDate}&q=SYN-JRN-MED`,
      headers: journeyHeaders,
    });
    expect(masters.statusCode).toBe(200);
    expect(masters.json().items[0]?.medicationItemId).toBe(
      JOURNEY_MEDICATION_ITEM,
    );

    const saved = await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: journeyHeaders,
      payload: structuredDraftBody(0),
    });
    expect(saved.statusCode).toBe(201);
    const prescriptionIdValue = "prescription-journey-001";

    const confirmed = await instance.inject({
      method: "POST",
      url: `/prescriptions/${prescriptionIdValue}/confirm`,
      headers: {
        ...journeyHeaders,
        "idempotency-key": "ns-full-journey-confirm-001",
      },
      payload: {},
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().status).toBe("PHARMACIST_CONFIRMED");

    const finalized = await instance.inject({
      method: "POST",
      url: `/prescriptions/${prescriptionIdValue}/finalize`,
      headers: {
        ...journeyHeaders,
        "idempotency-key": "ns-full-journey-finalize-01",
      },
      payload: {},
    });
    expect(finalized.statusCode).toBe(200);
    expect(finalized.json().status).toBe("PRESCRIPTION_FINALIZED");

    const dispensed = await instance.inject({
      method: "POST",
      url: "/dispensings",
      headers: {
        ...journeyHeaders,
        "idempotency-key": "ns-full-journey-disp-0001",
      },
      payload: {
        prescriptionId: prescriptionIdValue,
        prescriptionVersion: 1,
        dispensingDate: businessDate,
        items: [
          {
            rpItemId: JOURNEY_RP_ITEM,
            dispensedMedicationItemId: JOURNEY_MEDICATION_ITEM,
            dispensedText: null,
            quantity: "7錠",
            remainingStockAdjustment: null,
            note: null,
          },
        ],
      },
    });
    expect(dispensed.statusCode).toBe(201);
    const dispensingIdValue = dispensed.json().dispensingId;

    const dispensingConfirmed = await instance.inject({
      method: "POST",
      url: `/dispensings/${dispensingIdValue}/confirm`,
      headers: {
        ...journeyHeaders,
        "idempotency-key": "ns-full-journey-dcfm-0001",
      },
      payload: {},
    });
    expect(dispensingConfirmed.statusCode).toBe(200);
    expect(dispensingConfirmed.json().status).toBe("DISPENSING_RECORDED");

    // audit / outbox evidence(種別集合と鎖整合性)。
    const audit = await instance.inject({
      method: "GET",
      url: "/audit/events?limit=200",
      headers: journeyHeaders,
    });
    const auditTypes = auditLogResponseSchema
      .parse(audit.json())
      .entries.map((entry) => entry.auditEventType);
    expect(auditTypes).toEqual(
      expect.arrayContaining([
        "reception.created",
        "reception.started",
        "prescription.created",
        "prescription.confirmed",
        "prescription.finalized",
        "dispensing.recorded",
        "dispensing.confirmed",
      ]),
    );
    expect(
      auditLogResponseSchema.parse(audit.json()).chainVerification.ok,
    ).toBe(true);

    const outbox = await instance.inject({
      method: "GET",
      url: "/operations/outbox-summary",
      headers: journeyHeaders,
    });
    const byEventType = outboxSummaryResponseSchema
      .parse(outbox.json())
      .byEventType.map((entry) => entry.eventType);
    expect(byEventType).toEqual(
      expect.arrayContaining(["reception.created", "prescription.finalized", "dispense.confirmed"]),
    );
    expect(
      finalizedOutbox
        .list(tenantId("tenant-001"), pharmacyId("pharmacy-001"))
        .map((entry) => entry.eventType),
    ).toEqual(
      expect.arrayContaining(["prescription.finalized", "dispense.confirmed"]),
    );
  });

  it("fail-closed: 非資格 actor は confirm 403 + deny 監査", async () => {
    const { server: instance, masterRepository, auditRepository } = server();
    await seedJourneyMasters(masterRepository);

    const reception = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-full-journey-002",
      },
    });
    const { receptionId } = receptionQueueEntrySchema.parse(reception.json());
    await instance.inject({
      method: "POST",
      url: `/reception/${receptionId}/transitions`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: { to: "IN_PROGRESS", expectedVersion: 1 },
    });
    await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: journeyHeaders,
      payload: structuredDraftBody(0),
    });

    const unqualified = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-journey-001/confirm",
      headers: {
        ...journeyHeaders,
        "x-dev-actor": "clerk-syn-001",
        "idempotency-key": "ns-full-journey-uq-0001",
      },
      payload: {},
    });
    expect(unqualified.statusCode).toBe(403);
    expect(unqualified.json().errorCode).toBe(
      AUTH_PERMISSION_DENIED_ERROR_CODE,
    );
    const auditTypes = (
      await auditRepository.list({
        tenantId: tenantId("tenant-001"),
        pharmacyId: pharmacyId("pharmacy-001"),
      })
    ).map((entry) => entry.auditEventType);
    expect(auditTypes).toContain("prescription.confirm.denied");
  });

  it("fail-closed: 未解決行を残す draft は confirm 409", async () => {
    const { server: instance } = server();

    const reception = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-full-journey-003",
      },
    });
    const { receptionId } = receptionQueueEntrySchema.parse(reception.json());
    await instance.inject({
      method: "POST",
      url: `/reception/${receptionId}/transitions`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: { to: "IN_PROGRESS", expectedVersion: 1 },
    });
    // legacy rows = UNRESOLVED_TEXT のまま保存 → confirm 不可。
    const saved = await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: journeyHeaders,
      payload: draftBody(0, "未解決行を残す"),
    });
    expect(saved.statusCode).toBe(201);

    const confirm = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-journey-001/confirm",
      headers: {
        ...journeyHeaders,
        "idempotency-key": "ns-full-journey-unres-01",
      },
      payload: {},
    });
    expect(confirm.statusCode).toBe(409);
    expect(confirm.json().errorCode).toBe(
      PRESCRIPTION_CODE_MAPPING_REVIEW_REQUIRED_ERROR_CODE,
    );
  });

  it("fail-closed: 終端受付(COMPLETED)への draft 保存は 404", async () => {
    const { server: instance } = server();

    const reception = await instance.inject({
      method: "POST",
      url: "/reception",
      headers: journeyHeaders,
      payload: {
        patientId: "patient-syn-001",
        idempotencyKey: "ns-full-journey-004",
      },
    });
    const { receptionId } = receptionQueueEntrySchema.parse(reception.json());
    await instance.inject({
      method: "POST",
      url: `/reception/${receptionId}/transitions`,
      headers: { ...journeyHeaders, "if-match": '"1"' },
      payload: { to: "IN_PROGRESS", expectedVersion: 1 },
    });
    const completed = await instance.inject({
      method: "POST",
      url: `/reception/${receptionId}/transitions`,
      headers: { ...journeyHeaders, "if-match": '"2"' },
      payload: { to: "COMPLETED", expectedVersion: 2 },
    });
    expect(completed.statusCode).toBe(200);

    const saved = await instance.inject({
      method: "PUT",
      url: `/prescription-drafts/by-reception/${receptionId}`,
      headers: journeyHeaders,
      payload: draftBody(0, "終端受付への保存"),
    });
    // 非 editable 受付は draft 保存経路で 404(scope 内存在しない扱い)。
    expect(saved.statusCode).toBe(404);
  });
});
