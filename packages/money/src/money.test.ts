import { describe, expect, it } from "vitest";

import { Points, ROUNDING_MODES, ScaledDecimal, Yen, type RoundOptions } from "./index.js";

describe("ScaledDecimal", () => {
  it("constructs from decimal strings without using floating point", () => {
    expect(ScaledDecimal.fromString("00123.4500").toString()).toBe("123.45");
    expect(ScaledDecimal.fromString("-.5").toString()).toBe("-0.5");
    expect(ScaledDecimal.fromString("0.00000000000000000001").toString()).toBe(
      "0.00000000000000000001",
    );
  });

  it("rejects non-decimal and floating constructor inputs", () => {
    expect(() => ScaledDecimal.fromString("1e-3")).toThrow(RangeError);
    expect(() => ScaledDecimal.fromString("1.2.3")).toThrow(RangeError);
    expect(() => ScaledDecimal.fromInteger(1.1)).toThrow(RangeError);
    expect(() => ScaledDecimal.fromCoefficient(1, 1.5)).toThrow(RangeError);
  });

  it("adds and subtracts values by aligning scales exactly", () => {
    const left = ScaledDecimal.fromString("999999999999999999999999.99");
    const right = ScaledDecimal.fromString("0.01");

    expect(left.add(right).toString()).toBe("1000000000000000000000000");
    expect(left.subtract(right).toString()).toBe("999999999999999999999999.98");
  });

  it("multiplies arbitrary precision values without IEEE-754 precision loss", () => {
    const result = ScaledDecimal.fromString("12345678901234567890.12345").multiply(
      ScaledDecimal.fromString("10000000000000000000"),
    );

    expect(result.toString()).toBe("123456789012345678901234500000000000000");
  });

  it("compares numerically equivalent values across different scales", () => {
    expect(ScaledDecimal.fromString("1.2300").compare(ScaledDecimal.fromString("1.23"))).toBe(0);
    expect(ScaledDecimal.fromString("-1.24").compare(ScaledDecimal.fromString("-1.23"))).toBe(-1);
    expect(ScaledDecimal.fromString("10").compare(ScaledDecimal.fromString("9.999"))).toBe(1);
  });

  it("rounds only with explicit caller-provided scale and mode", () => {
    const value = ScaledDecimal.fromString("12.345");

    expect(ROUNDING_MODES).toEqual([
      "toward_zero",
      "away_from_zero",
      "half_up",
      "half_down",
      "half_even",
      "floor",
      "ceiling",
    ]);
    expect(value.round({ scale: 2, mode: "toward_zero" }).toString()).toBe("12.34");
    expect(value.round({ scale: 2, mode: "away_from_zero" }).toString()).toBe("12.35");
    expect(value.round({ scale: 2, mode: "half_up" }).toString()).toBe("12.35");
    expect(value.round({ scale: 2, mode: "half_down" }).toString()).toBe("12.34");
    expect(ScaledDecimal.fromString("12.355").round({ scale: 2, mode: "half_even" }).toString()).toBe(
      "12.36",
    );
    expect(ScaledDecimal.fromString("12.345").round({ scale: 2, mode: "half_even" }).toString()).toBe(
      "12.34",
    );
  });

  it("rejects unregistered or missing rounding modes", () => {
    const value = ScaledDecimal.fromString("12.345");

    expect(() => value.round({ scale: 2, mode: "invalid_mode" as RoundOptions["mode"] })).toThrow(
      /mode/,
    );
    expect(() => value.round({ scale: 2 } as unknown as RoundOptions)).toThrow(/mode/);
  });

  it("rounds negative values consistently for floor and ceiling", () => {
    const negative = ScaledDecimal.fromString("-12.341");

    expect(negative.round({ scale: 2, mode: "floor" }).toString()).toBe("-12.35");
    expect(negative.round({ scale: 2, mode: "ceiling" }).toString()).toBe("-12.34");
    expect(negative.round({ scale: 2, mode: "away_from_zero" }).toString()).toBe("-12.35");
    expect(ScaledDecimal.fromString("-0.001").round({ scale: 2, mode: "floor" }).toString()).toBe(
      "-0.01",
    );
    expect(ScaledDecimal.fromString("-0.001").round({ scale: 2, mode: "ceiling" }).toString()).toBe("0");
  });
});

describe("Yen", () => {
  it("represents integer yen only", () => {
    expect(Yen.fromInteger("1000000000000000000000000000000").toString()).toBe(
      "1000000000000000000000000000000",
    );
    expect(Yen.fromInteger(100).add(Yen.fromInteger(23)).toString()).toBe("123");
    expect(Yen.fromInteger(100).subtract(Yen.fromInteger(23)).toString()).toBe("77");
    expect(Yen.fromInteger(100).compare(Yen.fromInteger(99))).toBe(1);
    expect(Yen.fromInteger(100).toScaledDecimal().toString()).toBe("100");
  });

  it("rejects fractional yen", () => {
    expect(() => Yen.fromInteger(1.5)).toThrow(RangeError);
    expect(() => Yen.fromInteger("1.5")).toThrow(RangeError);
  });
});

describe("Points", () => {
  it("represents integer reimbursement points only", () => {
    expect(Points.fromInteger("900719925474099312345").add(Points.fromInteger(5n)).toString()).toBe(
      "900719925474099312350",
    );
    expect(Points.fromInteger(20).subtract(Points.fromInteger(5)).toString()).toBe("15");
    expect(Points.fromInteger(20).compare(Points.fromInteger(20))).toBe(0);
    expect(Points.fromInteger(20).toScaledDecimal().toString()).toBe("20");
  });

  it("rejects fractional points", () => {
    expect(() => Points.fromInteger(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => Points.fromInteger("10.0")).toThrow(RangeError);
  });
});
