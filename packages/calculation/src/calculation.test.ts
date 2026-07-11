/**
 * 原本再照合まで暫定(CAL-004 §6)。
 * Golden expectations below are derived only from CAL-003 evidence values.
 */
import { describe, expect, it } from "vitest";
import { CalendarDate, ClaimMonth, DispensingDate, PrescriptionDate, ReceptionDate } from "@yrese/date-time";
import { Points } from "@yrese/money";
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
  calculate,
  calculationRulesV20260601,
  createOralMedicinePreparationFeeRule,
  dispensingBasicFee1Rule,
  dispensingManagementFee2Rule,
  invalidStepResultWarning,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
  requirementsNotVerifiedWarning,
  type BlockedCalculationResult,
  type CalculationRequest,
  type CalculationResult,
  type CalculationRule,
  type CalculationRuleSet,
  type PointsOnlyCopayBlockedCalculationResult,
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
