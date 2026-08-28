import { describe, expect, it } from "vitest";
import { evidenceId } from "@yrese/shared-kernel";

import {
  collectCalculationTraceEvidenceIds,
  createCalculationTrace,
  createLegalTrace,
  isCanonicalTraceIntegerString,
  isPhiLikeIntermediateValueKey,
  type CalculationInputsSummary,
  type CalculationTraceStep,
  type EvidenceRef,
} from "./index.js";

describe("isPhiLikeIntermediateValueKey", () => {
  it("flags PHI-like keys (case-insensitive) as the single source of truth for trace/contracts", () => {
    for (const key of ["patientId", "PatientName", "address", "phone", "TEL", "email", "free_text", "freetext", "memo"]) {
      expect(isPhiLikeIntermediateValueKey(key)).toBe(true);
    }
  });

  it("accepts non-PHI calculation keys", () => {
    for (const key of ["basePoints", "multiplier", "rate", "subtotal"]) {
      expect(isPhiLikeIntermediateValueKey(key)).toBe(false);
    }
  });
});

describe("structured calculation trace integer strings", () => {
  it.each(["0", "1", "-1", "123456789012345678901234567890"])(
    "accepts canonical bigint string %s",
    (value) => {
      expect(isCanonicalTraceIntegerString(value)).toBe(true);
    },
  );

  it.each(["", " ", "NaN", "Infinity", "47.5", "1e3", "+1", "01", "-0"])(
    "rejects non-canonical integer string %j",
    (value) => {
      expect(isCanonicalTraceIntegerString(value)).toBe(false);
    },
  );

  it("rejects type-erased non-strings without coercion", () => {
    let coercions = 0;
    const result = isCanonicalTraceIntegerString({
      [Symbol.toPrimitive]() {
        coercions += 1;
        return "1";
      },
    } as never);

    expect({ result, coercions }).toEqual({ result: false, coercions: 0 });
  });
});

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

