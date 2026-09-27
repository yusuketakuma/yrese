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


import {
  scope,
  RESOLVED_UUID_A,
  RESOLVED_UUID_B,
  RESOLVED_UUID_C,
  RESOLVED_UUID_D,
  confirmableDraft,
  saveInput,
  command,
  harness,
} from './prescription-lifecycle-test-support.js';


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
