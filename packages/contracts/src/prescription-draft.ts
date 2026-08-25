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

const normalizedDraftText = (maximum: number) => z.string().trim().max(maximum);

export const prescriptionDraftRowSchema = z.object({
  sequence: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_ROWS),
  drugText: normalizedDraftText(PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH),
  usageText: normalizedDraftText(PRESCRIPTION_DRAFT_TEXT_MAX_LENGTH),
  days: z.number().int().min(1).max(PRESCRIPTION_DRAFT_MAX_DAYS).nullable(),
  quantityText: normalizedDraftText(PRESCRIPTION_DRAFT_QUANTITY_MAX_LENGTH),
});

export type PrescriptionDraftRow = z.infer<typeof prescriptionDraftRowSchema>;

export const prescriptionDraftContentSchema = z
  .object({
    prescriptionType: prescriptionDraftTypeSchema,
    prescriptionDate: z.iso.date().nullable(),
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

export const prescriptionDraftQuerySchema = z.object({
  patientId: patientIdWireSchema,
  date: z.iso.date(),
});

export const prescriptionDraftSaveRequestSchema = z.object({
  patientId: patientIdWireSchema,
  businessDate: z.iso.date(),
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
  businessDate: z.iso.date(),
  version: z
    .number()
    .int()
    .min(1)
    .max(PRESCRIPTION_DRAFT_MAX_VERSION),
  lifecycleStatus: z.literal("SERVER_SAVED"),
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
    saveDisposition: z.enum(["created", "updated", "unchanged", "replayed"]),
  });

export type PrescriptionDraftSaveResponse = z.infer<
  typeof prescriptionDraftSaveResponseSchema
>;
