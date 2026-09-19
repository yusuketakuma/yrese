import { z } from "zod";

import { PRESCRIPTION_STATUSES } from "@yrese/shared-kernel";

import {
  actorIdWireSchema,
  patientIdWireSchema,
  prescriptionIdWireSchema,
  receptionIdWireSchema,
} from "./wire-id.js";

export const PRESCRIPTION_DRAFT_MAX_ROWS = 100;
export const PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH = 256;
export const PRESCRIPTION_DRAFT_QUANTITY_MAX_LENGTH = 64;
export const PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH = 2_000;
export const PRESCRIPTION_DRAFT_MAX_DAYS = 999;
export const PRESCRIPTION_DRAFT_MAX_VERSION = 2_147_483_647;
export const PRESCRIPTION_DRAFT_INSTITUTION_CODE_MAX_LENGTH = 64;
export const PRESCRIPTION_DRAFT_PARTY_NAME_MAX_LENGTH = 128;
export const PRESCRIPTION_DRAFT_SPLIT_DISPENSING_MAX_LENGTH = 256;
export const PRESCRIPTION_DRAFT_REFILL_MAX_COUNT = 999;
// DOM-002 §4.2b / WP-7302 packet D-4 の確定上限値。
export const PRESCRIPTION_DRAFT_MAX_RP_GROUPS = 50;
export const PRESCRIPTION_DRAFT_MAX_RP_ITEMS = 200;
export const PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH = 500;
export const PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH = 64;

function isRealIsoCalendarDate(value: string): boolean {
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}

const calendarDateWireSchema = z
  .iso
  .date()
  .refine(isRealIsoCalendarDate, {
    message: "date must be a real calendar date",
  });

export const prescriptionDraftTypeSchema = z.enum([
  "UNSPECIFIED",
  "OUTPATIENT",
  "HOME",
]);

export type PrescriptionDraftType = z.infer<typeof prescriptionDraftTypeSchema>;

export const prescriptionDraftFlagSchema = z.enum([
  "PACKAGING",
  "HOME_CARE",
  "NARCOTIC",
  "PSYCHOTROPIC",
  "LEFTOVER_ADJUSTMENT",
]);

export type PrescriptionDraftFlag = z.infer<typeof prescriptionDraftFlagSchema>;

const normalizedDraftText = (maximum: number) =>
  z
    .string()
    .refine((value) => Array.from(value).length <= maximum, {
      message: `text must contain at most ${maximum} Unicode code points`,
    })
    .trim()
    .meta({ maxLength: maximum });

/**
 * WP-7302: 新規 Rp field の自由記載は制御文字を拒否する(master.ts の
 * textToken と同規則)。`\u0000` は Zod を通過しても Postgres の
 * jsonb/text 書込で失敗するため、契約層で fail-closed する。
 * legacy field(drugText/usageText/note 等)には適用しない —
 * 既存保存行の read 互換を維持する。
 */
const rpControlCharacterPattern =
  /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;
export const normalizedRpText = (maximum: number) =>
  normalizedDraftText(maximum).refine(
    (value) => !rpControlCharacterPattern.test(value),
    { message: "text must not contain control characters" },
  );

export const prescriptionDraftRowSchema = z.object({
  sequence: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_ROWS),
  drugText: normalizedDraftText(PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH),
  usageText: normalizedDraftText(PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH),
  days: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_DAYS).nullable(),
  quantityText: normalizedDraftText(PRESCRIPTION_DRAFT_QUANTITY_MAX_LENGTH),
});

export type PrescriptionDraftRow = z.infer<typeof prescriptionDraftRowSchema>;

/**
 * DOM-002 §4.2b / WP-7302: Rp 構造化行。
 * 剤形区分は内服・外用・注射・頓服を基本とし、分類不能な行は UNSPECIFIED
 * (legacy free-text 行の読み替えでも使用)とする。
 */
export const prescriptionRpDosageFormSchema = z.enum([
  "UNSPECIFIED",
  "ORAL",
  "TOPICAL",
  "INJECTION",
  "AS_NEEDED",
  "OTHER",
]);

