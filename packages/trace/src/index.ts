import type { EvidenceId } from "@yrese/shared-kernel";

export type EvidenceSourceType =
  | "law"
  | "notification"
  | "official_spec"
  | "master"
  | "guideline"
  | "jahis"
  | "internal_ssot";

export interface EvidenceRef {
  readonly evidenceId: EvidenceId;
  readonly sourceType: EvidenceSourceType;
  readonly title: string;
  readonly version?: string;
  readonly effectiveFrom?: string;
  readonly url?: never;
}

export interface TraceIdRef {
  readonly kind: "tenant" | "pharmacy" | "patient" | "prescription" | "dispensing" | "claim" | "device" | "event";
  readonly id: string;
}

export interface TraceDateRef {
  readonly kind: "prescription_date" | "dispensing_date" | "reception_date" | "claim_month" | "service_date";
  readonly value: string;
}

export interface TraceMasterVersionRef {
  readonly masterName: string;
  readonly version: string;
}

export interface TraceRuleVersionRef {
  readonly ruleName: string;
  readonly version: string;
}

/**
 * PHI を含めない入力要約。
 *
 * 患者氏名・住所・電話番号・自由記述などの name/text fields は持たせない。
 * 参照は ids、診療系日付、master/rule version に限定する。
 */
export interface CalculationInputsSummary {
  readonly ids: readonly TraceIdRef[];
  readonly dates: readonly TraceDateRef[];
  readonly masterVersions: readonly TraceMasterVersionRef[];
  readonly ruleVersions?: readonly TraceRuleVersionRef[];
}

export interface CalculationTraceStep {
  readonly stepId: string;
  readonly description: string;
  readonly affectsClaim: boolean;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly inputRefs: readonly string[];
  readonly output: string;
}

export interface CalculationTrace {
  readonly inputsSummary: CalculationInputsSummary;
  readonly masterVersion: string;
  readonly calculationRuleVersion: string;
  readonly steps: readonly CalculationTraceStep[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
  readonly evidenceIds: readonly EvidenceId[];
}

export type LegalTraceTargetType = "feature" | "screen" | "report" | "data" | "operation";

export interface LegalTrace {
  readonly targetType: LegalTraceTargetType;
  readonly targetId: string;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly humanReviewRequired: boolean;
}

export interface CreateCalculationTraceInput {
  readonly inputsSummary: CalculationInputsSummary;
  readonly masterVersion: string;
  readonly calculationRuleVersion: string;
  readonly steps: readonly CalculationTraceStep[];
  readonly warnings?: readonly string[];
  readonly blockers?: readonly string[];
}

export interface CreateLegalTraceInput {
  readonly targetType: LegalTraceTargetType;
  readonly targetId: string;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly humanReviewRequired: boolean;
}

const sourceTypes = new Set<EvidenceSourceType>([
  "law",
  "notification",
  "official_spec",
  "master",
  "guideline",
  "jahis",
  "internal_ssot",
]);

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function freezeEvidenceRef(ref: EvidenceRef): EvidenceRef {
  if ("url" in ref) {
    throw new RangeError("EvidenceRef must not include url; URLs live in source_registry");
  }
  if (!sourceTypes.has(ref.sourceType)) {
    throw new RangeError("EvidenceRef sourceType is not supported");
  }
  assertNonEmptyString(ref.evidenceId, "EvidenceRef evidenceId");
  assertNonEmptyString(ref.title, "EvidenceRef title");

  return Object.freeze({ ...ref });
}

function freezeInputsSummary(summary: CalculationInputsSummary): CalculationInputsSummary {
  return Object.freeze({
    ids: freezeArray(summary.ids.map((ref) => Object.freeze({ ...ref }))),
    dates: freezeArray(summary.dates.map((ref) => Object.freeze({ ...ref }))),
    masterVersions: freezeArray(summary.masterVersions.map((ref) => Object.freeze({ ...ref }))),
    ruleVersions: freezeArray((summary.ruleVersions ?? []).map((ref) => Object.freeze({ ...ref }))),
  });
}

function freezeStep(step: CalculationTraceStep): CalculationTraceStep {
  assertNonEmptyString(step.stepId, "CalculationTraceStep stepId");
  assertNonEmptyString(step.description, "CalculationTraceStep description");

  const evidenceRefs = freezeArray(step.evidenceRefs.map(freezeEvidenceRef));
  if (step.affectsClaim && evidenceRefs.length === 0) {
    throw new RangeError("Claim-affecting calculation steps require at least one evidenceRef");
  }

  return Object.freeze({
    ...step,
    evidenceRefs,
    inputRefs: freezeArray(step.inputRefs),
  });
}

function collectEvidenceIds(steps: readonly CalculationTraceStep[]): readonly EvidenceId[] {
  const ids = new Set<EvidenceId>();
  for (const step of steps) {
    for (const ref of step.evidenceRefs) {
      ids.add(ref.evidenceId);
    }
  }
  return freezeArray([...ids]);
}

export function createCalculationTrace(input: CreateCalculationTraceInput): CalculationTrace {
  assertNonEmptyString(input.masterVersion, "masterVersion");
  assertNonEmptyString(input.calculationRuleVersion, "calculationRuleVersion");

  const steps = freezeArray(input.steps.map(freezeStep));

  return Object.freeze({
    inputsSummary: freezeInputsSummary(input.inputsSummary),
    masterVersion: input.masterVersion,
    calculationRuleVersion: input.calculationRuleVersion,
    steps,
    warnings: freezeArray(input.warnings ?? []),
    blockers: freezeArray(input.blockers ?? []),
    evidenceIds: collectEvidenceIds(steps),
  });
}

export function createLegalTrace(input: CreateLegalTraceInput): LegalTrace {
  assertNonEmptyString(input.targetId, "targetId");

  return Object.freeze({
    targetType: input.targetType,
    targetId: input.targetId,
    evidenceRefs: freezeArray(input.evidenceRefs.map(freezeEvidenceRef)),
    humanReviewRequired: input.humanReviewRequired,
  });
}
