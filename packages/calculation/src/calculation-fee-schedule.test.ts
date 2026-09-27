/**
 * 原本再照合まで暫定(CAL-004 §6)。
 * Golden expectations below are derived only from CAL-003 evidence values.
 */
import { describe, expect, it } from "vitest";
import { CalendarDate, ClaimMonth, DispensingDate, PrescriptionDate, ReceptionDate } from "@yrese/date-time";
import { Points, ScaledDecimal } from "@yrese/money";
import { evidenceId } from "@yrese/shared-kernel";
import {
  dispensingId,
  patientId,
  pharmacyId,
  prescriptionId,
  tenantId,
  type BlockerType,
} from "@yrese/shared-kernel";
import type { EvidenceRef } from "@yrese/trace";

import {
  basicFeeCompositionOrderWarning,
  calculate,
  calculationRulesV20260601,
  createDecoctionPreparationFeeRule,
  createDispensingBasicFeeRule,
  createDrugFeeRule,
  createExternalPreparationFeeRule,
  createNarcoticPreparationAdditionRule,
  createOnePackagingSupportFeeRule,
  createOralDropPreparationFeeRule,
  createOralMedicinePreparationFeeRule,
  createPsychotropicEtcPreparationAdditionRule,
  createSelfPreparationAdditionRule,
  createSenzenPreparationFeeRule,
  createWeighingMixingAdditionRule,
  DISPENSING_BASIC_FEE_BASES,
  dispensingBasicFee1Rule,
  dispensingManagementFee2Rule,
  drugFeeProvisionalRoundingWarning,
  injectionPreparationFeeRule,
  invalidStepResultWarning,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
  requirementsNotVerifiedWarning,
  tonpukuPreparationFeeRule,
  type BlockedCalculationResult,
  type CalculationRequest,
  type CalculationResult,
  type CalculationRule,
  type CalculationRuleSet,
  type PointsOnlyCopayBlockedCalculationResult,
} from "./index.js";
import {
  adverseEventPreventionSamdWarning,
  biosimilarDispensingSystemAdditionRule,
  cooperationEnhancementAdditionRule,
  createAdverseEventPreventionAdditionRule,
  createDispensingManagementFee1IRule,
  createDispensingManagementFee1RoRule,
  createHomePatientEmergencyJointGuidanceRule,
  createInHomePharmacyComprehensiveSystemAddition2Rule,
  createMedicationInfoProvisionFeeRule,
  createMedicationManagementGuidanceFee4Rule,
  createMultiDrugReductionRule,
  createRegionalSupportSystemAdditionRule,
  createResidualDrugAdjustmentAdditionRule,
  createSpecificDrugManagementGuidanceAddition1Rule,
  createSpecificDrugManagementGuidanceAddition3Rule,
  createSpecificMedicalMaterialFeeRule,
  createTimeSurchargeAdditionRule,
  dischargeJointGuidanceFeeRule,
  dispensingBaseUpEvaluationFeeRule,
  dispensingPriceResponseFeeRule,
  electronicDispensingInfoCooperationAdditionRule,
  facilityCooperationAdditionRule,
  familyPharmacistFollowUpAdditionRule,
  familyPharmacistVisitAdditionRule,
  inHomePharmacyComprehensiveSystemAddition1Rule,
  inHomeTransitionInitialManagementFeeRule,
  infantMedicationGuidanceAdditionRule,
  inhalationDrugGuidanceAdditionRule,
  materialFeeProvisionalWarning,
  medicationAdjustmentSupportFee1Rule,
  medicationManagementGuidanceFee1Rule,
  medicationManagementGuidanceFee2Rule,
  medicationManagementGuidanceSpecialCaseRule,
  multiPharmacistManagementVisitFeeRule,
  narcoticManagementGuidanceAdditionRule,
  outpatientMedicationSupportFee1Rule,
  pediatricSpecificAdditionRule,
  specificDrugManagementGuidanceAddition2Rule,
  timeSurchargeProvisionalWarning,
  tubeFeedingMedicationSupportFeeRule,
  visitPharmacistPhysicianJointGuidanceFeeRule,
} from "./index.js";


import {
  request,
  evidenceRef,
  expectBlocked,
  expectPointsOnly,
} from './calculation-test-support.js';

