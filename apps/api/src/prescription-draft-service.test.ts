import { describe, expect, it } from "vitest";

import {
  patientId,
  pharmacyId,
  prescriptionId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryAuditRepository } from "./audit-repository.js";
import {
  InMemoryPrescriptionDraftService,
  type PrescriptionDraftSaveInput,
} from "./prescription-draft-service.js";
import { InMemoryReceptionRepository } from "./reception-repository.js";

const scope = {
  tenantId: tenantId("tenant-001"),
  pharmacyId: pharmacyId("pharmacy-001"),
  receptionId: receptionId("reception-syn-001"),
  patientId: patientId("patient-syn-001"),
  businessDate: "2026-07-09",
} as const;

function input(
  expectedVersion: number,
  drugText = "合成薬剤A 5mg",
): PrescriptionDraftSaveInput {
  return {
    ...scope,
    actorId: userId("actor-test-001"),
    expectedVersion,
    wallClock: `2026-08-25T00:00:0${Math.min(expectedVersion, 9)}.000Z`,
    draft: {
      prescriptionType: "OUTPATIENT",
      prescriptionDate: "2026-07-09",
      defaultDays: 7,
      flags: ["PACKAGING"],
      note: "合成テスト用下書き",
      rows: [
        {
          sequence: 1,
          drugText,
          usageText: "1日1回 朝食後",
          days: 7,
          quantityText: "7錠",
        },
      ],
    },
  };
}

describe("InMemoryPrescriptionDraftService", () => {
  it("creates, reads, updates, and idempotently replays a scoped draft", async () => {
    const audit = new InMemoryAuditRepository();
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      audit,
      () => prescriptionId("prescription-test-001"),
    );

    await expect(service.save(input(0))).resolves.toMatchObject({
      kind: "saved",
      draft: {
        prescriptionId: "prescription-test-001",
        version: 1,
        saveDisposition: "created",
        lifecycleStatus: "SERVER_SAVED",
      },
    });
    await expect(service.save(input(0))).resolves.toMatchObject({
      kind: "saved",
      draft: { version: 1, saveDisposition: "replayed" },
    });
    await expect(
      service.save(input(1, "合成薬剤B 10mg")),
    ).resolves.toMatchObject({
      kind: "saved",
      draft: { version: 2, saveDisposition: "updated" },
    });
    await expect(service.get(scope)).resolves.toMatchObject({
      kind: "found",
      draft: {
        version: 2,
        draft: { rows: [{ drugText: "合成薬剤B 10mg" }] },
      },
    });

    const events = await audit.list({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
    });
    expect(events.map((event) => event.auditEventType)).toEqual([
      "prescription.created",
      "prescription.updated",
    ]);
  });

  it("returns a conflict without mutating the current version", async () => {
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      new InMemoryAuditRepository(),
      () => prescriptionId("prescription-test-002"),
    );
    await service.save(input(0));

    await expect(service.save(input(0, "別の内容"))).resolves.toEqual({
      kind: "conflict",
      currentVersion: 1,
    });
    await expect(service.get(scope)).resolves.toMatchObject({
      kind: "found",
      draft: {
        version: 1,
        draft: { rows: [{ drugText: "合成薬剤A 5mg" }] },
      },
    });
  });

  it("fails closed across tenant, pharmacy, patient, date, and reception boundaries", async () => {
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      new InMemoryAuditRepository(),
    );

    for (const invalidScope of [
      { ...scope, tenantId: tenantId("tenant-other") },
      { ...scope, pharmacyId: pharmacyId("pharmacy-other") },
      { ...scope, patientId: patientId("patient-syn-002") },
      { ...scope, receptionId: receptionId("reception-syn-002") },
      { ...scope, businessDate: "2026-07-10" },
    ]) {
      await expect(
        service.save({ ...input(0), ...invalidScope }),
      ).resolves.toEqual({ kind: "not_found" });
      await expect(service.get(invalidScope)).resolves.toEqual({
        kind: "not_found",
      });
    }
  });

  it("does not create or update a draft for a completed reception", async () => {
    const audit = new InMemoryAuditRepository();
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      audit,
    );
    const completedScope = {
      ...scope,
      receptionId: receptionId("reception-syn-003"),
      patientId: patientId("patient-syn-003"),
    };

    await expect(
      service.save({ ...input(0), ...completedScope }),
    ).resolves.toEqual({ kind: "not_found" });
    expect(
      await audit.list({
        tenantId: scope.tenantId,
        pharmacyId: scope.pharmacyId,
      }),
    ).toEqual([]);
  });

  it("serializes concurrent first saves so only one draft is created", async () => {
    const audit = new InMemoryAuditRepository();
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      audit,
      () => prescriptionId("prescription-test-concurrent"),
    );

    const results = await Promise.all([
      service.save(input(0, "同時保存A")),
      service.save(input(0, "同時保存B")),
    ]);

    expect(results.filter((result) => result.kind === "saved")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(
      1,
    );
    expect(
      await audit.list({
        tenantId: scope.tenantId,
        pharmacyId: scope.pharmacyId,
      }),
    ).toHaveLength(1);
  });
});