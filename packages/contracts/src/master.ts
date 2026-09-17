import { z } from "zod";

import { coverageCalendarDateSchema } from "./coverage.js";

/**
 * MST-003: master 基盤。non-PHI。tenant/pharmacy は文脈由来で wire 非含有。
 * - 全経路で master 版解決は明示 asOf(暗黙の「今日」をサーバーで解決しない)。
 * - append-only: API・repository 共に UPDATE/DELETE 経路なし。
 * - seed 行は localCode が SYN- 接頭辞を持つ合成値のみ。
 */

const controlCharacterPattern = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;
const textToken = z
  .string()
  .min(1)
  .max(500)
  .refine((v) => v.trim().length > 0 && !controlCharacterPattern.test(v), {
    message: "must be non-blank text without control characters",
  });

export const masterKindSchema = z.enum(["medication", "usage"]);
export type MasterKind = z.infer<typeof masterKindSchema>;

export const masterVersionSchema = z.object({
  masterVersionId: z.uuid(),
  masterKind: masterKindSchema,
  version: textToken.max(100),
  validFrom: coverageCalendarDateSchema,
  validTo: coverageCalendarDateSchema.nullable(),
  transitionNote: textToken.nullable(),
  distributionState: z.literal("synthetic"),
});
export type MasterVersion = z.infer<typeof masterVersionSchema>;

export const genericFlagSchema = z.enum([
  "originator",
  "generic",
  "unclassified",
]);
export type GenericFlag = z.infer<typeof genericFlagSchema>;

export const controlCategorySchema = z.enum([
  "narcotic",
  "psychotropic",
  "poison",
  "powerful",
]);
export type ControlCategory = z.infer<typeof controlCategorySchema>;

export const medicationItemSchema = z.object({
  medicationItemId: z.uuid(),
  localCode: textToken.max(100),
  yjCode: textToken.max(100).nullable(),
  receiptCode: textToken.max(100).nullable(),
  hotCode: textToken.max(100).nullable(),
  name: textToken.max(500),
  unit: textToken.max(50),
  /** 整数の最小単位価格。synthetic seed は null を許容。 */
  price: z.int().min(0).max(9_999_999_999).nullable(),
  genericFlag: genericFlagSchema,
  /** 一般名コード統計用。genericFlag=generic でなくても保持可。 */
  genericNameCode: textToken.max(100).nullable(),
  controlCategories: z.array(controlCategorySchema),
});
export type MedicationItem = z.infer<typeof medicationItemSchema>;

export const mealTimingSchema = z.enum([
  "before",
  "after",
  "bedtime",
  "asNeeded",
  "other",
]);
export type MealTiming = z.infer<typeof mealTimingSchema>;

export const usageItemSchema = z.object({
  usageItemId: z.uuid(),
  localCode: textToken.max(100),
  /** 用法の表示/記録テキスト。識別子でなく自由入力として扱う。 */
  text: textToken.max(500),
  timesPerDay: z.int().min(1).max(100).nullable(),
  mealTiming: mealTimingSchema.nullable(),
  jahisCode: textToken.max(100).nullable(),
});
export type UsageItem = z.infer<typeof usageItemSchema>;

/** MST-003 §3: asOf 必須。q は optional・最大 100 文字。 */
export const masterQuerySchema = z.object({
  asOf: coverageCalendarDateSchema,
  q: z
    .string()
    .max(100)
    .refine((v) => !controlCharacterPattern.test(v))
    .optional(),
});
export type MasterQuery = z.infer<typeof masterQuerySchema>;

export const masterMedicationsResponseSchema = z.object({
  /** asOf 時点で有効な版が存在しない場合 null(404 ではなく空応答)。 */
  masterVersion: masterVersionSchema.nullable(),
  items: z.array(medicationItemSchema),
});
export type MasterMedicationsResponse = z.infer<
  typeof masterMedicationsResponseSchema
>;

export const masterUsagesResponseSchema = z.object({
  masterVersion: masterVersionSchema.nullable(),
  items: z.array(usageItemSchema),
});
export type MasterUsagesResponse = z.infer<typeof masterUsagesResponseSchema>;
