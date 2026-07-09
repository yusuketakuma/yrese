import { describe, expect, it } from "vitest";
import { evidenceId } from "@yrese/shared-kernel";

import {
  createCalculationTrace,
  createLegalTrace,
  type CalculationInputsSummary,
  type CalculationTraceStep,
  type EvidenceRef,
} from "./index.js";

const officialEvidence: EvidenceRef = {
  evidenceId: evidenceId("evidence:official:dispensing-fee:v1"),
  sourceType: "official_spec",
  title: "Dispensing fee official specification",
  version: "v1",
  effectiveFrom: "2026-04-01",
};

const masterEvidence: EvidenceRef = {
  evidenceId: evidenceId("evidence:master:drug:v1"),
  sourceType: "master",
  title: "Drug master",
  version: "2026.04",
};

const inputsSummary: CalculationInputsSummary = {
  ids: [
    {
      kind: "prescription",
      id: "prescription-001",
    },
    {
      kind: "claim",
      id: "claim-001",
    },
  ],
  dates: [
    {
      kind: "prescription_date",
      value: "2026-07-09",
    },
    {
      kind: "claim_month",
      value: "2026-07",
    },
  ],
  masterVersions: [
    {
      masterName: "drug",
      version: "2026.04",
    },
  ],
  ruleVersions: [
    {
      ruleName: "dispensing-fee",
      version: "draft-001",
    },
  ],
};

function claimStep(overrides: Partial<CalculationTraceStep> = {}): CalculationTraceStep {
  return {
    stepId: "step-001",
    description: "Apply claim-affecting dispensing fee rule",
    affectsClaim: true,
    evidenceRefs: [officialEvidence, masterEvidence],
    inputRefs: ["prescription-001", "drug-master:2026.04"],
    output: "points=10",
    ...overrides,
  };
}

describe("createCalculationTrace", () => {
  it("creates immutable calculation traces and aggregates evidence ids", () => {
    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [claimStep()],
      warnings: ["review pending"],
    });

    expect(trace.evidenceIds).toEqual([officialEvidence.evidenceId, masterEvidence.evidenceId]);
    expect(trace.inputsSummary.ids[0]).toEqual({
      kind: "prescription",
      id: "prescription-001",
    });
    expect(Object.isFrozen(trace)).toBe(true);
    expect(Object.isFrozen(trace.steps)).toBe(true);
    expect(Object.isFrozen(trace.steps[0])).toBe(true);
    expect(Object.isFrozen(trace.steps[0]?.evidenceRefs)).toBe(true);
    expect(Object.isFrozen(trace.inputsSummary.ids)).toBe(true);
  });

  it("accepts immutable CAL-008 optional extension fields without breaking existing steps", () => {
    const roundingEvidence = evidenceId("evidence:official:rounding:v1");
    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [
        claimStep({
          feeItemCode: "FEE_DISPENSING_BASIC_1",
          formula: "fixed(47)",
          intermediateValues: {
            points: "47",
            master_version: "2026.04",
          },
          rounding: {
            method: "none",
            evidenceId: roundingEvidence,
          },
          stepStatus: "applied",
          resultPoints: "47",
          resultYen: "470",
        }),
      ],
    });

    expect(trace.steps[0]).toMatchObject({
      feeItemCode: "FEE_DISPENSING_BASIC_1",
      formula: "fixed(47)",
      stepStatus: "applied",
      resultPoints: "47",
      resultYen: "470",
    });
    expect(trace.steps[0]?.intermediateValues).toEqual({
      points: "47",
      master_version: "2026.04",
    });
    expect(trace.steps[0]?.rounding).toEqual({
      method: "none",
      evidenceId: roundingEvidence,
    });
    expect(trace.evidenceIds).toEqual([
      officialEvidence.evidenceId,
      masterEvidence.evidenceId,
      roundingEvidence,
    ]);
    expect(Object.isFrozen(trace.steps[0]?.intermediateValues)).toBe(true);
    expect(Object.isFrozen(trace.steps[0]?.rounding)).toBe(true);
  });

  it("rejects claim-affecting steps without evidence refs", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep({ evidenceRefs: [] })],
      }),
    ).toThrow(/require at least one evidenceRef/);
  });

  it("keeps claim-affecting evidence enforcement for suggested and excluded extension steps", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            stepStatus: "suggested",
            evidenceRefs: [],
          }),
          claimStep({
            stepId: "step-002",
            stepStatus: "excluded",
            evidenceRefs: [],
          }),
        ],
      }),
    ).toThrow(/require at least one evidenceRef/);
  });

  it("rejects rounding without an evidence id", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            rounding: {
              method: "round_half_up",
            },
          } as unknown as Partial<CalculationTraceStep>),
        ],
      }),
    ).toThrow(/rounding\.evidenceId/);
  });

  it("rejects unsupported step statuses", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            stepStatus: "pending" as CalculationTraceStep["stepStatus"],
          } as unknown as Partial<CalculationTraceStep>),
        ],
      }),
    ).toThrow(/stepStatus/);
  });

  it("rejects non-string or PHI-like intermediate values", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            intermediateValues: {
              points: 47,
            },
          } as unknown as Partial<CalculationTraceStep>),
        ],
      }),
    ).toThrow(/intermediateValues values must be strings/);

    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            intermediateValues: {
              patient_name: "DO_NOT_CAPTURE",
            },
          }),
        ],
      }),
    ).toThrow(/PHI-like/);
  });

  it("allows non-claim-affecting steps without evidence refs", () => {
    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [
        claimStep({
          affectsClaim: false,
          evidenceRefs: [],
          description: "Normalize an input reference without changing claim output",
        }),
      ],
    });

    expect(trace.evidenceIds).toEqual([]);
    expect(trace.steps[0]?.affectsClaim).toBe(false);
  });

  it("deduplicates evidence ids across steps", () => {
    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [claimStep(), claimStep({ stepId: "step-002", evidenceRefs: [officialEvidence] })],
    });

    expect(trace.evidenceIds).toEqual([officialEvidence.evidenceId, masterEvidence.evidenceId]);
  });

  it("rejects evidence refs that inline urls", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            evidenceRefs: [
              {
                ...officialEvidence,
                url: "https://example.invalid",
              } as EvidenceRef,
            ],
          }),
        ],
      }),
    ).toThrow(/must not include url/);
  });
});

describe("createLegalTrace", () => {
  it("creates immutable legal trace mappings", () => {
    const trace = createLegalTrace({
      targetType: "feature",
      targetId: "feature:claim-preview",
      evidenceRefs: [officialEvidence],
      humanReviewRequired: true,
    });

    expect(trace.targetType).toBe("feature");
    expect(trace.evidenceRefs).toEqual([officialEvidence]);
    expect(trace.humanReviewRequired).toBe(true);
    expect(Object.isFrozen(trace)).toBe(true);
    expect(Object.isFrozen(trace.evidenceRefs)).toBe(true);
  });
});
