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
 * 区分01 薬剤調製料 — 剤形別(CAL-004 v0.3.0 §2 で解禁。evidence は CAL-003)
 * 剤・調剤の数量、適用可否は算定要件未検証のため呼び出し側指定(§5)。
 * ------------------------------------------------------------------ */

/** EVD-CAL-0022 屯服薬: 21点。 */
export const tonpukuPreparationFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0022:tonpuku-preparation-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0022"),
  itemPoints: Points.fromInteger(21),
  applicationKey: "tonpuku",
  description: "Tonpuku (as-needed) medicine preparation fee: 21 points",
  output: "itemPoints=21",
});

/** EVD-CAL-0023 浸煎薬: 190点(1調剤につき。4調剤以上は算定しない=上限3適用)。 */
export function createSenzenPreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0023:senzen-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0023"),
    itemPoints: Points.fromInteger(190),
    applicationKey,
    description: "Senzen (decocted crude drug) preparation fee: 190 points per dispensing, up to 3",
    output: "itemPoints=190",
    maxApplications: 3,
  });
}

/** EVD-CAL-0027 注射薬: 26点。 */
export const injectionPreparationFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0027:injection-preparation-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0027"),
  itemPoints: Points.fromInteger(26),
  applicationKey: "injection",
  description: "Injection medicine preparation fee: 26 points",
  output: "itemPoints=26",
});

/** EVD-CAL-0028 外用薬: 10点(1調剤につき。4調剤以上は算定しない=上限3適用)。 */
export function createExternalPreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0028:external-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0028"),
    itemPoints: Points.fromInteger(10),
    applicationKey,
    description: "External-use medicine preparation fee: 10 points per dispensing, up to 3",
    output: "itemPoints=10",
    maxApplications: 3,
  });
}

/** EVD-CAL-0029 注1 内服用滴剤: 1調剤につき10点。 */
export function createOralDropPreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0029:oral-drop-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0029"),
    itemPoints: Points.fromInteger(10),
    applicationKey,
    description: "Oral drop preparation fee: 10 points per dispensing",
    output: "itemPoints=10",
  });
}

/** EVD-CAL-0030 注3 麻薬加算: 1調剤につき70点。 */
export function createNarcoticPreparationAdditionRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0030:narcotic-preparation-addition",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0030"),
    itemPoints: Points.fromInteger(70),
    applicationKey,
    description: "Narcotic preparation addition: 70 points per dispensing",
    output: "itemPoints=70",
  });
}

/** EVD-CAL-0030 注3 向精神薬・覚醒剤原料・毒薬加算: 1調剤につき8点。 */
export function createPsychotropicEtcPreparationAdditionRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0030:psychotropic-etc-preparation-addition",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0030"),
    itemPoints: Points.fromInteger(8),
    applicationKey,
    description: "Psychotropic/raw-stimulant/poison preparation addition: 8 points per dispensing",
    output: "itemPoints=8",
  });
}

/**
 * 湯薬の薬剤調製料(EVD-CAL-0024/0025/0026 — 数量段階型)。
 * 日数は算定要件未検証の入力(呼び出し側指定)。適用された段の evidence を evidenceRefs に持つ。
 */
export function createDecoctionPreparationFeeRule(
  applicationKey: string,
  daysSupply: number,
): CalculationRule {
  assertNonEmptyString(applicationKey, "applicationKey");
  const fee = decoctionPreparationFeePoints(daysSupply);
  return Object.freeze({
    ruleId: `${fee.appliedEvidenceId}:decoction-preparation-fee`,
    evidenceRefs: freezeArray([calculationEvidenceRef(fee.appliedEvidenceId)]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Decoction (tou-yaku) preparation fee for ${daysSupply} days supply`,
        affectsClaim: true,
        inputRefs: ["daysSupply"],
        output: `itemPoints=${fee.points.toString()};daysSupply=${daysSupply}`,
        itemPoints: fee.points,
        applicationKey,
        // 段階ごとに ruleId が分かれるため重複検知をすり抜ける — 同一対象の併算定は排他
        // (別対象 applicationKey への正当な複数適用は妨げない — WP-5280 A2)
        exclusivityGroup: {
          groupId: `decoction-preparation-fee:${applicationKey}`,
          evidenceRef: calculationEvidenceRef(fee.appliedEvidenceId),
        },
      }),
  });
}

/**
 * 使用薬剤料(EVD-CAL-0067 — 薬価→点数変換)。
 * 薬価(所定単位あたり・円)は薬価基準由来の入力として呼び出し側が指定する。
 * EVD-CAL-0067 の caveat により暫定 warning を必ず付与する(CAL-004 §2)。
 */
export function createDrugFeeRule(input: {
  readonly applicationKey: string;
  /** 所定単位あたり薬価(円)。ScaledDecimal(小数薬価対応)。 */
  readonly unitPriceYen: ScaledDecimal;
}): CalculationRule {
  const { applicationKey, unitPriceYen } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  const unitPriceYenSnapshot = unitPriceYen.toString();
  const points = drugPriceToPoints(unitPriceYen);
  return Object.freeze({
    ruleId: "EVD-CAL-0067:drug-fee",
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0067")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Drug fee converted from unit price ${unitPriceYenSnapshot} yen`,
        affectsClaim: true,
        inputRefs: ["unitPriceYen"],
        output: `itemPoints=${points.toString()};unitPriceYen=${unitPriceYenSnapshot}`,
        itemPoints: points,
        applicationKey,
        // 多剤逓減(EVD-CAL-0068)は逓減後総額を返す置換型 — 元の薬剤料との併用は逓減側が block
        exclusivityGroup: {
          groupId: `drug-fee:${applicationKey}`,
          evidenceRef: calculationEvidenceRef("EVD-CAL-0067"),
        },
        warnings: [drugFeeProvisionalRoundingWarning],
      }),
  });
}

