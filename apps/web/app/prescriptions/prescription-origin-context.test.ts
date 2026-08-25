import { describe, expect, it } from "vitest";

import type { ReceptionQueueEntry } from "@yrese/contracts";

import type { UnsavedWorkRecord } from "../components/unsaved-work";
import {
  conflictingPrescriptionDrafts,
  createPrescriptionReceptionOrigin,
  isSamePrescriptionReceptionOrigin,
} from "./prescription-origin-context";

const ENTRY: ReceptionQueueEntry = {
  receptionId: "reception-test-001",
  patient: {
    patientId: "patient-test-001",
    name: "合成 患者",
    kana: "ゴウセイ カンジャ",
    birthDate: "1950-01-02",
    sex: "female",
    patientNumber: "T-0001",
    eligibilityStatus: "VERIFIED",
  },
  acceptedAt: "2026-08-25T00:15:00.000Z",
  receptionStatus: "WAITING",
  prescriptionIntakeType: "paper",
};

describe("prescription reception origin", () => {
  it("stores only the minimum reception and patient linkage", () => {
    const origin = createPrescriptionReceptionOrigin(ENTRY, "2026-08-25");

    expect(origin).toEqual({
      receptionId: "reception-test-001",
      patientId: "patient-test-001",
      businessDate: "2026-08-25",
    });
    expect(JSON.stringify(origin)).not.toContain("合成 患者");
    expect(JSON.stringify(origin)).not.toContain("T-0001");
  });

  it("treats only the exact reception, patient and date as the same handoff", () => {
    const origin = createPrescriptionReceptionOrigin(ENTRY, "2026-08-25");

    expect(isSamePrescriptionReceptionOrigin(origin, origin)).toBe(true);
    expect(
      isSamePrescriptionReceptionOrigin(origin, {
        ...origin,
        receptionId: "reception-test-002",
      }),
    ).toBe(false);
    expect(
      isSamePrescriptionReceptionOrigin(origin, {
        ...origin,
        patientId: "patient-test-002",
      }),
    ).toBe(false);
  });

  it("detects only same-patient drafts when moving to another reception", () => {
    const current = createPrescriptionReceptionOrigin(ENTRY, "2026-08-25");
    const next = { ...current, receptionId: "reception-test-002" };
    const records: readonly UnsavedWorkRecord[] = [
      {
        id: "prescription-draft:patient-test-001",
        kind: "prescription-draft",
        label: "処方下書き",
        href: "/prescriptions",
        patientId: "patient-test-001",
        snapshot: {},
      },
      {
        id: "prescription-draft:patient-test-002",
        kind: "prescription-draft",
        label: "処方下書き",
        href: "/prescriptions",
        patientId: "patient-test-002",
        snapshot: {},
      },
    ];

    expect(conflictingPrescriptionDrafts(records, current, next)).toEqual([
      records[0],
    ]);
    expect(conflictingPrescriptionDrafts(records, current, current)).toEqual([]);
  });
});
