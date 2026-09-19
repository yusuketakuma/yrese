import { describe, expect, it } from "vitest";

import {
  dispensingId,
  pharmacyId,
  prescriptionId,
  prescriptionInquiryId,
  receptionId,
  tenantId,
  userId,
  patientId,
} from "@yrese/shared-kernel";
import type { PrescriptionDraftContent } from "@yrese/contracts";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import { InMemoryMasterRepository } from "./master-repository.js";
import {
  InMemoryDispensingService,
  type DispensingCreateInput,
  type DispensingConfirmInput,
} from "./dispensing-service.js";
import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftSaveInput,
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

const GROUP_ID = "00000000-0000-4000-8000-0000000000a1";
const RP_ITEM_A = "00000000-0000-4000-8000-0000000000b1";
const MASTER_VERSION = "00000000-0000-4000-8000-0000000000c1";
const MED_PRESCRIBED = "00000000-0000-4000-8000-0000000000d1";
const MED_GENERIC_OK = "00000000-0000-4000-8000-0000000000d2";
const MED_GENERIC_NG = "00000000-0000-4000-8000-0000000000d3";

function finalizedDraft(
  overrides?: Partial<PrescriptionDraftContent>,
  genericSubstitutionPermitted: boolean | null = null,
): PrescriptionDraftContent {
  return {
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
        rpGroupId: GROUP_ID,
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
            genericSubstitutionPermitted,
          },
        ],
      },
    ],
    prescriptionDate: "2026-07-09",
    defaultDays: 7,
    flags: [],
    note: "",
    rows: [],
    ...overrides,
  };
}

async function seedMasters(master: InMemoryMasterRepository) {
  await master.seedVersion({
    ...scope,
    masterVersionId: MASTER_VERSION,
    masterKind: "medication",
    version: "2026-08",
    validFrom: "2026-01-01",
    recordedAt: scope.wallClock,
  });
  const item = (
    medicationItemId: string,
    localCode: string,
    genericNameCode: string | null,
  ) => ({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    masterVersionId: MASTER_VERSION,
    medicationItemId,
    localCode,
    name: `合成薬 ${localCode}`,
    unit: "錠",
    genericFlag: "generic" as const,
    genericNameCode,
    controlCategories: [],
  });
  await master.seedMedicationItem(
    item(MED_PRESCRIBED, "MED-001", "GN-001"),
  );
  await master.seedMedicationItem(item(MED_GENERIC_OK, "MED-002", "GN-001"));
  await master.seedMedicationItem(item(MED_GENERIC_NG, "MED-003", "GN-999"));
}

function harness(options?: { readonly qualified?: boolean }) {
  const audit = new InMemoryAuditRepository();
  const qualification = new InMemoryActorQualificationRepository();
  const outbox = new InMemoryPrescriptionFinalizedOutbox();
  const master = new InMemoryMasterRepository();
  if (options?.qualified !== false) {
    qualification.grant({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });
  }
  const prescriptions = new InMemoryPrescriptionDraftService(
    new InMemoryReceptionRepository(),
    audit,
    () => prescriptionId("prescription-dispensing-001"),
    {
      qualificationRepository: qualification,
      finalizedOutbox: outbox,
      nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e1",
      nextInquiryId: () =>
        prescriptionInquiryId("inquiry-dispensing-001"),
      masterRepository: master,
    },
  );
  let dispensingSeq = 0;
  const service = new InMemoryDispensingService({
    prescriptionSource: prescriptions,
    auditRepository: audit,
    qualificationRepository: qualification,
    masterRepository: master,
    dispensingOutbox: outbox,
    nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e2",
    nextDispensingId: () =>
      dispensingId(`dispensing-${(++dispensingSeq).toString().padStart(3, "0")}`),
  });
  return { audit, qualification, outbox, master, prescriptions, service };
}

