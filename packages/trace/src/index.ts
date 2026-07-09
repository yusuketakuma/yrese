import type { EvidenceId } from "@yrese/shared-kernel";

export const EVIDENCE_SOURCE_TYPES = [
  "law",
  "notification",
  "official_spec",
  "master",
  "guideline",
  "jahis",
  "internal_ssot",
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export interface EvidenceRef {
  readonly evidenceId: EvidenceId;
  readonly sourceType: EvidenceSourceType;
  readonly title: string;
  readonly version?: string;
  readonly effectiveFrom?: string;
  readonly url?: never;
}

export const TRACE_ID_REF_KINDS = [
  "tenant",
  "pharmacy",
  "patient",
  "prescription",
  "dispensing",
  "claim",
  "device",
  "event",
] as const;

export type TraceIdRefKind = (typeof TRACE_ID_REF_KINDS)[number];

export interface TraceIdRef {
  readonly kind: TraceIdRefKind;
  readonly id: string;
}

export const TRACE_DATE_REF_KINDS = [
  "prescription_date",
  "dispensing_date",
  "reception_date",
  "claim_month",
  "service_date",
] as const;

export type TraceDateRefKind = (typeof TRACE_DATE_REF_KINDS)[number];

export interface TraceDateRef {
  readonly kind: TraceDateRefKind;
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

export const CALCULATION_TRACE_STEP_STATUSES = ["applied", "suggested", "excluded", "blocked"] as const;
export type CalculationTraceStepStatus = (typeof CALCULATION_TRACE_STEP_STATUSES)[number];

export interface CalculationTraceRounding {
  readonly method: string;
  readonly evidenceId: EvidenceId;
}

export interface CalculationTraceStep {
  readonly stepId: string;
  readonly description: string;
  readonly affectsClaim: boolean;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly inputRefs: readonly string[];
  readonly output: string;
  readonly feeItemCode?: string;
  readonly formula?: string;
  readonly intermediateValues?: Readonly<Record<string, string>>;
  readonly rounding?: CalculationTraceRounding;
  readonly stepStatus?: CalculationTraceStepStatus;
  readonly resultPoints?: string;
  readonly resultYen?: string;
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

export const LEGAL_TRACE_TARGET_TYPES = ["feature", "screen", "report", "data", "operation"] as const;
export type LegalTraceTargetType = (typeof LEGAL_TRACE_TARGET_TYPES)[number];

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

const sourceTypes = new Set<EvidenceSourceType>(EVIDENCE_SOURCE_TYPES);
const traceIdKinds = new Set<TraceIdRefKind>(TRACE_ID_REF_KINDS);
const traceDateKinds = new Set<TraceDateRefKind>(TRACE_DATE_REF_KINDS);
const stepStatuses = new Set<CalculationTraceStepStatus>(CALCULATION_TRACE_STEP_STATUSES);
const legalTraceTargetTypes = new Set<LegalTraceTargetType>(LEGAL_TRACE_TARGET_TYPES);
const phiLikeIntermediateValueKeyPattern = /(patient|name|address|phone|tel|email|free_?text|memo)/i;

export function isEvidenceSourceType(value: string): value is EvidenceSourceType {
  return sourceTypes.has(value as EvidenceSourceType);
}

function assertNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

function assertAllowedString<T extends string>(value: unknown, values: ReadonlySet<T>, label: string): asserts value is T {
  if (typeof value !== "string" || !values.has(value as T)) {
    throw new RangeError(`${label} is not supported`);
  }
}

function assertArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) {
    throw new RangeError(`${label} must be an array`);
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

function freezeTraceIdRef(ref: TraceIdRef): TraceIdRef {
  assertAllowedString(ref.kind, traceIdKinds, "TraceIdRef kind");
  assertNonEmptyString(ref.id, "TraceIdRef id");

  return Object.freeze({ ...ref });
}

function freezeTraceDateRef(ref: TraceDateRef): TraceDateRef {
  assertAllowedString(ref.kind, traceDateKinds, "TraceDateRef kind");
  assertNonEmptyString(ref.value, "TraceDateRef value");

  return Object.freeze({ ...ref });
}

function freezeMasterVersionRef(ref: TraceMasterVersionRef): TraceMasterVersionRef {
  assertNonEmptyString(ref.masterName, "TraceMasterVersionRef masterName");
  assertNonEmptyString(ref.version, "TraceMasterVersionRef version");

  return Object.freeze({ ...ref });
}

function freezeRuleVersionRef(ref: TraceRuleVersionRef): TraceRuleVersionRef {
  assertNonEmptyString(ref.ruleName, "TraceRuleVersionRef ruleName");
  assertNonEmptyString(ref.version, "TraceRuleVersionRef version");

  return Object.freeze({ ...ref });
}

function freezeInputsSummary(summary: CalculationInputsSummary): CalculationInputsSummary {
  if (typeof summary !== "object" || summary === null) {
    throw new RangeError("inputsSummary must be an object");
  }
  assertArray(summary.ids, "inputsSummary.ids");
  assertArray(summary.dates, "inputsSummary.dates");
  assertArray(summary.masterVersions, "inputsSummary.masterVersions");
  if (summary.ruleVersions !== undefined) {
    assertArray(summary.ruleVersions, "inputsSummary.ruleVersions");
  }

  return Object.freeze({
    ids: freezeArray(summary.ids.map(freezeTraceIdRef)),
    dates: freezeArray(summary.dates.map(freezeTraceDateRef)),
    masterVersions: freezeArray(summary.masterVersions.map(freezeMasterVersionRef)),
    ruleVersions: freezeArray((summary.ruleVersions ?? []).map(freezeRuleVersionRef)),
  });
}

function freezeIntermediateValues(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    throw new RangeError("CalculationTraceStep intermediateValues must be a string record");
  }

  const frozenValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    assertNonEmptyString(key, "CalculationTraceStep intermediateValues key");
    if (phiLikeIntermediateValueKeyPattern.test(key)) {
      throw new RangeError("CalculationTraceStep intermediateValues must not include PHI-like keys");
    }
    if (typeof value !== "string") {
      throw new RangeError("CalculationTraceStep intermediateValues values must be strings");
    }
    frozenValues[key] = value;
  }

  return Object.freeze(frozenValues);
}

function freezeRounding(rounding: CalculationTraceRounding): CalculationTraceRounding {
  assertNonEmptyString(rounding.method, "CalculationTraceStep rounding.method");
  assertNonEmptyString(rounding.evidenceId, "CalculationTraceStep rounding.evidenceId");

  return Object.freeze({
    method: rounding.method,
    evidenceId: rounding.evidenceId,
  });
}

function freezeStep(step: CalculationTraceStep): CalculationTraceStep {
  assertNonEmptyString(step.stepId, "CalculationTraceStep stepId");
  assertNonEmptyString(step.description, "CalculationTraceStep description");
  if (step.feeItemCode !== undefined) {
    assertNonEmptyString(step.feeItemCode, "CalculationTraceStep feeItemCode");
  }
  if (step.formula !== undefined) {
    assertNonEmptyString(step.formula, "CalculationTraceStep formula");
  }
  if (step.resultPoints !== undefined) {
    assertNonEmptyString(step.resultPoints, "CalculationTraceStep resultPoints");
  }
  if (step.resultYen !== undefined) {
    assertNonEmptyString(step.resultYen, "CalculationTraceStep resultYen");
  }
  if (step.stepStatus !== undefined && !stepStatuses.has(step.stepStatus)) {
    throw new RangeError("CalculationTraceStep stepStatus is not supported");
  }

  const evidenceRefs = freezeArray(step.evidenceRefs.map(freezeEvidenceRef));
  if (step.affectsClaim && evidenceRefs.length === 0) {
    throw new RangeError("Claim-affecting calculation steps require at least one evidenceRef");
  }

  return Object.freeze({
    ...step,
    evidenceRefs,
    inputRefs: freezeArray(step.inputRefs),
    ...(step.intermediateValues === undefined
      ? {}
      : { intermediateValues: freezeIntermediateValues(step.intermediateValues) }),
    ...(step.rounding === undefined ? {} : { rounding: freezeRounding(step.rounding) }),
  });
}

function collectEvidenceIds(steps: readonly CalculationTraceStep[]): readonly EvidenceId[] {
  const ids = new Set<EvidenceId>();
  for (const step of steps) {
    for (const ref of step.evidenceRefs) {
      ids.add(ref.evidenceId);
    }
    if (step.rounding !== undefined) {
      ids.add(step.rounding.evidenceId);
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
  assertAllowedString(input.targetType, legalTraceTargetTypes, "LegalTrace targetType");
  assertNonEmptyString(input.targetId, "targetId");
  if (typeof input.humanReviewRequired !== "boolean") {
    throw new RangeError("LegalTrace humanReviewRequired must be a boolean");
  }

  return Object.freeze({
    targetType: input.targetType,
    targetId: input.targetId,
    evidenceRefs: freezeArray(input.evidenceRefs.map(freezeEvidenceRef)),
    humanReviewRequired: input.humanReviewRequired,
  });
}
