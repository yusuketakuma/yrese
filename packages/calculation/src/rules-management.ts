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
 * 区分10の2 調剤管理料(1イ/1ロ 本体、注3残薬調整加算、注4薬学的有害事象等防止加算)。
 * ================================================================== */

/** EVD-CAL-0035 調剤管理料1 イ(内服薬・28日分以上): 60点(1剤につき。4剤以上算定しない)。 */
export function createDispensingManagementFee1IRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0035:dispensing-management-fee-1-i",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0035"),
    itemPoints: Points.fromInteger(60),
    applicationKey,
    description: "Dispensing management fee 1-i (oral, 28+ days): 60 points per group, up to 3",
    output: "itemPoints=60",
    maxApplications: 3,
    // ロは「イ以外」(EVD-CAL-0036): 同一剤のイ/ロ併算定を排他(剤単位 — 料2 との区分間排他は料2側が宣言)
    exclusivityGroup: {
      groupId: `dispensing-management-fee-1:${applicationKey}`,
      evidenceRef: calculationEvidenceRef("EVD-CAL-0035"),
    },
  });
}

/** EVD-CAL-0036 調剤管理料1 ロ(イ以外): 10点(1剤につき。4剤以上算定しない)。 */
export function createDispensingManagementFee1RoRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0036:dispensing-management-fee-1-ro",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0036"),
    itemPoints: Points.fromInteger(10),
    applicationKey,
    description: "Dispensing management fee 1-ro (other): 10 points per group, up to 3",
    output: "itemPoints=10",
    maxApplications: 3,
    exclusivityGroup: {
      groupId: `dispensing-management-fee-1:${applicationKey}`,
      evidenceRef: calculationEvidenceRef("EVD-CAL-0036"),
    },
  });
}

/** イ/ロ/ハ=50点、ニ=30点 の4区分共通の点数マップ(EVD-CAL-0038 / 0039)。 */
export type IrohaNiVariant = "i" | "ro" | "ha" | "ni";
const irohaNi50_30Points: Readonly<Record<IrohaNiVariant, number>> = {
  i: 50,
  ro: 50,
  ha: 50,
  ni: 30,
};

/** EVD-CAL-0038 注3 調剤時残薬調整加算: イ/ロ/ハ 各50点、ニ 30点。 */
export function createResidualDrugAdjustmentAdditionRule(
  variant: IrohaNiVariant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0038:residual-drug-adjustment-addition:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0038"),
    itemPoints: Points.fromInteger(irohaNi50_30Points[variant]),
    applicationKey,
    description: `Residual drug adjustment addition (${variant})`,
    output: `itemPoints=${irohaNi50_30Points[variant]};variant=${variant}`,
  });
}

/**
 * EVD-CAL-0039 注4 薬学的有害事象等防止加算: イ/ロ/ハ 各50点、ニ 30点。
 * 重複投薬確認等の判定は行わず、適用可否は呼び出し側指定(表示専用)。
 * SaMD該当性(REG-005)評価が別途必要である旨を warning で明示する。
 */
export const adverseEventPreventionSamdWarning =
  "薬学的有害事象等防止加算は表示専用(判定ロジック非搭載)。SaMD該当性評価(REG-005)・外部確認前提との整合は別途整理が必要";
export function createAdverseEventPreventionAdditionRule(
  variant: IrohaNiVariant,
  applicationKey = "prescription",
): CalculationRule {
  const points = Points.fromInteger(irohaNi50_30Points[variant]);
  return Object.freeze({
    ruleId: `EVD-CAL-0039:adverse-event-prevention-addition:${variant}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0039")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Pharmaceutical adverse event prevention addition (${variant})`,
        affectsClaim: true,
        inputRefs: [],
        output: `itemPoints=${points.toString()};variant=${variant}`,
        itemPoints: points,
        applicationKey,
        warnings: [adverseEventPreventionSamdWarning],
      }),
  });
}

/* ==================================================================
 * 区分10の3 服薬管理指導料(1/2/4 本体、注6〜注17 加算)。
 * ================================================================== */

/** EVD-CAL-0040 服薬管理指導料1(3月以内再来+手帳提示): 45点(イ/ロ同点)。 */
export const medicationManagementGuidanceFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0040:medication-management-guidance-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0040"),
  itemPoints: Points.fromInteger(45),
  applicationKey: "prescription",
  description: "Medication management guidance fee 1: 45 points",
  output: "itemPoints=45",
  // 料2 は「1以外の患者」(EVD-CAL-0041): 同一処方箋受付での1↔2併算定を排他(WP-5280 F4)
  exclusivityGroup: {
    groupId: "medication-management-guidance-fee-1-or-2",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0040"),
  },
});

/** EVD-CAL-0041 服薬管理指導料2(1以外の患者): 59点。 */
export const medicationManagementGuidanceFee2Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0041:medication-management-guidance-fee-2",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0041"),
  itemPoints: Points.fromInteger(59),
  applicationKey: "prescription",
  description: "Medication management guidance fee 2: 59 points",
  output: "itemPoints=59",
  exclusivityGroup: {
    groupId: "medication-management-guidance-fee-1-or-2",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0041"),
  },
});

