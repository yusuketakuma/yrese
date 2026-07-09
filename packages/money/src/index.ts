/**
 * @yrese/money
 *
 * 金額/点数の計算では IEEE-754 floating point を使わない。
 * ScaledDecimal は bigint coefficient + scale の値オブジェクトとして実装する。
 *
 * RoundingMode と round() は API surface のみを提供する。端数処理ルール
 * (一部負担金などの scale/mode の政策値) はこの package に hardcode しない。
 * 政策値を配線する場合は、公式根拠の evidence_id を確認し、
 * BLOCKED_REGULATORY_REVIEW が解消されていることを呼び出し側で保証する。
 */

export const ROUNDING_MODES = [
  "toward_zero",
  "away_from_zero",
  "half_up",
  "half_down",
  "half_even",
  "floor",
  "ceiling",
] as const;

export type RoundingMode = (typeof ROUNDING_MODES)[number];

export interface RoundOptions {
  readonly scale: number;
  readonly mode: RoundingMode;
}

export type IntegerInput = bigint | number | string;

const integerPattern = /^[+-]?\d+$/;
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function assertRoundingMode(value: unknown): asserts value is RoundingMode {
  if (typeof value !== "string" || !(ROUNDING_MODES as readonly string[]).includes(value)) {
    throw new RangeError(`mode must be one of: ${ROUNDING_MODES.join(", ")}`);
  }
}

function assertSafeScale(scale: number): void {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    throw new RangeError("scale must be a non-negative safe integer");
  }
}

