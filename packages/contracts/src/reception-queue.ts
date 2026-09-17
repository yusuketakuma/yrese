import { RECEPTION_STATUSES, type ReceptionStatus } from "@yrese/shared-kernel";
import { z } from "zod";

import { receptionEligibilitySchema } from "./eligibility-snapshot.js";
import { patientSearchResultSchema } from "./patient-search.js";
import { patientIdWireSchema, receptionIdWireSchema } from "./wire-id.js";

export const RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function hasNoControlCharacters(value: string): boolean {
  return !controlCharacterPattern.test(value);
}

export const receptionQueueQuerySchema = z.object({
  date: z.iso.date(),
});

export const receptionIdSchema = receptionIdWireSchema;

export const receptionStatusSchema = z.enum(RECEPTION_STATUSES);

export const receptionIdempotencyKeySchema = z
  .string()
  .min(1)
  .max(RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, {
    message: "idempotencyKey must not be blank",
  })
  .refine(hasNoControlCharacters, {
    message: "idempotencyKey must not contain control characters",
  });

export const receptionQueueEntrySchema = z.object({
  receptionId: receptionIdSchema,
  patient: patientSearchResultSchema,
  acceptedAt: z.iso.datetime(),
  receptionStatus: receptionStatusSchema,
  prescriptionIntakeType: z.literal("paper"),
  // API-006 0.3.1: transitions の expectedVersion CAS には現在 version の取得経路が必要。
  version: z.number().int().min(1),
  // API-006 0.3.2: 受付行の資格表示は snapshot 由来の導出状態(API-019)。
  // 患者要約の eligibilityStatus とは別概念。UI が allows* を推測しないための
  // サーバー導出値(shared-kernel guard が唯一の判定実装)。
  eligibility: receptionEligibilitySchema,
});

export const receptionQueueResponseSchema = z.object({
  date: z.iso.date(),
  entries: z.array(receptionQueueEntrySchema),
});

export const receptionCreateRequestSchema = z.object({
  patientId: patientIdWireSchema,
  idempotencyKey: receptionIdempotencyKeySchema,
});

// API-006 0.3.x: 受付状態遷移(DOM-004 §2 の副状態機械を駆動する唯一の write 経路)
export const RECEPTION_TRANSITION_TARGETS = [
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

// MOD-008 の構造化理由コード(自由記述禁止)。wire・cancel_reason 列・
// 監査 businessReason.code に同値を保存する(API-006 0.3.1)。
export const RECEPTION_BUSINESS_REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const receptionTransitionParamsSchema = z.object({
  receptionId: receptionIdSchema,
});

export const receptionTransitionRequestSchema = z
  .object({
    to: z.enum(RECEPTION_TRANSITION_TARGETS),
    expectedVersion: z.number().int().min(1),
    businessReason: z
      .string()
      .regex(RECEPTION_BUSINESS_REASON_CODE_PATTERN)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.to === "CANCELLED" && value.businessReason === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["businessReason"],
        message: "businessReason is required when to is CANCELLED",
      });
    }
    if (value.to !== "CANCELLED" && value.businessReason !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["businessReason"],
        message: "businessReason is only allowed when to is CANCELLED",
      });
    }
  });

export const receptionTransitionHeadersSchema = z.object({
  "if-match": z
    .string()
    .regex(/^"[1-9][0-9]*"$/u)
    .max(12),
});

export const receptionTransitionResponseSchema = z.object({
  receptionId: receptionIdSchema,
  receptionStatus: receptionStatusSchema,
  version: z.number().int().min(1),
  statusChangedAt: z.iso.datetime(),
});

export type ReceptionQueueQuery = z.infer<typeof receptionQueueQuerySchema>;
export type ReceptionQueueEntry = z.infer<typeof receptionQueueEntrySchema>;
export type ReceptionQueueResponse = z.infer<typeof receptionQueueResponseSchema>;
export type ReceptionCreateRequest = z.infer<typeof receptionCreateRequestSchema>;
export type ReceptionTransitionTarget = (typeof RECEPTION_TRANSITION_TARGETS)[number];
export type ReceptionTransitionRequest = z.infer<typeof receptionTransitionRequestSchema>;
export type ReceptionTransitionResponse = z.infer<typeof receptionTransitionResponseSchema>;
export type { ReceptionStatus };
