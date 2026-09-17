import { describe, expect, it } from "vitest";

import {
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from "./actor-qualification-repository.js";
import { InMemoryAuditRepository } from "./audit-repository.js";
import type { PrescriptionDraftContent } from "@yrese/contracts";

import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
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
