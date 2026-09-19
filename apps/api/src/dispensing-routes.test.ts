import { randomBytes } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  dispensingRecordCreateResponseSchema,
  dispensingConfirmResponseSchema,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  dispensingId,
  DISPENSING_ALREADY_RECORDED_ERROR_CODE,
  DISPENSING_GENERIC_MISMATCH_ERROR_CODE,
  DISPENSING_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  DISPENSING_INQUIRY_UNRESOLVED_ERROR_CODE,
  DISPENSING_INVALID_REQUEST_ERROR_CODE,
  DISPENSING_NOT_FOUND_ERROR_CODE,
  pharmacyId,
  prescriptionId,
  prescriptionInquiryId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import {
  InMemoryDispensingService,
  type DispensingService,
} from "./dispensing-service.js";
import { dispensingRoutes } from "./dispensing-routes.js";
import { InMemoryMasterRepository } from "./master-repository.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { prescriptionDraftRoutes } from "./prescription-draft-routes.js";
import { prescriptionLifecycleRoutes } from "./prescription-lifecycle-routes.js";
import { prescriptionAmendmentRoutes } from "./prescription-amendment-routes.js";
import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftService,
} from "./prescription-draft-service.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const PRESCRIPTION_ID = "prescription-dispensing-route-001";

const RP_ITEM_A = "00000000-0000-4000-8000-0000000000b1";
const MED_PRESCRIBED = "00000000-0000-4000-8000-0000000000d1";
const MED_GENERIC_OK = "00000000-0000-4000-8000-0000000000d2";
const MASTER_VERSION = "00000000-0000-4000-8000-0000000000c1";

const authorizedHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "actor-pharmacist-001",
  "x-dev-scopes":
    "prescription:read,prescription:write,prescription:confirm,reception:read,patient:read,dispensing:write,dispensing:confirm",
  "idempotency-key": "disp-route-key-00001",
} as const;