export type PrescriptionRpDosageForm = z.infer<
  typeof prescriptionRpDosageFormSchema
>;

/** 用法参照(packet D-2): 自局用法コード解決済み | 未解決自由記載。 */
export const prescriptionRpUsageRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("resolved"),
    usageItemId: z.uuid(),
  }),
  z.object({
    kind: z.literal("unresolved"),
    text: normalizedRpText(PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH),
  }),
]);

export type PrescriptionRpUsageRef = z.infer<
  typeof prescriptionRpUsageRefSchema
>;

/** 医薬品参照(packet D-2): master 版 + item ID | UNRESOLVED_TEXT。 */
export const prescriptionRpMedicationRefSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("resolved"),
      masterVersionId: z.uuid(),
      medicationItemId: z.uuid(),
    }),
    z.object({
      kind: z.literal("unresolved"),
      text: normalizedRpText(PRESCRIPTION_DRAFT_RP_TEXT_MAX_LENGTH),
    }),
  ],
);

export type PrescriptionRpMedicationRef = z.infer<
  typeof prescriptionRpMedicationRefSchema
>;

const optionalRpDoseText = normalizedRpText(
  PRESCRIPTION_DRAFT_RP_DOSE_MAX_LENGTH,
).nullable();

/**
 * DOM-002 §4.2b: 用量フィールドは記録値であり、用量・用法の妥当性計算は
 * 行わない(算定・添文書チェックは別工程)。数値化しないのは入力値を
 * そのまま保持するため。
 */
export const prescriptionRpItemSchema = z.object({
  rpItemId: z.uuid(),
  sequence: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_RP_ITEMS),
  medication: prescriptionRpMedicationRefSchema,
  doseOnce: optionalRpDoseText,
  dosePerDay: optionalRpDoseText,
  doseTotal: optionalRpDoseText,
  unit: optionalRpDoseText,
  genericNamePrescription: z.boolean(),
  genericSubstitutionPermitted: z.boolean().nullable(),
});

export type PrescriptionRpItem = z.infer<typeof prescriptionRpItemSchema>;

export const prescriptionRpGroupSchema = z
  .object({
    rpGroupId: z.uuid(),
    sequence: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_RP_GROUPS),
    dosageForm: prescriptionRpDosageFormSchema,
    usage: prescriptionRpUsageRefSchema,
    /** 日数または回数(剤形区分に応じた記録値。単位の妥当性判定はしない)。 */
    daysOrCount: z
      .number()
      .int()
      .min(1)
      .max(PRESCRIPTION_DRAFT_MAX_DAYS)
      .nullable(),
    items: z
      .array(prescriptionRpItemSchema)
      .min(1)
      .max(PRESCRIPTION_DRAFT_MAX_RP_ITEMS),
  })
  .superRefine((group, context) => {
    group.items.forEach((item, index) => {
      if (item.sequence !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "sequence"],
          message: "rp item sequence must be contiguous and start at 1",
        });
      }
    });
  });

export type PrescriptionRpGroup = z.infer<typeof prescriptionRpGroupSchema>;

/**
 * DOM-002 §4.2b 移行規則: legacy free-text 行を UNRESOLVED_TEXT 構造へ
 * 読み替える。ID は content-hash 安定性のため行番号から決定的に採番する
 * (synthetic master ID と同じ UUID 形・永続参照には使わない)。
 */
export function deriveRpGroupsFromLegacyRows(
  rows: readonly PrescriptionDraftRow[],
): PrescriptionRpGroup[] {
  return rows.map((row, index) => {
    const sequence = index + 1;
    const idSuffix = String(sequence).padStart(12, "0");
    return {
      rpGroupId: `00000000-0000-4000-8000-${idSuffix}`,
      sequence,
      dosageForm: "UNSPECIFIED",
      usage: { kind: "unresolved", text: row.usageText },
      daysOrCount: row.days,
      items: [
        {
          rpItemId: `00000000-0000-4000-a000-${idSuffix}`,
          sequence: 1,
          medication: { kind: "unresolved", text: row.drugText },
          doseOnce: null,
          dosePerDay: null,
          doseTotal: row.quantityText.length === 0 ? null : row.quantityText,
          unit: null,
          genericNamePrescription: false,
          genericSubstitutionPermitted: null,
        },
      ],
    };
  });
}

