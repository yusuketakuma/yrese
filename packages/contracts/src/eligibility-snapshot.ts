import {
  ELIGIBILITY_VERIFICATION_METHODS,
  RECEPTION_ELIGIBILITY_STATES,
} from "@yrese/shared-kernel";
import { z } from "zod";

import { receptionIdWireSchema } from "./wire-id.js";

/**
 * 受付資格確認スナップショット契約(API-019 0.1.0 / WP-7204)。
 * 手動記録可能なのは券面系のみ(CARD_ONLINE→VERIFIED_CARD、
 * CARD_VISUAL→PROVISIONAL_VISUAL)。VERIFIED_MYNA・OFFLINE_PROVISIONAL・
 * EXPIRED・MISMATCH は外部 IF / システム遷移由来であり人手で宣言しない(422)。
 * method-state 不整合は 400、遷移表(ADP-004 §3)にない遷移は 422。
 */

export const ELIGIBILITY_SNAPSHOT_ID_MAX_LENGTH = 128;

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function isRealIsoCalendarDate(value: string): boolean {
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}

const calendarDateWireSchema = z.iso.date().refine(isRealIsoCalendarDate, {
  message: "date must be a real calendar date",
});

/** クライアント生成の不透明 ID(UUID 等)。冪等キーを兼ねる。wire-id 水準。 */
export const eligibilitySnapshotIdSchema = z
  .string()
  .min(1)
  .max(ELIGIBILITY_SNAPSHOT_ID_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, {
    message: "snapshotId must not be blank",
  })
  .refine((value) => !controlCharacterPattern.test(value), {
    message: "snapshotId must not contain control characters",
  });

export const eligibilityVerificationMethodSchema = z.enum(
  ELIGIBILITY_VERIFICATION_METHODS,
);

export const recordedEligibilityStateSchema = z.enum(
  RECEPTION_ELIGIBILITY_STATES.filter(
    (state) => state !== "UNVERIFIED",
  ) as unknown as readonly [
    "VERIFIED_MYNA",
    "VERIFIED_CARD",
    "PROVISIONAL_VISUAL",
    "OFFLINE_PROVISIONAL",
    "EXPIRED",
    "MISMATCH",
  ],
);

export const receptionEligibilityStateSchema = z.enum(
  RECEPTION_ELIGIBILITY_STATES,
);

export const eligibilitySnapshotParamsSchema = z.object({
  receptionId: receptionIdWireSchema,
});

export const eligibilitySnapshotRecordRequestSchema = z
  .object({
    snapshotId: eligibilitySnapshotIdSchema,
    verifiedMethod: eligibilityVerificationMethodSchema,
    state: recordedEligibilityStateSchema,
    verifiedAt: z.iso.datetime(),
    asOfDate: calendarDateWireSchema,
    validFrom: calendarDateWireSchema,
    validTo: calendarDateWireSchema.nullable().optional(),
    /** 外部確認応答の不透明参照(任意)。資格内容そのものは載せない。 */
    rawResponseRef: z
      .string()
      .min(1)
      .max(512)
      .refine((value) => !controlCharacterPattern.test(value), {
        message: "rawResponseRef must not contain control characters",
      })
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.validTo !== undefined &&
      value.validTo !== null &&
      value.validTo < value.validFrom
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "validTo must be on or after validFrom",
      });
    }
  });

/** 手動記録を許す (method, state) の組(API-019 §2)。それ以外は 422。 */
export const MANUAL_ELIGIBILITY_RECORD_PAIRS = [
  { verifiedMethod: "CARD_ONLINE", state: "VERIFIED_CARD" },
  { verifiedMethod: "CARD_VISUAL", state: "PROVISIONAL_VISUAL" },
] as const;

export function isManualEligibilityRecordAllowed(
  verifiedMethod: string,
  state: string,
): boolean {
  return MANUAL_ELIGIBILITY_RECORD_PAIRS.some(
    (pair) =>
      pair.verifiedMethod === verifiedMethod && pair.state === state,
  );
}

export const eligibilitySnapshotSchema = z.object({
  snapshotId: eligibilitySnapshotIdSchema,
  verifiedMethod: eligibilityVerificationMethodSchema,
  state: recordedEligibilityStateSchema,
  verifiedAt: z.iso.datetime(),
  validFrom: calendarDateWireSchema,
  validTo: calendarDateWireSchema.nullable(),
});

export const receptionEligibilitySchema = z.object({
  state: receptionEligibilityStateSchema,
  snapshotId: eligibilitySnapshotIdSchema.nullable(),
  allowsProvisionalCalculation: z.boolean(),
  allowsFinalCalculation: z.boolean(),
});

export const eligibilitySnapshotRecordResponseSchema = z.object({
  snapshotId: eligibilitySnapshotIdSchema,
  receptionId: receptionIdWireSchema,
  state: recordedEligibilityStateSchema,
  verifiedMethod: eligibilityVerificationMethodSchema,
  verifiedAt: z.iso.datetime(),
  validFrom: calendarDateWireSchema,
  validTo: calendarDateWireSchema.nullable(),
  derivedState: receptionEligibilityStateSchema,
});

export const eligibilitySnapshotListResponseSchema = z.object({
  receptionId: receptionIdWireSchema,
  current: receptionEligibilitySchema,
  snapshots: z.array(eligibilitySnapshotSchema),
});

export type EligibilitySnapshotRecordRequest = z.infer<
  typeof eligibilitySnapshotRecordRequestSchema
>;
export type EligibilitySnapshot = z.infer<typeof eligibilitySnapshotSchema>;
export type ReceptionEligibility = z.infer<typeof receptionEligibilitySchema>;
export type EligibilitySnapshotRecordResponse = z.infer<
  typeof eligibilitySnapshotRecordResponseSchema
>;
export type EligibilitySnapshotListResponse = z.infer<
  typeof eligibilitySnapshotListResponseSchema
>;
