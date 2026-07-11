import { Points, ScaledDecimal } from "@yrese/money";

/**
 * 点数計算式の純関数群(CAL-004 v0.3.0 §2 で解禁されたセマンティクス)。
 *
 * 規律:
 * - IEEE-754 を使わない(MOD-010 §1)。すべて bigint / ScaledDecimal。
 * - 丸めは公式根拠がある場合のみ(MOD-010 §1-4)。乗率で端数が出る入力は
 *   丸め evidence 発行まで「丸め根拠未発行」として呼び出し側が BLOCKED にする。
 * - 減算を負の項目として合算しない(CAL-004 §2)。合成計算内で差し引き、
 *   下限クランプが無い限り負は許さない。
 * - 数量(日数等)は算定要件未検証の入力として呼び出し側が指定する(CAL-004 §5)。
 */

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

const zeroPoints = Points.fromInteger(0);

/** 乗率(「所定点数の100分のX」)。 */
export interface PointsRatio {
  readonly numerator: number;
  readonly denominator: number;
}

export type MultiplierOutcome =
  | { readonly kind: "exact"; readonly points: Points }
  | {
      /** 乗算結果が整数点にならない。丸め evidence 未発行のため呼び出し側が BLOCKED にする。 */
      readonly kind: "requires_rounding_evidence";
      /** 正確な値の分数表現(trace 用)。例: "3760/100"。 */
      readonly exactFraction: string;
    };

/**
 * 乗率適用(EVD-CAL-0007「100分の80」/ EVD-CAL-0008「100分の50」/ EVD-CAL-0068「100分の90」等)。
 * 整数点にならない場合は丸めを行わず requires_rounding_evidence を返す(MOD-010 §1-4)。
 */
export function applyPointsMultiplier(base: Points, ratio: PointsRatio): MultiplierOutcome {
  assertPositiveSafeInteger(ratio.numerator, "ratio.numerator");
  assertPositiveSafeInteger(ratio.denominator, "ratio.denominator");
  if (base.compare(zeroPoints) < 0) {
    throw new RangeError("base points must not be negative");
  }

  const product = base.value * BigInt(ratio.numerator);
  const denominator = BigInt(ratio.denominator);
  if (product % denominator === 0n) {
    return { kind: "exact", points: Points.fromInteger(product / denominator) };
  }
  return { kind: "requires_rounding_evidence", exactFraction: `${product}/${denominator}` };
}

/** 湯薬の薬剤調製料(区分01)で適用された区分の evidence_id。 */
export type DecoctionEvidenceId = "EVD-CAL-0024" | "EVD-CAL-0025" | "EVD-CAL-0026";

export interface DecoctionFee {
  readonly points: Points;
  readonly appliedEvidenceId: DecoctionEvidenceId;
}

/**
 * 湯薬の薬剤調製料(数量段階型)。
 * - 7日分以下: 190点(EVD-CAL-0024)
 * - 8〜28日分: 7日以下部分190点+8日目以上1日につき10点(EVD-CAL-0025)
 * - 29日分以上: 400点(EVD-CAL-0026)
 * 日数は算定要件未検証の入力(呼び出し側指定)。
 */
export function decoctionPreparationFeePoints(daysSupply: number): DecoctionFee {
  assertPositiveSafeInteger(daysSupply, "daysSupply");
  if (daysSupply <= 7) {
    return { points: Points.fromInteger(190), appliedEvidenceId: "EVD-CAL-0024" };
  }
  if (daysSupply <= 28) {
    return {
      points: Points.fromInteger(190 + (daysSupply - 7) * 10),
      appliedEvidenceId: "EVD-CAL-0025",
    };
  }
  return { points: Points.fromInteger(400), appliedEvidenceId: "EVD-CAL-0026" };
}

/** EVD-CAL-0067 caveat(端数処理の細部は留意事項通知・薬価基準で確定)に対応する必須警告。 */
export const drugFeeProvisionalRoundingWarning =
  "使用薬剤料の端数処理は暫定実装(EVD-CAL-0067 caveat — 留意事項通知・薬価基準で確定)";

/**
 * 使用薬剤料の薬価→点数変換(EVD-CAL-0067)。
 * 「薬価が所定単位につき15円以下→1点。15円超→10円又はその端数を増すごとに1点を加算」
 * = 15円以下は1点、15円超は 1点+⌈(薬価−15円)/10円⌉。
 * 例: 16円→2点 / 25円→2点 / 25.10円→3点 / 35円→3点。
 * 呼び出し側は結果に drugFeeProvisionalRoundingWarning を必ず付与する(CAL-004 §2)。
 */
export function drugPriceToPoints(priceYen: ScaledDecimal): Points {
  const zero = ScaledDecimal.fromInteger(0);
  if (priceYen.compare(zero) <= 0) {
    throw new RangeError("priceYen must be positive");
  }
  const fifteen = ScaledDecimal.fromInteger(15);
  if (priceYen.compare(fifteen) <= 0) {
    return Points.fromInteger(1);
  }
  const excess = priceYen.subtract(fifteen);
  // ⌈excess / 10円⌉ を bigint で計算(excess.coefficient / (10 * 10^scale) の ceiling)
  const divisor = 10n * 10n ** BigInt(excess.scale);
  const steps = (excess.coefficient + divisor - 1n) / divisor;
  return Points.fromInteger(1n + steps);
}

