/**
 * calculation_trace 読取契約(API-007 / SCR-012 表示・QUA-007 L2 初UI)。
 *
 * trace 構造の正本は @yrese/trace 実装(CAL-008)。本スキーマはその **写像** であり、
 * enum 値・型・不変条件をローカル再定義しない(§2 / COMMON_MODULE_DUPLICATION_BLOCKED)。
 *
 * - 表示のみ(read-only)。生成・改変の経路は定義しない。
 * - 金額・点数は bigint 由来の文字列(浮動小数点フィールドを置かない / MOD-010)。
 * - PHI 不変条件(§5): 氏名・住所・電話・自由記述を持たない。EvidenceRef は url を持たない
 *   (URL は source_registry が正本)。intermediateValues は PHI 様キーを実行時拒否する。
 * - affectsClaim=true かつ evidenceRefs 空、の異常は構造的には受理し、表示側(SCR-012)で
 *   fail-closed に弾く(§7 / §8)。契約はこの不変条件を型では強制しない。
 */
import {
  CALCULATION_TRACE_STEP_STATUSES,
  EVIDENCE_SOURCE_TYPES,
  TRACE_DATE_REF_KINDS,
  TRACE_ID_REF_KINDS,
  collectCalculationTraceEvidenceIds,
  isCanonicalTraceIntegerString,
  isPhiLikeIntermediateValueKey,
} from "@yrese/trace";
import { z } from "zod";

const nonEmptyString = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, { message: "must not be blank" });

const canonicalTraceIntegerString = z.string().refine(isCanonicalTraceIntegerString, {
  message: "must be a canonical base-10 integer string",
});

export const evidenceSourceTypeSchema = z.enum(EVIDENCE_SOURCE_TYPES);
export const traceIdRefKindSchema = z.enum(TRACE_ID_REF_KINDS);
export const traceDateRefKindSchema = z.enum(TRACE_DATE_REF_KINDS);
export const calculationTraceStepStatusSchema = z.enum(CALCULATION_TRACE_STEP_STATUSES);

/**
 * EvidenceRef 写像。url を持たない(§5,§9)。strict で未知キー(url 含む)を拒否し、
 * @yrese/trace の construction 時 strictness を読取側でも再現する。
 */
export const evidenceRefSchema = z.strictObject({
  evidenceId: nonEmptyString,
  sourceType: evidenceSourceTypeSchema,
  title: nonEmptyString,
  version: z.string().optional(),
  effectiveFrom: z.string().optional(),
});

export const traceIdRefSchema = z.object({
  kind: traceIdRefKindSchema,
  id: nonEmptyString,
});

export const traceDateRefSchema = z.object({
  kind: traceDateRefKindSchema,
  value: nonEmptyString,
});

export const traceMasterVersionRefSchema = z.object({
  masterName: nonEmptyString,
  version: nonEmptyString,
});

export const traceRuleVersionRefSchema = z.object({
  ruleName: nonEmptyString,
  version: nonEmptyString,
});

export const calculationInputsSummarySchema = z.object({
  ids: z.array(traceIdRefSchema),
  dates: z.array(traceDateRefSchema),
  masterVersions: z.array(traceMasterVersionRefSchema),
  ruleVersions: z.array(traceRuleVersionRefSchema).optional(),
});

export const calculationTraceRoundingSchema = z.object({
  method: nonEmptyString,
  evidenceId: nonEmptyString,
});

/** intermediateValues: 金額・点数は bigint 由来。ここでは PHI 様キー・空キーを拒否する(§5)。 */
export const calculationTraceIntermediateValuesSchema = z
  .record(z.string(), z.string())
  .refine(
    (record) =>
      Object.keys(record).every(
        (key) => key.trim().length > 0 && !isPhiLikeIntermediateValueKey(key),
      ),
    { message: "intermediateValues must not include blank or PHI-like keys" },
  );

export const calculationTraceStepSchema = z.object({
  stepId: nonEmptyString,
  description: nonEmptyString,
  affectsClaim: z.boolean(),
  evidenceRefs: z.array(evidenceRefSchema),
  inputRefs: z.array(z.string()),
  output: nonEmptyString,
  feeItemCode: nonEmptyString.optional(),
  formula: nonEmptyString.optional(),
  intermediateValues: calculationTraceIntermediateValuesSchema.optional(),
  rounding: calculationTraceRoundingSchema.optional(),
  stepStatus: calculationTraceStepStatusSchema.optional(),
  resultPoints: canonicalTraceIntegerString.optional(),
  resultYen: canonicalTraceIntegerString.optional(),
});

export const calculationTraceSchema = z
  .object({
    inputsSummary: calculationInputsSummarySchema,
    masterVersion: nonEmptyString,
    calculationRuleVersion: nonEmptyString,
    steps: z.array(calculationTraceStepSchema),
    warnings: z.array(z.string()),
    blockers: z.array(z.string()),
    evidenceIds: z.array(nonEmptyString),
  })
  .superRefine((trace, context) => {
    const expected = collectCalculationTraceEvidenceIds(trace.steps);
    const actual = trace.evidenceIds;
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const matchesDerivedSet =
      actual.length === actualSet.size &&
      actualSet.size === expectedSet.size &&
      [...actualSet].every((evidenceId) => expectedSet.has(evidenceId));

    if (!matchesDerivedSet) {
      context.addIssue({
        code: "custom",
        path: ["evidenceIds"],
        message: "evidenceIds must be the unique set derived from step and rounding evidence",
      });
    }
  });

export type EvidenceRefWire = z.infer<typeof evidenceRefSchema>;
export type TraceIdRefWire = z.infer<typeof traceIdRefSchema>;
export type TraceDateRefWire = z.infer<typeof traceDateRefSchema>;
export type CalculationInputsSummaryWire = z.infer<typeof calculationInputsSummarySchema>;
export type CalculationTraceStepWire = z.infer<typeof calculationTraceStepSchema>;
export type CalculationTraceWire = z.infer<typeof calculationTraceSchema>;
