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

describe("calculation rule input validation", () => {
  it("rejects a non-string application key without invoking its trim method", () => {
    let trimCalls = 0;
    const value = {
      trim() {
        trimCalls += 1;
        return "oral-medicine:1";
      },
    };

    expect(() =>
      createOralMedicinePreparationFeeRule(value as unknown as string),
    ).toThrowError(new RangeError("applicationKey must be a non-empty string"));
    expect(trimCalls).toBe(0);
  });

  it.each([null, undefined])("normalizes a type-erased application key to RangeError", (value) => {
    expect(() =>
      createOralMedicinePreparationFeeRule(value as unknown as string),
    ).toThrowError(new RangeError("applicationKey must be a non-empty string"));
  });
});

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
