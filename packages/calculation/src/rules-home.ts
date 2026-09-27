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
 * 区分14の2 外来服薬支援料 / 14の3 服用薬剤調整支援料。
 * ================================================================== */

/** EVD-CAL-0054 外来服薬支援料1: 185点。 */
export const outpatientMedicationSupportFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0054:outpatient-medication-support-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0054"),
  itemPoints: Points.fromInteger(185),
  applicationKey: "prescription",
  description: "Outpatient medication support fee 1: 185 points",
  output: "itemPoints=185",
});

/** EVD-CAL-0057 注4 施設連携加算: 月1回 50点。 */
export const facilityCooperationAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0057:facility-cooperation-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0057"),
  itemPoints: Points.fromInteger(50),
  applicationKey: "claim-month",
  description: "Facility cooperation addition: 50 points (monthly)",
  output: "itemPoints=50",
  maxApplications: 1,
});

/** EVD-CAL-0058 服用薬剤調整支援料1: 125点(支援料2=1,000点判読は保留 P-02)。 */
export const medicationAdjustmentSupportFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0058:medication-adjustment-support-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0058"),
  itemPoints: Points.fromInteger(125),
  applicationKey: "prescription",
  description: "Medication adjustment support fee 1: 125 points",
  output: "itemPoints=125",
});

/* ==================================================================
 * 区分15系 在宅関連(CAL-003 発行済みのみ)。
 * 在宅患者訪問薬剤管理指導料(区分15)本体・在宅患者緊急訪問(15の2)本体は保留 P-04 のため未実装。
 * ================================================================== */

/**
 * EVD-CAL-0059 15の3 在宅患者緊急時等共同指導料。
 * 本体700点 + 各加算(麻薬管理指導100 / 在宅麻薬持続注射250 / 乳幼児100 / 小児特定450 / 中心静脈栄養150。各1回)。
 */
export type HomeEmergencyJointGuidanceVariant =
  | "base"
  | "narcotic"
  | "continuousNarcoticInjection"
  | "infant"
  | "pediatricSpecific"
  | "centralVenousNutrition";
const homeEmergencyJointGuidancePoints: Readonly<Record<HomeEmergencyJointGuidanceVariant, number>> = {
  base: 700,
  narcotic: 100,
  continuousNarcoticInjection: 250,
  infant: 100,
  pediatricSpecific: 450,
  centralVenousNutrition: 150,
};
export function createHomePatientEmergencyJointGuidanceRule(
  variant: HomeEmergencyJointGuidanceVariant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0059:home-patient-emergency-joint-guidance:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0059"),
    itemPoints: Points.fromInteger(homeEmergencyJointGuidancePoints[variant]),
    applicationKey,
    description: `Home patient emergency joint guidance (${variant})`,
    output: `itemPoints=${homeEmergencyJointGuidancePoints[variant]};variant=${variant}`,
    maxApplications: 1,
  });
}

/** EVD-CAL-0061 15の4 退院時共同指導料: 600点。 */
export const dischargeJointGuidanceFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0061:discharge-joint-guidance-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0061"),
  itemPoints: Points.fromInteger(600),
  applicationKey: "prescription",
  description: "Discharge joint guidance fee: 600 points",
  output: "itemPoints=600",
});

/** EVD-CAL-0062 15の5 服薬情報等提供料: 1=30点 / 2 イ・ロ・ハ=各20点 / 3=50点。 */
export type MedicationInfoProvisionVariant = "1" | "2i" | "2ro" | "2ha" | "3";
const medicationInfoProvisionPoints: Readonly<Record<MedicationInfoProvisionVariant, number>> = {
  "1": 30,
  "2i": 20,
  "2ro": 20,
  "2ha": 20,
  "3": 50,
};
export function createMedicationInfoProvisionFeeRule(
  variant: MedicationInfoProvisionVariant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0062:medication-info-provision-fee:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0062"),
    itemPoints: Points.fromInteger(medicationInfoProvisionPoints[variant]),
    applicationKey,
    description: `Medication info provision fee (${variant})`,
    output: `itemPoints=${medicationInfoProvisionPoints[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0063 15の7 経管投薬支援料: 初回のみ 100点。 */
export const tubeFeedingMedicationSupportFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0063:tube-feeding-medication-support-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0063"),
  itemPoints: Points.fromInteger(100),
  applicationKey: "patient",
  description: "Tube feeding medication support fee: 100 points (first time only)",
  output: "itemPoints=100",
  maxApplications: 1,
});

/** EVD-CAL-0064 15の8 在宅移行初期管理料: 230点。 */
export const inHomeTransitionInitialManagementFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0064:in-home-transition-initial-management-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0064"),
  itemPoints: Points.fromInteger(230),
  applicationKey: "prescription",
  description: "In-home transition initial management fee: 230 points",
  output: "itemPoints=230",
});

/** EVD-CAL-0065 15の9 訪問薬剤管理医師同時指導料: 6月に1回 150点。 */
export const visitPharmacistPhysicianJointGuidanceFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0065:visit-pharmacist-physician-joint-guidance-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0065"),
  itemPoints: Points.fromInteger(150),
  applicationKey: "prescription",
  description: "Visit pharmacist-physician joint guidance fee: 150 points",
  output: "itemPoints=150",
});

/** EVD-CAL-0066 15の10 複数名薬剤管理指導訪問料: 300点。 */
export const multiPharmacistManagementVisitFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0066:multi-pharmacist-management-visit-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0066"),
  itemPoints: Points.fromInteger(300),
  applicationKey: "prescription",
  description: "Multi-pharmacist management visit fee: 300 points",
  output: "itemPoints=300",
});