async function finalize(
  prescriptions: InMemoryPrescriptionDraftService,
  draft: PrescriptionDraftContent,
): Promise<void> {
  const saved = await prescriptions.save({
    ...scope,
    patientId: patientId("patient-syn-001"),
    expectedVersion: 0,
    draft,
  } satisfies PrescriptionDraftSaveInput);
  expect(saved.kind).toBe("saved");
  const confirmed = await prescriptions.confirm({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    prescriptionId: prescriptionId("prescription-dispensing-001"),
    idempotencyKey: "confirm-key-0000001",
    wallClock: scope.wallClock,
  });
  expect(confirmed.kind).toBe("transitioned");
  const finalized = await prescriptions.finalize({
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    prescriptionId: prescriptionId("prescription-dispensing-001"),
    idempotencyKey: "finalize-key-000001",
    wallClock: scope.wallClock,
  });
  expect(finalized.kind).toBe("transitioned");
}

function createInput(
  overrides?: Partial<DispensingCreateInput>,
): DispensingCreateInput {
  return {
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    prescriptionId: prescriptionId("prescription-dispensing-001"),
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
    idempotencyKey: "dispensing-key-0001",
    wallClock: scope.wallClock,
    ...overrides,
  };
}

function confirmInput(
  id: string,
  overrides?: Partial<DispensingConfirmInput>,
): DispensingConfirmInput {
  return {
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    dispensingId: dispensingId(id),
    idempotencyKey: "disp-confirm-key-001",
    wallClock: scope.wallClock,
    ...overrides,
  };
}

