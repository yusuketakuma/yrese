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

describe("WP-5280 regressions (Oracle-confirmed findings)", () => {
  it("F1: 固定基本料1と合成基本料ルールは同一排他 group で併用 BLOCKED(両順序)", () => {
    const forward = expectBlocked(
      calculate(request(), {
        rules: [
          dispensingBasicFee1Rule,
          createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_2 }),
        ],
      }),
    );
    expect(forward.blockers[0]?.detail).toContain("dispensing-basic-fee");

    const reverse = expectBlocked(
      calculate(request(), {
        rules: [
          createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_2 }),
          dispensingBasicFee1Rule,
        ],
      }),
    );
    expect(reverse.blockers[0]?.detail).toContain("dispensing-basic-fee");
  });

  it("F2: 特別調剤基本料A variant(100分の10)は全 level で丸め根拠未発行 BLOCKED", () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const blocked = expectBlocked(
        calculate(request(), {
          rules: [createRegionalSupportSystemAdditionRule(level, "prescription", "special_basic_fee_a")],
        }),
      );
      expect(blocked.blockers[0]?.type).toBe("BLOCKED_REGULATORY_REVIEW");
      expect(blocked.blockers[0]?.detail).toContain("丸め根拠未発行");
    }
    const level1 = expectBlocked(
      calculate(request(), {
        rules: [createRegionalSupportSystemAdditionRule(1, "prescription", "special_basic_fee_a")],
      }),
    );
    expect(level1.blockers[0]?.detail).toContain("270/100");
  });

  it("F3: EVD-CAL-0070/0071 は 2027-05-31 を含む期間のみ適用(2027-06-01 で失効 BLOCKED)", () => {
    expectPointsOnly(
      calculate(request("2027-05-31"), { rules: [dispensingBaseUpEvaluationFeeRule] }),
      "4",
    );
    expectPointsOnly(
      calculate(request("2027-05-31"), { rules: [dispensingPriceResponseFeeRule] }),
      "1",
    );

    const expired70 = expectBlocked(
      calculate(request("2027-06-01"), { rules: [dispensingBaseUpEvaluationFeeRule] }),
    );
    expect(expired70.blockers[0]?.detail).toContain("2027-05-31");
    expect(expired70.trace.steps[0]?.output).toBe("BLOCKED_REGULATORY_REVIEW:適用終了後");

    const expired71 = expectBlocked(
      calculate(request("2027-06-01"), { rules: [dispensingPriceResponseFeeRule] }),
    );
    expect(expired71.blockers[0]?.detail).toContain("適用終了後");
  });

  it("A2: 湯薬は同一対象の異段階併用を排他し、別対象への複数適用は妨げない(両順序)", () => {
    const forward = expectBlocked(
      calculate(request(), {
        rules: [
          createDecoctionPreparationFeeRule("touyaku:1", 7),
          createDecoctionPreparationFeeRule("touyaku:1", 15),
        ],
      }),
    );
    expect(forward.blockers[0]?.detail).toContain("decoction-preparation-fee:touyaku:1");
    expectBlocked(
      calculate(request(), {
        rules: [
          createDecoctionPreparationFeeRule("touyaku:1", 15),
          createDecoctionPreparationFeeRule("touyaku:1", 7),
        ],
      }),
    );

    expectPointsOnly(
      calculate(request(), {
        rules: [
          createDecoctionPreparationFeeRule("touyaku:1", 7),
          createDecoctionPreparationFeeRule("touyaku:2", 15),
        ],
      }),
      "460",
    );
  });

  it("A2: 一包化も同一対象の段階併用を排他し、別対象は合算する", () => {
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [
          createOnePackagingSupportFeeRule("rx:1", 7),
          createOnePackagingSupportFeeRule("rx:1", 43),
        ],
      }),
    );
    expect(blocked.blockers[0]?.detail).toContain("one-packaging-support-fee:rx:1");
    expectBlocked(
      calculate(request(), {
        rules: [
          createOnePackagingSupportFeeRule("rx:1", 43),
          createOnePackagingSupportFeeRule("rx:1", 7),
        ],
      }),
    );

    expectPointsOnly(
      calculate(request(), {
        rules: [
          createOnePackagingSupportFeeRule("rx:1", 7),
          createOnePackagingSupportFeeRule("rx:2", 43),
        ],
      }),
      "274",
    );
  });

  it("F4: 調剤管理料2(「1以外の場合」)は料1の任意適用と非対称排他(両順序)", () => {
    const fee2First = expectBlocked(
      calculate(request(), {
        rules: [dispensingManagementFee2Rule, createDispensingManagementFee1IRule("rp:1")],
      }),
    );
    expect(fee2First.blockers[0]?.detail).toContain("dispensing-management-fee-1:rp:1");

    const fee1First = expectBlocked(
      calculate(request(), {
        rules: [createDispensingManagementFee1IRule("rp:1"), dispensingManagementFee2Rule],
      }),
    );
    expect(fee1First.blockers[0]?.detail).toContain("dispensing-management-fee-2");

    // 料1ロも同様に料2と非対称排他(両順序)
    expectBlocked(
      calculate(request(), {
        rules: [dispensingManagementFee2Rule, createDispensingManagementFee1RoRule("rp:1")],
      }),
    );
    expectBlocked(
      calculate(request(), {
        rules: [createDispensingManagementFee1RoRule("rp:1"), dispensingManagementFee2Rule],
      }),
    );
  });

  it("F4: 調剤管理料1 イ/ロは同一対象で排他し、別対象では併用可", () => {
    expectBlocked(
      calculate(request(), {
        rules: [
          createDispensingManagementFee1IRule("rp:1"),
          createDispensingManagementFee1RoRule("rp:1"),
        ],
      }),
    );
    expectBlocked(
      calculate(request(), {
        rules: [
          createDispensingManagementFee1RoRule("rp:1"),
          createDispensingManagementFee1IRule("rp:1"),
        ],
      }),
    );

    expectPointsOnly(
      calculate(request(), {
        rules: [
          createDispensingManagementFee1IRule("rp:1"),
          createDispensingManagementFee1RoRule("rp:2"),
        ],
      }),
      "70",
    );
  });

  it("F4: 服薬管理指導料1↔2(「1以外の患者」)は排他、料3とは併用可", () => {
    expectBlocked(
      calculate(request(), {
        rules: [medicationManagementGuidanceFee1Rule, medicationManagementGuidanceFee2Rule],
      }),
    );
    expectBlocked(
      calculate(request(), {
        rules: [medicationManagementGuidanceFee2Rule, medicationManagementGuidanceFee1Rule],
      }),
    );

    expectPointsOnly(
      calculate(request(), {
        rules: [medicationManagementGuidanceFee1Rule, medicationManagementGuidanceFee3Rule],
      }),
      "90",
    );
  });

  it("C1: affectsClaim:false の正点数 ITEM_CALCULATED は SSOT_UPDATE_REQUIRED で拒否", () => {
    const evidenceDodgingRule: CalculationRule = {
      ruleId: "rule:non-claim-positive-points",
      evidenceRefs: [evidenceRef("EVD-CAL-0001")],
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () => ({
        status: "ITEM_CALCULATED",
        description: "Positive points trying to bypass trace evidence enforcement",
        affectsClaim: false,
        output: "itemPoints=10",
        itemPoints: Points.fromInteger(10),
        applicationKey: "prescription",
      }),
    };

    const blocked = expectBlocked(calculate(request(), { rules: [evidenceDodgingRule] }));
    expect(blocked.blockers[0]?.type).toBe("SSOT_UPDATE_REQUIRED");
    expect(blocked.blockers[0]?.detail).toContain("affectsClaim");
    expect(blocked.trace.warnings).toContain(invalidStepResultWarning);
  });

  it("C2: 多剤逓減(置換型)は元の使用薬剤料との併用を非対称排他で BLOCKED(両順序)", () => {
    // 100円 → 1+⌈85/10⌉ = 10点。逓減は 10×90/100 = 9点(置換後総額)
    const drugFee = () =>
      createDrugFeeRule({ applicationKey: "rp:1", unitPriceYen: ScaledDecimal.fromInteger(100) });
    const reduction = () =>
      createMultiDrugReductionRule({ applicationKey: "prescription", basePoints: Points.fromInteger(10) });

    expectBlocked(calculate(request(), { rules: [drugFee(), reduction()] }));
    expectBlocked(calculate(request(), { rules: [reduction(), drugFee()] }));
    expectPointsOnly(calculate(request(), { rules: [reduction()] }), "9");
    expectPointsOnly(calculate(request(), { rules: [drugFee()] }), "10");
  });

  it("C2: 限定 prefix は対象外の薬剤料との併用を許容する", () => {
    const targetedReduction = () =>
      createMultiDrugReductionRule({
        applicationKey: "prescription",
        basePoints: Points.fromInteger(10),
        reducedDrugFeeGroupPrefix: "drug-fee:rp:1",
      });
    const unrelatedDrugFee = () =>
      createDrugFeeRule({ applicationKey: "rp:2", unitPriceYen: ScaledDecimal.fromInteger(35) });
    const targetDrugFee = () =>
      createDrugFeeRule({ applicationKey: "rp:1", unitPriceYen: ScaledDecimal.fromInteger(100) });

    // 指定 prefix に前方一致する対象のみ排他し、対象外(rp:2 = 3点)は合算される(9+3=12、両順序)
    expectPointsOnly(
      calculate(request(), { rules: [targetedReduction(), unrelatedDrugFee()] }),
      "12",
    );
    expectPointsOnly(
      calculate(request(), { rules: [unrelatedDrugFee(), targetedReduction()] }),
      "12",
    );
    expectBlocked(calculate(request(), { rules: [targetedReduction(), targetDrugFee()] }));
    expectBlocked(calculate(request(), { rules: [targetDrugFee(), targetedReduction()] }));

    // 接頭辞契約の境界: "drug-fee:rp:1" は "drug-fee:rp:10" にも前方一致する(曖昧一致を pin)
    const rp10DrugFee = () =>
      createDrugFeeRule({ applicationKey: "rp:10", unitPriceYen: ScaledDecimal.fromInteger(35) });
    expectBlocked(calculate(request(), { rules: [targetedReduction(), rp10DrugFee()] }));
  });

  it("A3: factory 生成後の入力オブジェクト変更は点数と trace を変えない(薬剤料・材料料・基本料)", () => {
    const drugInput = {
      applicationKey: "rp:1",
      unitPriceYen: ScaledDecimal.fromString("25.10"),
    };
    const drugRule = createDrugFeeRule(drugInput);
    (drugInput as { unitPriceYen: ScaledDecimal }).unitPriceYen =
      ScaledDecimal.fromString("999.99");
    const drug = expectPointsOnly(calculate(request(), { rules: [drugRule] }), "3");
    expect(drug.trace.steps[0]?.output).toContain("unitPriceYen=25.1");
    expect(drug.trace.steps[0]?.output).not.toContain("999.99");

    const materialInput = {
      applicationKey: "material:1",
      materialPriceYen: ScaledDecimal.fromInteger(220),
    };
    const materialRule = createSpecificMedicalMaterialFeeRule(materialInput);
    (materialInput as { materialPriceYen: ScaledDecimal }).materialPriceYen =
      ScaledDecimal.fromInteger(999);
    const material = expectPointsOnly(calculate(request(), { rules: [materialRule] }), "22");
    expect(material.trace.steps[0]?.output).toContain("materialPriceYen=220");

    const basicInput = {
      base: { evidenceId: "EVD-CAL-0002", points: Points.fromInteger(30), label: "調剤基本料2" },
    };
    const basicRule = createDispensingBasicFeeRule(basicInput);
    (basicInput as { base: typeof basicInput.base }).base = {
      evidenceId: "EVD-CAL-0005",
      points: Points.fromInteger(37),
      label: "改変後ラベル",
    };
    const basic = expectPointsOnly(calculate(request(), { rules: [basicRule] }), "30");
    expect(basic.trace.steps[0]?.description).toContain("調剤基本料2");
    expect(basic.trace.steps[0]?.description).not.toContain("改変後ラベル");
  });

  it("A3: 乗率型 factory の basePoints 差し替えも生成時の値を維持する(時間外加算・多剤逓減)", () => {
    const surchargeInput = {
      applicationKey: "rp:1",
      basePoints: Points.fromInteger(24),
      kind: "lateNight" as const,
    };
    const surchargeRule = createTimeSurchargeAdditionRule(surchargeInput);
    (surchargeInput as { basePoints: Points }).basePoints = Points.fromInteger(48);
    expectPointsOnly(calculate(request(), { rules: [surchargeRule] }), "48");

    const reductionInput = {
      applicationKey: "prescription",
      basePoints: Points.fromInteger(10),
    };
    const reductionRule = createMultiDrugReductionRule(reductionInput);
    (reductionInput as { basePoints: Points }).basePoints = Points.fromInteger(100);
    expectPointsOnly(calculate(request(), { rules: [reductionRule] }), "9");
  });

  it("A3: Points/ScaledDecimal の値は実行時 freeze 済みで外部から書き換えられない", () => {
    const points = Points.fromInteger(10);
    const decimal = ScaledDecimal.fromString("25.10");
    expect(Object.isFrozen(points)).toBe(true);
    expect(Object.isFrozen(decimal)).toBe(true);
    expect(Reflect.set(points, "value", 90n)).toBe(false);
    expect(Reflect.set(decimal, "coefficient", 9999n)).toBe(false);
    expect(points.toString()).toBe("10");
    expect(decimal.toString()).toBe("25.1");

    // 生成済みルールが保持する Points への書き換え試行は結果を変えない
    const reduction = createMultiDrugReductionRule({
      applicationKey: "prescription",
      basePoints: points,
    });
    expectPointsOnly(calculate(request(), { rules: [reduction] }), "9");

    // 共有プリセットの子要素も freeze 済み
    expect(Object.isFrozen(DISPENSING_BASIC_FEE_BASES.FEE_1)).toBe(true);
    expect(
      Reflect.set(DISPENSING_BASIC_FEE_BASES.FEE_1, "points", Points.fromInteger(999)),
    ).toBe(false);
    expectPointsOnly(
      calculate(request(), {
        rules: [createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_1 })],
      }),
      "47",
    );
  });

  it("A5: 計算 step の output に applicationKey が残り対象を区別できる", () => {
    const pointsOnly = expectPointsOnly(
      calculate(request(), {
        rules: [
          createDrugFeeRule({ applicationKey: "rp:1", unitPriceYen: ScaledDecimal.fromInteger(25) }),
          createDrugFeeRule({ applicationKey: "rp:2", unitPriceYen: ScaledDecimal.fromInteger(35) }),
        ],
      }),
      "5",
    );
    expect(pointsOnly.trace.steps[0]?.output).toContain("applicationKey=rp:1");
    expect(pointsOnly.trace.steps[1]?.output).toContain("applicationKey=rp:2");
  });

  it("A5: 重複・上限・排他の拒否は専用 blocked step として trace に残る", () => {
    const duplicate = expectBlocked(
      calculate(request(), {
        rules: [
          createOralMedicinePreparationFeeRule("oral-medicine:1"),
          createOralMedicinePreparationFeeRule("oral-medicine:1"),
        ],
      }),
    );
    const duplicateStep = duplicate.trace.steps.find((s) =>
      s.stepId.includes(":duplicate-application:"),
    );
    expect(duplicateStep?.affectsClaim).toBe(false);
    expect(duplicateStep?.output).toContain("重複適用");

    const overLimit = expectBlocked(
      calculate(request(), {
        rules: [
          createOralMedicinePreparationFeeRule("oral-medicine:1"),
          createOralMedicinePreparationFeeRule("oral-medicine:2"),
          createOralMedicinePreparationFeeRule("oral-medicine:3"),
          createOralMedicinePreparationFeeRule("oral-medicine:4"),
        ],
      }),
    );
    const maxStep = overLimit.trace.steps.find((s) =>
      s.stepId.includes(":max-applications-exceeded"),
    );
    expect(maxStep?.affectsClaim).toBe(false);
    expect(maxStep?.output).toContain("上限超過");

    const exclusive = expectBlocked(
      calculate(request(), {
        rules: [medicationManagementGuidanceFee1Rule, medicationManagementGuidanceFee2Rule],
      }),
    );
    const exclusivityStep = exclusive.trace.steps.find((s) => s.stepId.includes(":exclusivity:"));
    expect(exclusivityStep?.affectsClaim).toBe(false);
    expect(exclusivityStep?.output).toContain("排他グループ衝突");
  });

  it("SSOT_UPDATE_REQUIRED: exclusivityGroup.blocksGroupIdPrefixes の形が不正", () => {
    const malformedPrefixes = (prefixes: unknown): CalculationRule => ({
      ruleId: "rule:malformed-prefixes",
      evidenceRefs: [evidenceRef("EVD-CAL-0001")],
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () =>
        ({
          status: "ITEM_CALCULATED",
          description: "Malformed blocksGroupIdPrefixes",
          affectsClaim: true,
          output: "itemPoints=1",
          itemPoints: Points.fromInteger(1),
          applicationKey: "prescription",
          exclusivityGroup: {
            groupId: "g",
            evidenceRef: evidenceRef("EVD-CAL-0001"),
            blocksGroupIdPrefixes: prefixes,
          },
        }) as never,
    });

    const sparseHolesOnly = new Array(2); // [,,] — every/some は hole を skip する
    const sparseMixed = ["ok", , "also-ok"]; // 有効値 + hole 混在
    for (const bad of [[""], "not-an-array", [1], sparseHolesOnly, sparseMixed]) {
      const blocked = expectBlocked(calculate(request(), { rules: [malformedPrefixes(bad)] }));
      expect(blocked.blockers[0]?.type).toBe("SSOT_UPDATE_REQUIRED");
      expect(blocked.blockers[0]?.detail).toContain(
        "exclusivityGroup.blocksGroupIdPrefixes must be an array of non-empty strings",
      );
    }
  });

  it("SSOT_UPDATE_REQUIRED: exclusivityGroup の unknown field 密輸を拒否", () => {
    const smugglingRule: CalculationRule = {
      ruleId: "rule:exclusivity-unknown-field",
      evidenceRefs: [evidenceRef("EVD-CAL-0001")],
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () =>
        ({
          status: "ITEM_CALCULATED",
          description: "Exclusivity group carrying an unapproved field",
          affectsClaim: true,
          output: "itemPoints=1",
          itemPoints: Points.fromInteger(1),
          applicationKey: "prescription",
          exclusivityGroup: {
            groupId: "g",
            evidenceRef: evidenceRef("EVD-CAL-0001"),
            smuggled: "x",
          },
        }) as never,
    };

    const blocked = expectBlocked(calculate(request(), { rules: [smugglingRule] }));
    expect(blocked.blockers[0]?.type).toBe("SSOT_UPDATE_REQUIRED");
    expect(blocked.blockers[0]?.detail).toContain(
      "unknown exclusivityGroup field outside the approved SSOT: smuggled",
    );
  });
});

