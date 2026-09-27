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


export function createFixedPointsRule(input: {
  readonly ruleId: string;
  readonly evidenceRef: EvidenceRef;
  readonly itemPoints: Points;
  readonly applicationKey: string;
  readonly description: string;
  readonly output: string;
  readonly maxApplications?: number;
  readonly effectiveTo?: CalendarDate;
  readonly exclusivityGroup?: CalculationExclusivityGroup;
}): CalculationRule {
  const {
    ruleId,
    evidenceRef,
    itemPoints,
    applicationKey,
    description,
    output,
    maxApplications,
    effectiveTo,
    exclusivityGroup,
  } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  if (maxApplications !== undefined) {
    assertPositiveSafeInteger(maxApplications, "maxApplications");
  }
  const frozenExclusivityGroup =
    exclusivityGroup === undefined
      ? undefined
      : Object.freeze({
          groupId: exclusivityGroup.groupId,
          evidenceRef: exclusivityGroup.evidenceRef,
          ...(exclusivityGroup.blocksGroupIdPrefixes !== undefined
            ? { blocksGroupIdPrefixes: freezeArray(exclusivityGroup.blocksGroupIdPrefixes) }
            : {}),
        });

  return Object.freeze({
    ruleId,
    evidenceRefs: freezeArray([evidenceRef]),
    effectiveFrom: ruleEffectiveFrom,
    ...(effectiveTo !== undefined ? { effectiveTo } : {}),
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description,
        affectsClaim: true,
        inputRefs: [],
        output,
        itemPoints,
        applicationKey,
        ...(maxApplications !== undefined ? { maxApplications } : {}),
        ...(frozenExclusivityGroup !== undefined ? { exclusivityGroup: frozenExclusivityGroup } : {}),
      }),
  });
}


/* ==================================================================
 * 乗率適用型ルールの共通ステップ生成(注意: 端数は BLOCKED = MOD-010 §1-4)。
 * ================================================================== */
export function multiplierAppliedStep(input: {
  readonly base: Points;
  readonly ratio: PointsRatio;
  readonly applicationKey: string;
  readonly ruleLabelJa: string;
  readonly descriptionEn: string;
  readonly inputRefs: readonly string[];
  readonly extraWarnings?: readonly string[];
  readonly exclusivityGroup?: CalculationExclusivityGroup;
}): StepResult {
  const {
    base,
    ratio,
    applicationKey,
    ruleLabelJa,
    descriptionEn,
    inputRefs,
    extraWarnings,
    exclusivityGroup,
  } = input;
  const outcome = applyPointsMultiplier(base, ratio);
  if (outcome.kind === "requires_rounding_evidence") {
    return Object.freeze({
      status: "BLOCKED",
      description: `${descriptionEn}: multiplier produced a fractional value`,
      affectsClaim: false,
      inputRefs: [],
      output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
      blocker: {
        type: "BLOCKED_REGULATORY_REVIEW" as const,
        detail: `丸め根拠未発行: ${ruleLabelJa} の乗率適用結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
      },
    });
  }
  return Object.freeze({
    status: "ITEM_CALCULATED",
    description: descriptionEn,
    affectsClaim: true,
    inputRefs,
    output: `itemPoints=${outcome.points.toString()}`,
    itemPoints: outcome.points,
    applicationKey,
    ...(extraWarnings && extraWarnings.length > 0 ? { warnings: extraWarnings } : {}),
    ...(exclusivityGroup !== undefined
      ? {
          exclusivityGroup: Object.freeze({
            groupId: exclusivityGroup.groupId,
            evidenceRef: exclusivityGroup.evidenceRef,
            ...(exclusivityGroup.blocksGroupIdPrefixes !== undefined
              ? { blocksGroupIdPrefixes: freezeArray(exclusivityGroup.blocksGroupIdPrefixes) }
              : {}),
          }),
        }
      : {}),
  });
}

export const dispensingBasicFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0001:dispensing-basic-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0001"),
  itemPoints: Points.fromInteger(47),
  applicationKey: "prescription",
  description: "Dispensing basic fee 1: 47 points per prescription reception",
  output: "itemPoints=47",
  // 区分00 は1処方箋受付につき1区分のみ(合成ルールと同じ group で排他 — WP-5280 F1)
  exclusivityGroup: {
    groupId: "dispensing-basic-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0001"),
  },
});

export function createOralMedicinePreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0021:oral-medicine-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0021"),
    itemPoints: Points.fromInteger(24),
    applicationKey,
    description: "Oral medicine preparation fee: 24 points per application, up to 3 applications",
    output: "itemPoints=24",
    maxApplications: 3,
  });
}

export const dispensingManagementFee2Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0037:dispensing-management-fee-2",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0037"),
  itemPoints: Points.fromInteger(10),
  applicationKey: "prescription",
  description: "Dispensing management fee 2: 10 points",
  output: "itemPoints=10",
  // 料2 は「1以外の場合」(EVD-CAL-0037): 料1(剤別 groupId 接頭辞)の任意適用と非対称排他
  exclusivityGroup: {
    groupId: "dispensing-management-fee-2",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0037"),
    blocksGroupIdPrefixes: ["dispensing-management-fee-1:"],
  },
});

export const medicationManagementGuidanceFee3Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0042:medication-management-guidance-fee-3",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0042"),
  itemPoints: Points.fromInteger(45),
  applicationKey: "prescription",
  description: "Medication management guidance fee 3: 45 points",
  output: "itemPoints=45",
});

export const nightHolidayAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0032:night-holiday-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0032"),
  itemPoints: Points.fromInteger(40),
  applicationKey: "prescription",
  description: "Night and holiday addition: 40 points per prescription reception",
  output: "itemPoints=40",
});
