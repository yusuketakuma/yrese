import { evidenceId } from "@yrese/shared-kernel";
import { CalendarDate } from "@yrese/date-time";
import { Points, type ScaledDecimal } from "@yrese/money";
import type { EvidenceRef } from "@yrese/trace";

import {
  applyPointsMultiplier,
  basicFeeCompositionOrderWarning,
  composeDispensingBasicFeePoints,
  decoctionPreparationFeePoints,
  drugFeeProvisionalRoundingWarning,
  drugPriceToPoints,
  materialFeeProvisionalWarning,
  materialPriceToPoints,
  onePackagingSupportFeePoints,
  type PointsRatio,
  selfPreparationAdditionPoints,
  type SelfPreparationKind,
  weighingMixingAdditionPoints,
  type WeighingMixingKind,
} from "./formulas.js";
import {
  assertNonEmptyString,
  assertPositiveSafeInteger,
  calculationEvidenceRef,
  freezeArray,
  ruleEffectiveFrom,
} from "./engine.js";
import type {
  CalculationExclusivityGroup,
  CalculationRule,
  StepResult,
} from "./types.js";

import {
  createFixedPointsRule,
  multiplierAppliedStep,
} from './rules-shared.js';

/* ==================================================================
 * 区分00 調剤基本料 加算(注5〜注14)。施設基準(P-05)前提のため呼び出し側指定。
 * 注4別薬局減算(EVD-CAL-0008 100分の50)・特別調剤基本料B(保留P-01)・
 * 分割調剤(EVD-CAL-0013〜0015 除算)は本バッチ対象外(対象外項目の一覧は CAL-004 §8 参照)。
 * ================================================================== */

/** EVD-CAL-0009 注5 地域支援体制加算・医薬品供給対応体制加算 1〜5(27/59/67/37/59点)。 */
export type RegionalSupportAdditionLevel = 1 | 2 | 3 | 4 | 5;
/**
 * EVD-CAL-0009 の variant。"special_basic_fee_a" は特別調剤基本料A薬局(所定点数の
 * 100分の10)。全 level で 10/100 が非整数となるため、丸め evidence 発行まで常に
 * BLOCKED(MOD-010 §1-4 — 推測丸めしない)。
 */
export type RegionalSupportAdditionVariant = "standard" | "special_basic_fee_a";
const regionalSupportAdditionPoints: Readonly<Record<RegionalSupportAdditionLevel, number>> = {
  1: 27,
  2: 59,
  3: 67,
  4: 37,
  5: 59,
};
export function createRegionalSupportSystemAdditionRule(
  level: RegionalSupportAdditionLevel,
  applicationKey = "prescription",
  variant: RegionalSupportAdditionVariant = "standard",
): CalculationRule {
  if (variant === "special_basic_fee_a") {
    const standardBasePoints = Points.fromInteger(regionalSupportAdditionPoints[level]);
    return Object.freeze({
      ruleId: `EVD-CAL-0009:regional-support-system-addition:${level}:special-basic-fee-a`,
      evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0009")]),
      effectiveFrom: ruleEffectiveFrom,
      apply: (): StepResult =>
        multiplierAppliedStep({
          base: standardBasePoints,
          ratio: { numerator: 10, denominator: 100 },
          applicationKey,
          ruleLabelJa: `地域支援体制加算・医薬品供給対応体制加算 level${level}(特別調剤基本料A薬局 100分の10)`,
          descriptionEn: `Regional support / drug supply system addition level ${level} (special basic fee A pharmacy: 10/100)`,
          inputRefs: [],
        }),
    });
  }
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0009:regional-support-system-addition:${level}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0009"),
    itemPoints: Points.fromInteger(regionalSupportAdditionPoints[level]),
    applicationKey,
    description: `Regional support / drug supply system addition level ${level}`,
    output: `itemPoints=${regionalSupportAdditionPoints[level]};level=${level}`,
  });
}

