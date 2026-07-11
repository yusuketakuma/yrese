/**
 * 原本再照合まで暫定(CAL-004 §6)。期待値は CAL-003 evidence 値のみから作成。
 */
import { describe, expect, it } from "vitest";
import { Points, ScaledDecimal } from "@yrese/money";

import {
  applyPointsMultiplier,
  composeDispensingBasicFeePoints,
  decoctionPreparationFeePoints,
  drugPriceToPoints,
  materialPriceToPoints,
  onePackagingSupportFeePoints,
  perSevenDayUnits,
  selfPreparationAdditionPoints,
  weighingMixingAdditionPoints,
} from "./formulas.js";

describe("applyPointsMultiplier (EVD-CAL-0007 100分の80 等)", () => {
  it("returns exact points when the product divides evenly (30×80/100=24)", () => {
    const outcome = applyPointsMultiplier(Points.fromInteger(30), { numerator: 80, denominator: 100 });
    expect(outcome).toEqual({ kind: "exact", points: Points.fromInteger(24) });
  });

  it("requires rounding evidence for fractional results instead of rounding (47×80/100)", () => {
    const outcome = applyPointsMultiplier(Points.fromInteger(47), { numerator: 80, denominator: 100 });
    expect(outcome).toEqual({ kind: "requires_rounding_evidence", exactFraction: "3760/100" });
  });

  it("rejects negative base points and non-positive ratios", () => {
    expect(() =>
      applyPointsMultiplier(Points.fromInteger(-1), { numerator: 80, denominator: 100 }),
    ).toThrow(/negative/);
    expect(() =>
      applyPointsMultiplier(Points.fromInteger(10), { numerator: 0, denominator: 100 }),
    ).toThrow(/numerator/);
  });
});

describe("decoctionPreparationFeePoints (EVD-CAL-0024/0025/0026 湯薬)", () => {
  it("EVD-CAL-0024: 7 days or less is 190 points", () => {
    expect(decoctionPreparationFeePoints(1)).toEqual({
      points: Points.fromInteger(190),
      appliedEvidenceId: "EVD-CAL-0024",
    });
    expect(decoctionPreparationFeePoints(7).points.toString()).toBe("190");
  });

  it("EVD-CAL-0025: 8-28 days adds 10 points per day beyond 7 (8日=200 / 15日=270 / 28日=400)", () => {
    expect(decoctionPreparationFeePoints(8)).toEqual({
      points: Points.fromInteger(200),
      appliedEvidenceId: "EVD-CAL-0025",
    });
    expect(decoctionPreparationFeePoints(15).points.toString()).toBe("270");
    expect(decoctionPreparationFeePoints(28).points.toString()).toBe("400");
  });

  it("EVD-CAL-0026: 29 days or more is 400 points", () => {
    expect(decoctionPreparationFeePoints(29)).toEqual({
      points: Points.fromInteger(400),
      appliedEvidenceId: "EVD-CAL-0026",
    });
    expect(decoctionPreparationFeePoints(90).points.toString()).toBe("400");
  });

  it("rejects non-positive day counts", () => {
    expect(() => decoctionPreparationFeePoints(0)).toThrow(/daysSupply/);
  });
});

describe("drugPriceToPoints (EVD-CAL-0067 使用薬剤料)", () => {
  it("15円以下は1点", () => {
    expect(drugPriceToPoints(ScaledDecimal.fromString("0.10")).toString()).toBe("1");
    expect(drugPriceToPoints(ScaledDecimal.fromInteger(15)).toString()).toBe("1");
  });

  it("15円超は10円又はその端数を増すごとに1点を加算 (16円=2 / 25円=2 / 25.10円=3 / 35円=3)", () => {
    expect(drugPriceToPoints(ScaledDecimal.fromInteger(16)).toString()).toBe("2");
    expect(drugPriceToPoints(ScaledDecimal.fromInteger(25)).toString()).toBe("2");
    expect(drugPriceToPoints(ScaledDecimal.fromString("25.10")).toString()).toBe("3");
    expect(drugPriceToPoints(ScaledDecimal.fromInteger(35)).toString()).toBe("3");
  });

  it("小数薬価でも bigint 演算で決定的 (505.40円 = 1+⌈490.40/10⌉ = 51点)", () => {
    expect(drugPriceToPoints(ScaledDecimal.fromString("505.40")).toString()).toBe("51");
  });

  it("rejects non-positive prices", () => {
    expect(() => drugPriceToPoints(ScaledDecimal.fromInteger(0))).toThrow(/positive/);
  });
});

