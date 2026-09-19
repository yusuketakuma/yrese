import { randomBytes } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  prescriptionInquiryViewSchema,
  prescriptionVersionViewSchema,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  pharmacyId,
  prescriptionId,
  prescriptionInquiryId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import {
  createPatientSearchCursorCodec,
  patientSearchCursorHmacKeyByteLength,
} from "./patient-search-cursor.js";
import { prescriptionAmendmentRoutes } from "./prescription-amendment-routes.js";
import { prescriptionDraftRoutes } from "./prescription-draft-routes.js";
import { prescriptionLifecycleRoutes } from "./prescription-lifecycle-routes.js";
import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftService,
} from "./prescription-draft-service.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";
import { buildServer } from "./server.js";

const PRESCRIPTION_ID = "prescription-amendment-route-001";

const authorizedHeaders = {
  "x-dev-tenant": "tenant-001",
  "x-dev-pharmacy": "pharmacy-001",
  "x-dev-actor": "actor-pharmacist-001",
  "x-dev-scopes":
    "prescription:read,prescription:write,prescription:confirm,reception:read,patient:read",
  "idempotency-key": "amendment-key-00001",
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

const AMENDED_CONTENT = {
  ...CONFIRMABLE_DRAFT,
  note: "疑義照会により用量訂正",
} as const;

interface HarnessOptions {
  readonly qualified?: boolean;
}

function buildAmendmentTestServer(options?: HarnessOptions) {
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
  let inquirySeq = 0;
  const service: PrescriptionDraftService = new InMemoryPrescriptionDraftService(
    receptionRepository,
    auditRepository,
    () => prescriptionId(PRESCRIPTION_ID),
    {
      qualificationRepository,
      finalizedOutbox: new InMemoryPrescriptionFinalizedOutbox(),
      nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e3",
      nextInquiryId: () =>
        prescriptionInquiryId(
          `inquiry-${(++inquirySeq).toString().padStart(3, "0")}`,
        ),
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
  instance.register(prescriptionAmendmentRoutes, {
    service,
    now: () => new Date("2026-08-25T01:00:00.000Z"),
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

async function recordInquiry(
  instance: Injectable,
  idempotencyKey = "inquiry-key-000001",
) {
  return instance.inject({
    method: "POST",
    url: `/prescriptions/${PRESCRIPTION_ID}/inquiries`,
    headers: { ...authorizedHeaders, "idempotency-key": idempotencyKey },
    payload: {
      directedTo: "合成病院 処方医",
      content: "用量が用法と整合しない疑義",
    },
  });
}

async function answerInquiry(
  instance: Injectable,
  inquiryId: string,
  result: "UNCHANGED" | "CHANGED" = "CHANGED",
  idempotencyKey = "answer-key-0000001",
) {
  return instance.inject({
    method: "POST",
    url: `/prescriptions/${PRESCRIPTION_ID}/inquiries/${inquiryId}/answer`,
    headers: { ...authorizedHeaders, "idempotency-key": idempotencyKey },
    payload: { answer: "用量を 7錠→14錠へ訂正", result },
  });
}

describe("prescription amendment routes (WP-7403)", () => {
  const servers: ReturnType<typeof buildAmendmentTestServer>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((instance) => instance.close()));
  });

  function server(options?: HarnessOptions) {
    const instance = buildAmendmentTestServer(options);
    servers.push(instance);
    return instance;
  }

  it("records an inquiry, answers CHANGED, amends to version 2, and reads both versions", async () => {
    const instance = server();
    await saveAndFinalize(instance);

    const created = await recordInquiry(instance);
    expect(created.statusCode).toBe(200);
    expect(created.headers["cache-control"]).toBe("no-store");
    const inquiry = prescriptionInquiryViewSchema.parse(created.json());
    expect(inquiry.status).toBe("OPEN");
    expect(inquiry.answer).toBeNull();

    const answered = await answerInquiry(instance, inquiry.inquiryId);
    expect(answered.statusCode).toBe(200);
    const resolved = prescriptionInquiryViewSchema.parse(answered.json());
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.result).toBe("CHANGED");
    expect(resolved.answeredBy).toBe("actor-pharmacist-001");

    const amended = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-00000001" },
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    expect(amended.statusCode).toBe(200);
    const version2 = prescriptionVersionViewSchema.parse(amended.json());
    expect(version2.version).toBe(2);
    expect(version2.supersedesVersion).toBe(1);
    expect(version2.inquiryId).toBe(inquiry.inquiryId);
    expect(version2.amendedBy).toBe("actor-pharmacist-001");

    const versions = await instance.inject({
      method: "GET",
      url: `/prescriptions/${PRESCRIPTION_ID}/versions`,
      headers: authorizedHeaders,
    });
    expect(versions.statusCode).toBe(200);
    expect(versions.headers["cache-control"]).toBe("no-store");
    const list = versions.json() as { versions: { version: number }[] };
    expect(list.versions.map((entry) => entry.version)).toEqual([1, 2]);

    const version1 = await instance.inject({
      method: "GET",
      url: `/prescriptions/${PRESCRIPTION_ID}/versions/1`,
      headers: authorizedHeaders,
    });
    expect(version1.statusCode).toBe(200);
    expect(version1.headers["cache-control"]).toBe("no-store");
    const old = prescriptionVersionViewSchema.parse(version1.json());
    expect(old.supersedesVersion).toBeNull();
    expect(old.inquiryId).toBeNull();
    expect(old.content.note).toBe("");

    const inquiries = await instance.inject({
      method: "GET",
      url: `/prescriptions/${PRESCRIPTION_ID}/inquiries`,
      headers: authorizedHeaders,
    });
    expect(inquiries.statusCode).toBe(200);
    expect(inquiries.headers["cache-control"]).toBe("no-store");
    const inquiryList = inquiries.json() as {
      inquiries: { inquiryId: string; status: string }[];
    };
    expect(inquiryList.inquiries).toHaveLength(1);
    expect(inquiryList.inquiries[0]?.status).toBe("RESOLVED");
  });

  it("rejects inquiry commands without Idempotency-Key or with invalid bodies as 400 RX-0008", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const { "idempotency-key": _key, ...headers } = authorizedHeaders;
    const missing = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/inquiries`,
      headers,
      payload: { directedTo: "合成病院", content: "疑義" },
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().errorCode).toBe("RX-0008");

    const invalid = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/inquiries`,
      headers: authorizedHeaders,
      payload: { directedTo: "", content: "疑義" },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().errorCode).toBe("RX-0008");
  });

  it("rejects inquiry recording without prescription:write scope as 403", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const response = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/inquiries`,
      headers: {
        ...authorizedHeaders,
        "x-dev-scopes": "prescription:read",
      },
      payload: { directedTo: "合成病院", content: "疑義" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);
  });

  it("returns 404 RX-0006 for inquiries on unknown prescriptions", async () => {
    const instance = server();
    const response = await instance.inject({
      method: "POST",
      url: "/prescriptions/prescription-nonexistent/inquiries",
      headers: authorizedHeaders,
      payload: { directedTo: "合成病院", content: "疑義" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().errorCode).toBe("RX-0006");
  });

  it("keeps the answer write-once: replay by same key, reject different key or payload", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const created = await recordInquiry(instance);
    const inquiry = prescriptionInquiryViewSchema.parse(created.json());

    const answered = await answerInquiry(instance, inquiry.inquiryId);
    const replay = await answerInquiry(instance, inquiry.inquiryId);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(answered.json());

    const differentPayload = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/inquiries/${inquiry.inquiryId}/answer`,
      headers: { ...authorizedHeaders, "idempotency-key": "answer-key-0000001" },
      payload: { answer: "別回答", result: "UNCHANGED" },
    });
    expect(differentPayload.statusCode).toBe(409);
    expect(differentPayload.json().errorCode).toBe("RX-0010");

    const differentKey = await answerInquiry(
      instance,
      inquiry.inquiryId,
      "CHANGED",
      "answer-key-0000002",
    );
    expect(differentKey.statusCode).toBe(409);
    expect(differentKey.json().errorCode).toBe("RX-0002");

    const missing = await answerInquiry(instance, "inquiry-nonexistent");
    expect(missing.statusCode).toBe(404);
    expect(missing.json().errorCode).toBe("RX-0009");
  });

  it("rejects amend without a resolved CHANGED inquiry as 422 RX-0007", async () => {
    const instance = server();
    await saveAndFinalize(instance);

    const noInquiry = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-0000001" },
      payload: { inquiryId: "inquiry-999", content: AMENDED_CONTENT },
    });
    expect(noInquiry.statusCode).toBe(422);
    expect(noInquiry.json().errorCode).toBe("RX-0007");

    const created = await recordInquiry(instance);
    const inquiry = prescriptionInquiryViewSchema.parse(created.json());
    const open = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-0000002" },
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    expect(open.statusCode).toBe(422);
    expect(open.json().errorCode).toBe("RX-0007");

    await answerInquiry(instance, inquiry.inquiryId, "UNCHANGED");
    const unchanged = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-0000003" },
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    expect(unchanged.statusCode).toBe(422);
    expect(unchanged.json().errorCode).toBe("RX-0007");
  });

  it("rejects amend for unqualified actors, missing confirm scope, and non-finalized prescriptions", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const created = await recordInquiry(instance);
    const inquiry = prescriptionInquiryViewSchema.parse(created.json());
    await answerInquiry(instance, inquiry.inquiryId);

    // SEC-010: 免許 evidence を持たない actor の amend は 403(unqualified)。
    const unqualified = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: {
        ...authorizedHeaders,
        "x-dev-actor": "actor-unqualified-001",
        "idempotency-key": "amend-key-0000000",
      },
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    expect(unqualified.statusCode).toBe(403);
    expect(unqualified.json().errorCode).toBe(
      AUTH_PERMISSION_DENIED_ERROR_CODE,
    );

    const noScope = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: {
        ...authorizedHeaders,
        "x-dev-scopes": "prescription:write",
        "idempotency-key": "amend-key-0000004",
      },
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    expect(noScope.statusCode).toBe(403);
    expect(noScope.json().errorCode).toBe(AUTH_PERMISSION_DENIED_ERROR_CODE);

    // 未確定 draft(confirm 前)への amend は 409 RX-0002。
    const draftOnly = server();
    await draftOnly.inject({
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
    const early = await draftOnly.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-0000005" },
      payload: { inquiryId: "inquiry-any", content: AMENDED_CONTENT },
    });
    expect(early.statusCode).toBe(409);
    expect(early.json().errorCode).toBe("RX-0002");
  });

  it("rejects amend bodies that fail validation as 400 RX-0005", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const { "idempotency-key": _key, ...headers } = authorizedHeaders;
    const missingKey = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers,
      payload: { inquiryId: "inquiry-001", content: AMENDED_CONTENT },
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.json().errorCode).toBe("RX-0005");

    const badBody = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: authorizedHeaders,
      payload: { inquiryId: "inquiry-001" },
    });
    expect(badBody.statusCode).toBe(400);
    expect(badBody.json().errorCode).toBe("RX-0005");
  });

  it("replays amend with the same key and rejects a different payload as 409 RX-0010", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const created = await recordInquiry(instance);
    const inquiry = prescriptionInquiryViewSchema.parse(created.json());
    await answerInquiry(instance, inquiry.inquiryId);

    const url = `/prescriptions/${PRESCRIPTION_ID}/amend`;
    const headers = {
      ...authorizedHeaders,
      "idempotency-key": "amend-key-0000001",
    };
    const first = await instance.inject({
      method: "POST",
      url,
      headers,
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    const replay = await instance.inject({
      method: "POST",
      url,
      headers,
      payload: { inquiryId: inquiry.inquiryId, content: AMENDED_CONTENT },
    });
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const different = await instance.inject({
      method: "POST",
      url,
      headers,
      payload: {
        inquiryId: inquiry.inquiryId,
        content: { ...AMENDED_CONTENT, note: "別内容" },
      },
    });
    expect(different.statusCode).toBe(409);
    expect(different.json().errorCode).toBe("RX-0010");
  });

  it("rejects a same-key amend bound to a different inquiry as 409 RX-0010", async () => {
    // F-1: command payload は {inquiryId, content} 全体の一致を要求する。
    const instance = server();
    await saveAndFinalize(instance);
    const first = await recordInquiry(instance);
    const inquiryA = prescriptionInquiryViewSchema.parse(first.json());
    await answerInquiry(instance, inquiryA.inquiryId);
    const amended = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-0000001" },
      payload: { inquiryId: inquiryA.inquiryId, content: AMENDED_CONTENT },
    });
    expect(amended.statusCode).toBe(200);

    const second = await recordInquiry(instance, "inquiry-key-000002");
    const inquiryB = prescriptionInquiryViewSchema.parse(second.json());
    await answerInquiry(instance, inquiryB.inquiryId, "CHANGED", "answer-key-0000002");
    const rebound = await instance.inject({
      method: "POST",
      url: `/prescriptions/${PRESCRIPTION_ID}/amend`,
      headers: { ...authorizedHeaders, "idempotency-key": "amend-key-0000001" },
      payload: { inquiryId: inquiryB.inquiryId, content: AMENDED_CONTENT },
    });
    expect(rebound.statusCode).toBe(409);
    expect(rebound.json().errorCode).toBe("RX-0010");
  });

  it("does not disclose cross-scope prescriptions on reads or commands", async () => {
    const instance = server();
    await saveAndFinalize(instance);
    const otherScope = {
      ...authorizedHeaders,
      "x-dev-tenant": "tenant-other",
    };
    for (const [method, url] of [
      ["GET", `/prescriptions/${PRESCRIPTION_ID}/versions`],
      ["GET", `/prescriptions/${PRESCRIPTION_ID}/versions/1`],
      ["GET", `/prescriptions/${PRESCRIPTION_ID}/inquiries`],
      ["POST", `/prescriptions/${PRESCRIPTION_ID}/inquiries`],
    ] as const) {
      const response = await instance.inject({
        method,
        url,
        headers: otherScope,
        ...(method === "POST"
          ? { payload: { directedTo: "合成病院", content: "疑義" } }
          : {}),
      });
      // 他 tenant は資格 evidence も無く amend 系は 403/404、read/inquiry は 404。
      expect([403, 404]).toContain(response.statusCode);
    }
  });
});
