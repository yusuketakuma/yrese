import {
  type DraftRow,
  createBlankDraftRows,
  isDraftRowEmpty,
} from "./prescription-replacement";

export const PRESCRIPTION_OPTIONS = [
  "一包化",
  "在宅",
  "麻薬",
  "向精神薬",
  "残薬調整",
] as const;

export type PrescriptionOption = (typeof PRESCRIPTION_OPTIONS)[number];

export interface PrescriptionDraftSnapshot {
  readonly rows: readonly DraftRow[];
  readonly prescriptionType: string;
  readonly prescriptionDate: string;
  readonly defaultDays: string;
  readonly options: readonly PrescriptionOption[];
  readonly note: string;
}

export function prescriptionDraftWorkId(patientId: string): string {
  return `prescription-draft:${patientId}`;
}

export function createBlankPrescriptionDraft(): PrescriptionDraftSnapshot {
  return {
    rows: createBlankDraftRows(),
    prescriptionType: "",
    prescriptionDate: "",
    defaultDays: "",
    options: [],
    note: "",
  };
}

export function clonePrescriptionDraft(
  draft: PrescriptionDraftSnapshot,
): PrescriptionDraftSnapshot {
  return {
    rows: draft.rows.map((row) => ({ ...row })),
    prescriptionType: draft.prescriptionType,
    prescriptionDate: draft.prescriptionDate,
    defaultDays: draft.defaultDays,
    options: [...draft.options],
    note: draft.note,
  };
}

export function isPrescriptionDraftDirty(
  draft: PrescriptionDraftSnapshot,
): boolean {
  if (draft.rows.length !== 1) return true;
  if (!isDraftRowEmpty(draft.rows[0]!)) return true;
  return (
    draft.prescriptionType.trim().length > 0 ||
    draft.prescriptionDate.trim().length > 0 ||
    draft.defaultDays.trim().length > 0 ||
    draft.options.length > 0 ||
    draft.note.trim().length > 0
  );
}
