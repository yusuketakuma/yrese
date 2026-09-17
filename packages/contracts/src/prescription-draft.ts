import { z } from "zod";

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

export const prescriptionDraftRowSchema = z.object({
  sequence: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_ROWS),
  drugText: normalizedDraftText(PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH),
  usageText: normalizedDraftText(PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH),
  days: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_DAYS).nullable(),
  quantityText: normalizedDraftText(PRESCRIPTION_DRAFT_QUANTITY_MAX_LENGTH),
});

export type PrescriptionDraftRow = z.infer<typeof prescriptionDraftRowSchema>;

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
    rows: z
      .array(prescriptionDraftRowSchema)
      .min(1)
      .max(PRESCRIPTION_DRAFT_MAX_ROWS),
    // DOM-002 §4.2a。additive: 既存の saved draft / client は null で読み書きする。
    sourceMetadata: prescriptionSourceMetadataSchema
      .nullable()
      .default(null),
  })
  .superRefine((value, context) => {
    if (new Set(value.flags).size !== value.flags.length) {
      context.addIssue({
        code: "custom",
        path: ["flags"],
        message: "flags must not contain duplicates",
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

export const prescriptionDraftSaveRequestSchema = z.object({
  patientId: patientIdWireSchema,
  businessDate: calendarDateWireSchema,
  expectedVersion: z
    .number()
    .int()
    .min(0)
    .max(PRESCRIPTION_DRAFT_MAX_VERSION),
  draft: prescriptionDraftContentSchema,
});

export type PrescriptionDraftSaveRequest = z.infer<
  typeof prescriptionDraftSaveRequestSchema
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
