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
  dispensingBasicFee1Rule,
  createOralMedicinePreparationFeeRule,
  dispensingManagementFee2Rule,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
} from './rules-shared.js';

/* ==================================================================
 * 第3節〜第5節(区分20 注2 多剤逓減 / 区分30 材料料 / 区分40・41 評価料)。
 * ================================================================== */

/**
 * EVD-CAL-0068 区分20 注2 多剤逓減: 1処方7種類以上の内服薬 → 所定点数の100分の90。
 * 使用薬剤料の所定点数(呼び出し側指定)に乗率を適用する。端数は BLOCKED(MOD-010 §1-4)。
 */
export function createMultiDrugReductionRule(input: {
  readonly applicationKey: string;
  /** 逓減対象の使用薬剤料 所定点数(呼び出し側指定)。 */
  readonly basePoints: Points;
  /**
   * 逓減が置き換える薬剤料の exclusivityGroup 接頭辞(既定 "drug-fee:" = 全使用薬剤料)。
   * 逓減後総額を返す置換型ルールのため、元の薬剤料との併算定(二重計上)を非対称排他する。
   * 対象を絞る場合は薬剤料側の applicationKey 接頭辞に合わせて指定する。
   * 前方一致契約: "drug-fee:rp:1" は "drug-fee:rp:10" にも一致するため、
   * 完全一致が必要なら区切りを含む applicationKey 命名規約が呼び出し側に必要。
   */
  readonly reducedDrugFeeGroupPrefix?: string;
}): CalculationRule {
  const { applicationKey, basePoints, reducedDrugFeeGroupPrefix = "drug-fee:" } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  assertNonEmptyString(reducedDrugFeeGroupPrefix, "reducedDrugFeeGroupPrefix");
  return Object.freeze({
    ruleId: "EVD-CAL-0068:multi-drug-reduction",
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0068")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult =>
      multiplierAppliedStep({
        base: basePoints,
        ratio: { numerator: 90, denominator: 100 },
        applicationKey,
        ruleLabelJa: "多剤逓減(100分の90)",
        descriptionEn: "Multi-drug reduction (90/100)",
        inputRefs: ["basePoints"],
        exclusivityGroup: {
          groupId: `multi-drug-reduction:${applicationKey}`,
          evidenceRef: calculationEvidenceRef("EVD-CAL-0068"),
          blocksGroupIdPrefixes: [reducedDrugFeeGroupPrefix],
        },
      }),
  });
}

/**
 * EVD-CAL-0069 区分30 特定保険医療材料料: 材料価格を10円で除して得た点数。
 * 材料価格(円)は材料価格基準由来の入力として呼び出し側が指定する。
 * 10円で割り切れない場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 */
export function createSpecificMedicalMaterialFeeRule(input: {
  readonly applicationKey: string;
  readonly materialPriceYen: ScaledDecimal;
}): CalculationRule {
  const { applicationKey, materialPriceYen } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  const materialPriceYenSnapshot = materialPriceYen.toString();
  const outcome = materialPriceToPoints(materialPriceYen);
  return Object.freeze({
    ruleId: "EVD-CAL-0069:specific-medical-material-fee",
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0069")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (outcome.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: "Specific medical material fee: material price is not divisible by 10 yen",
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: 特定保険医療材料料(材料価格÷10)の結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Specific medical material fee from material price ${materialPriceYenSnapshot} yen`,
        affectsClaim: true,
        inputRefs: ["materialPriceYen"],
        output: `itemPoints=${outcome.points.toString()};materialPriceYen=${materialPriceYenSnapshot}`,
        itemPoints: outcome.points,
        applicationKey,
        warnings: [materialFeeProvisionalWarning],
      });
    },
  });
}

/**
 * EVD-CAL-0070/0071 の時限規定: 「令和9年(2027年)6月以降は所定点数の100分の200」。
 * 現行点数(4点/1点)の最終有効日。以降の点数は改定 evidence 発行後に別ルールで追加する。
 */
const evdCal0070_0071EffectiveTo = CalendarDate.fromString("2027-05-31");

/** EVD-CAL-0070 区分40 調剤ベースアップ評価料: 4点(施設基準届出。令和9年6月以降は100分の200)。 */
export const dispensingBaseUpEvaluationFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0070:dispensing-base-up-evaluation-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0070"),
  itemPoints: Points.fromInteger(4),
  applicationKey: "prescription",
  description: "Dispensing base-up evaluation fee: 4 points",
  output: "itemPoints=4",
  effectiveTo: evdCal0070_0071EffectiveTo,
});

/** EVD-CAL-0071 区分41 調剤物価対応料: 1点(処方箋受付、3月に1回。令和9年6月以降は100分の200)。 */
export const dispensingPriceResponseFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0071:dispensing-price-response-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0071"),
  itemPoints: Points.fromInteger(1),
  applicationKey: "prescription",
  description: "Dispensing price response fee: 1 point",
  output: "itemPoints=1",
  effectiveTo: evdCal0070_0071EffectiveTo,
});

/**
 * 暫定の参照用ルール束(例示 — 全ルールカタログでも既定の算定セットでもない)。
 * 適用可否・組合せの自動選択は行われず、呼び出し側が rules を明示指定する。
 * claimable=false の表示専用出力のみに使う。
 */
export const calculationRulesV20260601 = Object.freeze([
  dispensingBasicFee1Rule,
  createOralMedicinePreparationFeeRule("oral-medicine:1"),
  dispensingManagementFee2Rule,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
] satisfies readonly CalculationRule[]);