/**
 * 一包化: 外来服薬支援料2(EVD-CAL-0055/0056 — 数量段階型)。
 * - 42日分以下: 7日ごと34点(EVD-CAL-0055)
 * - 43日分以上: 240点(EVD-CAL-0056)
 * 日数は算定要件未検証の入力(呼び出し側指定)。処方箋単位(applicationKey="prescription")。
 */
export function createOnePackagingSupportFeeRule(
  applicationKey: string,
  daysSupply: number,
): CalculationRule {
  assertNonEmptyString(applicationKey, "applicationKey");
  const fee = onePackagingSupportFeePoints(daysSupply);
  return Object.freeze({
    ruleId: `${fee.appliedEvidenceId}:one-packaging-support-fee`,
    evidenceRefs: freezeArray([calculationEvidenceRef(fee.appliedEvidenceId)]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `One-packaging (outpatient medication support fee 2) for ${daysSupply} days supply`,
        affectsClaim: true,
        inputRefs: ["daysSupply"],
        output: `itemPoints=${fee.points.toString()};daysSupply=${daysSupply}`,
        itemPoints: fee.points,
        applicationKey,
        // 段階ごとに ruleId が分かれるため重複検知をすり抜ける — 同一対象の併算定は排他
        // (別対象 applicationKey への正当な複数適用は妨げない — WP-5280 A2)
        exclusivityGroup: {
          groupId: `one-packaging-support-fee:${applicationKey}`,
          evidenceRef: calculationEvidenceRef(fee.appliedEvidenceId),
        },
      }),
  });
}

export interface SelfPreparationAdditionRuleInput {
  readonly applicationKey: string;
  readonly kind: SelfPreparationKind;
  /** oral_tablet_like(7日ごと)のみ必須。粉砕はここ。 */
  readonly daysSupply?: number;
  /** 予製剤・錠剤分割は所定点数の100分の20(EVD-CAL-0033 括弧書き)。 */
  readonly prePrepared?: boolean;
}

/**
 * 自家製剤加算(EVD-CAL-0033)。粉砕は kind="oral_tablet_like"(20点×⌈日数/7⌉)。
 * 予製剤の乗率(100分の20)で端数が出る場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 */
export function createSelfPreparationAdditionRule(
  input: SelfPreparationAdditionRuleInput,
): CalculationRule {
  const { applicationKey, kind, daysSupply, prePrepared } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  const outcome = selfPreparationAdditionPoints({
    kind,
    ...(daysSupply !== undefined ? { daysSupply } : {}),
    ...(prePrepared !== undefined ? { prePrepared } : {}),
  });
  return Object.freeze({
    ruleId: `EVD-CAL-0033:self-preparation-addition:${kind}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0033")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (outcome.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: `Self-preparation addition (${kind}): pre-prepared multiplier produced a fractional value`,
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: 自家製剤加算(予製剤 100分の20)の適用結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Self-preparation addition (${kind})`,
        affectsClaim: true,
        inputRefs: daysSupply !== undefined ? ["daysSupply"] : [],
        output: [
          `itemPoints=${outcome.points.toString()}`,
          `kind=${kind}`,
          ...(daysSupply !== undefined ? [`daysSupply=${daysSupply}`] : []),
          `prePrepared=${prePrepared === true}`,
        ].join(";"),
        itemPoints: outcome.points,
        applicationKey,
      });
    },
  });
}

export interface WeighingMixingAdditionRuleInput {
  readonly applicationKey: string;
  readonly kind: WeighingMixingKind;
  /** 予製剤は所定点数の100分の20。 */
  readonly prePrepared?: boolean;
}

/**
 * 計量混合調剤加算(EVD-CAL-0034): 液剤35 / 散剤・顆粒剤45 / 軟・硬膏剤80。
 * 予製剤の乗率(100分の20)で端数が出る場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 */
export function createWeighingMixingAdditionRule(
  input: WeighingMixingAdditionRuleInput,
): CalculationRule {
  const { applicationKey, kind, prePrepared } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  const outcome = weighingMixingAdditionPoints(kind, prePrepared ?? false);
  return Object.freeze({
    ruleId: `EVD-CAL-0034:weighing-mixing-addition:${kind}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0034")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (outcome.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: `Weighing-mixing addition (${kind}): pre-prepared multiplier produced a fractional value`,
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: 計量混合調剤加算(予製剤 100分の20)の適用結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Weighing-mixing addition (${kind})`,
        affectsClaim: true,
        inputRefs: [],
        output: `itemPoints=${outcome.points.toString()};kind=${kind};prePrepared=${prePrepared === true}`,
        itemPoints: outcome.points,
        applicationKey,
      });
    },
  });
}

