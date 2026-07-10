import {
  CALCULATION_TRACE_STEP_STATUSES,
  EVIDENCE_SOURCE_TYPES,
  TRACE_DATE_REF_KINDS,
  TRACE_ID_REF_KINDS,
  type CalculationInputsSummary,
  type CalculationTrace,
  type CalculationTraceStep,
  type EvidenceRef,
} from "@yrese/trace";
import { describe, expect, it } from "vitest";

import {
  calculationInputsSummarySchema,
  calculationTraceSchema,
  calculationTraceStepStatusSchema,
  evidenceRefSchema,
  evidenceSourceTypeSchema,
  traceDateRefKindSchema,
  traceIdRefKindSchema,
  type CalculationInputsSummaryWire,
  type CalculationTraceStepWire,
  type CalculationTraceWire,
  type EvidenceRefWire,
} from "./calculation-trace.js";

/**
 * 契約 §8: zod 写像 ⇔ @yrese/trace 型のフィールド集合・必須/optional 一致をコンパイル時に保証する。
 * @yrese/trace 側にフィールド追加/改名/optional 変更があれば typecheck が破断しドリフトを捕捉する。
 * EvidenceRef の `url?: never`(§9 で契約は非搭載)だけは比較から除外する。
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type OptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T];

type _TraceKeyParity = Expect<Equal<keyof CalculationTraceWire, keyof CalculationTrace>>;
type _TraceOptionalParity = Expect<Equal<OptionalKeys<CalculationTraceWire>, OptionalKeys<CalculationTrace>>>;
type _StepKeyParity = Expect<Equal<keyof CalculationTraceStepWire, keyof CalculationTraceStep>>;
type _StepOptionalParity = Expect<Equal<OptionalKeys<CalculationTraceStepWire>, OptionalKeys<CalculationTraceStep>>>;
type _InputsKeyParity = Expect<Equal<keyof CalculationInputsSummaryWire, keyof CalculationInputsSummary>>;
type _InputsOptionalParity = Expect<
  Equal<OptionalKeys<CalculationInputsSummaryWire>, OptionalKeys<CalculationInputsSummary>>
>;
type _EvidenceKeyParity = Expect<Equal<keyof EvidenceRefWire, Exclude<keyof EvidenceRef, "url">>>;
type _EvidenceOptionalParity = Expect<
  Equal<OptionalKeys<EvidenceRefWire>, Exclude<OptionalKeys<EvidenceRef>, "url">>
>;

/** 合成・PHI-free の代表 trace(affectsClaim=true → evidenceRefs≥1 を満たす正常 fixture)。 */
const validTrace = {
  inputsSummary: {
    ids: [
      { kind: "tenant", id: "tenant-syn-001" },
      { kind: "pharmacy", id: "pharmacy-syn-001" },
      { kind: "prescription", id: "prescription-syn-001" },
    ],
    dates: [
      { kind: "prescription_date", value: "2026-06-10" },
      { kind: "claim_month", value: "2026-06" },
    ],
    masterVersions: [{ masterName: "calculation", version: "R8" }],
    ruleVersions: [{ ruleName: "calculation", version: "v0.1.0" }],
  },
  masterVersion: "R8",
  calculationRuleVersion: "v0.1.0",
  steps: [
    {
      stepId: "EVD-CAL-0001:dispensing-basic-fee-1",
      description: "調剤基本料1: 受付につき47点",
      affectsClaim: true,
      evidenceRefs: [
        {
          evidenceId: "EVD-CAL-0001",
          sourceType: "notification",
          title: "調剤報酬点数表(令和8年告示第69号)別表第三",
          version: "R8",
        },
      ],
      inputRefs: ["prescription.prescriptionId"],
      output: "itemPoints=47",
      feeItemCode: "0001",
      stepStatus: "applied",
      resultPoints: "47",
    },
  ],
  warnings: [],
  blockers: [],
  evidenceIds: ["EVD-CAL-0001"],
} as const;

describe("calculation-trace enum mapping (API-007 §2/§8)", () => {
  it("sources enum values from @yrese/trace const tuples, not local hand-writing", () => {
    expect(evidenceSourceTypeSchema.options).toEqual([...EVIDENCE_SOURCE_TYPES]);
    expect(traceIdRefKindSchema.options).toEqual([...TRACE_ID_REF_KINDS]);
    expect(traceDateRefKindSchema.options).toEqual([...TRACE_DATE_REF_KINDS]);
    expect(calculationTraceStepStatusSchema.options).toEqual([...CALCULATION_TRACE_STEP_STATUSES]);
  });

  it("rejects an unknown sourceType / stepStatus at the wire boundary", () => {
    expect(() => evidenceSourceTypeSchema.parse("wikipedia")).toThrow();
    expect(() => calculationTraceStepStatusSchema.parse("finalized")).toThrow();
  });
});

