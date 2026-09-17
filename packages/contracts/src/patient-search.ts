import { ELIGIBILITY_STATUSES, type EligibilityStatus } from "@yrese/shared-kernel";
import { z } from "zod";

import { patientIdWireSchema } from "./wire-id.js";

export const PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512;
export const PATIENT_SEARCH_DEFAULT_LIMIT = 20;

export const patientSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(PATIENT_SEARCH_DEFAULT_LIMIT),
  cursor: z.string().max(PATIENT_SEARCH_CURSOR_MAX_LENGTH).optional(),
});

export const patientSearchResultSchema = z.object({
  patientId: patientIdWireSchema,
  name: z.string().min(1),
  kana: z.string().min(1),
  birthDate: z.iso.date(),
  sex: z.enum(["male", "female", "unknown"]),
  patientNumber: z.string().min(1),
  eligibilityStatus: z.enum(ELIGIBILITY_STATUSES),
  eligibilityCheckedAt: z.iso.datetime().optional(),
});

export const patientSearchResponseSchema = z.object({
  results: z.array(patientSearchResultSchema),
  nextCursor: z.string().max(PATIENT_SEARCH_CURSOR_MAX_LENGTH).optional(),
});

/**
 * 患者 get-by-id(GET /patients/:patientId)のパスパラメータ。
 * 応答は patientSearchResultSchema(PatientSummary 表示投影)を再利用する —
 * 検索結果と同一射影であることが、横断患者文脈(R-PATCTX)の再取得互換性の根拠。
 */
export const patientGetParamsSchema = z.object({
  patientId: patientIdWireSchema,
});

export { ELIGIBILITY_STATUSES, type EligibilityStatus };
export type PatientSearchQuery = z.infer<typeof patientSearchQuerySchema>;
export type PatientSearchResult = z.infer<typeof patientSearchResultSchema>;
export type PatientSearchResponse = z.infer<typeof patientSearchResponseSchema>;
export type PatientGetParams = z.infer<typeof patientGetParamsSchema>;

/**
 * WP-7202 / API-001 0.3.0: 患者登録・更新(POST /patients、PUT /patients/{id})。
 *
 * - `birthDate` は実在暦日のみ受け付ける(z.iso.date の rollover を二重検査)。
 * - POST の冪等性は `Idempotency-Key` ヘッダ(API-013 形式)が担い、
 *   PUT は `If-Match` + body `expectedVersion` の CAS が担う。
 * - identity field(氏名・カナ・生年月日・性別)の変更は append-only history へ
 *   記録される。`patientNumber` は PUT で不変(422 PAT-0005)。
 */
export const PATIENT_WRITE_NAME_MAX_LENGTH = 128;
export const PATIENT_WRITE_KANA_MAX_LENGTH = 128;
export const PATIENT_WRITE_PATIENT_NUMBER_MAX_LENGTH = 64;
export const PATIENT_DUPLICATE_WARNING_MAX_CANDIDATES = 5;

/** API-013 の Idempotency-Key 形式(opaque、log/metric label へ出さない)。 */
export const patientIdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/u);

function isRealIsoCalendarDate(value: string): boolean {
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}

const patientBirthDateWireSchema = z.iso.date().refine(isRealIsoCalendarDate, {
  message: "date must be a real calendar date",
});

const patientWriteNameSchema = z
  .string()
  .min(1)
  .max(PATIENT_WRITE_NAME_MAX_LENGTH);
const patientWriteKanaSchema = z
  .string()
  .min(1)
  .max(PATIENT_WRITE_KANA_MAX_LENGTH);
const patientWriteNumberSchema = z
  .string()
  .min(1)
  .max(PATIENT_WRITE_PATIENT_NUMBER_MAX_LENGTH);
const patientWriteSexSchema = z.enum(["male", "female", "unknown"]);

export const patientCreateRequestSchema = z.object({
  name: patientWriteNameSchema,
  kana: patientWriteKanaSchema,
  birthDate: patientBirthDateWireSchema,
  sex: patientWriteSexSchema,
  patientNumber: patientWriteNumberSchema.optional(),
});

export const patientUpdateRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    name: patientWriteNameSchema.optional(),
    kana: patientWriteKanaSchema.optional(),
    birthDate: patientBirthDateWireSchema.optional(),
    sex: patientWriteSexSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.kana !== undefined ||
      value.birthDate !== undefined ||
      value.sex !== undefined,
    { message: "at least one updatable field is required" },
  );

/** version を含む患者要約(POST/PUT 応答および GET 詳細の wire 形)。 */
export const patientVersionedSummarySchema = patientSearchResultSchema.extend({
  version: z.number().int().min(1),
});

export const patientDuplicateWarningSchema = z.object({
  type: z.literal("POSSIBLE_DUPLICATE"),
  candidates: z
    .array(patientSearchResultSchema)
    .max(PATIENT_DUPLICATE_WARNING_MAX_CANDIDATES),
});

export const patientCreateResponseSchema = z.object({
  patient: patientVersionedSummarySchema,
  warnings: z.array(patientDuplicateWarningSchema).optional(),
});

export const patientUpdateResponseSchema = z.object({
  patient: patientVersionedSummarySchema,
});

/** POST /patients の必須ヘッダ(API-013 Idempotency-Key)。 */
export const patientCreateHeadersSchema = z.object({
  "idempotency-key": patientIdempotencyKeySchema,
});

/** PUT /patients/{id} の必須ヘッダ(引用符付き expectedVersion)。 */
export const patientUpdateHeadersSchema = z.object({
  "if-match": z
    .string()
    .regex(/^"[1-9][0-9]*"$/u)
    .max(12),
});

export type PatientCreateRequest = z.infer<typeof patientCreateRequestSchema>;
export type PatientUpdateRequest = z.infer<typeof patientUpdateRequestSchema>;
export type PatientVersionedSummary = z.infer<typeof patientVersionedSummarySchema>;
export type PatientDuplicateWarning = z.infer<typeof patientDuplicateWarningSchema>;
export type PatientCreateResponse = z.infer<typeof patientCreateResponseSchema>;
export type PatientUpdateResponse = z.infer<typeof patientUpdateResponseSchema>;