/** EVD-CAL-0069 caveat(材料価格基準の版管理が別途必要)に対応する必須警告。 */
export const materialFeeProvisionalWarning =
  "特定保険医療材料料は暫定実装(EVD-CAL-0069 caveat — 材料価格基準の版管理が別途必要)";

export type MaterialFeeOutcome =
  | { readonly kind: "exact"; readonly points: Points }
  | { readonly kind: "requires_rounding_evidence"; readonly exactFraction: string };

/**
 * 特定保険医療材料料の材料価格→点数変換(EVD-CAL-0069)。
 * 「材料価格を10円で除して得た点数」。丸め evidence 未発行のため、
 * 10円で割り切れない場合は丸めを行わず requires_rounding_evidence を返す(MOD-010 §1-4)。
 * 呼び出し側は結果に materialFeeProvisionalWarning を必ず付与する(CAL-004 §2)。
 */
export function materialPriceToPoints(priceYen: ScaledDecimal): MaterialFeeOutcome {
  const zero = ScaledDecimal.fromInteger(0);
  if (priceYen.compare(zero) <= 0) {
    throw new RangeError("priceYen must be positive");
  }
  const divisor = 10n * 10n ** BigInt(priceYen.scale);
  if (priceYen.coefficient % divisor === 0n) {
    return { kind: "exact", points: Points.fromInteger(priceYen.coefficient / divisor) };
  }
  return {
    kind: "requires_rounding_evidence",
    exactFraction: `${priceYen.coefficient}/${divisor}`,
  };
}

/** 「7日又はその端数を増すごとに」の単位数(⌈days/7⌉)。 */
export function perSevenDayUnits(daysSupply: number): number {
  assertPositiveSafeInteger(daysSupply, "daysSupply");
  return Math.ceil(daysSupply / 7);
}

/** 一包化(外来服薬支援料2)で適用された区分の evidence_id。 */
export type OnePackagingEvidenceId = "EVD-CAL-0055" | "EVD-CAL-0056";

export interface OnePackagingSupportFee {
  readonly points: Points;
  readonly appliedEvidenceId: OnePackagingEvidenceId;
}

/**
 * 一包化: 外来服薬支援料2(数量段階型)。
 * - 42日分以下: 7日ごとに34点加算(EVD-CAL-0055)= 34×⌈日数/7⌉
 * - 43日分以上: 240点(EVD-CAL-0056)
 * 日数は算定要件未検証の入力(呼び出し側指定)。
 */
export function onePackagingSupportFeePoints(daysSupply: number): OnePackagingSupportFee {
  assertPositiveSafeInteger(daysSupply, "daysSupply");
  if (daysSupply <= 42) {
    return {
      points: Points.fromInteger(34 * perSevenDayUnits(daysSupply)),
      appliedEvidenceId: "EVD-CAL-0055",
    };
  }
  return { points: Points.fromInteger(240), appliedEvidenceId: "EVD-CAL-0056" };
}

/**
 * 自家製剤加算(EVD-CAL-0033)の種別。
 * 粉砕(錠剤を砕いて散剤化等)は oral_tablet_like(内服薬(1)錠剤等・7日ごと20点)。
 */
export const SELF_PREPARATION_KINDS = [
  /** 内服薬・屯服薬 (1) 錠剤等: 20点(7日ごと)— 粉砕はここ。 */
  "oral_tablet_like",
  /** 内服薬・屯服薬 (2) 屯服: 90点。 */
  "tonpuku",
  /** 内服薬・屯服薬 (3) 液剤: 45点。 */
  "oral_liquid",
  /** 外用薬 (1) 錠剤・トローチ・軟膏等: 90点。 */
  "external_tablet_ointment",
  /** 外用薬 (2) 点眼・点鼻・点耳・浣腸: 75点。 */
  "eye_nose_ear_enema",
  /** 外用薬 (3) 液剤: 45点。 */
  "external_liquid",
] as const;
export type SelfPreparationKind = (typeof SELF_PREPARATION_KINDS)[number];

export interface SelfPreparationInput {
  readonly kind: SelfPreparationKind;
  /** oral_tablet_like(7日ごと)のみ必須。他種別では指定不可。 */
  readonly daysSupply?: number;
  /** 予製剤・錠剤分割は所定点数の100分の20(EVD-CAL-0033 括弧書き)。 */
  readonly prePrepared?: boolean;
}

/** 予製剤乗率(100分の20)。基礎点数(20/45/75/90/35/80)はすべて5の倍数のため常に整数点。 */
const prePreparedRatio: PointsRatio = { numerator: 20, denominator: 100 };

/**
 * 自家製剤加算(EVD-CAL-0033)。粉砕は kind="oral_tablet_like"(20点×⌈日数/7⌉)。
 * 予製剤・錠剤分割は所定点数の100分の20(乗率は整数点になる構造だが、
 * 端数が出る宣言に対しては MultiplierOutcome の規律に従い呼び出し側が BLOCKED にする)。
 */
