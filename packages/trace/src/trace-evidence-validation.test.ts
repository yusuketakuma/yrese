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


describe("createCalculationTrace evidence field validation", () => {
  it("preserves evidence collection field validation precedence", () => {
    let roundingReads = 0;

    expect(() =>
      collectCalculationTraceEvidenceIds([
        {
          evidenceRefs: new Array<{ readonly evidenceId: string }>(1),
          get rounding() {
            roundingReads += 1;
            return { evidenceId: "EVD-B" };
          },
        },
      ]),
    ).toThrow(new RangeError("Trace arrays must be dense"));
    expect(roundingReads).toBe(0);
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