/**
 * draft の実効 Rp 構造。永続化済み rpGroups があればそれを使い、
 * 無ければ legacy free-text 行から読み替える(永続行は書き換えない)。
 */
export function prescriptionDraftEffectiveRpGroups(
  draft: Pick<PrescriptionDraftContent, "rows" | "rpGroups">,
): readonly PrescriptionRpGroup[] {
  return draft.rpGroups.length > 0
    ? draft.rpGroups
    : deriveRpGroupsFromLegacyRows(draft.rows);
}

export interface PrescriptionDraftUnresolvedCounts {
  readonly unresolvedMedicationItems: number;
  readonly unresolvedUsages: number;
}

export function prescriptionDraftUnresolvedCounts(
  draft: Pick<PrescriptionDraftContent, "rows" | "rpGroups">,
): PrescriptionDraftUnresolvedCounts {
  let unresolvedMedicationItems = 0;
  let unresolvedUsages = 0;
  for (const group of prescriptionDraftEffectiveRpGroups(draft)) {
    if (group.usage.kind === "unresolved") unresolvedUsages += 1;
    for (const item of group.items) {
      if (item.medication.kind === "unresolved") {
        unresolvedMedicationItems += 1;
      }
    }
  }
  return { unresolvedMedicationItems, unresolvedUsages };
}

/**
 * DOM-002 §4.2b 解決必須 guard: UNRESOLVED_TEXT の品目を含む draft は
 * 薬剤師確認へ進めない(CODE_MAPPING_REVIEW_REQUIRED / RX-0001)。
 * 未解決用法は禁止されない(自由記載の用法は制度上許容される)が、
 * UI が警告表示できるよう counts として併せて公開する。
 */
export function prescriptionDraftHasUnresolvedMedicationItems(
  draft: Pick<PrescriptionDraftContent, "rows" | "rpGroups">,
): boolean {
  return (
    prescriptionDraftUnresolvedCounts(draft).unresolvedMedicationItems > 0
  );
}

/**
 * 処方箋原本 metadata(DOM-002 §4.2a / WP-7205)。
 * 全項目は手入力値であり、システムは制度上の妥当性を判定しない。
 * issueDate/validUntil は必須、有効期限超過は警告扱いで拒否しない。
 */
export const prescriptionSourceMetadataSchema = z
  .object({
    medicalInstitution: z.object({
      code: normalizedDraftText(
        PRESCRIPTION_DRAFT_INSTITUTION_CODE_MAX_LENGTH,
      ).nullable(),
      name: normalizedDraftText(PRESCRIPTION_DRAFT_PARTY_NAME_MAX_LENGTH),
    }),
    prescriberName: normalizedDraftText(PRESCRIPTION_DRAFT_PARTY_NAME_MAX_LENGTH),
    issueDate: calendarDateWireSchema,
    validUntil: calendarDateWireSchema,
    refill: z
      .object({
        total: z
          .number()
          .int()
          .min(0)
          .max(PRESCRIPTION_DRAFT_REFILL_MAX_COUNT),
        remaining: z
          .number()
          .int()
          .min(0)
          .max(PRESCRIPTION_DRAFT_REFILL_MAX_COUNT),
      })
      .nullable(),
    splitDispensing: normalizedDraftText(
      PRESCRIPTION_DRAFT_SPLIT_DISPENSING_MAX_LENGTH,
    ).nullable(),
  })
  .superRefine((value, context) => {
    if (value.validUntil < value.issueDate) {
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "validUntil must not be before issueDate",
      });
    }
    if (
      value.refill !== null &&
      value.refill.remaining > value.refill.total
    ) {
      context.addIssue({
        code: "custom",
        path: ["refill", "remaining"],
        message: "refill.remaining must not exceed refill.total",
      });
    }
  });

