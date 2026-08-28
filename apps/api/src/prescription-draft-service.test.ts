import { describe, expect, it, vi } from "vitest";

import { prescriptionDraftContentSchema } from "@yrese/contracts";
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
  normalizePrescriptionDraftContent,
  prescriptionDraftContentHash,
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

const saveScope = {
  ...scope,
  patientId: patientId("patient-syn-001"),
} as const;

function input(
  expectedVersion: number,
  drugText = "合成薬剤A 5mg",
): PrescriptionDraftSaveInput {
  return {
    ...saveScope,
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

describe("normalizePrescriptionDraftContent", () => {
  it("parses at the trust boundary exactly once and returns canonical content", () => {
    const raw = {
      prescriptionType: "OUTPATIENT",
      prescriptionDate: "2026-07-09",
      defaultDays: 7,
      flags: ["NARCOTIC", "PACKAGING"],
      note: "  正規化テスト  ",
      rows: [
        {
          sequence: 1,
          drugText: " 合成薬剤A 5mg ",
          usageText: "1日1回 朝食後",
          days: 7,
          quantityText: "7錠",
        },
      ],
      unknownKey: "must be stripped",
    };
    const parseSpy = vi.spyOn(prescriptionDraftContentSchema, "parse");
    try {
      const normalized = normalizePrescriptionDraftContent(raw);
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(normalized.flags).toEqual(["PACKAGING", "NARCOTIC"]);
      expect(normalized.note).toBe("正規化テスト");
      expect(normalized.rows[0]?.drugText).toBe("合成薬剤A 5mg");
      expect("unknownKey" in normalized).toBe(false);
      expect(prescriptionDraftContentHash(normalized)).toBe(
        prescriptionDraftContentHash(
          raw as unknown as Parameters<typeof prescriptionDraftContentHash>[0],
        ),
      );
    } finally {
      parseSpy.mockRestore();
    }
  });
});

describe("InMemoryPrescriptionDraftService", () => {
  it("creates, reads, updates, and recognizes an unchanged scoped draft", async () => {
    const audit = new InMemoryAuditRepository();
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      audit,
      () => prescriptionId("prescription-test-001"),
    );

    await expect(service.get(scope)).resolves.toEqual({ kind: "empty" });
    await expect(service.save(input(0))).resolves.toMatchObject({
      kind: "saved",
      draft: {
        prescriptionId: "prescription-test-001",
        version: 1,
        saveDisposition: "created",
      },
    });
    await expect(service.save(input(0))).resolves.toEqual({
      kind: "conflict",
      currentVersion: 1,
    });
    await expect(
      service.save(input(1, "合成薬剤B 10mg")),
    ).resolves.toMatchObject({
      kind: "saved",
      draft: { version: 2, saveDisposition: "updated" },
    });
    await expect(
      service.save(input(2, "合成薬剤B 10mg")),
    ).resolves.toMatchObject({
      kind: "saved",
      draft: { version: 2, saveDisposition: "unchanged" },
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
      "prescription.draft.viewed",
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

  it("fails closed across tenant, pharmacy, date, and reception boundaries", async () => {
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      new InMemoryAuditRepository(),
    );

    for (const invalidScope of [
      { ...scope, tenantId: tenantId("tenant-other") },
      { ...scope, pharmacyId: pharmacyId("pharmacy-other") },
      { ...scope, receptionId: receptionId("reception-other") },
      { ...scope, businessDate: "2026-07-10" },
    ]) {
      await expect(
        service.save({ ...input(0), ...invalidScope }),
      ).resolves.toEqual({ kind: "not_found" });
      await expect(service.get(invalidScope)).resolves.toEqual({
        kind: "not_found",
      });
    }

    await expect(
      service.save({ ...input(0), patientId: patientId("patient-syn-002") }),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("rejects writes for a terminal reception without recording success", async () => {
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
    await expect(
      audit.list({ tenantId: scope.tenantId, pharmacyId: scope.pharmacyId }),
    ).resolves.toEqual([]);
  });

  it("keeps persisted timestamps monotonic when the wall clock moves backward", async () => {
    const service = new InMemoryPrescriptionDraftService(
      new InMemoryReceptionRepository(),
      new InMemoryAuditRepository(),
    );
    await service.save({
      ...input(0),
      wallClock: "2026-08-25T00:00:05.000Z",
    });

    await expect(
      service.save({
        ...input(1, "時刻逆行後の更新"),
        wallClock: "2026-08-25T00:00:04.000Z",
      }),
    ).resolves.toMatchObject({
      kind: "saved",
      draft: {
        createdAt: "2026-08-25T00:00:05.000Z",
        updatedAt: "2026-08-25T00:00:05.000Z",
      },
    });
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
