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

import { InMemoryActorQualificationRepository } from '../actor-qualification-repository.js';
import { InMemoryAuditRepository } from '../audit/audit-repository.js';
import type { PrescriptionDraftContent } from "@yrese/contracts";
import { InMemoryMasterRepository } from '../master/master-repository.js';

import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftFromPriorInput,
  type PrescriptionDraftSaveInput,
  type PrescriptionLifecycleCommandInput,
} from './prescription-draft-service.js';
import { InMemoryReceptionRepository } from '../reception/reception-repository.js';


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