/** EVD-CAL-0043 服薬管理指導料4(情報通信機器): イ45点 / ロ・ハ・ニ 59点。 */
export type MedicationManagementGuidanceFee4Variant = "i" | "ro" | "ha" | "ni";
const medicationManagementGuidanceFee4Points: Readonly<
  Record<MedicationManagementGuidanceFee4Variant, number>
> = { i: 45, ro: 59, ha: 59, ni: 59 };
export function createMedicationManagementGuidanceFee4Rule(
  variant: MedicationManagementGuidanceFee4Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0043:medication-management-guidance-fee-4:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0043"),
    itemPoints: Points.fromInteger(medicationManagementGuidanceFee4Points[variant]),
    applicationKey,
    description: `Medication management guidance fee 4 (${variant})`,
    output: `itemPoints=${medicationManagementGuidanceFee4Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0044 注6 麻薬管理指導加算: 22点。 */
export const narcoticManagementGuidanceAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0044:narcotic-management-guidance-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0044"),
  itemPoints: Points.fromInteger(22),
  applicationKey: "prescription",
  description: "Narcotic management guidance addition: 22 points",
  output: "itemPoints=22",
});

/** EVD-CAL-0045 注7 特定薬剤管理指導加算1: イ 10点 / ロ 5点。 */
export type SpecificDrugManagementAddition1Variant = "i" | "ro";
const specificDrugManagementAddition1Points: Readonly<
  Record<SpecificDrugManagementAddition1Variant, number>
> = { i: 10, ro: 5 };
export function createSpecificDrugManagementGuidanceAddition1Rule(
  variant: SpecificDrugManagementAddition1Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0045:specific-drug-management-guidance-addition-1:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0045"),
    itemPoints: Points.fromInteger(specificDrugManagementAddition1Points[variant]),
    applicationKey,
    description: `Specific drug management guidance addition 1 (${variant})`,
    output: `itemPoints=${specificDrugManagementAddition1Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0046 注8 特定薬剤管理指導加算2: 月1回 100点。 */
export const specificDrugManagementGuidanceAddition2Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0046:specific-drug-management-guidance-addition-2",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0046"),
  itemPoints: Points.fromInteger(100),
  applicationKey: "claim-month",
  description: "Specific drug management guidance addition 2: 100 points (monthly)",
  output: "itemPoints=100",
  maxApplications: 1,
});

/** EVD-CAL-0047 注9 特定薬剤管理指導加算3: イ 5点 / ロ 10点。 */
export type SpecificDrugManagementAddition3Variant = "i" | "ro";
const specificDrugManagementAddition3Points: Readonly<
  Record<SpecificDrugManagementAddition3Variant, number>
> = { i: 5, ro: 10 };
export function createSpecificDrugManagementGuidanceAddition3Rule(
  variant: SpecificDrugManagementAddition3Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0047:specific-drug-management-guidance-addition-3:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0047"),
    itemPoints: Points.fromInteger(specificDrugManagementAddition3Points[variant]),
    applicationKey,
    description: `Specific drug management guidance addition 3 (${variant})`,
    output: `itemPoints=${specificDrugManagementAddition3Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0048 注10 乳幼児服薬指導加算: 12点。 */
export const infantMedicationGuidanceAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0048:infant-medication-guidance-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0048"),
  itemPoints: Points.fromInteger(12),
  applicationKey: "prescription",
  description: "Infant medication guidance addition: 12 points",
  output: "itemPoints=12",
});

/** EVD-CAL-0049 注11 小児特定加算: 350点。 */
export const pediatricSpecificAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0049:pediatric-specific-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0049"),
  itemPoints: Points.fromInteger(350),
  applicationKey: "prescription",
  description: "Pediatric specific addition: 350 points",
  output: "itemPoints=350",
});

/** EVD-CAL-0050 注12 吸入薬指導加算: 6月に1回 30点。 */
export const inhalationDrugGuidanceAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0050:inhalation-drug-guidance-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0050"),
  itemPoints: Points.fromInteger(30),
  applicationKey: "prescription",
  description: "Inhalation drug guidance addition: 30 points",
  output: "itemPoints=30",
});

/** EVD-CAL-0051 注13 かかりつけ薬剤師フォローアップ加算: 3月に1回 50点。 */
export const familyPharmacistFollowUpAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0051:family-pharmacist-follow-up-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0051"),
  itemPoints: Points.fromInteger(50),
  applicationKey: "prescription",
  description: "Family pharmacist follow-up addition: 50 points",
  output: "itemPoints=50",
});

/** EVD-CAL-0052 注14 かかりつけ薬剤師訪問加算: 6月に1回 230点。 */
export const familyPharmacistVisitAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0052:family-pharmacist-visit-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0052"),
  itemPoints: Points.fromInteger(230),
  applicationKey: "prescription",
  description: "Family pharmacist visit addition: 230 points",
  output: "itemPoints=230",
});

/** EVD-CAL-0053 注17 服薬管理指導料の特例: 13点。 */
export const medicationManagementGuidanceSpecialCaseRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0053:medication-management-guidance-special-case",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0053"),
  itemPoints: Points.fromInteger(13),
  applicationKey: "prescription",
  description: "Medication management guidance special case: 13 points",
  output: "itemPoints=13",
});