export type PrescriptionSourceMetadata = z.infer<
  typeof prescriptionSourceMetadataSchema
>;

export const prescriptionDraftContentSchema = z
  .object({
    prescriptionType: prescriptionDraftTypeSchema,
    prescriptionDate: calendarDateWireSchema.nullable(),
    defaultDays: z
      .number()
      .int()
      .min(1)
      .max(PRESCRIPTION_DRAFT_MAX_DAYS)
      .nullable(),
    flags: z
      .array(prescriptionDraftFlagSchema)
      .max(prescriptionDraftFlagSchema.options.length),
    note: normalizedDraftText(PRESCRIPTION_DRAFT_NOTE_MAX_LENGTH),
    // DOM-002 §4.2b: rows は legacy free-text 構造の読み専用ミラー。
    // 新構造の明細は rpGroups に保持し、次版 draft から新構造のみを書く。
    rows: z.array(prescriptionDraftRowSchema).max(PRESCRIPTION_DRAFT_MAX_ROWS),
    // DOM-002 §4.2a。additive: 既存の saved draft / client は null で読み書きする。
    sourceMetadata: prescriptionSourceMetadataSchema
      .nullable()
      .default(null),
    // DOM-002 §4.2b。additive: WP-7302 以前の draft は空配列として読み、
    // 読み替えは prescriptionDraftEffectiveRpGroups が rows から導出する。
    rpGroups: z
      .array(prescriptionRpGroupSchema)
      .max(PRESCRIPTION_DRAFT_MAX_RP_GROUPS)
      .default([]),
  })
  .superRefine((value, context) => {
    if (new Set(value.flags).size !== value.flags.length) {
      context.addIssue({
        code: "custom",
        path: ["flags"],
        message: "flags must not contain duplicates",
      });
    }
    if (value.rows.length === 0 && value.rpGroups.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["rpGroups"],
        message: "draft must contain at least one row or rp group",
      });
    }
    value.rows.forEach((row, index) => {
      if (row.sequence !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["rows", index, "sequence"],
          message: "row sequence must be contiguous and start at 1",
        });
      }
    });
    let itemCount = 0;
    const groupIds = new Set<string>();
    const itemIds = new Set<string>();
    value.rpGroups.forEach((group, index) => {
      if (group.sequence !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["rpGroups", index, "sequence"],
          message: "rp group sequence must be contiguous and start at 1",
        });
      }
      if (!groupIds.add(group.rpGroupId)) {
        context.addIssue({
          code: "custom",
          path: ["rpGroups", index, "rpGroupId"],
          message: "rpGroupId must be unique within a draft",
        });
      }
      group.items.forEach((item, itemIndex) => {
        if (!itemIds.add(item.rpItemId)) {
          context.addIssue({
            code: "custom",
            path: ["rpGroups", index, "items", itemIndex, "rpItemId"],
            message: "rpItemId must be unique within a draft",
          });
        }
      });
      itemCount += group.items.length;
    });
    if (itemCount > PRESCRIPTION_DRAFT_MAX_RP_ITEMS) {
      context.addIssue({
        code: "custom",
        path: ["rpGroups"],
        message: `rp items must not exceed ${PRESCRIPTION_DRAFT_MAX_RP_ITEMS} per draft`,
      });
    }
  });

export type PrescriptionDraftContent = z.infer<
  typeof prescriptionDraftContentSchema
>;

export const prescriptionDraftParamsSchema = z.object({
  receptionId: receptionIdWireSchema,
});

export const prescriptionDraftQuerySchema = z
  .object({ date: calendarDateWireSchema })
  .strict();

export const prescriptionDraftUpdateHeadersSchema = z.object({
  "if-match": z
    .string()
    .regex(/^"[1-9][0-9]*"$/u)
    .max(12)
    .optional(),
});

