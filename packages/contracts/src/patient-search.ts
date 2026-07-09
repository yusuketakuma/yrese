import { z } from "zod";

import { patientIdWireSchema } from "./wire-id.js";

export const ELIGIBILITY_STATUSES = [
  "VERIFIED",
  "PENDING_REVERIFY",
  "LOCAL_ONLY_UNVERIFIED",
  "NOT_CHECKED",
] as const;

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

export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];
export type PatientSearchQuery = z.infer<typeof patientSearchQuerySchema>;
export type PatientSearchResult = z.infer<typeof patientSearchResultSchema>;
export type PatientSearchResponse = z.infer<typeof patientSearchResponseSchema>;