/** EVD-CAL-0010 注6 連携強化加算: 5点。 */
export const cooperationEnhancementAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0010:cooperation-enhancement-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0010"),
  itemPoints: Points.fromInteger(5),
  applicationKey: "prescription",
  description: "Cooperation enhancement addition: 5 points",
  output: "itemPoints=5",
});

/** EVD-CAL-0011 注7 バイオ後続品調剤体制加算: 50点。 */
export const biosimilarDispensingSystemAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0011:biosimilar-dispensing-system-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0011"),
  itemPoints: Points.fromInteger(50),
  applicationKey: "prescription",
  description: "Biosimilar dispensing system addition: 50 points",
  output: "itemPoints=50",
});

/** EVD-CAL-0016 注12 在宅薬学総合体制加算1: 30点。 */
export const inHomePharmacyComprehensiveSystemAddition1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0016:in-home-pharmacy-comprehensive-system-addition-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0016"),
  itemPoints: Points.fromInteger(30),
  applicationKey: "prescription",
  description: "In-home pharmacy comprehensive system addition 1: 30 points",
  output: "itemPoints=30",
});

/** EVD-CAL-0017 注13 在宅薬学総合体制加算2: イ 100点 / ロ 50点。 */
export type InHomePharmacyAddition2Variant = "i" | "ro";
const inHomePharmacyAddition2Points: Readonly<Record<InHomePharmacyAddition2Variant, number>> = {
  i: 100,
  ro: 50,
};
export function createInHomePharmacyComprehensiveSystemAddition2Rule(
  variant: InHomePharmacyAddition2Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0017:in-home-pharmacy-comprehensive-system-addition-2:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0017"),
    itemPoints: Points.fromInteger(inHomePharmacyAddition2Points[variant]),
    applicationKey,
    description: `In-home pharmacy comprehensive system addition 2 (${variant})`,
    output: `itemPoints=${inHomePharmacyAddition2Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0018 注14 電子的調剤情報連携体制整備加算: 月1回 8点。 */
export const electronicDispensingInfoCooperationAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0018:electronic-dispensing-info-cooperation-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0018"),
  itemPoints: Points.fromInteger(8),
  applicationKey: "claim-month",
  description: "Electronic dispensing info cooperation addition: 8 points (monthly)",
  output: "itemPoints=8",
  maxApplications: 1,
});

/* ==================================================================
 * 区分01 薬剤調製料 加算(注4 時間外・休日・深夜加算)。
 * ================================================================== */

/** EVD-CAL-0031 注4 時間外・休日・深夜加算: 100分の100 / 140 / 200(薬剤調製料所定点数に対する乗率)。 */
export type TimeSurchargeKind = "afterHours" | "holiday" | "lateNight";
const timeSurchargeRatios: Readonly<Record<TimeSurchargeKind, PointsRatio>> = {
  afterHours: { numerator: 100, denominator: 100 },
  holiday: { numerator: 140, denominator: 100 },
  lateNight: { numerator: 200, denominator: 100 },
};
/** 時間帯定義が留意事項通知精読後に確定であることの必須警告(EVD-CAL-0031 caveat)。 */
export const timeSurchargeProvisionalWarning =
  "時間外・休日・深夜加算の時間帯定義は暫定(EVD-CAL-0031 caveat — 留意事項通知精読後に確定)";
export function createTimeSurchargeAdditionRule(input: {
  readonly applicationKey: string;
  /** 薬剤調製料の所定点数(乗率の基礎)。呼び出し側指定。 */
  readonly basePoints: Points;
  readonly kind: TimeSurchargeKind;
}): CalculationRule {
  const { applicationKey, basePoints, kind } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  return Object.freeze({
    ruleId: `EVD-CAL-0031:time-surcharge-addition:${kind}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0031")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult =>
      multiplierAppliedStep({
        base: basePoints,
        ratio: timeSurchargeRatios[kind],
        applicationKey,
        ruleLabelJa: `時間外等加算(${kind})`,
        descriptionEn: `Time surcharge addition (${kind})`,
        inputRefs: ["basePoints"],
        extraWarnings: [timeSurchargeProvisionalWarning],
      }),
  });
}