describe("calculationTraceSchema round-trip (API-007 §3/§8)", () => {
  it("parses a synthetic PHI-free trace unchanged", () => {
    expect(calculationTraceSchema.parse(validTrace)).toEqual(validTrace);
  });

  it("accepts a BLOCKED trace with empty steps and non-empty blockers", () => {
    const blocked = {
      ...validTrace,
      steps: [],
      blockers: ["BLOCKED_REGULATORY_REVIEW"],
      evidenceIds: [],
    };
    expect(calculationTraceSchema.parse(blocked)).toEqual(blocked);
  });

  it("structurally accepts the affectsClaim/empty-evidence anomaly (display side rejects it — §7)", () => {
    const anomaly = {
      ...validTrace,
      steps: [{ ...validTrace.steps[0], evidenceRefs: [] }],
      evidenceIds: [],
    };
    // 契約は構造的には受理する。正当な確定根拠としての排除は SCR-012 ビューアの責務(§8)。
    expect(() => calculationTraceSchema.parse(anomaly)).not.toThrow();
  });

  it.each([
    ["resultPoints", "NaN"],
    ["resultPoints", "47.5"],
    ["resultPoints", "1e3"],
    ["resultPoints", "01"],
    ["resultYen", "Infinity"],
    ["resultYen", "+1"],
    ["resultYen", "-0"],
  ] as const)("rejects non-canonical %s value %j", (field, value) => {
      const invalid = {
        ...validTrace,
        steps: [{ ...validTrace.steps[0], [field]: value }],
      };
      expect(() => calculationTraceSchema.parse(invalid)).toThrow(
        /canonical base-10 integer string/,
      );
    });

  it("requires evidenceIds to equal the unique set derived from steps and rounding", () => {
    const withRounding = {
      ...validTrace,
      steps: [
        {
          ...validTrace.steps[0],
          rounding: { method: "round", evidenceId: "EVD-ROUND-0001" },
        },
      ],
      evidenceIds: ["EVD-ROUND-0001", "EVD-CAL-0001"],
    };
    expect(calculationTraceSchema.parse(withRounding)).toEqual(withRounding);

    for (const evidenceIds of [
      [],
      ["EVD-CAL-0001", "EVD-FORGED"],
      ["EVD-CAL-0001", "EVD-CAL-0001"],
    ]) {
      expect(() => calculationTraceSchema.parse({ ...validTrace, evidenceIds })).toThrow(
        /unique set derived from step and rounding evidence/,
      );
    }
  });
});

describe("calculation-trace PHI and url invariants (API-007 §5/§9)", () => {
  it("rejects an EvidenceRef that carries a url", () => {
    expect(() =>
      evidenceRefSchema.parse({
        evidenceId: "EVD-CAL-0001",
        sourceType: "notification",
        title: "告示",
        url: "https://example.test/notice",
      }),
    ).toThrow();
  });

  it("rejects intermediateValues with PHI-like or blank keys", () => {
    const withPhiKey = {
      ...validTrace,
      steps: [
        {
          ...validTrace.steps[0],
          intermediateValues: { patientName: "x" },
        },
      ],
    };
    expect(() => calculationTraceSchema.parse(withPhiKey)).toThrow();

    const withBlankKey = {
      ...validTrace,
      steps: [{ ...validTrace.steps[0], intermediateValues: { "  ": "1" } }],
    };
    expect(() => calculationTraceSchema.parse(withBlankKey)).toThrow();
  });

  it("accepts non-PHI intermediateValues (bigint-derived strings)", () => {
    const withValues = {
      ...validTrace,
      steps: [
        {
          ...validTrace.steps[0],
          intermediateValues: { basePoints: "47", multiplier: "1" },
        },
      ],
    };
    expect(() => calculationTraceSchema.parse(withValues)).not.toThrow();
  });
});

describe("calculation-trace field validation (API-007 §3)", () => {
  it("requires non-empty stepId / description / output", () => {
    for (const field of ["stepId", "description", "output"] as const) {
      const broken = {
        ...validTrace,
        steps: [{ ...validTrace.steps[0], [field]: "  " }],
      };
      expect(() => calculationTraceSchema.parse(broken)).toThrow();
    }
  });

  it("requires rounding.evidenceId when rounding is present", () => {
    const missingEvidence = {
      ...validTrace,
      steps: [{ ...validTrace.steps[0], rounding: { method: "四捨五入", evidenceId: "" } }],
    };
    expect(() => calculationTraceSchema.parse(missingEvidence)).toThrow();
  });

  it("rejects a missing required top-level field", () => {
    const { masterVersion: _dropped, ...withoutMaster } = validTrace;
    expect(() => calculationTraceSchema.parse(withoutMaster)).toThrow();
  });

  it("accepts inputsSummary without optional ruleVersions", () => {
    const { ruleVersions: _dropped, ...summaryWithoutRuleVersions } = validTrace.inputsSummary;
    expect(() => calculationInputsSummarySchema.parse(summaryWithoutRuleVersions)).not.toThrow();
  });
});
