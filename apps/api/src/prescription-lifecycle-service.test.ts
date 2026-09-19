import { describe, expect, it } from "vitest";

import {
  patientId,
  pharmacyId,
  prescriptionId,
  prescriptionInquiryId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import type { PrescriptionDraftContent } from "@yrese/contracts";
import { InMemoryMasterRepository } from "./master-repository.js";

import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftFromPriorInput,
  type PrescriptionDraftSaveInput,
  type PrescriptionLifecycleCommandInput,
} from "./prescription-draft-service.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";

const scope = {
  tenantId: tenantId("tenant-001"),
  pharmacyId: pharmacyId("pharmacy-001"),
  actorId: userId("actor-test-001"),
  receptionId: receptionId("reception-syn-001"),
  businessDate: "2026-07-09",
  wallClock: "2026-08-25T00:00:09.000Z",
} as const;

const RESOLVED_UUID_A = "00000000-0000-4000-8000-0000000000a1";
const RESOLVED_UUID_B = "00000000-0000-4000-8000-0000000000b1";
const RESOLVED_UUID_C = "00000000-0000-4000-8000-0000000000c1";
const RESOLVED_UUID_D = "00000000-0000-4000-8000-0000000000d1";

function confirmableDraft(): PrescriptionDraftContent {
  return {
    prescriptionType: "OUTPATIENT" as const,
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
        rpGroupId: RESOLVED_UUID_A,
        sequence: 1,
        dosageForm: "ORAL" as const,
        usage: { kind: "unresolved" as const, text: "1日1回 朝食後" },
        daysOrCount: 7,
        items: [
          {
            rpItemId: RESOLVED_UUID_B,
            sequence: 1,
            medication: {
              kind: "resolved" as const,
              masterVersionId: RESOLVED_UUID_C,
              medicationItemId: RESOLVED_UUID_D,
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
  };
}

function saveInput(
  draft: ReturnType<typeof confirmableDraft>,
): PrescriptionDraftSaveInput {
  return {
    ...scope,
    patientId: patientId("patient-syn-001"),
    expectedVersion: 0,
    draft,
  };
}

function command(
  prescription: string,
  idempotencyKey: string,
): PrescriptionLifecycleCommandInput {
  return {
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    prescriptionId: prescriptionId(prescription),
    idempotencyKey,
    wallClock: scope.wallClock,
  };
}

function harness(options?: { readonly qualified?: boolean }) {
  const audit = new InMemoryAuditRepository();
  const qualification = new InMemoryActorQualificationRepository();
  const outbox = new InMemoryPrescriptionFinalizedOutbox();
  if (options?.qualified !== false) {
    qualification.grant({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });
  }
  const service = new InMemoryPrescriptionDraftService(
    new InMemoryReceptionRepository(),
    audit,
    () => prescriptionId("prescription-lifecycle-001"),
    {
      qualificationRepository: qualification,
      finalizedOutbox: outbox,
      nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e1",
    },
  );
  return { audit, qualification, outbox, service };
}

describe("InMemoryPrescriptionDraftService lifecycle (WP-7402)", () => {
  it("confirms then finalizes with immutable version 1 and outbox intent", async () => {
    const { audit, outbox, service } = harness();
    await service.save(saveInput(confirmableDraft()));

    const confirmed = await service.confirm(
      command("prescription-lifecycle-001", "confirm-key-00000001"),
    );
    expect(confirmed).toMatchObject({
      kind: "transitioned",
      view: {
        status: "PHARMACIST_CONFIRMED",
        confirmedBy: "actor-test-001",
        prescriptionVersion: null,
      },
    });

    // DOM-004 §1: 確認後の draft write は locked。
    await expect(
      service.save({ ...saveInput(confirmableDraft()), expectedVersion: 1 }),
    ).resolves.toEqual({ kind: "locked" });

    const finalized = await service.finalize(
      command("prescription-lifecycle-001", "finalize-key-0000001"),
    );
    expect(finalized).toMatchObject({
      kind: "transitioned",
      view: {
        status: "PRESCRIPTION_FINALIZED",
        finalizedBy: "actor-test-001",
        prescriptionVersion: 1,
      },
    });

    expect(outbox.list(scope.tenantId, scope.pharmacyId)).toHaveLength(1);
    expect(
      (await audit.list({
        tenantId: scope.tenantId,
        pharmacyId: scope.pharmacyId,
      })).map((event) => event.auditEventType),
    ).toEqual([
      "prescription.created",
      "prescription.confirmed",
      "prescription.finalized",
    ]);
  });

  it("records each actor on version 1 when confirm and finalize diverge", async () => {
    // N-1: v1 confirmedBy/At は confirm 実行者、finalizedBy/At は finalize 実行者。
    const { qualification, service } = harness();
    qualification.grant({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: userId("actor-test-002"),
      kind: "PHARMACIST_LICENSE",
    });
    await service.save(saveInput(confirmableDraft()));
    await service.confirm(
      command("prescription-lifecycle-001", "confirm-key-00000002"),
    );

    const finalized = await service.finalize({
      ...command("prescription-lifecycle-001", "finalize-key-0000002"),
      actorId: userId("actor-test-002"),
      wallClock: "2026-08-25T01:00:00.000Z",
    });
    expect(finalized).toMatchObject({ kind: "transitioned" });

    const versions = await service.listVersions({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      prescriptionId: prescriptionId("prescription-lifecycle-001"),
      wallClock: scope.wallClock,
    });
    if (versions.kind !== "listed") throw new Error("versions not listed");
    expect(versions.versions[0]).toMatchObject({
      version: 1,
      confirmedBy: "actor-test-001",
      confirmedAt: scope.wallClock,
      finalizedBy: "actor-test-002",
      finalizedAt: "2026-08-25T01:00:00.000Z",
    });
  });

  it("denies confirm without active pharmacist qualification and audits the denial", async () => {
    const { audit, service } = harness({ qualified: false });
    await service.save(saveInput(confirmableDraft()));

    await expect(
      service.confirm(command("prescription-lifecycle-001", "key-denied-0000001")),
    ).resolves.toEqual({ kind: "unqualified" });
    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    expect(events.at(-1)?.auditEventType).toBe("prescription.confirm.denied");
    expect(events.at(-1)?.outcome).toBe("denied");
  });

  it("treats a revoked qualification as unqualified", async () => {
    const { qualification, service } = harness();
    await service.save(saveInput(confirmableDraft()));
    qualification.revoke({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });
    await expect(
      service.confirm(command("prescription-lifecycle-001", "key-revoked-000001")),
    ).resolves.toEqual({ kind: "unqualified" });
  });

  it("rejects confirm for unresolved medication items (RX-0001)", async () => {
    const { service } = harness();
    const draft = confirmableDraft();
    draft.rpGroups[0]!.items[0]!.medication = {
      kind: "unresolved",
      text: "未解決薬剤",
    };
    await service.save(saveInput(draft));
    await expect(
      service.confirm(command("prescription-lifecycle-001", "key-unres-00000001")),
    ).resolves.toEqual({ kind: "unresolved_items" });
  });

  it("rejects confirm when source metadata is incomplete (RX-0003)", async () => {
    const { service } = harness();
    const draft = confirmableDraft();
    draft.sourceMetadata = null;
    await service.save(saveInput(draft));
    await expect(
      service.confirm(command("prescription-lifecycle-001", "key-meta-0000000001")),
    ).resolves.toEqual({ kind: "metadata_incomplete" });
  });

  it("rejects finalize before confirm (RX-0002)", async () => {
    const { service } = harness();
    await service.save(saveInput(confirmableDraft()));
    await expect(
      service.finalize(command("prescription-lifecycle-001", "key-final-00000001")),
    ).resolves.toEqual({ kind: "invalid_transition" });
  });

  it("replays the same idempotency key and rejects a different key", async () => {
    const { service } = harness();
    await service.save(saveInput(confirmableDraft()));
    const first = await service.confirm(
      command("prescription-lifecycle-001", "confirm-key-00000001"),
    );
    const replay = await service.confirm(
      command("prescription-lifecycle-001", "confirm-key-00000001"),
    );
    expect(first).toMatchObject({ kind: "transitioned", replayed: false });
    expect(replay).toMatchObject({ kind: "transitioned", replayed: true });
    if (first.kind === "transitioned" && replay.kind === "transitioned") {
      expect(replay.view).toEqual(first.view);
    }
    await expect(
      service.confirm(command("prescription-lifecycle-001", "confirm-key-00000002")),
    ).resolves.toEqual({ kind: "invalid_transition" });
  });

  it("rejects confirm when prescription type/date/days are unset (packet §5)", async () => {
    const { service } = harness();
    let expectedVersion = 0;
    for (const [field, value] of [
      ["prescriptionType", "UNSPECIFIED"],
      ["prescriptionDate", null],
      ["defaultDays", null],
    ] as const) {
      const draft = confirmableDraft();
      (draft as Record<string, unknown>)[field] = value;
      const saved = await service.save({ ...saveInput(draft), expectedVersion });
      expect(saved.kind).toBe("saved");
      expectedVersion += 1;
      await expect(
        service.confirm(command("prescription-lifecycle-001", `key-${field}-00001`)),
      ).resolves.toEqual({ kind: "metadata_incomplete" });
    }
  });

  it("leaves the record untouched when the success audit append fails", async () => {
    const { audit, service } = harness();
    await service.save(saveInput(confirmableDraft()));
    const recordAudit = audit.record.bind(audit);
    let calls = 0;
    audit.record = ((scopeArg: unknown, event: { auditEventType: string }) => {
      calls += 1;
      if (event.auditEventType === "prescription.confirmed") {
        throw new Error("audit store offline");
      }
      return recordAudit(scopeArg as never, event as never);
    }) as typeof audit.record;

    await expect(
      service.confirm(command("prescription-lifecycle-001", "key-atomic-0000001")),
    ).rejects.toThrow("audit store offline");

    // 失敗後の再 confirm は初回遷移として扱われるべきで、replay になっては
    // いけない(半端な transitioned 状態が残っていないこと)。
    audit.record = recordAudit;
    const retry = await service.confirm(
      command("prescription-lifecycle-001", "key-atomic-0000001"),
    );
    expect(retry).toMatchObject({ kind: "transitioned", replayed: false });
    expect(calls).toBeGreaterThan(0);
  });

  it("does not leak cross-scope prescription existence", async () => {
    const { qualification, service } = harness();
    await service.save(saveInput(confirmableDraft()));
    // 他テナントの資格 evidence が無い → fail-closed unqualified(F-12:
    // 資格チェックは存在確認より先。存在の有無を漏らさない)。
    await expect(
      service.confirm({
        ...command("prescription-lifecycle-001", "key-tenant-00000001"),
        tenantId: tenantId("tenant-other"),
      }),
    ).resolves.toEqual({ kind: "unqualified" });
    // 他テナントで資格があっても対象が無ければ not_found(他 scope の
    // prescriptionId は見えない)。
    qualification.grant({
      tenantId: tenantId("tenant-other"),
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });
    await expect(
      service.confirm({
        ...command("prescription-lifecycle-001", "key-tenant-00000002"),
        tenantId: tenantId("tenant-other"),
      }),
    ).resolves.toEqual({ kind: "not_found" });
  });
});

const AMENDMENT_PRESCRIPTION_ID = "prescription-lifecycle-001";

function inquiryCommand(
  idempotencyKey: string,
  extra?: { directedTo?: string; content?: string },
) {
  return {
    ...command(AMENDMENT_PRESCRIPTION_ID, idempotencyKey),
    directedTo: extra?.directedTo ?? "合成病院 処方医",
    content: extra?.content ?? "用量が用法と整合しない疑義",
  };
}

function answerCommand(
  inquiryId: string,
  idempotencyKey: string,
  result: "UNCHANGED" | "CHANGED" = "CHANGED",
  answer = "用量を訂正",
) {
  return {
    ...command(AMENDMENT_PRESCRIPTION_ID, idempotencyKey),
    inquiryId: prescriptionInquiryId(inquiryId),
    answer,
    result,
  };
}

function amendCommand(
  inquiryId: string,
  idempotencyKey: string,
  draft: PrescriptionDraftContent = {
    ...confirmableDraft(),
    note: "疑義照会により訂正",
  },
) {
  return {
    ...command(AMENDMENT_PRESCRIPTION_ID, idempotencyKey),
    inquiryId: prescriptionInquiryId(inquiryId),
    content: draft,
  };
}

const readInput = () => ({
  tenantId: scope.tenantId,
  pharmacyId: scope.pharmacyId,
  actorId: scope.actorId,
  prescriptionId: prescriptionId(AMENDMENT_PRESCRIPTION_ID),
  wallClock: scope.wallClock,
});

async function finalizedService(
  service: ReturnType<typeof harness>["service"],
) {
  await service.save(saveInput(confirmableDraft()));
  await service.confirm(
    command(AMENDMENT_PRESCRIPTION_ID, "confirm-key-00000001"),
  );
  await service.finalize(
    command(AMENDMENT_PRESCRIPTION_ID, "finalize-key-0000001"),
  );
}

async function changedInquiry(
  service: ReturnType<typeof harness>["service"],
  result: "UNCHANGED" | "CHANGED" = "CHANGED",
) {
  const created = await service.createInquiry(
    inquiryCommand("inquiry-key-000001"),
  );
  if (created.kind !== "recorded") throw new Error("inquiry not recorded");
  const answered = await service.answerInquiry(
    answerCommand(created.inquiry.inquiryId, "answer-key-0000001", result),
  );
  if (answered.kind !== "answered") throw new Error("inquiry not answered");
  return answered.inquiry;
}

describe("InMemoryPrescriptionDraftService amendment (WP-7403)", () => {
  it("records an inquiry once per idempotency key and audits it", async () => {
    const { audit, service } = harness();
    await finalizedService(service);

    const created = await service.createInquiry(
      inquiryCommand("inquiry-key-000001"),
    );
    expect(created).toMatchObject({
      kind: "recorded",
      replayed: false,
      inquiry: { status: "OPEN", answer: null },
    });

    const replay = await service.createInquiry(
      inquiryCommand("inquiry-key-000001"),
    );
    expect(replay).toMatchObject({ kind: "recorded", replayed: true });
    if (created.kind === "recorded" && replay.kind === "recorded") {
      expect(replay.inquiry).toEqual(created.inquiry);
    }

    const conflict = await service.createInquiry(
      inquiryCommand("inquiry-key-000001", { content: "別の疑義内容" }),
    );
    expect(conflict).toEqual({ kind: "idempotency_conflict" });

    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    expect(events.at(-1)?.auditEventType).toBe("inquiry.recorded");
    expect(events.at(-1)?.outcome).toBe("success");
  });

  it("writes the answer once and audits inquiry.answered", async () => {
    const { audit, service } = harness();
    await finalizedService(service);
    const created = await service.createInquiry(
      inquiryCommand("inquiry-key-000001"),
    );
    if (created.kind !== "recorded") throw new Error("inquiry not recorded");

    const answered = await service.answerInquiry(
      answerCommand(created.inquiry.inquiryId, "answer-key-0000001"),
    );
    expect(answered).toMatchObject({
      kind: "answered",
      replayed: false,
      inquiry: { status: "RESOLVED", result: "CHANGED" },
    });

    // 同一キー+同一内容は replay、別内容は RX-0010、別キーは write-once 拒否。
    const replay = await service.answerInquiry(
      answerCommand(created.inquiry.inquiryId, "answer-key-0000001"),
    );
    expect(replay).toMatchObject({ kind: "answered", replayed: true });
    const differentPayload = await service.answerInquiry(
      answerCommand(
        created.inquiry.inquiryId,
        "answer-key-0000001",
        "UNCHANGED",
      ),
    );
    expect(differentPayload).toEqual({ kind: "idempotency_conflict" });
    const differentKey = await service.answerInquiry(
      answerCommand(created.inquiry.inquiryId, "answer-key-0000002"),
    );
    expect(differentKey).toEqual({ kind: "invalid_transition" });

    await expect(
      service.answerInquiry(
        answerCommand("inquiry-nonexistent", "answer-key-0000003"),
      ),
    ).resolves.toEqual({ kind: "inquiry_not_found" });

    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    expect(events.at(-1)?.auditEventType).toBe("inquiry.answered");
  });

  it("amends a finalized prescription to version 2 with audit and outbox in one flow", async () => {
    const { audit, outbox, service } = harness();
    await finalizedService(service);
    const inquiry = await changedInquiry(service);

    const amended = await service.amend(
      amendCommand(inquiry.inquiryId, "amend-key-00000001"),
    );
    expect(amended).toMatchObject({
      kind: "amended",
      replayed: false,
      version: {
        version: 2,
        supersedesVersion: 1,
        inquiryId: inquiry.inquiryId,
        amendedBy: "actor-test-001",
      },
    });
    if (amended.kind === "amended") {
      expect(amended.version.content.note).toBe("疑義照会により訂正");
      // amend は新版の confirm+finalize を兼ねる(packet §4)。
      expect(amended.version.finalizedBy).toBe("actor-test-001");
    }

    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    expect(events.map((event) => event.auditEventType)).toEqual([
      "prescription.created",
      "prescription.confirmed",
      "prescription.finalized",
      "inquiry.recorded",
      "inquiry.answered",
      "prescription.amended",
    ]);
    const intents = outbox.list(scope.tenantId, scope.pharmacyId);
    expect(intents.map((intent) => intent.eventType)).toEqual([
      "prescription.finalized",
      "prescription.amended",
    ]);
    expect(intents[1]?.version).toBe(2);

    // MOD-008: 監査 payload の識別子を検証(本文は含まない)。
    const recordedEvent = events.find(
      (event) => event.auditEventType === "inquiry.recorded",
    );
    expect(recordedEvent?.targetRef).toEqual({
      kind: "prescription_inquiry",
      id: `${AMENDMENT_PRESCRIPTION_ID}/${inquiry.inquiryId}`,
    });
    const answeredEvent = events.find(
      (event) => event.auditEventType === "inquiry.answered",
    );
    expect(answeredEvent?.targetRef.id).toContain(inquiry.inquiryId);
    expect(answeredEvent?.businessReason?.code).toBe("INQUIRY_RESULT_CHANGED");
    const amendedEvent = events.find(
      (event) => event.auditEventType === "prescription.amended",
    );
    expect(amendedEvent?.targetRef).toEqual({
      kind: "prescription_version",
      id: `${AMENDMENT_PRESCRIPTION_ID}/2/${inquiry.inquiryId}`,
    });

    // 旧版は読める(immutable snapshot がそのまま返る)。
    const versions = await service.listVersions(readInput());
    expect(versions).toMatchObject({ kind: "listed" });
    if (versions.kind === "listed") {
      expect(versions.versions.map((entry) => entry.version)).toEqual([1, 2]);
      expect(versions.versions[0]?.content.note).toBe("");
    }
  });

  it("supports a second amendment via a new CHANGED inquiry", async () => {
    const { service } = harness();
    await finalizedService(service);
    const first = await changedInquiry(service);
    await service.amend(amendCommand(first.inquiryId, "amend-key-00000001"));

    const second = await service.createInquiry(
      inquiryCommand("inquiry-key-000002", { content: "2件目の疑義" }),
    );
    if (second.kind !== "recorded") throw new Error("second inquiry missing");
    await service.answerInquiry(
      answerCommand(second.inquiry.inquiryId, "answer-key-0000002"),
    );
    const amended = await service.amend(
      amendCommand(second.inquiry.inquiryId, "amend-key-00000002"),
    );
    expect(amended).toMatchObject({
      kind: "amended",
      version: { version: 3, supersedesVersion: 2 },
    });
  });

  it("records amend actor and time as the new version's confirm/finalize provenance", async () => {
    // packet §4: amend は新版の confirm+finalize を兼ねる。v1 の
    // confirmer/finalizer と異なる actor/時刻で amend した場合でも、
    // 新版の confirmed/finalized_* は amend 実行者・時刻を指す。
    const { qualification, service } = harness();
    qualification.grant({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: userId("actor-test-002"),
      kind: "PHARMACIST_LICENSE",
    });
    await finalizedService(service);
    const inquiry = await changedInquiry(service);

    const amended = await service.amend({
      ...amendCommand(inquiry.inquiryId, "amend-key-00000001"),
      actorId: userId("actor-test-002"),
      wallClock: "2026-08-26T03:00:00.000Z",
    });
    expect(amended).toMatchObject({
      kind: "amended",
      version: {
        amendedBy: "actor-test-002",
        amendedAt: "2026-08-26T03:00:00.000Z",
        confirmedBy: "actor-test-002",
        confirmedAt: "2026-08-26T03:00:00.000Z",
        finalizedBy: "actor-test-002",
        finalizedAt: "2026-08-26T03:00:00.000Z",
      },
    });
    // v1 の provenance は不変。
    const v1 = await service.getVersion({ ...readInput(), version: 1 });
    expect(v1).toMatchObject({
      kind: "found",
      version: {
        confirmedBy: "actor-test-001",
        finalizedBy: "actor-test-001",
      },
    });
  });

  it("rejects a same-key amend replay bound to a different inquiry", async () => {
    const { service } = harness();
    await finalizedService(service);
    const first = await changedInquiry(service);
    await service.amend(amendCommand(first.inquiryId, "amend-key-00000001"));

    // 同じ key + 同じ content だが別の inquiryId → RX-0010(F-1:
    // payload は {inquiryId, content} 全体の一致を要求する)。
    const created = await service.createInquiry(
      inquiryCommand("inquiry-key-000002"),
    );
    if (created.kind !== "recorded") throw new Error("inquiry not recorded");
    await service.answerInquiry(
      answerCommand(created.inquiry.inquiryId, "answer-key-0000002"),
    );
    await expect(
      service.amend(
        amendCommand(created.inquiry.inquiryId, "amend-key-00000001"),
      ),
    ).resolves.toEqual({ kind: "idempotency_conflict" });
  });

  it("rejects amend for unqualified actors and audits amend.denied", async () => {
    const { audit, service } = harness({ qualified: false });
    await service.save(saveInput(confirmableDraft()));

    const result = await service.amend(
      amendCommand("inquiry-any", "amend-key-00000001"),
    );
    expect(result).toEqual({ kind: "unqualified" });
    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    expect(events.at(-1)?.auditEventType).toBe("prescription.amend.denied");
    expect(events.at(-1)?.outcome).toBe("denied");
  });

  it("rejects amend when the prescription is not finalized", async () => {
    const { service } = harness();
    await service.save(saveInput(confirmableDraft()));
    // draft のみ(confirm 前)— FINALIZED でないので invalid_transition。
    await expect(
      service.amend(amendCommand("inquiry-any", "amend-key-00000001")),
    ).resolves.toEqual({ kind: "invalid_transition" });
  });

  it("rejects amend when the inquiry is missing, open, or not CHANGED", async () => {
    const { service } = harness();
    await finalizedService(service);

    // inquiry 不存在
    await expect(
      service.amend(amendCommand("inquiry-missing", "amend-key-00000001")),
    ).resolves.toEqual({ kind: "inquiry_unresolved" });

    // OPEN(未回答)
    const created = await service.createInquiry(
      inquiryCommand("inquiry-key-000001"),
    );
    if (created.kind !== "recorded") throw new Error("inquiry not recorded");
    await expect(
      service.amend(
        amendCommand(created.inquiry.inquiryId, "amend-key-00000002"),
      ),
    ).resolves.toEqual({ kind: "inquiry_unresolved" });

    // RESOLVED だが UNCHANGED
    await service.answerInquiry(
      answerCommand(created.inquiry.inquiryId, "answer-key-0000001", "UNCHANGED"),
    );
    await expect(
      service.amend(
        amendCommand(created.inquiry.inquiryId, "amend-key-00000003"),
      ),
    ).resolves.toEqual({ kind: "inquiry_unresolved" });
  });

  it("rejects amend whose new content has unresolved items or incomplete metadata", async () => {
    const { service } = harness();
    await finalizedService(service);
    const inquiry = await changedInquiry(service);

    const unresolved = confirmableDraft();
    unresolved.rpGroups[0]!.items[0]!.medication = {
      kind: "unresolved",
      text: "未解決薬剤",
    };
    await expect(
      service.amend(
        amendCommand(inquiry.inquiryId, "amend-key-00000001", unresolved),
      ),
    ).resolves.toEqual({ kind: "unresolved_items" });

    const incomplete = confirmableDraft();
    incomplete.sourceMetadata = null;
    await expect(
      service.amend(
        amendCommand(inquiry.inquiryId, "amend-key-00000001", incomplete),
      ),
    ).resolves.toEqual({ kind: "metadata_incomplete" });
  });

  it("replays amend with the same key and rejects a different payload", async () => {
    const { service } = harness();
    await finalizedService(service);
    const inquiry = await changedInquiry(service);

    const first = await service.amend(
      amendCommand(inquiry.inquiryId, "amend-key-00000001"),
    );
    const replay = await service.amend(
      amendCommand(inquiry.inquiryId, "amend-key-00000001"),
    );
    expect(first).toMatchObject({ kind: "amended", replayed: false });
    expect(replay).toMatchObject({ kind: "amended", replayed: true });
    if (first.kind === "amended" && replay.kind === "amended") {
      expect(replay.version).toEqual(first.version);
    }

    const different = await service.amend(
      amendCommand(inquiry.inquiryId, "amend-key-00000001", {
        ...confirmableDraft(),
        note: "別内容への訂正",
      }),
    );
    expect(different).toEqual({ kind: "idempotency_conflict" });
  });

  it("reads versions and inquiries only inside scope and audits the read", async () => {
    const { audit, service } = harness();
    await finalizedService(service);
    await changedInquiry(service);

    const versions = await service.listVersions(readInput());
    expect(versions).toMatchObject({ kind: "listed" });
    const single = await service.getVersion({ ...readInput(), version: 1 });
    expect(single).toMatchObject({ kind: "found" });
    await expect(
      service.getVersion({ ...readInput(), version: 9 }),
    ).resolves.toEqual({ kind: "not_found" });

    const inquiries = await service.listInquiries(readInput());
    expect(inquiries).toMatchObject({ kind: "listed" });
    if (inquiries.kind === "listed") {
      expect(inquiries.inquiries).toHaveLength(1);
      expect(inquiries.inquiries[0]?.status).toBe("RESOLVED");
    }

    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    // read 監査は既存の PHI read 監査種別を使う(listVersions/getVersion/
    // listInquiries の 3 回)。
    expect(
      events
        .filter((event) => event.auditEventType === "prescription.draft.viewed")
        .length,
    ).toBe(3);

    const crossScope = { ...readInput(), tenantId: tenantId("tenant-other") };
    await expect(service.listVersions(crossScope)).resolves.toEqual({
      kind: "not_found",
    });
    await expect(
      service.getVersion({ ...crossScope, version: 1 }),
    ).resolves.toEqual({ kind: "not_found" });
    await expect(service.listInquiries(crossScope)).resolves.toEqual({
      kind: "not_found",
    });
    await expect(
      service.createInquiry({ ...inquiryCommand("inquiry-key-x"), tenantId: tenantId("tenant-other") }),
    ).resolves.toEqual({ kind: "not_found" });
  });
});

// ---- WP-7304 / PRD-001 M4: 前回 Do(createFromPrior)----

const COPY_MED_VERSION_V1 = "00000000-0000-4000-8000-0000000000c1";
const COPY_MED_VERSION_V2 = "00000000-0000-4000-8000-0000000000c2";
const COPY_MED_ITEM_V1 = RESOLVED_UUID_D;
const COPY_MED_ITEM_V2 = "00000000-0000-4000-8000-0000000000d2";
const COPY_USAGE_VERSION_V1 = "00000000-0000-4000-8000-0000000000e3";
const COPY_USAGE_ITEM_V1 = "00000000-0000-4000-8000-0000000000e4";

function copyableDraft(): PrescriptionDraftContent {
  const draft = confirmableDraft();
  draft.rpGroups[0]!.usage = {
    kind: "resolved",
    usageItemId: COPY_USAGE_ITEM_V1,
  };
  return draft;
}

function copyHarness(options?: { readonly withMasters?: boolean }) {
  const audit = new InMemoryAuditRepository();
  const qualification = new InMemoryActorQualificationRepository();
  const masters = new InMemoryMasterRepository();
  qualification.grant({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    kind: "PHARMACIST_LICENSE",
  });
  let counter = 0;
  const service = new InMemoryPrescriptionDraftService(
    new InMemoryReceptionRepository(),
    audit,
    () =>
      prescriptionId(`prescription-copy-${String(++counter).padStart(3, "0")}`),
    {
      qualificationRepository: qualification,
      ...(options?.withMasters === false
        ? {}
        : { masterRepository: masters }),
    },
  );
  return { audit, masters, service };
}

async function seedCopyMasters(masters: InMemoryMasterRepository) {
  const recordedAt = "2026-07-01T00:00:00.000Z";
  await masters.seedVersion({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    masterVersionId: COPY_MED_VERSION_V1,
    masterKind: "medication",
    version: "2026-07-01",
    validFrom: "2026-07-01",
    recordedAt,
  });
  await masters.seedMedicationItem({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    medicationItemId: COPY_MED_ITEM_V1,
    masterVersionId: COPY_MED_VERSION_V1,
    localCode: "MED001",
    name: "合成薬剤 5mg",
    unit: "錠",
    genericFlag: "unclassified",
  });
  await masters.seedVersion({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    masterVersionId: COPY_USAGE_VERSION_V1,
    masterKind: "usage",
    version: "2026-07-01",
    validFrom: "2026-07-01",
    recordedAt,
  });
  await masters.seedUsageItem({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    usageItemId: COPY_USAGE_ITEM_V1,
    masterVersionId: COPY_USAGE_VERSION_V1,
    localCode: "U001",
    text: "1日1回 朝食後",
  });
}

const COPY_SOURCE_ID = "prescription-copy-001";

async function finalizedCopySource(
  service: ReturnType<typeof copyHarness>["service"],
  draft: PrescriptionDraftContent = copyableDraft(),
) {
  await service.save(saveInput(draft));
  await service.confirm(command(COPY_SOURCE_ID, "confirm-key-00000001"));
  await service.finalize(command(COPY_SOURCE_ID, "finalize-key-0000001"));
}

function fromPriorInput(
  overrides?: Partial<PrescriptionDraftFromPriorInput>,
): PrescriptionDraftFromPriorInput {
  return {
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    receptionId: receptionId("reception-syn-002"),
    patientId: patientId("patient-syn-002"),
    businessDate: scope.businessDate,
    sourcePrescriptionId: prescriptionId(COPY_SOURCE_ID),
    wallClock: scope.wallClock,
    ...overrides,
  };
}

async function amendCopySource(
  service: ReturnType<typeof copyHarness>["service"],
) {
  const rxCommand = (key: string) => ({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    prescriptionId: prescriptionId(COPY_SOURCE_ID),
    idempotencyKey: key,
    wallClock: scope.wallClock,
  });
  const created = await service.createInquiry({
    ...rxCommand("inquiry-key-000001"),
    directedTo: "合成病院 処方医",
    content: "用量が用法と整合しない疑義",
  });
  if (created.kind !== "recorded") throw new Error("inquiry not recorded");
  await service.answerInquiry({
    ...rxCommand("answer-key-0000001"),
    inquiryId: prescriptionInquiryId(created.inquiry.inquiryId),
    answer: "用量を訂正",
    result: "CHANGED",
  });
  const amended = await service.amend({
    ...rxCommand("amend-key-00000001"),
    inquiryId: prescriptionInquiryId(created.inquiry.inquiryId),
    content: { ...copyableDraft(), note: "疑義照会により訂正" },
  });
  if (amended.kind !== "amended") throw new Error("amend failed");
}

describe("InMemoryPrescriptionDraftService from-prior copy (WP-7304)", () => {
  it("copies a finalized version into an editable draft with provenance and re-resolution", async () => {
    const { audit, masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);

    const result = await service.createFromPrior(fromPriorInput());
    expect(result).toMatchObject({
      kind: "saved",
      draft: {
        saveDisposition: "created",
        prescriptionId: "prescription-copy-002",
        receptionId: "reception-syn-002",
        patientId: "patient-syn-002",
        version: 1,
        status: null,
        copiedFrom: { prescriptionId: COPY_SOURCE_ID, version: 1 },
      },
    });
    if (result.kind !== "saved") throw new Error("copy failed");

    // D-3: 原本 metadata・発行日は新原本前提でリセット。
    expect(result.draft.draft.sourceMetadata).toBeNull();
    expect(result.draft.draft.prescriptionDate).toBeNull();
    // D-4: 同一版が現行なら resolved ref は item 行再検証の上そのまま再解決。
    expect(
      result.draft.draft.rpGroups[0]?.items[0]?.medication,
    ).toEqual({
      kind: "resolved",
      masterVersionId: COPY_MED_VERSION_V1,
      medicationItemId: COPY_MED_ITEM_V1,
    });
    expect(result.draft.draft.rpGroups[0]?.usage).toEqual({
      kind: "resolved",
      usageItemId: COPY_USAGE_ITEM_V1,
    });
    expect(result.draft.draft.note).toBe("");

    // D-6: 複製元の PHI read + 新規作成の監査。
    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    const lastTwo = events.slice(-2);
    expect(lastTwo[0]).toMatchObject({
      auditEventType: "prescription.draft.viewed",
      targetRef: { kind: "prescription", id: COPY_SOURCE_ID },
    });
    expect(lastTwo[1]).toMatchObject({
      auditEventType: "prescription.created",
      targetRef: { kind: "prescription", id: "prescription-copy-002" },
    });
  });

  it("re-resolves references against a newer current master version", async () => {
    const { masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);

    // asOf(=businessDate 2026-07-09)で現行となる新版を seed し、同一
    // localCode の別 item ID を収載する。
    await masters.seedVersion({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      masterVersionId: COPY_MED_VERSION_V2,
      masterKind: "medication",
      version: "2026-07-05",
      validFrom: "2026-07-05",
      recordedAt: "2026-07-05T00:00:00.000Z",
    });
    await masters.seedMedicationItem({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      medicationItemId: COPY_MED_ITEM_V2,
      masterVersionId: COPY_MED_VERSION_V2,
      localCode: "MED001",
      name: "合成薬剤 5mg(改訂)",
      unit: "錠",
      genericFlag: "unclassified",
    });

    const result = await service.createFromPrior(fromPriorInput());
    expect(result).toMatchObject({ kind: "saved" });
    if (result.kind !== "saved") throw new Error("copy failed");
    expect(
      result.draft.draft.rpGroups[0]?.items[0]?.medication,
    ).toEqual({
      kind: "resolved",
      masterVersionId: COPY_MED_VERSION_V2,
      medicationItemId: COPY_MED_ITEM_V2,
    });
  });

  it("downgrades stale or missing references to unresolved text", async () => {
    const { masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);

    // 現行版から MED001 / U001 を外す(廃止相当)→ UNRESOLVED_TEXT 降格。
    await masters.seedVersion({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      masterVersionId: COPY_MED_VERSION_V2,
      masterKind: "medication",
      version: "2026-07-05",
      validFrom: "2026-07-05",
      recordedAt: "2026-07-05T00:00:00.000Z",
    });
    await masters.seedMedicationItem({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      medicationItemId: COPY_MED_ITEM_V2,
      masterVersionId: COPY_MED_VERSION_V2,
      localCode: "MED999",
      name: "別品目",
      unit: "錠",
      genericFlag: "unclassified",
    });

    const result = await service.createFromPrior(fromPriorInput());
    if (result.kind !== "saved") throw new Error("copy failed");
    expect(
      result.draft.draft.rpGroups[0]?.items[0]?.medication,
    ).toEqual({ kind: "unresolved", text: "合成薬剤 5mg" });
    // usage master は v1 のまま現行 → usage は再解決を維持。
    expect(result.draft.draft.rpGroups[0]?.usage).toEqual({
      kind: "resolved",
      usageItemId: COPY_USAGE_ITEM_V1,
    });
  });

  it("downgrades all resolved refs when no current master version exists", async () => {
    const { masters, service } = copyHarness();
    // 旧 item の lookup だけ行えるよう item は seed するが、asOf 以後のみ
    // 有効な版を置いて list が no_version になる状態を作る。
    await masters.seedVersion({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      masterVersionId: COPY_MED_VERSION_V1,
      masterKind: "medication",
      version: "2026-07-01",
      validFrom: "2026-07-01",
      validTo: "2026-07-05",
      recordedAt: "2026-07-01T00:00:00.000Z",
    });
    await masters.seedMedicationItem({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      medicationItemId: COPY_MED_ITEM_V1,
      masterVersionId: COPY_MED_VERSION_V1,
      localCode: "MED001",
      name: "合成薬剤 5mg",
      unit: "錠",
      genericFlag: "unclassified",
    });
    await masters.seedVersion({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      masterVersionId: COPY_USAGE_VERSION_V1,
      masterKind: "usage",
      version: "2026-07-01",
      validFrom: "2026-07-01",
      validTo: "2026-07-05",
      recordedAt: "2026-07-01T00:00:00.000Z",
    });
    await masters.seedUsageItem({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      usageItemId: COPY_USAGE_ITEM_V1,
      masterVersionId: COPY_USAGE_VERSION_V1,
      localCode: "U001",
      text: "1日1回 朝食後",
    });
    await finalizedCopySource(service);

    const result = await service.createFromPrior(fromPriorInput());
    if (result.kind !== "saved") throw new Error("copy failed");
    expect(
      result.draft.draft.rpGroups[0]?.items[0]?.medication,
    ).toEqual({ kind: "unresolved", text: "合成薬剤 5mg" });
    expect(result.draft.draft.rpGroups[0]?.usage).toEqual({
      kind: "unresolved",
      text: "1日1回 朝食後",
    });
  });

  it("defaults to the latest version and honours an explicit sourceVersion", async () => {
    const { masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);
    await amendCopySource(service);

    const latest = await service.createFromPrior(fromPriorInput());
    if (latest.kind !== "saved") throw new Error("copy failed");
    expect(latest.draft.copiedFrom).toEqual({
      prescriptionId: COPY_SOURCE_ID,
      version: 2,
    });
    expect(latest.draft.draft.note).toBe("疑義照会により訂正");

    // 明示版指定は旧版からの複製も許可(packet §3)。
    const { masters: masters2, service: service2 } = copyHarness();
    await seedCopyMasters(masters2);
    await finalizedCopySource(service2);
    await amendCopySource(service2);
    const explicit = await service2.createFromPrior(
      fromPriorInput({ sourceVersion: 1 }),
    );
    if (explicit.kind !== "saved") throw new Error("copy failed");
    expect(explicit.draft.copiedFrom).toEqual({
      prescriptionId: COPY_SOURCE_ID,
      version: 1,
    });
    expect(explicit.draft.draft.note).toBe("");
  });

  it("returns not_found for missing source, missing version, or unfinalized prescription", async () => {
    const { masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);

    await expect(
      service.createFromPrior(
        fromPriorInput({
          sourcePrescriptionId: prescriptionId("prescription-missing"),
        }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
    await expect(
      service.createFromPrior(fromPriorInput({ sourceVersion: 9 })),
    ).resolves.toEqual({ kind: "not_found" });

    // 未確定(versions 空)の処方は複製元にできない。
    const { masters: masters2, service: service2 } = copyHarness();
    await seedCopyMasters(masters2);
    await service2.save(saveInput(copyableDraft()));
    await expect(
      service2.createFromPrior(
        fromPriorInput({
          sourcePrescriptionId: prescriptionId("prescription-copy-001"),
        }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("enforces reception editability, patient match, and existing-draft conflict", async () => {
    const { masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);

    // COMPLETED 受付は editable でない。
    await expect(
      service.createFromPrior(
        fromPriorInput({
          receptionId: receptionId("reception-syn-003"),
          patientId: patientId("patient-syn-003"),
        }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
    // patient 不一致。
    await expect(
      service.createFromPrior(
        fromPriorInput({ patientId: patientId("patient-syn-003") }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
    // 複製元と同じ受付 = draft 既存 → conflict。
    await expect(
      service.createFromPrior(
        fromPriorInput({
          receptionId: receptionId("reception-syn-001"),
          patientId: patientId("patient-syn-001"),
        }),
      ),
    ).resolves.toEqual({ kind: "conflict" });

    // 成功後の同一再送も reception 一意で conflict。
    await service.createFromPrior(fromPriorInput());
    await expect(
      service.createFromPrior(fromPriorInput()),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("keeps source scope isolation across tenants", async () => {
    const { masters, service } = copyHarness();
    await seedCopyMasters(masters);
    await finalizedCopySource(service);

    await expect(
      service.createFromPrior(
        fromPriorInput({ tenantId: tenantId("tenant-other") }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed without a master repository", async () => {
    const { service } = copyHarness({ withMasters: false });
    await finalizedCopySource(service);

    await expect(
      service.createFromPrior(fromPriorInput()),
    ).rejects.toThrow("Master repository is required");
  });
});