describe("composeDispensingBasicFeePoints (区分00 合成: 乗率→減算→下限)", () => {
  it("passes through the base when no notes apply (EVD-CAL-0001: 47点)", () => {
    expect(
      composeDispensingBasicFeePoints({ basePoints: Points.fromInteger(47) }),
    ).toEqual({ kind: "calculated", points: Points.fromInteger(47), clampedToMinimum: false });
  });

  it("applies reductions after the multiplier (30×80/100−5=19)", () => {
    expect(
      composeDispensingBasicFeePoints({
        basePoints: Points.fromInteger(30),
        multiplier: { numerator: 80, denominator: 100 },
        reductions: [Points.fromInteger(5)],
      }),
    ).toEqual({ kind: "calculated", points: Points.fromInteger(19), clampedToMinimum: false });
  });

  it("clamps to the minimum when reductions undercut it (EVD-CAL-0020: 5−5=0→3点)", () => {
    expect(
      composeDispensingBasicFeePoints({
        basePoints: Points.fromInteger(5),
        reductions: [Points.fromInteger(5)],
        minimumPoints: Points.fromInteger(3),
      }),
    ).toEqual({ kind: "calculated", points: Points.fromInteger(3), clampedToMinimum: true });
  });

  it("surfaces fractional multiplier results as requires_rounding_evidence (47×80/100)", () => {
    expect(
      composeDispensingBasicFeePoints({
        basePoints: Points.fromInteger(47),
        multiplier: { numerator: 80, denominator: 100 },
        minimumPoints: Points.fromInteger(3),
      }),
    ).toEqual({ kind: "requires_rounding_evidence", exactFraction: "3760/100" });
  });

  it("reports negative results when no minimum is declared (定義不備の防御)", () => {
    expect(
      composeDispensingBasicFeePoints({
        basePoints: Points.fromInteger(5),
        reductions: [Points.fromInteger(15)],
      }),
    ).toEqual({ kind: "negative_without_minimum" });
  });
});

describe("materialPriceToPoints (EVD-CAL-0069 特定保険医療材料料 = 材料価格÷10)", () => {
  it("10円で割り切れる場合は整数点 (100円=10 / 220円=22)", () => {
    expect(materialPriceToPoints(ScaledDecimal.fromInteger(100))).toEqual({
      kind: "exact",
      points: Points.fromInteger(10),
    });
    expect(materialPriceToPoints(ScaledDecimal.fromString("220.00"))).toEqual({
      kind: "exact",
      points: Points.fromInteger(22),
    });
  });

  it("10円で割り切れない場合は丸めず requires_rounding_evidence (105円=1050/100)", () => {
    expect(materialPriceToPoints(ScaledDecimal.fromInteger(105))).toEqual({
      kind: "requires_rounding_evidence",
      exactFraction: "105/10",
    });
    expect(materialPriceToPoints(ScaledDecimal.fromString("105.5"))).toEqual({
      kind: "requires_rounding_evidence",
      exactFraction: "1055/100",
    });
  });

  it("rejects non-positive prices", () => {
    expect(() => materialPriceToPoints(ScaledDecimal.fromInteger(0))).toThrow(/positive/);
  });
});

describe("perSevenDayUnits (「7日又はその端数を増すごとに」= ⌈days/7⌉)", () => {
  it("counts each started 7-day block (1→1 / 7→1 / 8→2 / 42→6)", () => {
    expect(perSevenDayUnits(1)).toBe(1);
    expect(perSevenDayUnits(7)).toBe(1);
    expect(perSevenDayUnits(8)).toBe(2);
    expect(perSevenDayUnits(42)).toBe(6);
  });

  it("rejects non-positive day counts", () => {
    expect(() => perSevenDayUnits(0)).toThrow(/daysSupply/);
  });
});

