import { describe, expect, it } from "vitest";

import {
  prescriptionDraftContentSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
} from "./prescription-draft.js";

const validDraft = {
  prescriptionType: "OUTPATIENT",
  prescriptionDate: "2026-08-25",
  defaultDays: 7,
  flags: ["PACKAGING"],
  note: "服薬状況を確認",
  rows: [
    {
      sequence: 1,
      drugText: "合成薬剤 5mg",
      usageText: "1日1回 朝食後",
      days: 7,
      quantityText: "7錠",
    },
  ],
} as const;

describe("prescription draft contracts", () => {
  it("accepts a bounded versioned draft request and normalizes edge whitespace", () => {
    const parsed = prescriptionDraftSaveRequestSchema.parse({
      patientId: "patient-test-001",
      businessDate: "2026-08-25",
      expectedVersion: 0,
      draft: { ...validDraft, note: "  服薬状況を確認  " },
    });

    expect(parsed.draft.note).toBe("服薬状況を確認");
    expect(parsed.draft.rows).toHaveLength(1);
  });

  it("rejects duplicate flags and non-contiguous row sequences", () => {
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        flags: ["PACKAGING", "PACKAGING"],
        rows: [{ ...validDraft.rows[0], sequence: 2 }],
      }),
    ).toThrow();
  });

  it("rejects invalid dates and unbounded text", () => {
    expect(() =>
      prescriptionDraftSaveRequestSchema.parse({
        patientId: "patient-test-001",
        businessDate: "2026-02-30",
        expectedVersion: 0,
        draft: validDraft,
      }),
    ).toThrow();
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        note: "x".repeat(2_001),
      }),
    ).toThrow();
  });

  it("requires persisted identity, version, lifecycle, and actor metadata", () => {
    expect(
      prescriptionDraftResponseSchema.parse({
        prescriptionId: "prescription-test-001",
        receptionId: "reception-test-001",
        patientId: "patient-test-001",
        businessDate: "2026-08-25",
        version: 1,
        lifecycleStatus: "SERVER_SAVED",
        draft: validDraft,
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
        createdBy: "actor-test-001",
        updatedBy: "actor-test-001",
      }),
    ).toMatchObject({
      prescriptionId: "prescription-test-001",
      version: 1,
      lifecycleStatus: "SERVER_SAVED",
    });
  });
});
