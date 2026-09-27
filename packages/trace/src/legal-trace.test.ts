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