describe("audit regressions (StepResult validation hardening)", () => {
  function itemRule(ruleId: string, result: Record<string, unknown>): CalculationRule {
    return {
      ruleId,
      evidenceRefs: [evidenceRef("EVD-CAL-0001")],
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () => result as never,
    };
  }

  const validItemResult: Record<string, unknown> = {
    status: "ITEM_CALCULATED",
    description: "item",
    affectsClaim: true,
    output: "itemPoints=1",
    itemPoints: Points.fromInteger(1),
    applicationKey: "prescription",
  };

  it("疎配列の warnings は hole を検査し BLOCKED (undefined の混入/裸 throw を防止)", () => {
    const sparseWarnings = [, "w"]; // hole at index 0
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [itemRule("rule:sparse-warnings", { ...validItemResult, warnings: sparseWarnings })],
      }),
    );
    expect(blocked.blockers[0]?.type).toBe("SSOT_UPDATE_REQUIRED");
    expect(blocked.blockers[0]?.detail).toContain("warnings must be a string array");
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
  });

  it("疎配列の inputRefs は BLOCKED (trace 層 assertDenseArray の裸 throw ではない)", () => {
    const sparseInputRefs = [, "dispensing.dispensingDate"];
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [itemRule("rule:sparse-input-refs", { ...validItemResult, inputRefs: sparseInputRefs })],
      }),
    );
    expect(blocked.blockers[0]?.type).toBe("SSOT_UPDATE_REQUIRED");
    expect(blocked.blockers[0]?.detail).toContain("inputRefs must be a string array");
  });

  it("blocker の unknown field 密輸を拒否", () => {
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [
          itemRule("rule:blocker-unknown-field", {
            status: "BLOCKED",
            description: "blocked",
            affectsClaim: false,
            output: "BLOCKED",
            blocker: { type: "SSOT_UPDATE_REQUIRED", detail: "d", smuggled: "x" },
          }),
        ],
      }),
    );
    expect(blocked.blockers[0]?.detail).toContain(
      "unknown blocker field outside the approved SSOT: smuggled",
    );
  });

  it("evidenceRef の unknown field 密輸を拒否", () => {
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [
          itemRule("rule:evidence-ref-unknown-field", {
            ...validItemResult,
            exclusivityGroup: {
              groupId: "g",
              evidenceRef: { ...evidenceRef("EVD-CAL-0001"), injected: "y" },
            },
          }),
        ],
      }),
    );
    expect(blocked.blockers[0]?.detail).toContain(
      "exclusivityGroup.evidenceRef must not include unknown field: injected",
    );
  });

  it("前後空白を含む applicationKey は同一性判定回避として拒否", () => {
    const blocked = expectBlocked(
      calculate(request(), {
        rules: [itemRule("rule:padded-application-key", { ...validItemResult, applicationKey: " prescription" })],
      }),
    );
    expect(blocked.blockers[0]?.detail).toContain(
      "applicationKey must be a canonical string without surrounding whitespace",
    );
  });

  it("前後空白を含む exclusivityGroup.groupId / prefix を拒否", () => {
    const paddedGroupId = expectBlocked(
      calculate(request(), {
        rules: [
          itemRule("rule:padded-group-id", {
            ...validItemResult,
            exclusivityGroup: { groupId: "g ", evidenceRef: evidenceRef("EVD-CAL-0001") },
          }),
        ],
      }),
    );
    expect(paddedGroupId.blockers[0]?.detail).toContain(
      "exclusivityGroup.groupId must be a canonical string without surrounding whitespace",
    );

    const paddedPrefix = expectBlocked(
      calculate(request(), {
        rules: [
          itemRule("rule:padded-prefix", {
            ...validItemResult,
            exclusivityGroup: {
              groupId: "g",
              evidenceRef: evidenceRef("EVD-CAL-0001"),
              blocksGroupIdPrefixes: [" g2"],
            },
          }),
        ],
      }),
    );
    expect(paddedPrefix.blockers[0]?.detail).toContain(
      "exclusivityGroup.blocksGroupIdPrefixes must not contain surrounding whitespace",
    );
  });

  it("早期 return 経路でも必須警告は重複蓄積しない", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        itemRule("rule:emits-required-warning", {
          ...validItemResult,
          warnings: [invalidStepResultWarning, "custom-warning-1"],
        }),
        {
          ruleId: "rule:invalid-range",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          effectiveTo: CalendarDate.fromString("2026-05-01"),
          apply: () => validItemResult as never,
        },
      ],
    };

    const blocked = expectBlocked(calculate(request(), ruleSet));
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning, "custom-warning-1"]);
  });
});