describe("onePackagingSupportFeePoints (一包化 = 外来服薬支援料2 EVD-CAL-0055/0056)", () => {
  it("EVD-CAL-0055: 42日以下は7日ごと34点 (7日=34 / 8日=68 / 42日=204)", () => {
    expect(onePackagingSupportFeePoints(7)).toEqual({
      points: Points.fromInteger(34),
      appliedEvidenceId: "EVD-CAL-0055",
    });
    expect(onePackagingSupportFeePoints(8).points.toString()).toBe("68");
    expect(onePackagingSupportFeePoints(42).points.toString()).toBe("204");
  });

  it("EVD-CAL-0056: 43日以上は240点 (43日=240 / 90日=240)", () => {
    expect(onePackagingSupportFeePoints(43)).toEqual({
      points: Points.fromInteger(240),
      appliedEvidenceId: "EVD-CAL-0056",
    });
    expect(onePackagingSupportFeePoints(90).points.toString()).toBe("240");
  });

  it("rejects non-positive day counts", () => {
    expect(() => onePackagingSupportFeePoints(0)).toThrow(/daysSupply/);
  });
});

describe("selfPreparationAdditionPoints (自家製剤加算 EVD-CAL-0033)", () => {
  it("粉砕 = oral_tablet_like: 20点×⌈日数/7⌉ (7日=20 / 14日=40)", () => {
    expect(selfPreparationAdditionPoints({ kind: "oral_tablet_like", daysSupply: 7 })).toEqual({
      kind: "exact",
      points: Points.fromInteger(20),
    });
    expect(
      selfPreparationAdditionPoints({ kind: "oral_tablet_like", daysSupply: 14 }),
    ).toEqual({ kind: "exact", points: Points.fromInteger(40) });
  });

  it("固定点数種別 (屯服90 / 内服液剤45 / 外用錠剤軟膏90 / 点眼等75 / 外用液剤45)", () => {
    expect(selfPreparationAdditionPoints({ kind: "tonpuku" })).toEqual({
      kind: "exact",
      points: Points.fromInteger(90),
    });
    expect(selfPreparationAdditionPoints({ kind: "oral_liquid" })).toEqual({
      kind: "exact",
      points: Points.fromInteger(45),
    });
    expect(selfPreparationAdditionPoints({ kind: "external_tablet_ointment" })).toEqual({
      kind: "exact",
      points: Points.fromInteger(90),
    });
    expect(selfPreparationAdditionPoints({ kind: "eye_nose_ear_enema" })).toEqual({
      kind: "exact",
      points: Points.fromInteger(75),
    });
    expect(selfPreparationAdditionPoints({ kind: "external_liquid" })).toEqual({
      kind: "exact",
      points: Points.fromInteger(45),
    });
  });

  it("予製剤は所定点数の100分の20 (屯服90×20/100=18)", () => {
    expect(selfPreparationAdditionPoints({ kind: "tonpuku", prePrepared: true })).toEqual({
      kind: "exact",
      points: Points.fromInteger(18),
    });
  });

  it("oral_tablet_like は daysSupply 必須、他種別では指定不可", () => {
    expect(() => selfPreparationAdditionPoints({ kind: "oral_tablet_like" })).toThrow(/daysSupply/);
    expect(() =>
      selfPreparationAdditionPoints({ kind: "tonpuku", daysSupply: 7 }),
    ).toThrow(/daysSupply/);
  });
});

describe("weighingMixingAdditionPoints (計量混合調剤加算 EVD-CAL-0034)", () => {
  it("剤形ごとの基礎点数 (液剤35 / 散剤顆粒45 / 軟硬膏80)", () => {
    expect(weighingMixingAdditionPoints("liquid")).toEqual({
      kind: "exact",
      points: Points.fromInteger(35),
    });
    expect(weighingMixingAdditionPoints("powder_granule")).toEqual({
      kind: "exact",
      points: Points.fromInteger(45),
    });
    expect(weighingMixingAdditionPoints("ointment")).toEqual({
      kind: "exact",
      points: Points.fromInteger(80),
    });
  });

  it("予製剤は所定点数の100分の20 (軟硬膏80×20/100=16)", () => {
    expect(weighingMixingAdditionPoints("ointment", true)).toEqual({
      kind: "exact",
      points: Points.fromInteger(16),
    });
  });
});
