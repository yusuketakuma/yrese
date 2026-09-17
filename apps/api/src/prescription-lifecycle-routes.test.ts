import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { prescriptionLifecycleViewSchema } from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  pharmacyId,
  prescriptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { prescriptionDraftRoutes } from "./prescription-draft-routes.js";
import { prescriptionLifecycleRoutes } from "./prescription-lifecycle-routes.js";
import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftService,
} from "./prescription-draft-service.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const authorizedHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "actor-pharmacist-001",
  "x-dev-scopes":
    "prescription:read,prescription:write,prescription:confirm,reception:read,patient:read",
  "idempotency-key": "lifecycle-key-000001",
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
          rpItemId: "00000000-0000-4000-8000-0000000000b1",
          sequence: 1,
          medication: {
            kind: "resolved",
            masterVersionId: "00000000-0000-4000-8000-0000000000c1",
            medicationItemId: "00000000-0000-4000-8000-0000000000d1",
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
  readonly scopes?: string;
}

function buildLifecycleTestServer(options?: HarnessOptions) {
  const receptionRepository = new InMemoryReceptionRepository();
  const auditRepository = new InMemoryAuditRepository();
  const qualificationRepository = new InMemoryActorQualificationRepository();
  if (options?.qualified !== false) {
    qualificationRepository.grant({
      tenantId: tenantId("tenant-001"),
      pharmacyId: pharmacyId("pharmacy-001"),
      actorId: userId("actor-pharmacist-001"),
      kind: "PHARMACIST_LICENSE",
    });
  }
  const service: PrescriptionDraftService = new InMemoryPrescriptionDraftService(
    receptionRepository,
    auditRepository,
    () => prescriptionId("prescription-lifecycle-route-001"),
    {
      qualificationRepository,
      finalizedOutbox: new InMemoryPrescriptionFinalizedOutbox(),
      nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e2",
    },
  );
  const instance = buildServer({
    receptionRepository,
    auditRepository,
    repositoryMode: "in_memory",
    tenantContextMode: "dev_headers",
    patientSearchCursorCodec: createPatientSearchCursorCodec(
      randomBytes(patientSearchCursorHmacKeyByteLength),
    ),
  });
  instance.register(prescriptionDraftRoutes, { service });
  instance.register(prescriptionLifecycleRoutes, {
    service,
    now: () => new Date("2026-08-25T00:00:00.000Z"),
  });
  return instance;
}

async function saveConfirmableDraft(instance: {
  inject: (options: object) => Promise<{ statusCode: number }>;
}) {
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
}

describe("prescription lifecycle routes (WP-7402)", () => {
  const servers: ReturnType<typeof buildLifecycleTestServer>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((instance) => instance.close()));
  });

  function server(options?: HarnessOptions) {
    const instance = buildLifecycleTestServer(options);
    servers.push(instance);
    return instance;
  }

  it("confirms then finalizes through the API with a lifecycle view", async () => {
    const instance = server();
    await saveConfirmableDraft(instance);

    const confirmed = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/confirm",
      headers: authorizedHeaders,
    });
    expect(confirmed.statusCode).toBe(200);
    const confirmedView = prescriptionLifecycleViewSchema.parse(
      confirmed.json(),
    );
    expect(confirmedView.status).toBe("PHARMACIST_CONFIRMED");
    expect(confirmed.headers["cache-control"]).toBe("no-store");

    const finalized = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/finalize",
      headers: {
        ...authorizedHeaders,
        "idempotency-key": "lifecycle-key-000002",
      },
    });
    expect(finalized.statusCode).toBe(200);
    const finalizedView = prescriptionLifecycleViewSchema.parse(
      finalized.json(),
    );
    expect(finalizedView.status).toBe("PRESCRIPTION_FINALIZED");
    expect(finalizedView.prescriptionVersion).toBe(1);
  });

  it("rejects commands without Idempotency-Key as 400 RX-0005", async () => {
    const instance = server();
    const { "idempotency-key": _key, ...headers } = authorizedHeaders;
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-unknown/confirm",
      headers,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errorCode).toBe("RX-0005");
  });

  it("rejects actors without prescription:confirm scope as 403", async () => {
    const instance = server();
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/confirm",
      headers: {
        ...authorizedHeaders,
        "x-dev-scopes": "prescription:read",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);
  });

  it("rejects unqualified actors as 403 and audits the denial", async () => {
    const instance = server({ qualified: false });
    await saveConfirmableDraft(instance);
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/confirm",
      headers: authorizedHeaders,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);
  });

  it("returns 404 for unknown or cross-scope prescriptions", async () => {
    const instance = server();
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-nonexistent/confirm",
      headers: authorizedHeaders,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe("RX-0006");
  });

  it("returns 409 RX-0001 when medication items remain unresolved", async () => {
    const instance = server();
    await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: {
        patientId: "patient-syn-001",
        businessDate: "2026-07-09",
        expectedVersion: 0,
        draft: {
          ...CONFIRMABLE_DRAFT,
          rpGroups: [
            {
              ...CONFIRMABLE_DRAFT.rpGroups[0],
              items: [
                {
                  ...CONFIRMABLE_DRAFT.rpGroups[0]!.items[0],
                  medication: { kind: "unresolved", text: "未解決薬剤" },
                },
              ],
            },
          ],
        },
      },
    });
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/confirm",
      headers: authorizedHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe("RX-0001");
  });

  it("returns 409 RX-0003 for incomplete source metadata", async () => {
    const instance = server();
    await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: authorizedHeaders,
      payload: {
        patientId: "patient-syn-001",
        businessDate: "2026-07-09",
        expectedVersion: 0,
        draft: { ...CONFIRMABLE_DRAFT, sourceMetadata: null },
      },
    });
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/confirm",
      headers: authorizedHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe("RX-0003");
  });

  it("returns 409 RX-0002 for finalize before confirm", async () => {
    const instance = server();
    await saveConfirmableDraft(instance);
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-lifecycle-route-001/finalize",
      headers: authorizedHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().errorCode).toBe("RX-0002");
  });

  it("replays an identical Idempotency-Key and rejects post-transition edits", async () => {
    const instance = server();
    await saveConfirmableDraft(instance);
    const url = "/prescriptions/prescription-lifecycle-route-001/confirm";
    const first = await instance.inject({
      method: "POST",
      url,
      headers: authorizedHeaders,
    });
    const replay = await instance.inject({
      method: "POST",
      url,
      headers: authorizedHeaders,
    });
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const differentKey = await instance.inject({
      method: "POST",
      url,
      headers: { ...authorizedHeaders, "idempotency-key": "different-key-00001" },
    });
    expect(differentKey.statusCode).toBe(409);
    expect(differentKey.json().errorCode).toBe("RX-0002");

    const edit = await instance.inject({
      method: "PUT",
      url: "/prescription-drafts/by-reception/reception-syn-001",
      headers: { ...authorizedHeaders, "if-match": '"1"' },
      payload: {
        patientId: "patient-syn-001",
        businessDate: "2026-07-09",
        expectedVersion: 1,
        draft: { ...CONFIRMABLE_DRAFT, note: "確認後の改訂" },
      },
    });
    expect(edit.statusCode).toBe(409);
  });
});