export function selfPreparationAdditionPoints(input: SelfPreparationInput): MultiplierOutcome {
  let base: Points;
  switch (input.kind) {
    case "oral_tablet_like": {
      if (input.daysSupply === undefined) {
        throw new RangeError("daysSupply is required for oral_tablet_like (7日ごと)");
      }
      base = Points.fromInteger(20 * perSevenDayUnits(input.daysSupply));
      break;
    }
    case "tonpuku":
      base = Points.fromInteger(90);
      break;
    case "oral_liquid":
      base = Points.fromInteger(45);
      break;
    case "external_tablet_ointment":
      base = Points.fromInteger(90);
      break;
    case "eye_nose_ear_enema":
      base = Points.fromInteger(75);
      break;
    case "external_liquid":
      base = Points.fromInteger(45);
      break;
  }
  if (input.kind !== "oral_tablet_like" && input.daysSupply !== undefined) {
    throw new RangeError("daysSupply is only applicable to oral_tablet_like");
  }
  if (input.prePrepared === true) {
    return applyPointsMultiplier(base, prePreparedRatio);
  }
  return { kind: "exact", points: base };
}

/** 計量混合調剤加算(EVD-CAL-0034)の剤形。 */
export const WEIGHING_MIXING_KINDS = ["liquid", "powder_granule", "ointment"] as const;
export type WeighingMixingKind = (typeof WEIGHING_MIXING_KINDS)[number];

const weighingMixingBasePoints: Readonly<Record<WeighingMixingKind, number>> = {
  liquid: 35,
  powder_granule: 45,
  ointment: 80,
};

/**
 * 計量混合調剤加算(EVD-CAL-0034): 液剤35点 / 散剤・顆粒剤45点 / 軟・硬膏剤80点。
 * 予製剤は所定点数の100分の20。
 */
export function weighingMixingAdditionPoints(
  kind: WeighingMixingKind,
  prePrepared = false,
): MultiplierOutcome {
  const base = Points.fromInteger(weighingMixingBasePoints[kind]);
  if (prePrepared) {
    return applyPointsMultiplier(base, prePreparedRatio);
  }
  return { kind: "exact", points: base };
}

/** 合成適用順(乗率→減算→下限)が暫定であることの必須警告(CAL-004 §2)。 */
export const basicFeeCompositionOrderWarning =
  "調剤基本料の乗率・減算・下限の適用順は暫定(乗率→減算→下限 — 留意事項通知精読後に確定)";

export interface DispensingBasicFeeComposition {
  /** 基礎点数(区分00 のいずれか。区分選択は施設基準=P-05 前提のため呼び出し側指定)。 */
  readonly basePoints: Points;
  /** 注3(EVD-CAL-0007)等の乗率。未指定=適用なし。 */
  readonly multiplier?: PointsRatio;
  /** 注8(EVD-CAL-0012 ▲5)/注15(EVD-CAL-0019 ▲15)等の減算(正の点数で指定)。 */
  readonly reductions?: readonly Points[];
  /** 注16(EVD-CAL-0020)の下限。調剤基本料では 3点。 */
  readonly minimumPoints?: Points;
}

export type DispensingBasicFeeOutcome =
  | { readonly kind: "calculated"; readonly points: Points; readonly clampedToMinimum: boolean }
  | { readonly kind: "requires_rounding_evidence"; readonly exactFraction: string }
  | {
      /** 減算後が負になり、下限クランプも宣言されていない(定義不備)。 */
      readonly kind: "negative_without_minimum";
    };

/**
 * 調剤基本料の合成計算(区分00: 基礎点数 → 乗率 → 減算 → 下限クランプ)。
 * 適用順は暫定(basicFeeCompositionOrderWarning を必ず付与)。
 * 乗率で端数が出る場合は丸め evidence 未発行のため requires_rounding_evidence。
 */
export function composeDispensingBasicFeePoints(
  input: DispensingBasicFeeComposition,
): DispensingBasicFeeOutcome {
  if (input.basePoints.compare(zeroPoints) < 0) {
    throw new RangeError("basePoints must not be negative");
  }

  let value = input.basePoints;

  if (input.multiplier !== undefined) {
    const multiplied = applyPointsMultiplier(value, input.multiplier);
    if (multiplied.kind === "requires_rounding_evidence") {
      return multiplied;
    }
    value = multiplied.points;
  }

  for (const reduction of input.reductions ?? []) {
    if (reduction.compare(zeroPoints) < 0) {
      throw new RangeError("reductions must be non-negative points");
    }
    value = value.subtract(reduction);
  }

  if (input.minimumPoints !== undefined && value.compare(input.minimumPoints) < 0) {
    return { kind: "calculated", points: input.minimumPoints, clampedToMinimum: true };
  }

  if (value.compare(zeroPoints) < 0) {
    return { kind: "negative_without_minimum" };
  }

  return { kind: "calculated", points: value, clampedToMinimum: false };
}