describe("InMemoryDispensingService (WP-7404)", () => {
  it("creates a dispensing record for a finalized version with audit", async () => {
    const { audit, prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());

    const result = await service.create(createInput());
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.replayed).toBe(false);
    expect(result.record.status).toBeNull();
    expect(result.record.prescriptionVersion).toBe(1);
    expect(result.record.items[0]?.dispensedBy).toBe("actor-test-001");
    expect(result.record.items[0]?.prescribedMedicationItemId).toBe(
      MED_PRESCRIBED,
    );

    const events = await audit.list(scope);
    const recorded = events.find(
      (entry) => entry.auditEventType === "dispensing.recorded",
    );
    expect(recorded?.targetRef.kind).toBe("dispensing_record");
    expect(recorded?.outcome).toBe("success");
  });

  it("rejects create for a missing/unfinalized version", async () => {
    const { prescriptions, service } = harness();
    await prescriptions.save({
      ...scope,
      patientId: patientId("patient-syn-001"),
      expectedVersion: 0,
      draft: finalizedDraft(),
    });
    // draft はあるが確定版がない → not_found。
    const unfinalized = await service.create(createInput());
    expect(unfinalized.kind).toBe("not_found");
    // 処方自体がない → not_found。
    const missing = await service.create(
      createInput({ prescriptionId: prescriptionId("prescription-x") }),
    );
    expect(missing.kind).toBe("not_found");
  });

  it("blocks create while an inquiry is OPEN and allows after answer", async () => {
    const { prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());
    const inquiry = await prescriptions.createInquiry({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      prescriptionId: prescriptionId("prescription-dispensing-001"),
      idempotencyKey: "inquiry-key-0000001",
      wallClock: scope.wallClock,
      directedTo: "合成病院 処方医",
      content: "疑義照会",
    });
    expect(inquiry.kind).toBe("recorded");

    const blocked = await service.create(createInput());
    expect(blocked.kind).toBe("inquiry_unresolved");

    if (inquiry.kind === "recorded") {
      const answered = await prescriptions.answerInquiry({
        tenantId: scope.tenantId,
        pharmacyId: scope.pharmacyId,
        actorId: scope.actorId,
        prescriptionId: prescriptionId("prescription-dispensing-001"),
        inquiryId: prescriptionInquiryId(inquiry.inquiry.inquiryId),
        idempotencyKey: "answer-key-00000001",
        wallClock: scope.wallClock,
        answer: "変更なし",
        result: "UNCHANGED",
      });
      expect(answered.kind).toBe("answered");
    }
    const allowed = await service.create(
      createInput({ idempotencyKey: "dispensing-key-0002" }),
    );
    expect(allowed.kind).toBe("created");
  });

  it("enforces one record per prescription version", async () => {
    const { prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());
    await service.create(createInput());
    const second = await service.create(
      createInput({ idempotencyKey: "dispensing-key-0002" }),
    );
    expect(second.kind).toBe("already_recorded");
  });

  it("rejects item sets that do not cover every rpItem exactly once", async () => {
    const { prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());
    const missing = await service.create(createInput({ items: [] }));
    expect(missing.kind).toBe("invalid_items");
    const extra = await service.create(
      createInput({
        items: [
          ...createInput().items,
          {
            rpItemId: "00000000-0000-4000-8000-0000000000ff",
            dispensedMedicationItemId: null,
            dispensedText: "不明品目",
            quantity: "1",
            remainingStockAdjustment: null,
            note: null,
          },
        ],
      }),
    );
    expect(extra.kind).toBe("invalid_items");
    const duplicate = await service.create(
      createInput({
        items: [...createInput().items, ...createInput().items],
      }),
    );
    expect(duplicate.kind).toBe("invalid_items");
  });

  it("rejects generic substitution without permission or generic-name match", async () => {
    const { master, prescriptions, service } = harness();
    await seedMasters(master);
    await finalize(prescriptions, finalizedDraft());

    // 変更可否 null → DSP-0004。
    const notPermitted = await service.create(
      createInput({
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
      }),
    );
    expect(notPermitted.kind).toBe("generic_mismatch");
  });

  it("accepts generic substitution when permitted and genericNameCode matches", async () => {
    const { master, prescriptions, service } = harness();
    await seedMasters(master);
    await finalize(
      prescriptions,
      finalizedDraft(undefined, true),
    );
    const ok = await service.create(
      createInput({
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
      }),
    );
    expect(ok.kind).toBe("created");
  });

  it("rejects substitution when genericNameCode differs despite permission", async () => {
    const { master, prescriptions, service } = harness();
    await seedMasters(master);
    await finalize(prescriptions, finalizedDraft(undefined, true));
    const mismatch = await service.create(
      createInput({
        items: [
          {
            rpItemId: RP_ITEM_A,
            dispensedMedicationItemId: MED_GENERIC_NG,
            dispensedText: null,
            quantity: "7",
            remainingStockAdjustment: null,
            note: null,
          },
        ],
      }),
    );
    expect(mismatch.kind).toBe("generic_mismatch");
  });

  it("treats free-text dispensing on a resolved line as a substitution (変更可否必須)", async () => {
    const { prescriptions, service } = harness();
    // resolved 行への free text は品目変更扱い — 変更可否なしでは拒否。
    await finalize(prescriptions, finalizedDraft());
    const denied = await service.create(
      createInput({
        items: [
          {
            rpItemId: RP_ITEM_A,
            dispensedMedicationItemId: null,
            dispensedText: "マスター未収載の調剤品目",
            quantity: "7",
            remainingStockAdjustment: "残薬 3 錠調整",
            note: null,
          },
        ],
      }),
    );
    expect(denied.kind).toBe("generic_mismatch");

    // 変更可否ありなら受理される(未収載品の実務ケース)。
    const { prescriptions: prescriptions2, service: service2 } = harness();
    await finalize(prescriptions2, finalizedDraft(undefined, true));
    const allowed = await service2.create(
      createInput({
        items: [
          {
            rpItemId: RP_ITEM_A,
            dispensedMedicationItemId: null,
            dispensedText: "マスター未収載の調剤品目",
            quantity: "7",
            remainingStockAdjustment: "残薬 3 錠調整",
            note: null,
          },
        ],
      }),
    );
    expect(allowed.kind).toBe("created");
    if (allowed.kind === "created") {
      expect(allowed.record.items[0]?.dispensedText).toBe(
        "マスター未収載の調剤品目",
      );
      expect(allowed.record.items[0]?.dispensedMedicationItemId).toBeNull();
    }
  });

  it("replays create with the same key and payload, conflicts on different payload", async () => {
    const { prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());
    const first = await service.create(createInput());
    expect(first.kind).toBe("created");
    const replay = await service.create(createInput());
    expect(replay.kind).toBe("created");
    if (replay.kind === "created") expect(replay.replayed).toBe(true);
    const conflict = await service.create(
      createInput({ dispensingDate: "2026-08-26" }),
    );
    expect(conflict.kind).toBe("idempotency_conflict");
  });

  it("confirms with qualification, records audit and outbox, replays on same key", async () => {
    const { audit, outbox, prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());
    const created = await service.create(createInput());
    if (created.kind !== "created") throw new Error("create failed");
    const id = created.record.dispensingId;

    const confirmed = await service.confirm(confirmInput(id));
    expect(confirmed.kind).toBe("confirmed");
    if (confirmed.kind !== "confirmed") return;
    expect(confirmed.record.status).toBe("DISPENSING_RECORDED");
    expect(confirmed.record.confirmedBy).toBe("actor-test-001");

    const events = await audit.list(scope);
    expect(
      events.some((entry) => entry.auditEventType === "dispensing.confirmed"),
    ).toBe(true);
    const intents = outbox.list(scope.tenantId, scope.pharmacyId);
    const intent = intents.find(
      (entry) => entry.eventType === "dispense.confirmed",
    );
    expect(intent?.aggregateType).toBe("dispensing");
    expect(intent?.aggregateId).toBe(id);
    expect(intent?.prescriptionId).toBe("prescription-dispensing-001");
    expect(intent?.version).toBe(1);

    const replay = await service.confirm(confirmInput(id));
    expect(replay.kind).toBe("confirmed");
    if (replay.kind === "confirmed") expect(replay.replayed).toBe(true);
    // 確認済みへの別 key 再送は lifecycle 遷移不可(DSP-0002)。
    const conflict = await service.confirm(
      confirmInput(id, { idempotencyKey: "disp-confirm-key-999" }),
    );
    expect(conflict.kind).toBe("invalid_transition");
  });

  it("denies confirm without pharmacist qualification before existence check", async () => {
    const { audit, qualification, prescriptions, service } = harness();
    await finalize(prescriptions, finalizedDraft());
    const created = await service.create(createInput());
    if (created.kind !== "created") throw new Error("create failed");
    // 処方確定後に資格取消 — SEC-010 は confirm 時点の evidence を見る。
    qualification.revoke({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });

    const denied = await service.confirm(
      confirmInput(created.record.dispensingId),
    );
    expect(denied.kind).toBe("unqualified");
    // 存在しない ID に対しても同じ deny(存在非開示)。
    const deniedMissing = await service.confirm(
      confirmInput("dispensing-999"),
    );
    expect(deniedMissing.kind).toBe("unqualified");
    const events = await audit.list(scope);
    expect(
      events.filter(
        (entry) => entry.auditEventType === "dispensing.confirm.denied",
      ).length,
    ).toBe(2);
  });

  it("returns not_found for an unknown dispensing id when qualified", async () => {
    const { service } = harness();
    const result = await service.confirm(confirmInput("dispensing-404"));
    expect(result.kind).toBe("not_found");
  });

  it("conceals records across pharmacy scopes", async () => {
    const { prescriptions, qualification, service } = harness();
    // 別 pharmacy scope での confirm を検証するため pharmacy-002 にも資格付与
    // (SEC-010 は存在判定より先に評価されるため、資格なしでは conceal 確認に
    // 到達しない)。
    qualification.grant({
      tenantId: scope.tenantId,
      pharmacyId: pharmacyId("pharmacy-002"),
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });
    await finalize(prescriptions, finalizedDraft());
    const created = await service.create(createInput());
    if (created.kind !== "created") throw new Error("create failed");
    const otherScope = await service.create(
      createInput({
        pharmacyId: pharmacyId("pharmacy-002"),
      }),
    );
    expect(otherScope.kind).toBe("not_found");
    const confirmOther = await service.confirm(
      confirmInput(created.record.dispensingId, {
        pharmacyId: pharmacyId("pharmacy-002"),
      }),
    );
    expect(confirmOther.kind).toBe("not_found");
  });
});
