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

/* ------------------------------------------------------------------
 * 区分00 調剤基本料 — 合成計算(基礎点数 → 乗率 → 減算 → 下限)
 * 区分選択(1/2/3イロハ/特別A)は施設基準(P-05)前提のため呼び出し側指定。
 * ------------------------------------------------------------------ */

export interface DispensingBasicFeeBase {
  readonly evidenceId: string;
  readonly points: Points;
  readonly label: string;
}

/** 区分00 の基礎点数プリセット(CAL-003 EVD-CAL-0001〜0006)。 */
export const DISPENSING_BASIC_FEE_BASES = Object.freeze({
  FEE_1: Object.freeze({ evidenceId: "EVD-CAL-0001", points: Points.fromInteger(47), label: "調剤基本料1" }),
  FEE_2: Object.freeze({ evidenceId: "EVD-CAL-0002", points: Points.fromInteger(30), label: "調剤基本料2" }),
  FEE_3_I: Object.freeze({ evidenceId: "EVD-CAL-0003", points: Points.fromInteger(25), label: "調剤基本料3イ" }),
  FEE_3_RO: Object.freeze({ evidenceId: "EVD-CAL-0004", points: Points.fromInteger(20), label: "調剤基本料3ロ" }),
  FEE_3_HA: Object.freeze({ evidenceId: "EVD-CAL-0005", points: Points.fromInteger(37), label: "調剤基本料3ハ" }),
  SPECIAL_A: Object.freeze({ evidenceId: "EVD-CAL-0006", points: Points.fromInteger(5), label: "特別調剤基本料A" }),
} satisfies Readonly<Record<string, DispensingBasicFeeBase>>);

export interface DispensingBasicFeeRuleInput {
  /** 基礎区分(DISPENSING_BASIC_FEE_BASES のいずれか、または evidence 付き同型値)。 */
  readonly base: DispensingBasicFeeBase;
  /** 注3(EVD-CAL-0007): 複数医療機関の処方箋同時受付の2枚目以降(所定点数の100分の80)。 */
  readonly secondOrLaterConcurrentPrescription?: boolean;
  /** 注8(EVD-CAL-0012): 後発医薬品減算(▲5点)。 */
  readonly genericDispensingReduction?: boolean;
  /** 注15(EVD-CAL-0019): 門前薬局等立地依存減算(▲15点)。 */
  readonly locationDependencyReduction?: boolean;
}

/**
 * 調剤基本料の合成ルール(区分00)。
 * 合成計算は composeDispensingBasicFeePoints(乗率→減算→下限3点 EVD-CAL-0020)。
 * 乗率で端数が出る場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 * 同一処方箋受付での基本料区分の重複適用は exclusivityGroup で排他する。
 */
export function createDispensingBasicFeeRule(input: DispensingBasicFeeRuleInput): CalculationRule {
  const { base } = input;
  // factory 入口で基礎区分の値を固定し、呼び出し後の入力オブジェクト変更に不感性を持たせる
  const baseEvidenceId = base.evidenceId;
  const basePoints = base.points;
  const baseLabel = base.label;
  const evidenceRefs: EvidenceRef[] = [calculationEvidenceRef(baseEvidenceId)];
  const reductions: Points[] = [];
  const noteOutputs: string[] = [];

  const multiplier = input.secondOrLaterConcurrentPrescription === true
    ? { numerator: 80, denominator: 100 }
    : undefined;
  if (multiplier !== undefined) {
    evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0007"));
    noteOutputs.push("multiplier=80/100");
  }
  if (input.genericDispensingReduction === true) {
    evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0012"));
    reductions.push(Points.fromInteger(5));
    noteOutputs.push("reduction=5");
  }
  if (input.locationDependencyReduction === true) {
    evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0019"));
    reductions.push(Points.fromInteger(15));
    noteOutputs.push("reduction=15");
  }
  // 注16(下限3点)は区分00 の合算に常に効く規定
  evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0020"));

  const composed = composeDispensingBasicFeePoints({
    basePoints,
    ...(multiplier !== undefined ? { multiplier } : {}),
    reductions,
    minimumPoints: Points.fromInteger(3),
  });
  const usesComposition = multiplier !== undefined || reductions.length > 0;

  return Object.freeze({
    ruleId: `${baseEvidenceId}:dispensing-basic-fee`,
    evidenceRefs: freezeArray(evidenceRefs),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (composed.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: `${baseLabel}: multiplier produced a fractional value and no rounding evidence is issued`,
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${composed.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: ${baseLabel} の乗率適用結果 ${composed.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      if (composed.kind === "negative_without_minimum") {
        // minimumPoints=3 を常時宣言しているため到達しない(防御)
        return Object.freeze({
          status: "BLOCKED",
          description: `${baseLabel}: reductions produced a negative value without a floor`,
          affectsClaim: false,
          inputRefs: [],
          output: "SSOT_UPDATE_REQUIRED:減算結果が負",
          blocker: {
            type: "SSOT_UPDATE_REQUIRED" as const,
            detail: `${baseLabel}: 減算結果が負(下限宣言なし)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `${baseLabel}: composed dispensing basic fee (base=${basePoints.toString()})`,
        affectsClaim: true,
        inputRefs: [],
        output: [
          `itemPoints=${composed.points.toString()}`,
          ...noteOutputs,
          ...(composed.clampedToMinimum ? ["clampedToMinimum=3"] : []),
        ].join(";"),
        itemPoints: composed.points,
        applicationKey: "dispensing-basic-fee",
        exclusivityGroup: {
          groupId: "dispensing-basic-fee",
          evidenceRef: calculationEvidenceRef(baseEvidenceId),
        },
        ...(usesComposition ? { warnings: [basicFeeCompositionOrderWarning] } : {}),
      });
    },
  });
}