function freezeLegalEvidence(ref: EvidenceRef): EvidenceRef {
  return createLegalTrace({
    targetType: "feature",
    targetId: "feature:claim-preview",
    evidenceRefs: [ref],
    humanReviewRequired: true,
  }).evidenceRefs[0]!;
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
    expect(trace.steps[0]?.inputRefs).toEqual(["prescription-001", "drug-master:2026.04"]);
    expect(Object.isFrozen(trace.steps[0]?.inputRefs)).toBe(true);
    expect(Object.isFrozen(trace.evidenceIds)).toBe(true);
    expect(Object.isFrozen(trace.inputsSummary.ids)).toBe(true);
  });

  it("snapshots top-level calculation trace inputs once", () => {
    const reads = { masterVersion: 0, calculationRuleVersion: 0, steps: 0 };
    const firstSteps = [claimStep()];
    const trace = createCalculationTrace({
      inputsSummary,
      get masterVersion() {
        reads.masterVersion += 1;
        return reads.masterVersion === 1 ? "2026.04" : "forged-master";
      },
      get calculationRuleVersion() {
        reads.calculationRuleVersion += 1;
        return reads.calculationRuleVersion === 1 ? "draft-001" : "forged-rule";
      },
      get steps() {
        reads.steps += 1;
        return reads.steps === 1 ? firstSteps : [];
      },
    });

    expect(reads).toEqual({ masterVersion: 1, calculationRuleVersion: 1, steps: 1 });
    expect(trace.masterVersion).toBe("2026.04");
    expect(trace.calculationRuleVersion).toBe("draft-001");
    expect(trace.steps[0]?.stepId).toBe("step-001");
    expect(Object.isFrozen(trace.steps)).toBe(true);
  });

  it("preserves top-level calculation trace validation precedence", () => {
    let stepFieldReads = 0;
    const prototype = Object.create(Array.prototype) as CalculationTraceStep[];
    Object.defineProperty(prototype, 0, {
      get() {
        stepFieldReads += 1;
        return claimStep();
      },
    });
    const sparseSteps = new Array<CalculationTraceStep>(1);
    Object.setPrototypeOf(sparseSteps, prototype);

    const cases = [
      ["masterVersion", " ", "masterVersion must be a non-empty string", ["masterVersion"]],
      [
        "calculationRuleVersion",
        " ",
        "calculationRuleVersion must be a non-empty string",
        ["masterVersion", "calculationRuleVersion"],
      ],
      ["steps", sparseSteps, "Trace arrays must be dense", ["masterVersion", "calculationRuleVersion", "steps"]],
    ] as const;

    for (const [field, invalidValue, message, expectedReads] of cases) {
      const reads: (string | symbol)[] = [];
      const input = {
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      };
      Object.defineProperty(input, field, { value: invalidValue });

      expect(() =>
        createCalculationTrace(
          new Proxy(input, {
            get(target, property, receiver) {
              reads.push(property);
              return Reflect.get(target, property, receiver);
            },
          }),
        ),
      ).toThrow(new RangeError(message));
      expect(reads).toEqual(expectedReads);
    }
    expect(stepFieldReads).toBe(0);
  });

  it("snapshots known input-ref fields and preserves first-field error precedence", () => {
    const cases = [
      ["ids", "kind", "prescription", "unsupported", "id", "prescription-001", "forged-id", "TraceIdRef kind is not supported"],
      ["dates", "kind", "prescription_date", "unsupported", "value", "2026-07-09", "forged-date", "TraceDateRef kind is not supported"],
      ["masterVersions", "masterName", "drug", " ", "version", "2026.04", "forged-master-version", "TraceMasterVersionRef masterName must be a non-empty string"],
      ["ruleVersions", "ruleName", "dispensing-fee", " ", "version", "draft-001", "forged-rule-version", "TraceRuleVersionRef ruleName must be a non-empty string"],
    ] as const;

    for (const [collection, firstField, first, invalidFirst, secondField, second, forged, message] of cases) {
      const reads = { first: 0, second: 0, unknown: 0 };
      const ref = Object.defineProperties({}, {
        [firstField]: {
          enumerable: true,
          get() {
            reads.first += 1;
            return reads.first === 1 ? first : invalidFirst;
          },
        },
        [secondField]: {
          enumerable: true,
          get() {
            reads.second += 1;
            return reads.second === 1 ? second : forged;
          },
        },
        patient_name: {
          enumerable: true,
          get() {
            reads.unknown += 1;
            return "synthetic";
          },
        },
      });
      const trace = createCalculationTrace({
        inputsSummary: { ...inputsSummary, [collection]: [ref] } as unknown as CalculationInputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      });
      const frozenRef = trace.inputsSummary[collection]?.[0];

      expect(reads).toEqual({ first: 1, second: 1, unknown: 0 });
      expect(frozenRef).toEqual({ [firstField]: first, [secondField]: second });
      expect(Object.isFrozen(frozenRef)).toBe(true);

      let laterReads = 0;
      const invalidRef = Object.defineProperties({}, {
        [firstField]: { enumerable: true, value: invalidFirst },
        [secondField]: {
          enumerable: true,
          get() {
            laterReads += 1;
            return second;
          },
        },
      });
      expect(() =>
        createCalculationTrace({
          inputsSummary: { ...inputsSummary, [collection]: [invalidRef] } as unknown as CalculationInputsSummary,
          masterVersion: "2026.04",
          calculationRuleVersion: "draft-001",
          steps: [claimStep()],
        }),
      ).toThrow(new RangeError(message));
      expect(laterReads).toBe(0);
    }
  });

  it("snapshots input-summary collections once, including an absent ruleVersions", () => {
    const cases = [
      ["ids", inputsSummary.ids],
      ["dates", inputsSummary.dates],
      ["masterVersions", inputsSummary.masterVersions],
      ["ruleVersions", inputsSummary.ruleVersions ?? []],
      ["ruleVersions", undefined],
    ] as const;

    for (const [collection, firstRead] of cases) {
      let reads = 0;
      const summary = { ...inputsSummary };
      Object.defineProperty(summary, collection, {
        enumerable: true,
        get() {
          reads += 1;
          return reads === 1 ? firstRead : [];
        },
      });

      const trace = createCalculationTrace({
        inputsSummary: summary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      });

      expect(reads).toBe(1);
      expect(Object.hasOwn(trace.inputsSummary, collection)).toBe(true);
      expect(trace.inputsSummary[collection]).toEqual(firstRead ?? []);
      expect(Object.isFrozen(trace.inputsSummary[collection])).toBe(true);
    }
  });

  it("checks every input-summary collection type before dense arrays", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary: {
          ...inputsSummary,
          ids: new Array<(typeof inputsSummary.ids)[number]>(1),
          dates: "not-an-array" as unknown as CalculationInputsSummary["dates"],
        },
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      }),
    ).toThrow(new RangeError("inputsSummary.dates must be an array"));
  });

  it("reads each known step field once and omits unknown accessors", () => {
    const values = claimStep({
      feeItemCode: "FEE_DISPENSING_BASIC_1",
      formula: "fixed(47)",
      intermediateValues: { points: "47" },
      rounding: {
        method: "none",
        evidenceId: officialEvidence.evidenceId,
      },
      stepStatus: "applied",
      resultPoints: "47",
      resultYen: "470",
    });
    const reads: Record<string, number> = {};
    const step = Object.defineProperties(
      {},
      Object.fromEntries(
        Object.entries(values).map(([field, value]) => [
          field,
          {
            enumerable: true,
            get() {
              reads[field] = (reads[field] ?? 0) + 1;
              return field === "resultPoints" && reads[field] > 2 ? "NaN" : value;
            },
          },
        ]),
      ),
    ) as CalculationTraceStep;
    let unknownReads = 0;
    Object.defineProperty(step, "patient_name", {
      enumerable: true,
      get() {
        unknownReads += 1;
        return "synthetic";
      },
    });

    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [step],
    });

    expect(reads).toEqual(Object.fromEntries(Object.keys(values).map((field) => [field, 1])));
    expect(trace.steps[0]).toEqual(values);
    expect(unknownReads).toBe(0);
    expect(trace.steps[0]).not.toHaveProperty("patient_name");
  });

  it("rejects the first PHI-like intermediate-values snapshot", () => {
    let reads = 0;
    const step = {
      ...claimStep(),
      get intermediateValues(): Readonly<Record<string, string>> | undefined {
        reads += 1;
        return reads === 1 ? { patient_name: "synthetic" } : undefined;
      },
    } as unknown as CalculationTraceStep;

    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [step],
      }),
    ).toThrow(new RangeError("CalculationTraceStep intermediateValues must not include PHI-like keys"));
    expect(reads).toBe(1);
  });

  it("uses one affects-claim snapshot for validation and output", () => {
    let reads = 0;
    const step = {
      ...claimStep({ evidenceRefs: [] }),
      get affectsClaim() {
        reads += 1;
        return reads > 1;
      },
    };

    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [step],
    });

    expect({ reads, affectsClaim: trace.steps[0]?.affectsClaim }).toEqual({
      reads: 1,
      affectsClaim: false,
    });
  });

  it("does not read later step fields after an invalid step id", () => {
    let laterReads = 0;
    const step = new Proxy(claimStep(), {
      get(target, property, receiver) {
        if (property === "stepId") {
          return " ";
        }
        laterReads += 1;
        return Reflect.get(target, property, receiver);
      },
    });

    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [step],
      }),
    ).toThrow(new RangeError("CalculationTraceStep stepId must be a non-empty string"));
    expect(laterReads).toBe(0);
  });

  it("omits optional step fields whose snapshot is undefined", () => {
    const step = {
      ...claimStep(),
      feeItemCode: undefined,
    } as unknown as CalculationTraceStep;
    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [step],
    });

    expect(Object.hasOwn(trace.steps[0] ?? {}, "feeItemCode")).toBe(false);
  });

  it("rejects non-array step input refs", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            inputRefs: "abc" as unknown as CalculationTraceStep["inputRefs"],
          }),
        ],
      }),
    ).toThrow(new RangeError("Trace arrays must be an array"));
  });

  it("rejects unsupported input id and date kinds", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary: {
          ...inputsSummary,
          ids: [
            {
              kind: "patient_name" as never,
              id: "patient-001",
            },
          ],
        },
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      }),
    ).toThrow(/TraceIdRef kind/);

    expect(() =>
      createCalculationTrace({
        inputsSummary: {
          ...inputsSummary,
          dates: [
            {
              kind: "visit_date" as never,
              value: "2026-07-09",
            },
          ],
        },
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      }),
    ).toThrow(/TraceDateRef kind/);
  });

  it("rejects empty input refs and version refs", () => {
    expect(() =>
      createCalculationTrace({
        inputsSummary: {
          ...inputsSummary,
          ids: [{ kind: "patient", id: " " }],
        },
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      }),
    ).toThrow(/TraceIdRef id/);

    expect(() =>
      createCalculationTrace({
        inputsSummary: {
          ...inputsSummary,
          masterVersions: [{ masterName: "drug", version: "" }],
        },
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      }),
    ).toThrow(/TraceMasterVersionRef version/);

    expect(() =>
      createCalculationTrace({
        inputsSummary: {
          ...inputsSummary,
          ruleVersions: [{ ruleName: "", version: "draft-001" }],
        },
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [claimStep()],
      }),
    ).toThrow(/TraceRuleVersionRef ruleName/);
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

  it("uses one rounding-field snapshot for output and evidence aggregation", () => {
    const firstEvidenceId = evidenceId("evidence:official:rounding:first");
    const laterEvidenceId = evidenceId("evidence:official:rounding:later");
    let methodReads = 0;
    let evidenceIdReads = 0;
    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [
        claimStep({
          rounding: {
            get method() {
              methodReads += 1;
              return methodReads === 1 ? "none" : "";
            },
            get evidenceId() {
              evidenceIdReads += 1;
              return evidenceIdReads === 1 ? firstEvidenceId : laterEvidenceId;
            },
          },
        }),
      ],
    });

    expect({ methodReads, evidenceIdReads, rounding: trace.steps[0]?.rounding }).toEqual({
      methodReads: 1,
      evidenceIdReads: 1,
      rounding: { method: "none", evidenceId: firstEvidenceId },
    });
    expect(trace.evidenceIds).toEqual([
      officialEvidence.evidenceId,
      masterEvidence.evidenceId,
      firstEvidenceId,
    ]);
  });

  it("does not read rounding evidence after an invalid method", () => {
    let evidenceIdReads = 0;

    expect(() =>
      createCalculationTrace({
        inputsSummary,
        masterVersion: "2026.04",
        calculationRuleVersion: "draft-001",
        steps: [
          claimStep({
            rounding: {
              method: " ",
              get evidenceId() {
                evidenceIdReads += 1;
                return officialEvidence.evidenceId;
              },
            },
          }),
        ],
      }),
    ).toThrow(new RangeError("CalculationTraceStep rounding.method must be a non-empty string"));
    expect(evidenceIdReads).toBe(0);
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

  it.each([
    ["resultPoints", "NaN"],
    ["resultPoints", "47.5"],
    ["resultPoints", "1e3"],
    ["resultPoints", "01"],
    ["resultYen", "Infinity"],
    ["resultYen", "+1"],
    ["resultYen", "-0"],
  ] as const)("rejects non-canonical %s value %j", (field, value) => {
      expect(() =>
        createCalculationTrace({
          inputsSummary,
          masterVersion: "2026.04",
          calculationRuleVersion: "draft-001",
          steps: [claimStep({ [field]: value })],
        }),
      ).toThrow(new RegExp(`${field} must be a canonical base-10 integer string`));
    });

  it("collects a unique evidence-id set from step and rounding evidence", () => {
    expect(
      collectCalculationTraceEvidenceIds([
        {
          evidenceRefs: [{ evidenceId: "EVD-A" }, { evidenceId: "EVD-A" }],
          rounding: { evidenceId: "EVD-B" },
        },
        { evidenceRefs: [{ evidenceId: "EVD-C" }] },
      ]),
    ).toEqual(["EVD-A", "EVD-B", "EVD-C"]);
  });

  it("rejects sparse evidence collection steps", () => {
    const steps = new Array<{
      readonly evidenceRefs: readonly { readonly evidenceId: string }[];
    }>(1);

    expect(() => collectCalculationTraceEvidenceIds(steps)).toThrow(
      new RangeError("Trace arrays must be dense"),
    );
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

  it("snapshots evidence fields and omits non-wire properties", () => {
    const firstEvidenceId = evidenceId("evidence:official:snapshot:first");
    const laterEvidenceId = evidenceId("evidence:official:snapshot:later");
    const inheritedEvidenceId = evidenceId("evidence:master:inherited-options");
    const hiddenSymbol = Symbol("patient_name");
    const reads = { evidenceId: 0, sourceType: 0, title: 0, version: 0, effectiveFrom: 0 };
    let hiddenReads = 0;
    const statefulEvidence = {
      get evidenceId() {
        reads.evidenceId += 1;
        return reads.evidenceId === 1 ? firstEvidenceId : laterEvidenceId;
      },
      get sourceType() {
        reads.sourceType += 1;
        return reads.sourceType === 1 ? "official_spec" : "unsupported";
      },
      get title() {
        reads.title += 1;
        return reads.title === 1 ? "Synthetic official evidence" : " ";
      },
      get version() {
        reads.version += 1;
        return reads.version === 1 ? undefined : "forged-version";
      },
      get effectiveFrom() {
        reads.effectiveFrom += 1;
        return reads.effectiveFrom === 1 ? "2026-04-01" : "forged-date";
      },
    } as unknown as EvidenceRef;
    Object.defineProperties(statefulEvidence, {
      patient_name: {
        enumerable: false,
        get() {
          hiddenReads += 1;
          return "synthetic";
        },
      },
      [hiddenSymbol]: {
        enumerable: true,
        get() {
          hiddenReads += 1;
          return "synthetic";
        },
      },
    });
    const inheritedReads = { version: 0, effectiveFrom: 0 };
    const inheritedEvidence = Object.assign(
      Object.create({
        get version() {
          inheritedReads.version += 1;
          return "inherited-version";
        },
      }),
      {
        evidenceId: inheritedEvidenceId,
        sourceType: "master" as const,
        title: "Synthetic master evidence",
      },
    ) as EvidenceRef;
    Object.defineProperty(inheritedEvidence, "effectiveFrom", {
      enumerable: false,
      get() {
        inheritedReads.effectiveFrom += 1;
        return "2026-04-01";
      },
    });

    const trace = createCalculationTrace({
      inputsSummary,
      masterVersion: "2026.04",
      calculationRuleVersion: "draft-001",
      steps: [claimStep({ evidenceRefs: [statefulEvidence, inheritedEvidence] })],
    });
    const first = trace.steps[0]?.evidenceRefs[0];
    const second = trace.steps[0]?.evidenceRefs[1];

    expect({ reads, hiddenReads, inheritedReads }).toEqual({
      reads: { evidenceId: 1, sourceType: 1, title: 1, version: 1, effectiveFrom: 1 },
      hiddenReads: 0,
      inheritedReads: { version: 0, effectiveFrom: 0 },
    });
    expect(first).toEqual({
      evidenceId: firstEvidenceId,
      sourceType: "official_spec",
      title: "Synthetic official evidence",
      version: undefined,
      effectiveFrom: "2026-04-01",
    });
    expect(Object.hasOwn(first ?? {}, "version")).toBe(true);
    expect(Reflect.ownKeys(first ?? {})).toEqual(["evidenceId", "sourceType", "title", "version", "effectiveFrom"]);
    expect(Reflect.ownKeys(second ?? {})).toEqual(["evidenceId", "sourceType", "title"]);
    expect(trace.evidenceIds).toEqual([firstEvidenceId, inheritedEvidenceId]);
  });

  it("rejects own and inherited unknown evidence fields without reading their values", () => {
    for (const inherited of [false, true]) {
      let reads = 0;
      const prototype = inherited
        ? Object.defineProperty({}, "patient_name", {
            enumerable: true,
            get() {
              reads += 1;
              return "synthetic";
            },
          })
        : Object.prototype;
      const ref = Object.assign(Object.create(prototype), officialEvidence) as EvidenceRef;
      if (!inherited) {
        Object.defineProperty(ref, "patient_name", {
          enumerable: true,
          get() {
            reads += 1;
            return "synthetic";
          },
        });
      }

      expect(() => freezeLegalEvidence(ref)).toThrow(new RangeError("EvidenceRef must not include unknown fields"));
      expect(reads).toBe(0);
    }
  });

  it("preserves evidence validation precedence ahead of unknown-field rejection", () => {
    let urlReads = 0;
    let titleReads = 0;
    const urlRef = Object.defineProperty({ ...officialEvidence, patient_name: "synthetic" }, "url", {
      enumerable: true,
      get() {
        urlReads += 1;
        return "https://example.invalid";
      },
    }) as EvidenceRef;
    const invalidEvidenceId = Object.defineProperty(
      { ...officialEvidence, evidenceId: " " as never, patient_name: "synthetic" },
      "title",
      {
        enumerable: true,
        get() {
          titleReads += 1;
          return officialEvidence.title;
        },
      },
    ) as EvidenceRef;
    const cases: readonly (readonly [EvidenceRef, string])[] = [
      [urlRef, "EvidenceRef must not include url; URLs live in source_registry"],
      [
        { ...officialEvidence, sourceType: "unsupported" as never, patient_name: "synthetic" } as EvidenceRef,
        "EvidenceRef sourceType is not supported",
      ],
      [invalidEvidenceId, "EvidenceRef evidenceId must be a non-empty string"],
      [
        { ...officialEvidence, title: " ", patient_name: "synthetic" } as EvidenceRef,
        "EvidenceRef title must be a non-empty string",
      ],
    ];

    for (const [ref, message] of cases) {
      expect(() => freezeLegalEvidence(ref)).toThrow(new RangeError(message));
    }
    expect({ urlReads, titleReads }).toEqual({ urlReads: 0, titleReads: 0 });
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
  it("snapshots top-level legal trace inputs once", () => {
    const reads = { targetType: 0, targetId: 0, humanReviewRequired: 0, evidenceRefs: 0 };
    const firstEvidenceRefs = [officialEvidence];
    const trace = createLegalTrace({
      get targetType() {
        reads.targetType += 1;
        return reads.targetType === 1 ? "feature" : "screen";
      },
      get targetId() {
        reads.targetId += 1;
        return reads.targetId === 1 ? "feature:claim-preview" : "forged-target";
      },
      get humanReviewRequired() {
        reads.humanReviewRequired += 1;
        return reads.humanReviewRequired === 1;
      },
      get evidenceRefs() {
        reads.evidenceRefs += 1;
        return reads.evidenceRefs === 1 ? firstEvidenceRefs : [];
      },
    });

    expect(reads).toEqual({ targetType: 1, targetId: 1, humanReviewRequired: 1, evidenceRefs: 1 });
    expect(trace.targetType).toBe("feature");
    expect(trace.targetId).toBe("feature:claim-preview");
    expect(trace.humanReviewRequired).toBe(true);
    expect(trace.evidenceRefs).toEqual([officialEvidence]);
    expect(Object.isFrozen(trace.evidenceRefs)).toBe(true);
  });

  it("preserves top-level legal trace validation precedence", () => {
    const cases = [
      ["targetType", "endpoint", "LegalTrace targetType is not supported", ["targetType"]],
      ["targetId", " ", "targetId must be a non-empty string", ["targetType", "targetId"]],
      [
        "humanReviewRequired",
        "yes",
        "LegalTrace humanReviewRequired must be a boolean",
        ["targetType", "targetId", "humanReviewRequired"],
      ],
      [
        "evidenceRefs",
        new Array<EvidenceRef>(1),
        "Trace arrays must be dense",
        ["targetType", "targetId", "humanReviewRequired", "evidenceRefs"],
      ],
    ] as const;

    for (const [field, invalidValue, message, expectedReads] of cases) {
      const reads: (string | symbol)[] = [];
      const input = {
        targetType: "feature",
        targetId: "feature:claim-preview",
        evidenceRefs: [officialEvidence],
        humanReviewRequired: true,
      } satisfies Parameters<typeof createLegalTrace>[0];
      Object.defineProperty(input, field, { value: invalidValue });

      expect(() =>
        createLegalTrace(
          new Proxy(input, {
            get(target, property, receiver) {
              reads.push(property);
              return Reflect.get(target, property, receiver);
            },
          }),
        ),
      ).toThrow(new RangeError(message));
      expect(reads).toEqual(expectedReads);
    }
  });

  it("rejects sparse evidence refs", () => {
    expect(() =>
      createLegalTrace({
        targetType: "feature",
        targetId: "feature:claim-preview",
        evidenceRefs: new Array<EvidenceRef>(1),
        humanReviewRequired: true,
      }),
    ).toThrow(new RangeError("Trace arrays must be dense"));
  });

  it("rejects inherited evidence refs without invoking accessors", () => {
    let accessorInvoked = false;
    const prototype = Object.create(Array.prototype) as EvidenceRef[];
    Object.defineProperty(prototype, 0, {
      get() {
        accessorInvoked = true;
        return officialEvidence;
      },
    });
    const evidenceRefs = new Array<EvidenceRef>(1);
    Object.setPrototypeOf(evidenceRefs, prototype);

    expect(() =>
      createLegalTrace({
        targetType: "feature",
        targetId: "feature:claim-preview",
        evidenceRefs,
        humanReviewRequired: true,
      }),
    ).toThrow(new RangeError("Trace arrays must be dense"));
    expect(accessorInvoked).toBe(false);
  });

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

  it("rejects unsupported target types and invalid review flags", () => {
    expect(() =>
      createLegalTrace({
        targetType: "endpoint" as never,
        targetId: "feature:claim-preview",
        evidenceRefs: [officialEvidence],
        humanReviewRequired: true,
      }),
    ).toThrow(/targetType/);

    expect(() =>
      createLegalTrace({
        targetType: "feature",
        targetId: "feature:claim-preview",
        evidenceRefs: [officialEvidence],
        humanReviewRequired: "yes" as never,
      }),
    ).toThrow(/humanReviewRequired/);
  });
});
