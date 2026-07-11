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

function request(dispensingDate = "2026-07-02"): CalculationRequest {
  return {
    tenantId: tenantId("tenant-001"),
    pharmacyId: pharmacyId("pharmacy-001"),
    patient: {
      patientId: patientId("patient-001"),
    },
    insurance: {
      insuranceSnapshot: {
        id: "insurance-snapshot-001",
      },
      publicExpenses: [
        {
          id: "public-expense-001",
        },
      ],
    },
    prescription: {
      prescriptionId: prescriptionId("prescription-001"),
      prescriptionDate: PrescriptionDate.fromString("2026-07-01"),
    },
    dispensing: {
      dispensingId: dispensingId("dispensing-001"),
      dispensingDate: DispensingDate.fromString(dispensingDate),
    },
    receptionDate: ReceptionDate.fromString("2026-07-03"),
    claimMonth: ClaimMonth.fromString("2026-07"),
    masterVersion: "master-CAL-003",
    calculationRuleVersion: "CAL-004-v0.2.1",
  };
}

function evidenceRef(id: string): EvidenceRef {
  return {
    evidenceId: evidenceId(id),
    sourceType: "notification",
    title: "調剤報酬点数表(令和8年告示第69号)別表第三",
    version: "R8",
  };
}

function expectBlocked(result: CalculationResult): BlockedCalculationResult {
  expect(result.status).toBe("BLOCKED");
  if (result.status === "BLOCKED") {
    return result;
  }
  throw new Error("expected blocked result");
}

function expectPointsOnly(
  result: CalculationResult,
  expectedPoints: string,
): PointsOnlyCopayBlockedCalculationResult {
  expect(result.status).toBe("POINTS_ONLY_COPAY_BLOCKED");
  if (result.status === "POINTS_ONLY_COPAY_BLOCKED") {
    expect(result.claimable).toBe(false);
    expect(result.total.toString()).toBe(expectedPoints);
    expect(result.warnings).toContain(requirementsNotVerifiedWarning);
    expect(result.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "Patient copay calculation remains blocked because copay evidence has not been issued.",
      },
    ]);
    expect(result.trace.blockers).toEqual(["BLOCKED_REGULATORY_REVIEW"]);
    return result;
  }
  throw new Error("expected points-only result");
}

