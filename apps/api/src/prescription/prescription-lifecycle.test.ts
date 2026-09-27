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
