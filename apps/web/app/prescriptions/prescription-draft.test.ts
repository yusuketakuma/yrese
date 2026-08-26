import { describe, expect, it } from "vitest";

import {
  clonePrescriptionDraft,
  createBlankPrescriptionDraft,
  isPrescriptionDraftDirty,
  prescriptionDraftWorkId,
} from "./prescription-draft";

describe("prescription draft tab-memory policy", () => {
  it("starts clean and uses a stable patient-scoped internal key", () => {
    const draft = createBlankPrescriptionDraft();
    expect(isPrescriptionDraftDirty(draft)).toBe(false);
    expect(prescriptionDraftWorkId("patient-1")).toBe(
      "prescription-draft:patient-1",
    );
    expect(
      prescriptionDraftWorkId("patient-1", "reception-1", "2026-08-25"),
    ).toBe("prescription-draft:patient-1:2026-08-25:reception-1");
    expect(
      prescriptionDraftWorkId("patient-1", "reception-2", "2026-08-25"),
    ).not.toBe(
      prescriptionDraftWorkId("patient-1", "reception-1", "2026-08-25"),
    );
    expect(
      prescriptionDraftWorkId("patient-1", "reception-1", "2026-08-26"),
    ).not.toBe(
      prescriptionDraftWorkId("patient-1", "reception-1", "2026-08-25"),
    );
  });

  it("treats any meaningful edit or added row as unsaved work", () => {
    const blank = createBlankPrescriptionDraft();
    expect(
      isPrescriptionDraftDirty({
        ...blank,
        rows: [{ ...blank.rows[0]!, drug: "合成薬A" }],
      }),
    ).toBe(true);
    expect(
      isPrescriptionDraftDirty({
        ...blank,
        rows: [
          ...blank.rows,
          { id: 2, drug: "", usage: "", days: "", quantity: "" },
        ],
      }),
    ).toBe(true);
    expect(
      isPrescriptionDraftDirty({ ...blank, prescriptionType: "外来" }),
    ).toBe(true);
    expect(isPrescriptionDraftDirty({ ...blank, options: ["一包化"] })).toBe(
      true,
    );
    expect(isPrescriptionDraftDirty({ ...blank, note: "確認事項" })).toBe(true);
  });

  it("clones nested rows and options before storing or restoring", () => {
    const source = {
      ...createBlankPrescriptionDraft(),
      rows: [
        { id: 1, drug: "合成薬A", usage: "朝", days: "7", quantity: "7錠" },
      ],
      options: ["一包化"] as const,
    };
    const clone = clonePrescriptionDraft(source);

    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect(clone.rows).not.toBe(source.rows);
    expect(clone.rows[0]).not.toBe(source.rows[0]);
    expect(clone.options).not.toBe(source.options);
  });
});
