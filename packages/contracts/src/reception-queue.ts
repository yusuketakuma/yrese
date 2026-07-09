import { RECEPTION_STATUSES, type ReceptionStatus } from "@yrese/shared-kernel";
import { z } from "zod";

import { patientSearchResultSchema } from "./patient-search.js";

export const RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function hasNoControlCharacters(value: string): boolean {
  return !controlCharacterPattern.test(value);
}

export const receptionQueueQuerySchema = z.object({
  date: z.iso.date(),
});

export const receptionIdSchema = z
  .string()
  .min(1)
  .refine(hasNoControlCharacters, {
    message: "receptionId must not contain control characters",
  });

export const receptionStatusSchema = z.enum(RECEPTION_STATUSES);

export const receptionQueueEntrySchema = z.object({
  receptionId: receptionIdSchema,
  patient: patientSearchResultSchema,
  acceptedAt: z.iso.datetime(),
  receptionStatus: receptionStatusSchema,
  prescriptionIntakeType: z.literal("paper"),
});

export const receptionQueueResponseSchema = z.object({
  date: z.iso.date(),
  entries: z.array(receptionQueueEntrySchema),
});

export const receptionCreateRequestSchema = z.object({
  patientId: z
    .string()
    .min(1)
    .refine(hasNoControlCharacters, {
      message: "patientId must not contain control characters",
    }),
  idempotencyKey: z
    .string()
    .min(1)
    .max(RECEPTION_IDEMPOTENCY_KEY_MAX_LENGTH)
    .refine((value) => value.trim().length > 0, {
      message: "idempotencyKey must not be blank",
    })
    .refine(hasNoControlCharacters, {
      message: "idempotencyKey must not contain control characters",
    }),
});

export type ReceptionQueueQuery = z.infer<typeof receptionQueueQuerySchema>;
export type ReceptionQueueEntry = z.infer<typeof receptionQueueEntrySchema>;
export type ReceptionQueueResponse = z.infer<typeof receptionQueueResponseSchema>;
export type ReceptionCreateRequest = z.infer<typeof receptionCreateRequestSchema>;
export type { ReceptionStatus };