function parseIntegerInput(value: IntegerInput, label: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${label} must be a safe integer number`);
    }
    return BigInt(value);
  }

  const trimmed = value.trim();
  if (!integerPattern.test(trimmed)) {
    throw new RangeError(`${label} must be an integer string`);
  }
  return BigInt(trimmed);
}

function pow10(exponent: number): bigint {
  assertSafeScale(exponent);
  return 10n ** BigInt(exponent);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function alignCoefficients(
  leftCoefficient: bigint,
  leftScale: number,
  rightCoefficient: bigint,
  rightScale: number,
): readonly [bigint, bigint, number] {
  if (leftScale === rightScale) {
    return [leftCoefficient, rightCoefficient, leftScale];
  }

  if (leftScale > rightScale) {
    return [leftCoefficient, rightCoefficient * pow10(leftScale - rightScale), leftScale];
  }

  return [leftCoefficient * pow10(rightScale - leftScale), rightCoefficient, rightScale];
}

function normalizeDecimal(coefficient: bigint, scale: number): readonly [bigint, number] {
  let nextCoefficient = coefficient;
  let nextScale = scale;

  while (nextScale > 0 && nextCoefficient % 10n === 0n) {
    nextCoefficient /= 10n;
    nextScale -= 1;
  }

  return [nextCoefficient, nextScale];
}

function shouldIncrementForRounding(
  quotient: bigint,
  remainder: bigint,
  divisor: bigint,
  mode: RoundingMode,
): boolean {
  if (remainder === 0n) {
    return false;
  }

  const isNegative = quotient < 0n || remainder < 0n;
  const absoluteRemainder = abs(remainder);
  const twiceRemainder = absoluteRemainder * 2n;

  switch (mode) {
    case "toward_zero":
      return false;
    case "away_from_zero":
      return true;
    case "floor":
      return isNegative;
    case "ceiling":
      return !isNegative;
    case "half_up":
      return twiceRemainder >= divisor;
    case "half_down":
      return twiceRemainder > divisor;
    case "half_even":
      return twiceRemainder > divisor || (twiceRemainder === divisor && abs(quotient) % 2n === 1n);
  }
}

export class ScaledDecimal {
  private constructor(
    readonly coefficient: bigint,
    readonly scale: number,
  ) {
    assertSafeScale(scale);
  }

  static fromCoefficient(coefficient: IntegerInput, scale: number): ScaledDecimal {
    return new ScaledDecimal(parseIntegerInput(coefficient, "coefficient"), scale).normalize();
  }

  static fromInteger(value: IntegerInput): ScaledDecimal {
    return new ScaledDecimal(parseIntegerInput(value, "value"), 0);
  }

  static fromString(value: string): ScaledDecimal {
    const trimmed = value.trim();
    if (!decimalPattern.test(trimmed)) {
      throw new RangeError("decimal string must be a base-10 decimal literal");
    }

    const isNegative = trimmed.startsWith("-");
    const unsigned = trimmed.replace(/^[+-]/, "");
    const [wholePart = "", fractionPart = ""] = unsigned.split(".");
    const digits = `${wholePart}${fractionPart}`.replace(/^0+(?=\d)/, "");
    const coefficient = BigInt(digits.length === 0 ? "0" : digits) * (isNegative ? -1n : 1n);

    return new ScaledDecimal(coefficient, fractionPart.length).normalize();
  }

  add(other: ScaledDecimal): ScaledDecimal {
    const [left, right, scale] = alignCoefficients(
      this.coefficient,
      this.scale,
      other.coefficient,
      other.scale,
    );
    return new ScaledDecimal(left + right, scale).normalize();
  }

  subtract(other: ScaledDecimal): ScaledDecimal {
    const [left, right, scale] = alignCoefficients(
      this.coefficient,
      this.scale,
      other.coefficient,
      other.scale,
    );
    return new ScaledDecimal(left - right, scale).normalize();
  }

  multiply(other: ScaledDecimal): ScaledDecimal {
    return new ScaledDecimal(this.coefficient * other.coefficient, this.scale + other.scale).normalize();
  }

  compare(other: ScaledDecimal): -1 | 0 | 1 {
    const [left, right] = alignCoefficients(this.coefficient, this.scale, other.coefficient, other.scale);
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
    return 0;
  }

  round(options: RoundOptions): ScaledDecimal {
    assertSafeScale(options.scale);
    assertRoundingMode(options.mode);

    if (options.scale >= this.scale) {
      return new ScaledDecimal(this.coefficient * pow10(options.scale - this.scale), options.scale);
    }

    const divisor = pow10(this.scale - options.scale);
    const quotient = this.coefficient / divisor;
    const remainder = this.coefficient % divisor;

    if (!shouldIncrementForRounding(quotient, remainder, divisor, options.mode)) {
      return new ScaledDecimal(quotient, options.scale).normalize();
    }

    const direction = this.coefficient < 0n ? -1n : 1n;
    return new ScaledDecimal(quotient + direction, options.scale).normalize();
  }

  equals(other: ScaledDecimal): boolean {
    return this.compare(other) === 0;
  }

  toString(): string {
    if (this.scale === 0) {
      return this.coefficient.toString();
    }

    const sign = this.coefficient < 0n ? "-" : "";
    const digits = abs(this.coefficient).toString().padStart(this.scale + 1, "0");
    const whole = digits.slice(0, -this.scale);
    const fraction = digits.slice(-this.scale);

    return `${sign}${whole}.${fraction}`;
  }

  private normalize(): ScaledDecimal {
    const [coefficient, scale] = normalizeDecimal(this.coefficient, this.scale);
    return coefficient === this.coefficient && scale === this.scale
      ? this
      : new ScaledDecimal(coefficient, scale);
  }
}

export class Yen {
  private constructor(readonly amount: bigint) {}

  static fromInteger(value: IntegerInput): Yen {
    return new Yen(parseIntegerInput(value, "Yen"));
  }

  add(other: Yen): Yen {
    return new Yen(this.amount + other.amount);
  }

  subtract(other: Yen): Yen {
    return new Yen(this.amount - other.amount);
  }

  compare(other: Yen): -1 | 0 | 1 {
    if (this.amount < other.amount) {
      return -1;
    }
    if (this.amount > other.amount) {
      return 1;
    }
    return 0;
  }

  toScaledDecimal(): ScaledDecimal {
    return ScaledDecimal.fromInteger(this.amount);
  }

  toString(): string {
    return this.amount.toString();
  }
}

export class Points {
  private constructor(readonly value: bigint) {}

  static fromInteger(value: IntegerInput): Points {
    return new Points(parseIntegerInput(value, "Points"));
  }

  add(other: Points): Points {
    return new Points(this.value + other.value);
  }

  subtract(other: Points): Points {
    return new Points(this.value - other.value);
  }

  compare(other: Points): -1 | 0 | 1 {
    if (this.value < other.value) {
      return -1;
    }
    if (this.value > other.value) {
      return 1;
    }
    return 0;
  }

  toScaledDecimal(): ScaledDecimal {
    return ScaledDecimal.fromInteger(this.value);
  }

  toString(): string {
    return this.value.toString();
  }
}