export const prescriptionDraftSaveRequestSchema = z
  .object({
    patientId: patientIdWireSchema,
    businessDate: calendarDateWireSchema,
    expectedVersion: z
      .number()
      .int()
      .min(0)
      .max(PRESCRIPTION_DRAFT_MAX_VERSION),
    draft: prescriptionDraftContentSchema,
  })
  .superRefine((value, context) => {
    // DOM-002 §4.2b: 書込時の正本は rpGroups。両方送ると rows をどちらの
    // 構造として扱うか曖昧になるため fail-closed で拒否する(rows のみの
    // 送信は UNRESOLVED_TEXT として読み替えられるため許容)。
    if (value.draft.rows.length > 0 && value.draft.rpGroups.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["draft", "rpGroups"],
        message: "rows and rpGroups must not both be supplied",
      });
    }
  });

export type PrescriptionDraftSaveRequest = z.infer<
  typeof prescriptionDraftSaveRequestSchema
>;

/**
 * WP-7304 / PRD-001 M4: 前回 Do — 確定済み処方版からの複製起点。
 * sourcePrescriptionId は client 明示指定(自動選択しない)。sourceVersion
 * 省略時は最新版(MAX(version))を複製する。
 */
export const prescriptionDraftFromPriorRequestSchema = z
  .object({
    patientId: patientIdWireSchema,
    businessDate: calendarDateWireSchema,
    sourcePrescriptionId: prescriptionIdWireSchema,
    sourceVersion: z
      .number()
      .int()
      .min(1)
      .max(PRESCRIPTION_DRAFT_MAX_VERSION)
      .optional(),
  })
  .strict();

export type PrescriptionDraftFromPriorRequest = z.infer<
  typeof prescriptionDraftFromPriorRequestSchema
>;

/** WP-7304: draft の複製元 provenance。通常 save 経路では null。 */
export const prescriptionCopiedFromSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
  version: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_VERSION),
});

export type PrescriptionCopiedFrom = z.infer<
  typeof prescriptionCopiedFromSchema
>;

export const prescriptionStatusWireSchema = z.enum(PRESCRIPTION_STATUSES);
export type PrescriptionStatusWire = z.infer<
  typeof prescriptionStatusWireSchema
>;

export const prescriptionDraftResponseSchema = z.object({
  prescriptionId: prescriptionIdWireSchema,
  receptionId: receptionIdWireSchema,
  patientId: patientIdWireSchema,
  businessDate: calendarDateWireSchema,
  version: z
    .number()
    .int()
    .min(1)
    .max(PRESCRIPTION_DRAFT_MAX_VERSION),
  draft: prescriptionDraftContentSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  createdBy: actorIdWireSchema,
  updatedBy: actorIdWireSchema,
  /**
   * ライフサイクル(MOD-005 §2.3)。null = draft(未確認)。confirmed/finalized
   * 系は遷移後にのみ値を持ち、prescriptionVersion は確定 snapshot 版。
   */
  status: prescriptionStatusWireSchema.nullable(),
  confirmedBy: actorIdWireSchema.nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  finalizedBy: actorIdWireSchema.nullable(),
  finalizedAt: z.iso.datetime().nullable(),
  prescriptionVersion: z
    .number()
    .int()
    .min(1)
    .max(PRESCRIPTION_DRAFT_MAX_VERSION)
    .nullable(),
  /**
   * WP-7304: 前回 Do の複製元 provenance。通常 save 経路では null。
   * content 本体・immutable 版 snapshot には含めない(draft 行の属性)。
   */
  copiedFrom: prescriptionCopiedFromSchema.nullable(),
});

export type PrescriptionDraftResponse = z.infer<
  typeof prescriptionDraftResponseSchema
>;

export const prescriptionDraftSaveResponseSchema =
  prescriptionDraftResponseSchema.extend({
    saveDisposition: z.enum(["created", "updated", "unchanged"]),
  });

export type PrescriptionDraftSaveResponse = z.infer<
  typeof prescriptionDraftSaveResponseSchema
>;
