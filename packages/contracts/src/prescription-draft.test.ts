import { describe, expect, it } from "vitest";

import {
  PRESCRIPTION_DRAFT_MAX_RP_GROUPS,
  PRESCRIPTION_DRAFT_MAX_RP_ITEMS,
  PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH,
  PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH,
  deriveRpGroupsFromLegacyRows,
  prescriptionDraftContentSchema,
  prescriptionDraftEffectiveRpGroups,
  prescriptionDraftHasUnresolvedMedicationItems,
  prescriptionDraftQuerySchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveRequestSchema,
  prescriptionDraftUnresolvedCounts,
} from "./prescription-draft.js";

const validDraft = {
  prescriptionType: "OUTPATIENT",
  sourceMetadata: null,
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
  it("keeps patient identifiers out of the read URL", () => {
    expect(prescriptionDraftQuerySchema.parse({ date: "2026-08-25" })).toEqual({
      date: "2026-08-25",
    });
    expect(() =>
      prescriptionDraftQuerySchema.parse({
        patientId: "patient-test-001",
        date: "2026-08-25",
      }),
    ).toThrow();
  });

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
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        note: ` ${"x".repeat(PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH - 1)} `,
      }),
    ).toThrow();
  });

  it("uses JSON Schema code-point length for clinical text", () => {
    expect(
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        note: "😀".repeat(PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH),
      }).note,
    ).toHaveLength(PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH * 2);
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        note: "😀".repeat(PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it("accepts and validates source metadata (DOM-002 §4.2a / WP-7205)", () => {
    const metadata = {
      medicalInstitution: { code: "1312345", name: "合成クリニック" },
      prescriberName: "合成 医師",
      issueDate: "2026-08-20",
      validUntil: "2026-08-24",
      refill: { total: 3, remaining: 2 },
      splitDispensing: "分割指示あり",
    };
    const parsed = prescriptionDraftContentSchema.parse({
      ...validDraft,
      sourceMetadata: metadata,
    });
    expect(parsed.sourceMetadata).toEqual(metadata);
    // 省略時は additive に null へ既定。
    expect(
      prescriptionDraftContentSchema.parse({
        prescriptionType: "OUTPATIENT",
        prescriptionDate: null,
        defaultDays: null,
        flags: [],
        note: "",
        rows: validDraft.rows,
      }).sourceMetadata,
    ).toBeNull();
  });

  it("rejects invalid source metadata invariants", () => {
    const base = {
      medicalInstitution: { code: null, name: "合成クリニック" },
      prescriberName: "合成 医師",
      issueDate: "2026-08-20",
      validUntil: "2026-08-24",
      refill: null,
      splitDispensing: null,
    };
    // validUntil < issueDate は拒否
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        sourceMetadata: { ...base, validUntil: "2026-08-19" },
      }),
    ).toThrow();
    // 実在しない暦日は拒否
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        sourceMetadata: { ...base, issueDate: "2026-02-30" },
      }),
    ).toThrow();
    // refill.remaining > total は拒否
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        sourceMetadata: {
          ...base,
          refill: { total: 2, remaining: 3 },
        },
      }),
    ).toThrow();
    // 負数・小数は拒否
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        sourceMetadata: {
          ...base,
          refill: { total: -1, remaining: 0 },
        },
      }),
    ).toThrow();
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        sourceMetadata: {
          ...base,
          refill: { total: 2.5, remaining: 1 },
        },
      }),
    ).toThrow();
  });

  it("accepts structured rpGroups with resolved and unresolved union refs", () => {
    const resolvedGroup = {
      rpGroupId: "00000000-0000-4000-8000-000000000010",
      sequence: 1,
      dosageForm: "ORAL",
      usage: {
        kind: "resolved",
        usageItemId: "00000000-0000-4000-8000-000000000101",
      },
      daysOrCount: 7,
      items: [
        {
          rpItemId: "00000000-0000-4000-a000-000000000010",
          sequence: 1,
          medication: {
            kind: "resolved",
            masterVersionId: "00000000-0000-4000-8000-000000000201",
            medicationItemId: "00000000-0000-4000-8000-000000000301",
          },
          doseOnce: "1錠",
          dosePerDay: null,
          doseTotal: "7錠",
          unit: "錠",
          genericNamePrescription: true,
          genericSubstitutionPermitted: true,
        },
      ],
    };
    const unresolvedGroup = {
      rpGroupId: "00000000-0000-4000-8000-000000000011",
      sequence: 2,
      dosageForm: "UNSPECIFIED",
      usage: { kind: "unresolved", text: "疼痛時 頓服" },
      daysOrCount: null,
      items: [
        {
          rpItemId: "00000000-0000-4000-a000-000000000011",
          sequence: 1,
          medication: { kind: "unresolved", text: "ロキソニン 60mg" },
          doseOnce: null,
          dosePerDay: null,
          doseTotal: null,
          unit: null,
          genericNamePrescription: false,
          genericSubstitutionPermitted: null,
        },
      ],
    };
    // rows を持たない新構造 draft(rows は legacy 読み専用ミラー)。
    const parsed = prescriptionDraftContentSchema.parse({
      ...validDraft,
      rows: [],
      rpGroups: [resolvedGroup, unresolvedGroup],
    });
    expect(parsed.rpGroups).toHaveLength(2);
    expect(parsed.rows).toHaveLength(0);
    // 混在(resolved + unresolved)は許可(packet D-1)。
    expect(
      prescriptionDraftUnresolvedCounts(parsed).unresolvedMedicationItems,
    ).toBe(1);
    expect(
      prescriptionDraftUnresolvedCounts(parsed).unresolvedUsages,
    ).toBe(1);
  });

  it("rejects drafts with no rows and no rpGroups, or both on write", () => {
    expect(() =>
      prescriptionDraftContentSchema.parse({ ...validDraft, rows: [] }),
    ).toThrow();
    expect(() =>
      prescriptionDraftSaveRequestSchema.parse({
        patientId: "patient-test-001",
        businessDate: "2026-08-25",
        expectedVersion: 0,
        draft: {
          ...validDraft,
          rpGroups: deriveRpGroupsFromLegacyRows(validDraft.rows),
        },
      }),
    ).toThrow();
    // response 側(rows + derived rpGroups の併存)は許容される。
    expect(
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        rpGroups: deriveRpGroupsFromLegacyRows(validDraft.rows),
      }).rpGroups,
    ).toHaveLength(1);
  });

  it("enforces rp group/item bounds and contiguous sequences", () => {
    const group = deriveRpGroupsFromLegacyRows(validDraft.rows)[0]!;
    const tooManyGroups = Array.from(
      { length: PRESCRIPTION_DRAFT_MAX_RP_GROUPS + 1 },
      (_, index) => ({
        ...group,
        rpGroupId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        items: [
          {
            ...group.items[0],
            rpItemId: `00000000-0000-4000-a000-${String(index + 1).padStart(12, "0")}`,
          },
        ],
        sequence: index + 1,
      }),
    );
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        rows: [],
        rpGroups: tooManyGroups,
      }),
    ).toThrow();
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        rows: [],
        rpGroups: [{ ...group, sequence: 2 }],
      }),
    ).toThrow();
    const overTextItem = {
      ...group,
      items: [
        {
          ...group.items[0],
          medication: {
            kind: "unresolved",
            text: "x".repeat(PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH + 1),
          },
        },
      ],
    };
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        rows: [],
        rpGroups: [overTextItem],
      }),
    ).toThrow();
    const manyItems = Array.from(
      { length: PRESCRIPTION_DRAFT_MAX_RP_ITEMS + 1 },
      (_, index) => ({
        ...group.items[0],
        rpItemId: `00000000-0000-4000-a000-${String(index + 1).padStart(12, "0")}`,
        sequence: index + 1,
      }),
    );
    expect(() =>
      prescriptionDraftContentSchema.parse({
        ...validDraft,
        rows: [],
        rpGroups: [{ ...group, items: manyItems }],
      }),
    ).toThrow();
  });

  it("derives deterministic UNRESOLVED_TEXT groups from legacy rows", () => {
    const derived = deriveRpGroupsFromLegacyRows(validDraft.rows);
    expect(derived).toEqual(deriveRpGroupsFromLegacyRows(validDraft.rows));
    expect(derived[0]).toMatchObject({
      sequence: 1,
      dosageForm: "UNSPECIFIED",
      usage: { kind: "unresolved", text: "1日1回 朝食後" },
      daysOrCount: 7,
      items: [
        {
          sequence: 1,
          medication: { kind: "unresolved", text: "合成薬剤 5mg" },
          doseTotal: "7錠",
          genericNamePrescription: false,
          genericSubstitutionPermitted: null,
        },
      ],
    });
    // legacy draft(rows のみ)の実効構造は導出結果と一致する。
    const legacy = prescriptionDraftContentSchema.parse(validDraft);
    expect(prescriptionDraftEffectiveRpGroups(legacy)).toEqual(derived);
    expect(prescriptionDraftHasUnresolvedMedicationItems(legacy)).toBe(true);
  });

  it("requires persisted identity, version, and actor metadata", () => {
    expect(
      prescriptionDraftResponseSchema.parse({
        prescriptionId: "prescription-test-001",
        receptionId: "reception-test-001",
        patientId: "patient-test-001",
        businessDate: "2026-08-25",
        version: 1,
        draft: validDraft,
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
        createdBy: "actor-test-001",
        updatedBy: "actor-test-001",
      }),
    ).toMatchObject({
      prescriptionId: "prescription-test-001",
      version: 1,
    });
  });
});
