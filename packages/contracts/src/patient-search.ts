import { ELIGIBILITY_STATUSES, type EligibilityStatus } from "@yrese/shared-kernel";
import { z } from "zod";

import { patientIdWireSchema } from "./wire-id.js";

export const PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512;

export const patientSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
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
