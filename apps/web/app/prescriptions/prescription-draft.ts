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
  /** DOM-002 §4.2a 原本 metadata(手入力値。全フィールド文字列、空文字=未入力)。 */
  readonly institutionCode: string;
  readonly institutionName: string;
  readonly prescriberName: string;
  readonly issueDate: string;
  readonly validUntil: string;
  readonly refillTotal: string;
  readonly refillRemaining: string;
  readonly splitDispensing: string;
}

export function prescriptionDraftWorkId(
  patientId: string,
  receptionId?: string,
  businessDate?: string,
): string {
  if (receptionId === undefined || businessDate === undefined) {
    return `prescription-draft:${patientId}`;
  }
  return `prescription-draft:${patientId}:${businessDate}:${receptionId}`;
}

export function createBlankPrescriptionDraft(): PrescriptionDraftSnapshot {
  return {
    rows: createBlankDraftRows(),
    prescriptionType: "",
    prescriptionDate: "",
    defaultDays: "",
    options: [],
    note: "",
    institutionCode: "",
    institutionName: "",
    prescriberName: "",
    issueDate: "",
    validUntil: "",
    refillTotal: "",
    refillRemaining: "",
    splitDispensing: "",
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
    institutionCode: draft.institutionCode,
    institutionName: draft.institutionName,
    prescriberName: draft.prescriberName,
    issueDate: draft.issueDate,
    validUntil: draft.validUntil,
    refillTotal: draft.refillTotal,
    refillRemaining: draft.refillRemaining,
    splitDispensing: draft.splitDispensing,
  };
}

export function isPrescriptionDraftDirty(
  draft: PrescriptionDraftSnapshot,
): boolean {
  // 行の追加・削除は内容の有無に関わらず未保存の編集として扱う。
  if (draft.rows.length !== 1) return true;
  if (!isDraftRowEmpty(draft.rows[0]!)) return true;
  return (
    draft.prescriptionType.trim().length > 0 ||
    draft.prescriptionDate.trim().length > 0 ||
    draft.defaultDays.trim().length > 0 ||
    draft.options.length > 0 ||
    draft.note.trim().length > 0 ||
    draft.institutionCode.trim().length > 0 ||
    draft.institutionName.trim().length > 0 ||
    draft.prescriberName.trim().length > 0 ||
    draft.issueDate.trim().length > 0 ||
    draft.validUntil.trim().length > 0 ||
    draft.refillTotal.trim().length > 0 ||
    draft.refillRemaining.trim().length > 0 ||
    draft.splitDispensing.trim().length > 0
  );
}