describe("calculate", () => {
  it("always returns BLOCKED for an empty ruleset", () => {
    const result = calculate(request(), { rules: [] });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "Calculation rules are not approved. Actual scoring remains blocked until regulatory review completes.",
      },
    ]);
    expect(blocked.trace.steps).toEqual([
      {
        stepId: "blocked:regulatory-review",
        description: "Stop calculation because no approved calculation rules are available",
        affectsClaim: false,
        evidenceRefs: [],
        inputRefs: [],
        output: "BLOCKED_REGULATORY_REVIEW",
      },
    ]);
    expect(blocked.trace.evidenceIds).toEqual([]);
  });

  it("delegates claim-affecting evidence enforcement to trace creation", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:claim-affecting-without-evidence",
          evidenceRefs: [],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () => ({
            status: "ITEM_CALCULATED",
            description: "Claim-affecting placeholder rule without evidence",
            affectsClaim: true,
            output: "itemPoints=0",
            itemPoints: Points.fromInteger(0),
            applicationKey: "prescription",
          }),
        },
      ],
    };

    expect(() => calculate(request(), ruleSet)).toThrow(/require at least one evidenceRef/);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED when a rule returns an unsupported StepResult status", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:invalid-step-status",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () => ({ status: "SKIPPED" }) as any,
        },
      ],
    };

    const result = calculate(request(), ruleSet);
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail: "invalid StepResult for ruleId=rule:invalid-step-status: status must be BLOCKED or ITEM_CALCULATED",
      },
    ]);
    expect(blocked.trace.blockers).toEqual(["SSOT_UPDATE_REQUIRED"]);
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
    expect(blocked.trace.steps).toEqual([
      {
        stepId: "rule:invalid-step-status:invalid-step-result",
        description: "Stop calculation because the rule returned a StepResult shape outside the approved SSOT",
        affectsClaim: false,
        evidenceRefs: [evidenceRef("EVD-CAL-0001")],
        inputRefs: [],
        output: "SSOT_UPDATE_REQUIRED:status must be BLOCKED or ITEM_CALCULATED",
      },
    ]);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED when an item StepResult is missing applicationKey", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:item-without-application-key",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () =>
            ({
              status: "ITEM_CALCULATED",
              description: "Invalid item result",
              affectsClaim: true,
              output: "itemPoints=1",
              itemPoints: Points.fromInteger(1),
            }) as any,
        },
      ],
    };

    const result = calculate(request(), ruleSet);
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail:
          "invalid StepResult for ruleId=rule:item-without-application-key: applicationKey must be a non-empty string",
      },
    ]);
    expect(blocked.trace.blockers).toEqual(["SSOT_UPDATE_REQUIRED"]);
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED when a blocked StepResult is missing blocker", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:blocked-without-blocker",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () =>
            ({
              status: "BLOCKED",
              description: "Invalid blocked result",
              affectsClaim: false,
              output: "BLOCKED",
            }) as any,
        },
      ],
    };

    const result = calculate(request(), ruleSet);
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail: "invalid StepResult for ruleId=rule:blocked-without-blocker: blocker must be an object",
      },
    ]);
    expect(blocked.trace.blockers).toEqual(["SSOT_UPDATE_REQUIRED"]);
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED when exclusivityGroup evidence sourceType is unsupported", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:exclusive-with-invalid-evidence-source",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () => ({
            status: "ITEM_CALCULATED",
            description: "Invalid exclusivity evidence source",
            affectsClaim: true,
            output: "itemPoints=1",
            itemPoints: Points.fromInteger(1),
            applicationKey: "exclusive-invalid-source",
            exclusivityGroup: {
              groupId: "exclusive-group",
              evidenceRef: {
                ...evidenceRef("EVD-CAL-0032"),
                sourceType: "bad-source",
              },
            },
          }) as any,
        },
      ],
    };

    const result = calculate(request(), ruleSet);
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail:
          "invalid StepResult for ruleId=rule:exclusive-with-invalid-evidence-source: exclusivityGroup.evidenceRef.sourceType must be a supported EvidenceSourceType",
      },
    ]);
    expect(blocked.trace.blockers).toEqual(["SSOT_UPDATE_REQUIRED"]);
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
  });

  it("EVD-CAL-0001 calculates dispensing basic fee 1 as 47 points", () => {
    const result = calculate(request(), { rules: [dispensingBasicFee1Rule] });
    const pointsOnly = expectPointsOnly(result, "47");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0001")]);
  });

  it("EVD-CAL-0021 calculates oral medicine preparation fee as 24 points per application", () => {
    const result = calculate(request(), { rules: [createOralMedicinePreparationFeeRule("oral-medicine:1")] });
    const pointsOnly = expectPointsOnly(result, "24");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0021")]);
  });

  it("EVD-CAL-0037 calculates dispensing management fee 2 as 10 points", () => {
    const result = calculate(request(), { rules: [dispensingManagementFee2Rule] });
    const pointsOnly = expectPointsOnly(result, "10");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0037")]);
  });

  it("EVD-CAL-0042 calculates medication management guidance fee 3 as 45 points", () => {
    const result = calculate(request(), { rules: [medicationManagementGuidanceFee3Rule] });
    const pointsOnly = expectPointsOnly(result, "45");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0042")]);
  });

  it("EVD-CAL-0032 calculates night and holiday addition as 40 points", () => {
    const result = calculate(request(), { rules: [nightHolidayAdditionRule] });
    const pointsOnly = expectPointsOnly(result, "40");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0032")]);
  });

  it("EVD-CAL-0001+EVD-CAL-0021x2+EVD-CAL-0037 sums to 105 points with claimable false", () => {
    const result = calculate(request(), {
      rules: [
        dispensingBasicFee1Rule,
        createOralMedicinePreparationFeeRule("oral-medicine:1"),
        createOralMedicinePreparationFeeRule("oral-medicine:2"),
        dispensingManagementFee2Rule,
      ],
    });
    const pointsOnly = expectPointsOnly(result, "105");

    expect(pointsOnly.trace.evidenceIds).toEqual([
      evidenceId("EVD-CAL-0001"),
      evidenceId("EVD-CAL-0021"),
      evidenceId("EVD-CAL-0037"),
    ]);
  });

  it("EVD-CAL-0001 is BLOCKED before effectiveFrom 2026-06-01", () => {
    const result = calculate(request("2026-05-31"), { rules: [dispensingBasicFee1Rule] });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "適用日前: EVD-CAL-0001:dispensing-basic-fee-1 is effective from 2026-06-01",
      },
    ]);
    expect(blocked.trace.steps[0]?.output).toBe("BLOCKED_REGULATORY_REVIEW:適用日前");
  });

  it("EVD-CAL-0001 applies on effectiveFrom boundary date 2026-06-01", () => {
    const result = calculate(request("2026-06-01"), { rules: [dispensingBasicFee1Rule] });
    const pointsOnly = expectPointsOnly(result, "47");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0001")]);
  });

  it("EVD-CAL-0021 allows exactly 3 applications and sums to 72 points", () => {
    const result = calculate(request(), {
      rules: [
        createOralMedicinePreparationFeeRule("oral-medicine:1"),
        createOralMedicinePreparationFeeRule("oral-medicine:2"),
        createOralMedicinePreparationFeeRule("oral-medicine:3"),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "72");

    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0021")]);
  });

  it("EVD-CAL-0021 is BLOCKED when max 3 applications is exceeded", () => {
    const result = calculate(request(), {
      rules: [
        createOralMedicinePreparationFeeRule("oral-medicine:1"),
        createOralMedicinePreparationFeeRule("oral-medicine:2"),
        createOralMedicinePreparationFeeRule("oral-medicine:3"),
        createOralMedicinePreparationFeeRule("oral-medicine:4"),
      ],
    });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail:
          "application count exceeds evidence-backed limit for ruleId=EVD-CAL-0021:oral-medicine-preparation-fee; maxApplications=3",
      },
    ]);
  });

  it("EVD-CAL-0021 is BLOCKED for duplicate (ruleId, applicationKey)", () => {
    const result = calculate(request(), {
      rules: [
        createOralMedicinePreparationFeeRule("oral-medicine:1"),
        createOralMedicinePreparationFeeRule("oral-medicine:1"),
      ],
    });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail:
          "duplicate calculation application detected for ruleId=EVD-CAL-0021:oral-medicine-preparation-fee, applicationKey=oral-medicine:1",
      },
    ]);
  });

  it("blocks duplicate exclusivity group applications when evidence-backed exclusivity is declared", () => {
    const exclusiveEvidence = evidenceRef("EVD-CAL-0032");
    const firstRule: CalculationRule = {
      ruleId: "exclusive:first",
      evidenceRefs: [exclusiveEvidence],
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () => ({
        status: "ITEM_CALCULATED",
        description: "First exclusive result",
        affectsClaim: true,
        output: "itemPoints=1",
        itemPoints: Points.fromInteger(1),
        applicationKey: "first",
        exclusivityGroup: {
          groupId: "exclusive-group",
          evidenceRef: exclusiveEvidence,
        },
      }),
    };
    const secondRule: CalculationRule = {
      ...firstRule,
      ruleId: "exclusive:second",
      apply: () => ({
        status: "ITEM_CALCULATED",
        description: "Second exclusive result",
        affectsClaim: true,
        output: "itemPoints=1",
        itemPoints: Points.fromInteger(1),
        applicationKey: "second",
        exclusivityGroup: {
          groupId: "exclusive-group",
          evidenceRef: exclusiveEvidence,
        },
      }),
    };

    const result = calculate(request(), { rules: [firstRule, secondRule] });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "exclusive calculation group applied more than once: exclusive-group",
      },
    ]);
  });

  it("EVD-CAL-0001+EVD-CAL-0021+EVD-CAL-0037+EVD-CAL-0042+EVD-CAL-0032 canonical rules sum to 166 points", () => {
    const result = calculate(request(), { rules: calculationRulesV20260601 });
    const pointsOnly = expectPointsOnly(result, "166");

    expect(pointsOnly.trace.evidenceIds).toEqual([
      evidenceId("EVD-CAL-0001"),
      evidenceId("EVD-CAL-0021"),
      evidenceId("EVD-CAL-0037"),
      evidenceId("EVD-CAL-0042"),
      evidenceId("EVD-CAL-0032"),
    ]);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED for negative itemPoints (減算はスコープ外 — CAL-004 §2)", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:negative-points",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () => ({
            status: "ITEM_CALCULATED",
            description: "Negative fixed points must not pass as an addition",
            affectsClaim: true,
            output: "itemPoints=-5",
            itemPoints: Points.fromInteger(-5),
            applicationKey: "prescription",
          }),
        },
      ],
    };

    const result = calculate(request(), ruleSet);
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail:
          "invalid StepResult for ruleId=rule:negative-points: itemPoints must not be negative (減算は CAL-004 §2 スコープ外)",
      },
    ]);
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED for unknown StepResult fields (SSOT外フィールドの密輸禁止)", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:blocked-with-item-points",
          evidenceRefs: [evidenceRef("EVD-CAL-0001")],
          effectiveFrom: CalendarDate.fromString("2026-06-01"),
          apply: () =>
            ({
              status: "BLOCKED",
              description: "Blocked result smuggling itemPoints",
              affectsClaim: false,
              output: "BLOCKED",
              blocker: {
                type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
                detail: "test blocker",
              },
              itemPoints: Points.fromInteger(47),
            }) as any,
        },
      ],
    };

    const result = calculate(request(), ruleSet);
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail:
          "invalid StepResult for ruleId=rule:blocked-with-item-points: unknown StepResult field outside the approved SSOT: itemPoints",
      },
    ]);
  });

  it("applies a rule through its effectiveTo boundary date (最終有効日を含む)", () => {
    const expiringRule: CalculationRule = {
      ...dispensingBasicFee1Rule,
      effectiveTo: CalendarDate.fromString("2026-07-02"),
    };

    const onBoundary = calculate(request("2026-07-02"), { rules: [expiringRule] });
    expectPointsOnly(onBoundary, "47");
  });

  it("is BLOCKED after effectiveTo (失効ルールの適用継続を禁止 — CAL-006 §3.1)", () => {
    const expiringRule: CalculationRule = {
      ...dispensingBasicFee1Rule,
      effectiveTo: CalendarDate.fromString("2026-07-01"),
    };

    const result = calculate(request("2026-07-02"), { rules: [expiringRule] });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "適用終了後: EVD-CAL-0001:dispensing-basic-fee-1 was effective through 2026-07-01",
      },
    ]);
    expect(blocked.trace.steps[0]?.output).toBe("BLOCKED_REGULATORY_REVIEW:適用終了後");
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED when effectiveTo is before effectiveFrom (適用期間不正)", () => {
    const invalidRangeRule: CalculationRule = {
      ...dispensingBasicFee1Rule,
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      effectiveTo: CalendarDate.fromString("2026-05-31"),
    };

    const result = calculate(request(), { rules: [invalidRangeRule] });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail:
          "invalid effective range for ruleId=EVD-CAL-0001:dispensing-basic-fee-1: effectiveTo 2026-05-31 is before effectiveFrom 2026-06-01",
      },
    ]);
    expect(blocked.trace.warnings).toEqual([invalidStepResultWarning]);
  });

  it("returns BLOCKED with SSOT_UPDATE_REQUIRED for inconsistent maxApplications declarations", () => {
    const declaringRule = createOralMedicinePreparationFeeRule("oral-medicine:1");
    const conflictingRule: CalculationRule = {
      ruleId: declaringRule.ruleId,
      evidenceRefs: declaringRule.evidenceRefs,
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () => ({
        status: "ITEM_CALCULATED",
        description: "Same ruleId without the evidence-backed limit declaration",
        affectsClaim: true,
        output: "itemPoints=24",
        itemPoints: Points.fromInteger(24),
        applicationKey: "oral-medicine:2",
      }),
    };

    const result = calculate(request(), { rules: [declaringRule, conflictingRule] });
    const blocked = expectBlocked(result);

    expect(blocked.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail:
          "inconsistent maxApplications declarations for ruleId=EVD-CAL-0021:oral-medicine-preparation-fee: 3 vs (undeclared)",
      },
    ]);
    expect(blocked.trace.warnings).toContain(invalidStepResultWarning);
  });

  it("deduplicates repeated warnings while keeping first-seen order (warning fatigue 抑制)", () => {
    const warningRule = (ruleId: string, applicationKey: string): CalculationRule => ({
      ruleId,
      evidenceRefs: [evidenceRef("EVD-CAL-0001")],
      effectiveFrom: CalendarDate.fromString("2026-06-01"),
      apply: () => ({
        status: "ITEM_CALCULATED",
        description: "Rule emitting a repeated warning",
        affectsClaim: true,
        output: "itemPoints=1",
        itemPoints: Points.fromInteger(1),
        applicationKey,
        warnings: ["同一警告", "個別警告:" + applicationKey],
      }),
    });

    const result = calculate(request(), {
      rules: [warningRule("rule:warn-1", "a"), warningRule("rule:warn-2", "b")],
    });
    const pointsOnly = expectPointsOnly(result, "2");

    expect(pointsOnly.warnings).toEqual([
      "同一警告",
      "個別警告:a",
      "個別警告:b",
      requirementsNotVerifiedWarning,
    ]);
  });

  it("EVD-CAL-0022/0027/0029/0030 fixed preparation fees calculate their evidence values", () => {
    const cases: readonly [CalculationRule, string, string][] = [
      [tonpukuPreparationFeeRule, "21", "EVD-CAL-0022"],
      [injectionPreparationFeeRule, "26", "EVD-CAL-0027"],
      [createOralDropPreparationFeeRule("drop:1"), "10", "EVD-CAL-0029"],
      [createNarcoticPreparationAdditionRule("rp:1"), "70", "EVD-CAL-0030"],
      [createPsychotropicEtcPreparationAdditionRule("rp:1"), "8", "EVD-CAL-0030"],
    ];
    for (const [rule, expectedPoints, evidence] of cases) {
      const pointsOnly = expectPointsOnly(calculate(request(), { rules: [rule] }), expectedPoints);
      expect(pointsOnly.trace.evidenceIds).toContain(evidenceId(evidence));
    }
  });

  it("EVD-CAL-0023/0028 per-dispensing fees enforce the 4調剤以上算定しない上限 (3適用まで)", () => {
    const senzen = calculate(request(), {
      rules: [
        createSenzenPreparationFeeRule("senzen:1"),
        createSenzenPreparationFeeRule("senzen:2"),
        createSenzenPreparationFeeRule("senzen:3"),
      ],
    });
    expectPointsOnly(senzen, "570");

    const externalOverLimit = calculate(request(), {
      rules: [
        createExternalPreparationFeeRule("gaiyo:1"),
        createExternalPreparationFeeRule("gaiyo:2"),
        createExternalPreparationFeeRule("gaiyo:3"),
        createExternalPreparationFeeRule("gaiyo:4"),
      ],
    });
    expectBlocked(externalOverLimit);
  });

  it("EVD-CAL-0024/0025/0026 decoction fee tiers via calculate (7日=190 / 15日=270 / 29日=400)", () => {
    expectPointsOnly(
      calculate(request(), { rules: [createDecoctionPreparationFeeRule("touyaku:1", 7)] }),
      "190",
    );
    const midTier = expectPointsOnly(
      calculate(request(), { rules: [createDecoctionPreparationFeeRule("touyaku:1", 15)] }),
      "270",
    );
    expect(midTier.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0025")]);
    expectPointsOnly(
      calculate(request(), { rules: [createDecoctionPreparationFeeRule("touyaku:1", 29)] }),
      "400",
    );
  });

  it("EVD-CAL-0067 drug fee converts unit price with the provisional rounding warning", () => {
    const result = calculate(request(), {
      rules: [
        createDrugFeeRule({ applicationKey: "rp:1", unitPriceYen: ScaledDecimal.fromString("25.10") }),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "3");
    expect(pointsOnly.warnings).toContain(drugFeeProvisionalRoundingWarning);
    expect(pointsOnly.trace.evidenceIds).toEqual([evidenceId("EVD-CAL-0067")]);
  });

  it("EVD-CAL-0001 composed dispensing basic fee without notes equals the plain base (47点)", () => {
    const result = calculate(request(), {
      rules: [createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_1 })],
    });
    const pointsOnly = expectPointsOnly(result, "47");
    // 注を使わない場合は適用順の暫定 warning を付けない
    expect(pointsOnly.warnings).not.toContain(basicFeeCompositionOrderWarning);
  });

  it("EVD-CAL-0012+0019 reductions compose (47−5−15=27) with the provisional order warning", () => {
    const result = calculate(request(), {
      rules: [
        createDispensingBasicFeeRule({
          base: DISPENSING_BASIC_FEE_BASES.FEE_1,
          genericDispensingReduction: true,
          locationDependencyReduction: true,
        }),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "27");
    expect(pointsOnly.warnings).toContain(basicFeeCompositionOrderWarning);
    expect(pointsOnly.trace.evidenceIds).toEqual([
      evidenceId("EVD-CAL-0001"),
      evidenceId("EVD-CAL-0012"),
      evidenceId("EVD-CAL-0019"),
      evidenceId("EVD-CAL-0020"),
    ]);
  });

  it("EVD-CAL-0020 clamps the composed basic fee to the 3-point floor (特別A 5−5=0→3点)", () => {
    const result = calculate(request(), {
      rules: [
        createDispensingBasicFeeRule({
          base: DISPENSING_BASIC_FEE_BASES.SPECIAL_A,
          genericDispensingReduction: true,
        }),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "3");
    const step = pointsOnly.trace.steps[0];
    expect(step?.output).toContain("clampedToMinimum=3");
  });

  it("EVD-CAL-0007 multiplier with a fractional result is BLOCKED until rounding evidence is issued (47×80/100)", () => {
    const result = calculate(request(), {
      rules: [
        createDispensingBasicFeeRule({
          base: DISPENSING_BASIC_FEE_BASES.FEE_1,
          secondOrLaterConcurrentPrescription: true,
        }),
      ],
    });
    const blocked = expectBlocked(result);
    expect(blocked.blockers[0]?.type).toBe("BLOCKED_REGULATORY_REVIEW");
    expect(blocked.blockers[0]?.detail).toContain("丸め根拠未発行");
    expect(blocked.blockers[0]?.detail).toContain("3760/100");
  });

  it("EVD-CAL-0007 multiplier applies when the result is exact (調剤基本料2: 30×80/100=24)", () => {
    const result = calculate(request(), {
      rules: [
        createDispensingBasicFeeRule({
          base: DISPENSING_BASIC_FEE_BASES.FEE_2,
          secondOrLaterConcurrentPrescription: true,
        }),
      ],
    });
    const pointsOnly = expectPointsOnly(result, "24");
    expect(pointsOnly.trace.evidenceIds).toContain(evidenceId("EVD-CAL-0007"));
  });

  it("blocks two dispensing basic fee kinds on one reception via the exclusivity group", () => {
    const result = calculate(request(), {
      rules: [
        createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_1 }),
        createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_2 }),
      ],
    });
    const blocked = expectBlocked(result);
    expect(blocked.blockers[0]?.detail).toContain("dispensing-basic-fee");
  });

  it("composes a realistic reception (基本料1 47 + 内服24×2=48 + 湯薬15日 270 + 薬剤料2点 = 367点)", () => {
    const result = calculate(request(), {
      rules: [
        createDispensingBasicFeeRule({ base: DISPENSING_BASIC_FEE_BASES.FEE_1 }),
        createOralMedicinePreparationFeeRule("rp:1"),
        createOralMedicinePreparationFeeRule("rp:2"),
        createDecoctionPreparationFeeRule("rp:3", 15),
        createDrugFeeRule({ applicationKey: "rp:1", unitPriceYen: ScaledDecimal.fromString("16.40") }),
      ],
    });
    expectPointsOnly(result, "367");
  });

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