describe("calculate fee schedule rules (区分別算定)", () => {
  it("複数剤数: 内服薬調製料は剤ごとに加算し3剤まで (24×3=72)、4剤目で上限 BLOCKED", () => {
    const threeGroups = calculate(request(), {
      rules: [
        createOralMedicinePreparationFeeRule("rp:1"),
        createOralMedicinePreparationFeeRule("rp:2"),
        createOralMedicinePreparationFeeRule("rp:3"),
      ],
    });
    expectPointsOnly(threeGroups, "72");

    const fourGroups = calculate(request(), {
      rules: [
        createOralMedicinePreparationFeeRule("rp:1"),
        createOralMedicinePreparationFeeRule("rp:2"),
        createOralMedicinePreparationFeeRule("rp:3"),
        createOralMedicinePreparationFeeRule("rp:4"),
      ],
    });
    expectBlocked(fourGroups);
  });

  it("一包化: 外来服薬支援料2 の数量段階 (7日=34 EVD-CAL-0055 / 43日=240 EVD-CAL-0056)", () => {
    const shortTerm = expectPointsOnly(
      calculate(request(), { rules: [createOnePackagingSupportFeeRule("prescription", 7)] }),
      "34",
    );
    expect(shortTerm.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0055")]);

    const longTerm = expectPointsOnly(
      calculate(request(), { rules: [createOnePackagingSupportFeeRule("prescription", 43)] }),
      "240",
    );
    expect(longTerm.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0056")]);
  });

  it("粉砕: 自家製剤加算 oral_tablet_like は 20点×⌈日数/7⌉ (14日=40 EVD-CAL-0033)", () => {
    const result = calculate(request(), {
      rules: [
        createSelfPreparationAdditionRule({
          applicationKey: "rp:1",
          kind: "oral_tablet_like",
          daysSupply: 14,
        }),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "40");
    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0033")]);
  });

  it("自家製剤加算: 予製剤は所定点数の100分の20 (屯服90×20/100=18)", () => {
    expectPointsOnly(
      calculate(request(), {
        rules: [
          createSelfPreparationAdditionRule({
            applicationKey: "rp:1",
            kind: "tonpuku",
            prePrepared: true,
          }),
        ],
      }),
      "18",
    );
  });

  it("計量混合調剤加算: 剤形ごとの点数 (散剤顆粒45 EVD-CAL-0034)、予製剤は100分の20 (軟硬膏80→16)", () => {
    const powder = expectPointsOnly(
      calculate(request(), {
        rules: [createWeighingMixingAdditionRule({ applicationKey: "rp:1", kind: "powder_granule" })],
      }),
      "45",
    );
    expect(powder.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0034")]);

    expectPointsOnly(
      calculate(request(), {
        rules: [
          createWeighingMixingAdditionRule({
            applicationKey: "rp:1",
            kind: "ointment",
            prePrepared: true,
          }),
        ],
      }),
      "16",
    );
  });

  it("調剤料算定の合成: 一包化34 + 粉砕20 + 計量混合45 = 99点", () => {
    const result = calculate(request(), {
      rules: [
        createOnePackagingSupportFeeRule("prescription", 7),
        createSelfPreparationAdditionRule({ applicationKey: "rp:1", kind: "oral_tablet_like", daysSupply: 7 }),
        createWeighingMixingAdditionRule({ applicationKey: "rp:1", kind: "powder_granule" }),
      ],
    });
    expectPointsOnly(result, "99");
  });

  it("固定点数の加算・本体・料が evidence 値どおり算定される(区分00〜第5節)", () => {
    const cases: readonly [CalculationRule, string, string][] = [
      // 区分00 加算
      [cooperationEnhancementAdditionRule, "5", "EVD-CAL-0010"],
      [biosimilarDispensingSystemAdditionRule, "50", "EVD-CAL-0011"],
      [inHomePharmacyComprehensiveSystemAddition1Rule, "30", "EVD-CAL-0016"],
      [electronicDispensingInfoCooperationAdditionRule, "8", "EVD-CAL-0018"],
      // 区分10の3 本体・加算
      [medicationManagementGuidanceFee1Rule, "45", "EVD-CAL-0040"],
      [medicationManagementGuidanceFee2Rule, "59", "EVD-CAL-0041"],
      [narcoticManagementGuidanceAdditionRule, "22", "EVD-CAL-0044"],
      [specificDrugManagementGuidanceAddition2Rule, "100", "EVD-CAL-0046"],
      [infantMedicationGuidanceAdditionRule, "12", "EVD-CAL-0048"],
      [pediatricSpecificAdditionRule, "350", "EVD-CAL-0049"],
      [inhalationDrugGuidanceAdditionRule, "30", "EVD-CAL-0050"],
      [familyPharmacistFollowUpAdditionRule, "50", "EVD-CAL-0051"],
      [familyPharmacistVisitAdditionRule, "230", "EVD-CAL-0052"],
      [medicationManagementGuidanceSpecialCaseRule, "13", "EVD-CAL-0053"],
      // 14の2/14の3
      [outpatientMedicationSupportFee1Rule, "185", "EVD-CAL-0054"],
      [facilityCooperationAdditionRule, "50", "EVD-CAL-0057"],
      [medicationAdjustmentSupportFee1Rule, "125", "EVD-CAL-0058"],
      // 在宅系
      [dischargeJointGuidanceFeeRule, "600", "EVD-CAL-0061"],
      [tubeFeedingMedicationSupportFeeRule, "100", "EVD-CAL-0063"],
      [inHomeTransitionInitialManagementFeeRule, "230", "EVD-CAL-0064"],
      [visitPharmacistPhysicianJointGuidanceFeeRule, "150", "EVD-CAL-0065"],
      [multiPharmacistManagementVisitFeeRule, "300", "EVD-CAL-0066"],
      // 第4・5節
      [dispensingBaseUpEvaluationFeeRule, "4", "EVD-CAL-0070"],
      [dispensingPriceResponseFeeRule, "1", "EVD-CAL-0071"],
    ];
    for (const [rule, expectedPoints, evidence] of cases) {
      const pointsOnly = expectPointsOnly(calculate(request(), { rules: [rule] }), expectedPoints);
      expect(pointsOnly.trace.evidenceIds).toContain(evidenceId(evidence));
    }
  });

  it("EVD-CAL-0009 地域支援体制加算1〜5 (27/59/67/37/59)", () => {
    const expected: readonly [1 | 2 | 3 | 4 | 5, string][] = [
      [1, "27"],
      [2, "59"],
      [3, "67"],
      [4, "37"],
      [5, "59"],
    ];
    for (const [level, points] of expected) {
      expectPointsOnly(
        calculate(request(), { rules: [createRegionalSupportSystemAdditionRule(level)] }),
        points,
      );
    }
  });

  it("EVD-CAL-0017 在宅薬学総合体制加算2 (イ100/ロ50)", () => {
    expectPointsOnly(
      calculate(request(), {
        rules: [createInHomePharmacyComprehensiveSystemAddition2Rule("i")],
      }),
      "100",
    );
    expectPointsOnly(
      calculate(request(), {
        rules: [createInHomePharmacyComprehensiveSystemAddition2Rule("ro")],
      }),
      "50",
    );
  });

  it("EVD-CAL-0035/0036 調剤管理料1 は剤ごとに加算し3剤まで (60×3=180)、4剤目で上限 BLOCKED", () => {
    expectPointsOnly(
      calculate(request(), {
        rules: [
          createDispensingManagementFee1IRule("rp:1"),
          createDispensingManagementFee1IRule("rp:2"),
          createDispensingManagementFee1IRule("rp:3"),
        ],
      }),
      "180",
    );
    expectBlocked(
      calculate(request(), {
        rules: [
          createDispensingManagementFee1IRule("rp:1"),
          createDispensingManagementFee1IRule("rp:2"),
          createDispensingManagementFee1IRule("rp:3"),
          createDispensingManagementFee1IRule("rp:4"),
        ],
      }),
    );
    expectPointsOnly(
      calculate(request(), { rules: [createDispensingManagementFee1RoRule("rp:1")] }),
      "10",
    );
  });

  it("EVD-CAL-0038 残薬調整加算 (イ/ロ/ハ50・ニ30)", () => {
    expectPointsOnly(
      calculate(request(), { rules: [createResidualDrugAdjustmentAdditionRule("i")] }),
      "50",
    );
    expectPointsOnly(
      calculate(request(), { rules: [createResidualDrugAdjustmentAdditionRule("ni")] }),
      "30",
    );
  });

  it("EVD-CAL-0039 薬学的有害事象等防止加算は表示専用で SaMD 警告を必ず付与 (イ50)", () => {
    const result = calculate(request(), {
      rules: [createAdverseEventPreventionAdditionRule("i")],
    });
    const pointsOnly = expectPointsOnly(result, "50");
    expect(pointsOnly.warnings).toContain(adverseEventPreventionSamdWarning);
  });

  it("EVD-CAL-0043 服薬管理指導料4 (イ45/ロ59/ハ59/ニ59)", () => {
    expectPointsOnly(
      calculate(request(), { rules: [createMedicationManagementGuidanceFee4Rule("i")] }),
      "45",
    );
    expectPointsOnly(
      calculate(request(), { rules: [createMedicationManagementGuidanceFee4Rule("ni")] }),
      "59",
    );
  });

  it("EVD-CAL-0045/0047 特定薬剤管理指導加算1 (イ10/ロ5) と加算3 (イ5/ロ10)", () => {
    expectPointsOnly(
      calculate(request(), { rules: [createSpecificDrugManagementGuidanceAddition1Rule("i")] }),
      "10",
    );
    expectPointsOnly(
      calculate(request(), { rules: [createSpecificDrugManagementGuidanceAddition3Rule("ro")] }),
      "10",
    );
  });

  it("EVD-CAL-0059 在宅患者緊急時等共同指導料 本体700 + 各加算 (小児特定450/中心静脈栄養150)", () => {
    expectPointsOnly(
      calculate(request(), { rules: [createHomePatientEmergencyJointGuidanceRule("base")] }),
      "700",
    );
    const composed = calculate(request(), {
      rules: [
        createHomePatientEmergencyJointGuidanceRule("base"),
        createHomePatientEmergencyJointGuidanceRule("pediatricSpecific"),
        createHomePatientEmergencyJointGuidanceRule("centralVenousNutrition"),
      ],
    });
    expectPointsOnly(composed, "1300");
  });

  it("EVD-CAL-0062 服薬情報等提供料 (1=30 / 2イ=20 / 3=50)", () => {
    expectPointsOnly(
      calculate(request(), { rules: [createMedicationInfoProvisionFeeRule("1")] }),
      "30",
    );
    expectPointsOnly(
      calculate(request(), { rules: [createMedicationInfoProvisionFeeRule("2i")] }),
      "20",
    );
    expectPointsOnly(
      calculate(request(), { rules: [createMedicationInfoProvisionFeeRule("3")] }),
      "50",
    );
  });

  it("EVD-CAL-0031 時間外・休日・深夜加算 (乗率): afterHours=base, lateNight=2×base, 端数(holiday×24)は BLOCKED", () => {
    const afterHours = calculate(request(), {
      rules: [
        createTimeSurchargeAdditionRule({
          applicationKey: "rp:1",
          basePoints: Points.fromInteger(24),
          kind: "afterHours",
        }),
      ],
    });
    const pointsOnly = expectPointsOnly(afterHours, "24");
    expect(pointsOnly.warnings).toContain(timeSurchargeProvisionalWarning);

    expectPointsOnly(
      calculate(request(), {
        rules: [
          createTimeSurchargeAdditionRule({
            applicationKey: "rp:1",
            basePoints: Points.fromInteger(24),
            kind: "lateNight",
          }),
        ],
      }),
      "48",
    );

    const holiday = calculate(request(), {
      rules: [
        createTimeSurchargeAdditionRule({
          applicationKey: "rp:1",
          basePoints: Points.fromInteger(24),
          kind: "holiday",
        }),
      ],
    });
    const blocked = expectBlocked(holiday);
    expect(blocked.blockers[0]?.detail).toContain("丸め根拠未発行");
  });

  it("EVD-CAL-0068 多剤逓減 (100分の90): 整数結果は算定、端数は BLOCKED", () => {
    expectPointsOnly(
      calculate(request(), {
        rules: [createMultiDrugReductionRule({ applicationKey: "rp:1", basePoints: Points.fromInteger(10) })],
      }),
      "9",
    );
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [createMultiDrugReductionRule({ applicationKey: "rp:1", basePoints: Points.fromInteger(5) })],
      }),
    );
    expect(blocked.blockers[0]?.detail).toContain("丸め根拠未発行");
  });

  it("EVD-CAL-0069 特定保険医療材料料 (材料価格÷10): 割り切れれば算定+暫定警告、端数は BLOCKED", () => {
    const result = calculate(request(), {
      rules: [
        createSpecificMedicalMaterialFeeRule({
          applicationKey: "material:1",
          materialPriceYen: ScaledDecimal.fromInteger(220),
        }),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "22");
    expect(pointsOnly.warnings).toContain(materialFeeProvisionalWarning);

    expectBlocked(
      calculate(request(), {
        rules: [
          createSpecificMedicalMaterialFeeRule({
            applicationKey: "material:1",
            materialPriceYen: ScaledDecimal.fromInteger(105),
          }),
        ],
      }),
    );
  });

  it("is deterministic for identical inputs", () => {
    const ruleSet = {
      rules: [
        dispensingBasicFee1Rule,
        createOralMedicinePreparationFeeRule("oral-medicine:1"),
        dispensingManagementFee2Rule,
      ],
    };
    const first = calculate(request(), ruleSet);
    const second = calculate(request(), ruleSet);

    expect(second).toEqual(first);
  });
});

