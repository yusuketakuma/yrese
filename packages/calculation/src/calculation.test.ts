import { describe, expect, it } from "vitest";
import { ClaimMonth, DispensingDate, PrescriptionDate, ReceptionDate } from "@yrese/date-time";
import { Points, Yen } from "@yrese/money";
import { evidenceId } from "@yrese/shared-kernel";
import {
  dispensingId,
  patientId,
  pharmacyId,
  prescriptionId,
  tenantId,
  type BlockerType,
} from "@yrese/shared-kernel";

import { calculate, type CalculationRequest, type CalculationRuleSet } from "./index.js";

function request(): CalculationRequest {
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
      dispensingDate: DispensingDate.fromString("2026-07-02"),
    },
    receptionDate: ReceptionDate.fromString("2026-07-03"),
    claimMonth: ClaimMonth.fromString("2026-07"),
    masterVersion: "master-draft-001",
    calculationRuleVersion: "rules-unapproved-001",
  };
}

describe("calculate", () => {
  it("always returns BLOCKED for an empty ruleset", () => {
    const result = calculate(request(), { rules: [] });

    expect(result.status).toBe("BLOCKED");
    if (result.status !== "BLOCKED") {
      throw new Error("expected empty ruleset to be blocked");
    }
    expect(result.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "Calculation rules are not approved. Actual scoring remains blocked until regulatory review completes.",
      },
    ]);
    expect(result.trace.steps).toEqual([
      {
        stepId: "blocked:regulatory-review",
        description: "Stop calculation because no approved calculation rules are available",
        affectsClaim: false,
        evidenceRefs: [],
        inputRefs: [],
        output: "BLOCKED_REGULATORY_REVIEW",
      },
    ]);
    expect(result.trace.evidenceIds).toEqual([]);
  });

  it("delegates claim-affecting evidence enforcement to trace creation", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:claim-affecting-without-evidence",
          evidenceRefs: [],
          apply: () => ({
            status: "CALCULATED",
            description: "Claim-affecting placeholder rule without evidence",
            affectsClaim: true,
            output: "total=0",
            total: Points.fromInteger(0),
            patientCopay: Yen.fromInteger(0),
          }),
        },
      ],
    };

    expect(() => calculate(request(), ruleSet)).toThrow(/require at least one evidenceRef/);
  });

  it("blocks multiple calculated rules until aggregation semantics are approved", () => {
    const ruleSet: CalculationRuleSet = {
      rules: [
        {
          ruleId: "rule:first-calculated",
          evidenceRefs: [
            {
              evidenceId: evidenceId("evidence:internal:first-calculated"),
              sourceType: "internal_ssot",
              title: "First placeholder calculation evidence",
            },
          ],
          apply: () => ({
            status: "CALCULATED",
            description: "First placeholder calculated result",
            affectsClaim: true,
            output: "total=1",
            total: Points.fromInteger(1),
            patientCopay: Yen.fromInteger(1),
          }),
        },
        {
          ruleId: "rule:second-calculated",
          evidenceRefs: [
            {
              evidenceId: evidenceId("evidence:internal:second-calculated"),
              sourceType: "internal_ssot",
              title: "Second placeholder calculation evidence",
            },
          ],
          apply: () => ({
            status: "CALCULATED",
            description: "Second placeholder calculated result",
            affectsClaim: true,
            output: "total=2",
            total: Points.fromInteger(2),
            patientCopay: Yen.fromInteger(2),
          }),
        },
      ],
    };

    const result = calculate(request(), ruleSet);

    expect(result.status).toBe("BLOCKED");
    if (result.status !== "BLOCKED") {
      throw new Error("expected multiple calculated rules to be blocked");
    }
    expect(result.blockers).toEqual([
      {
        type: "SSOT_UPDATE_REQUIRED" satisfies BlockerType,
        detail: "aggregation semantics for multiple calculated rules are undefined; define in calculation engine design SSOT",
      },
    ]);
    expect(result.trace.steps.map((step) => step.stepId)).toEqual([
      "rule:first-calculated",
      "rule:second-calculated",
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const first = calculate(request(), { rules: [] });
    const second = calculate(request(), { rules: [] });

    expect(second).toEqual(first);
  });
});