const CONFIRMABLE_DRAFT = {
  prescriptionType: "OUTPATIENT",
  sourceMetadata: {
    medicalInstitution: { code: "1234567", name: "合成病院" },
    prescriberName: "合成 医師",
    issueDate: "2026-08-20",
    validUntil: "2026-08-24",
    refill: null,
    splitDispensing: null,
  },
  rpGroups: [
    {
      rpGroupId: "00000000-0000-4000-8000-0000000000a1",
      sequence: 1,
      dosageForm: "ORAL",
      usage: { kind: "unresolved", text: "1日1回 朝食後" },
      daysOrCount: 7,
      items: [
        {
          rpItemId: RP_ITEM_A,
          sequence: 1,
          medication: {
            kind: "resolved",
            masterVersionId: MASTER_VERSION,
            medicationItemId: MED_PRESCRIBED,
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
  prescriptionDate: "2026-07-09",
  defaultDays: 7,
  flags: [],
  note: "",
  rows: [],
} as const;

interface HarnessOptions {
  readonly qualified?: boolean;
}

function buildDispensingTestServer(options?: HarnessOptions) {
  const receptionRepository = new InMemoryReceptionRepository();
  const auditRepository = new InMemoryAuditRepository();
  const qualificationRepository = new InMemoryActorQualificationRepository();
  const masterRepository = new InMemoryMasterRepository();
  const outbox = new InMemoryPrescriptionFinalizedOutbox();
  if (options?.qualified !== false) {
    qualificationRepository.grant({
      tenantId: tenantId("tenant-001"),
      pharmacyId: pharmacyId("pharmacy-001"),
      actorId: userId("actor-pharmacist-001"),
      kind: "PHARMACIST_LICENSE",
    });
  }
  const prescriptions: PrescriptionDraftService =
    new InMemoryPrescriptionDraftService(
      receptionRepository,
      auditRepository,
      () => prescriptionId(PRESCRIPTION_ID),
      {
        qualificationRepository,
        finalizedOutbox: outbox,
        nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e3",
        nextInquiryId: () =>
          prescriptionInquiryId("inquiry-disp-route-001"),
        masterRepository,
      },
    );
  let dispensingSeq = 0;
  const dispensing: DispensingService = new InMemoryDispensingService({
    prescriptionSource:
      prescriptions as InMemoryPrescriptionDraftService,
    auditRepository,
    qualificationRepository,
    masterRepository,
    dispensingOutbox: outbox,
    nextDispensingId: () =>
      dispensingId(
        `dispensing-route-${(++dispensingSeq).toString().padStart(3, "0")}`,
      ),
  });
  const instance = buildServer({
    receptionRepository,
    auditRepository,
    repositoryMode: "in_memory",
    tenantContextMode: "dev_headers",
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
  });
  instance.register(prescriptionDraftRoutes, { service: prescriptions });
  instance.register(prescriptionLifecycleRoutes, {
    service: prescriptions,
    now: () => new Date("2026-08-25T00:00:00.000Z"),
  });
  instance.register(prescriptionAmendmentRoutes, {
    service: prescriptions,
    now: () => new Date("2026-08-25T01:00:00.000Z"),
  });
  instance.register(dispensingRoutes, {
    service: dispensing,
    now: () => new Date("2026-08-25T02:00:00.000Z"),
  });
  return instance;
}

type Injectable = Pick<FastifyInstance, "inject">;

async function saveAndFinalize(instance: Injectable) {
  const saved = await instance.inject({
    method: "PUT",
    url: "/prescription-drafts/by-reception/reception-syn-001",
    headers: authorizedHeaders,
    payload: {
      patientId: "patient-syn-001",
      businessDate: "2026-07-09",
      expectedVersion: 0,
      draft: CONFIRMABLE_DRAFT,
    },
  });
  expect(saved.statusCode).toBe(201);
  const confirmed = await instance.inject({
    method: "POST",
    url: `/prescriptions/${PRESCRIPTION_ID}/confirm`,
    headers: authorizedHeaders,
  });
  expect(confirmed.statusCode).toBe(200);
  const finalized = await instance.inject({
    method: "POST",
    url: `/prescriptions/${PRESCRIPTION_ID}/finalize`,
    headers: { ...authorizedHeaders, "idempotency-key": "finalize-key-0000001" },
  });
  expect(finalized.statusCode).toBe(200);
}

function createDispensing(instance: Injectable, key = "disp-key-00000000001") {
  return instance.inject({
    method: "POST",
    url: "/dispensings",
    headers: { ...authorizedHeaders, "idempotency-key": key },
    payload: {
      prescriptionId: PRESCRIPTION_ID,
      prescriptionVersion: 1,
      dispensingDate: "2026-08-25",
      items: [
        {
          rpItemId: RP_ITEM_A,
          dispensedMedicationItemId: MED_PRESCRIBED,
          dispensedText: null,
          quantity: "7",
          remainingStockAdjustment: null,
          note: null,
        },
      ],
    },
  });
}

describe("dispensing routes (WP-7404)", () => {
  const servers: ReturnType<typeof buildDispensingTestServer>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((instance) => instance.close()));
  });

  function server(options?: HarnessOptions) {
    const instance = buildDispensingTestServer(options);
    servers.push(instance);
    return instance;
  }

  it("creates and confirms a dispensing record end to end", async () => {
    const instance = server();
    await saveAndFinalize(instance);

    const created = await createDispensing(instance);
    expect(created.statusCode).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    const record = dispensingRecordCreateResponseSchema.parse(created.json());
    expect(record.status).toBeNull();
    expect(record.replayed).toBe(false);
    expect(record.prescriptionVersion).toBe(1);

    const confirmed = await instance.inject({
      method: "POST",
      url: `/dispensings/${record.dispensingId}/confirm`,
      headers: { ...authorizedHeaders, "idempotency-key": "disp-conf-00000001" },
      payload: {},
    });
    expect(confirmed.statusCode).toBe(200);
    const view = dispensingConfirmResponseSchema.parse(confirmed.json());
    expect(view.status).toBe("DISPENSING_RECORDED");
    expect(view.confirmedBy).toBe("actor-pharmacist-001");
    expect(view.replayed).toBe(false);

    const replay = await instance.inject({
      method: "POST",
      url: `/dispensings/${record.dispensingId}/confirm`,
      headers: { ...authorizedHeaders, "idempotency-key": "disp-conf-00000001" },
      payload: {},
    });
    expect(replay.statusCode).toBe(200);
    expect(
      dispensingConfirmResponseSchema.parse(replay.json()).replayed,
    ).toBe(true);
  });

  it("returns 403 without dispensing:write scope", async () => {
    const instance = server();
    const response = await instance.inject({
      method: "POST",
      url: "/dispensings",
      headers: {
        ...authorizedHeaders,
        "x-dev-scopes": "prescription:read,prescription:write",
      },
      payload: {
        prescriptionId: PRESCRIPTION_ID,
        prescriptionVersion: 1,
        dispensingDate: "2026-08-25",
        items: [
          {
            rpItemId: RP_ITEM_A,
            dispensedMedicationItemId: MED_PRESCRIBED,
            dispensedText: null,
            quantity: "7",
            remainingStockAdjustment: null,
            note: null,
          },
        ],
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);
  });

  it("returns 403 for confirm without dispensing:confirm scope", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const created = await createDispensing(instance);
    const record = dispensingRecordCreateResponseSchema.parse(created.json());
    const response = await instance.inject({
      method: "POST",
      url: `/dispensings/${record.dispensingId}/confirm`,
      headers: {
        ...authorizedHeaders,
        "x-dev-scopes": "dispensing:write",
        "idempotency-key": "disp-conf-00000001",
      },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
  });

  it("returns 403 for confirm without pharmacist qualification (SEC-010)", async () => {
    const instance = server({ qualified: false });
    const response = await instance.inject({
      method: "POST",
      url: "/dispensings/dispensing-nonexistent-1/confirm",
      headers: { ...authorizedHeaders, "idempotency-key": "disp-conf-00000001" },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    // 存在非開示: record 有無に関わらず 403。
  });

  it("returns 400 for malformed create body", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const response = await instance.inject({
      method: "POST",
      url: "/dispensings",
      headers: authorizedHeaders,
      payload: {
        prescriptionId: PRESCRIPTION_ID,
        prescriptionVersion: 1,
        dispensingDate: "2026-08-25",
        items: [],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errorCode).toBe(
      DISPENSING_INVALID_REQUEST_ERROR_CODE,
    );
  });

  it("returns 404 for a missing prescription version", async () => {
    const instance = server();
    const response = await createDispensing(instance);
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe(DISPENSING_NOT_FOUND_ERROR_CODE);
  });

  it("returns 409 DSP-0001 while an inquiry is OPEN", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const inquiry = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/inquiries`,
      headers: { ...authorizedHeaders, "idempotency-key": "inquiry-key-0000001" },
      payload: { directedTo: "合成病院", content: "疑義" },
    });
    expect(inquiry.statusCode).toBe(200);
    const response = await createDispensing(instance);
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe(
      DISPENSING_INQUIRY_UNRESOLVED_ERROR_CODE,
    );
  });

  it("returns 409 DSP-0007 for a duplicate record on the same version", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const first = await createDispensing(instance);
    expect(first.statusCode).toBe(201);
    const second = await createDispensing(instance, "disp-key-00000000002");
    expect(second.statusCode).toBe(409);
    expect(second.json().errorCode).toBe(
      DISPENSING_ALREADY_RECORDED_ERROR_CODE,
    );
  });

  it("replays create on same key and returns 409 DSP-0008 on different payload", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const replay = await createDispensing(instance);
    expect(replay.statusCode).toBe(201);
    const again = await createDispensing(instance);
    expect(again.statusCode).toBe(200);
    expect(
      dispensingRecordCreateResponseSchema.parse(again.json()).replayed,
    ).toBe(true);
    const conflict = await instance.inject({
      method: "POST",
      url: "/dispensings",
      // 同一 key(disp-key-00000000001)+別 payload → DSP-0008。
      headers: {
        ...authorizedHeaders,
        "idempotency-key": "disp-key-00000000001",
      },
      payload: {
        prescriptionId: PRESCRIPTION_ID,
        prescriptionVersion: 1,
        dispensingDate: "2026-08-26",
        items: [
          {
            rpItemId: RP_ITEM_A,
            dispensedMedicationItemId: MED_PRESCRIBED,
            dispensedText: null,
            quantity: "14",
            remainingStockAdjustment: null,
            note: null,
          },
        ],
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().errorCode).toBe(
      DISPENSING_IDEMPOTENCY_CONFLICT_ERROR_CODE,
    );
  });

  it("returns 409 DSP-0004 for unpermitted generic substitution", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const response = await instance.inject({
      method: "POST",
      url: "/dispensings",
      headers: authorizedHeaders,
      payload: {
        prescriptionId: PRESCRIPTION_ID,
        prescriptionVersion: 1,
        dispensingDate: "2026-08-25",
        items: [
          {
            rpItemId: RP_ITEM_A,
            dispensedMedicationItemId: MED_GENERIC_OK,
            dispensedText: null,
            quantity: "7",
            remainingStockAdjustment: null,
            note: null,
          },
        ],
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe(
      DISPENSING_GENERIC_MISMATCH_ERROR_CODE,
    );
  });
});
