import { z } from "zod";

import { patientIdWireSchema } from "./wire-id.js";

/**
 * 保険・公費(Coverage)登録契約(API-020 0.1.0 / WP-7203)。
 *
 * - InsuranceCard / PublicExpense は append-only。訂正・失効は
 *   `kind: "supersede"` の新規行で行い、UPDATE/DELETE 経路は存在しない。
 * - 負担割合(copayRatio)・公費優先順位(priority)は**入力値の記録**であり、
 *   算定利用・制度妥当性の判定は行わない(CAL-R-024 BLOCKED 据置)。
 * - GET は `asOf`(必須・実在暦日)時点で有効な行のみ返す。全履歴閲覧経路は
 *   提供しない(PHI 最小化)。
 * - 監査 payload には行 ID と kind のみ載せる。保険者番号・記号番号・
 *   受給者番号は監査・ログ・エラー応答へ出さない。
 */

export const COVERAGE_ROW_ID_MAX_LENGTH = 128;
export const COVERAGE_NUMBER_MAX_LENGTH = 64;

const controlCharacterPattern = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;

function isRealIsoCalendarDate(value: string): boolean {
  // Postgres DATE は year 0 を受理しない。永続化境界と揃えるため契約でも拒否する。
  if (value.startsWith("0000")) {
    return false;
  }
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}

export const coverageCalendarDateSchema = z.iso.date().refine(isRealIsoCalendarDate, {
  message: "date must be a real calendar date",
});

/** サーバー採番の行 ID(insurance-card / public-expense の opaque 識別子)。 */
export const coverageRowIdSchema = z
  .string()
  .min(1)
  .max(COVERAGE_ROW_ID_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, {
    message: "row id must not be blank",
  })
  .refine((value) => !controlCharacterPattern.test(value), {
    message: "row id must not contain control characters",
  });

const coverageNumberSchema = z
  .string()
  .min(1)
  .max(COVERAGE_NUMBER_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, {
    message: "coverage number must not be blank",
  })
  .refine((value) => !controlCharacterPattern.test(value), {
    message: "coverage number must not contain control characters",
  });

const coverageRelationshipSchema = z.enum(["self", "family"]);

/** 負担割合(入力値。0 < r < 1。制度妥当性の判定はしない)。 */
const coverageCopayRatioSchema = z.number().gt(0).lt(1);

// Postgres INTEGER(int4) の範囲と揃える。超過は永続化境界で 500 になる前に
// 契約が 400 で拒否する(in-memory との parity)。
const coveragePrioritySchema = z.number().int().min(1).max(2147483647);

const coverageValidPeriodSchema = z
  .object({
    validFrom: coverageCalendarDateSchema,
    validTo: coverageCalendarDateSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.validTo === undefined ||
      value.validTo === null ||
      value.validTo >= value.validFrom,
    { message: "validTo must be on or after validFrom" },
  );

export const insuranceCardSchema = z.object({
  insuranceCardId: coverageRowIdSchema,
  insurerNumber: coverageNumberSchema,
  insuredSymbol: coverageNumberSchema,
  insuredNumber: coverageNumberSchema,
  branchNumber: coverageNumberSchema.optional(),
  relationship: coverageRelationshipSchema,
  copayRatio: coverageCopayRatioSchema,
  validFrom: coverageCalendarDateSchema,
  validTo: coverageCalendarDateSchema.nullable(),
  supersededBy: coverageRowIdSchema.nullable(),
  recordedAt: z.iso.datetime(),
});

export const publicExpenseSchema = z.object({
  publicExpenseId: coverageRowIdSchema,
  payerNumber: coverageNumberSchema,
  recipientNumber: coverageNumberSchema,
  priority: coveragePrioritySchema,
  validFrom: coverageCalendarDateSchema,
  validTo: coverageCalendarDateSchema.nullable(),
  supersededBy: coverageRowIdSchema.nullable(),
  recordedAt: z.iso.datetime(),
});

export const coverageParamsSchema = z.object({
  patientId: patientIdWireSchema,
});

/** GET の asOf は必須(暗黙の「今日」をサーバーで解決しない — MOD-011)。 */
export const coverageListQuerySchema = z.object({
  asOf: coverageCalendarDateSchema,
});

export const coverageListResponseSchema = z.object({
  patientId: patientIdWireSchema,
  asOf: coverageCalendarDateSchema,
  insuranceCards: z.array(insuranceCardSchema),
  publicExpenses: z.array(publicExpenseSchema),
});

const insuranceCardRegistrationFieldsSchema = z
  .object({
    insurerNumber: coverageNumberSchema,
    insuredSymbol: coverageNumberSchema,
    insuredNumber: coverageNumberSchema,
    branchNumber: coverageNumberSchema.optional(),
    relationship: coverageRelationshipSchema,
    copayRatio: coverageCopayRatioSchema,
  })
  .and(coverageValidPeriodSchema);

const publicExpenseRegistrationFieldsSchema = z
  .object({
    payerNumber: coverageNumberSchema,
    recipientNumber: coverageNumberSchema,
    priority: coveragePrioritySchema,
  })
  .and(coverageValidPeriodSchema);

const insuranceCardRegistrationRequestSchema = z
  .object({ kind: z.literal("insurance-card") })
  .and(insuranceCardRegistrationFieldsSchema);

const publicExpenseRegistrationRequestSchema = z
  .object({ kind: z.literal("public-expense") })
  .and(publicExpenseRegistrationFieldsSchema);

const supersedeInsuranceCardRequestSchema = z
  .object({
    kind: z.literal("supersede"),
    targetKind: z.literal("insurance-card"),
    targetId: coverageRowIdSchema,
  })
  .and(insuranceCardRegistrationFieldsSchema);

const supersedePublicExpenseRequestSchema = z
  .object({
    kind: z.literal("supersede"),
    targetKind: z.literal("public-expense"),
    targetId: coverageRowIdSchema,
  })
  .and(publicExpenseRegistrationFieldsSchema);

/** POST ボディ(discriminated union: 3 kind、supersede は targetKind で再分岐)。 */
export const coverageRecordRequestSchema = z.union([
  insuranceCardRegistrationRequestSchema,
  publicExpenseRegistrationRequestSchema,
  supersedeInsuranceCardRequestSchema,
  supersedePublicExpenseRequestSchema,
]);

/** 登録応答(201 / 冪等再送時 200): 登録された行そのもの(API-020 §2)。
 * 行 ID フィールド(insuranceCardId / publicExpenseId)で kind を判別できる。 */
export const coverageRecordResponseSchema = z.union([
  insuranceCardSchema,
  publicExpenseSchema,
]);

/** POST /patients/{id}/coverage の必須ヘッダ(API-013 Idempotency-Key)。 */
export const coverageRecordHeadersSchema = z.object({
  "idempotency-key": z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
});

export type InsuranceCard = z.infer<typeof insuranceCardSchema>;
export type PublicExpense = z.infer<typeof publicExpenseSchema>;
export type CoverageParams = z.infer<typeof coverageParamsSchema>;
export type CoverageListQuery = z.infer<typeof coverageListQuerySchema>;
export type CoverageListResponse = z.infer<typeof coverageListResponseSchema>;
export type CoverageRecordRequest = z.infer<typeof coverageRecordRequestSchema>;
export type CoverageRecordResponse = z.infer<typeof coverageRecordResponseSchema>;
