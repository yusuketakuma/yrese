import { evidenceId, isBlockerType, type BlockerType } from "@yrese/shared-kernel";
import { CalendarDate } from "@yrese/date-time";
import { Points } from "@yrese/money";
import {
  createCalculationTrace,
  isEvidenceSourceType,
  type CalculationInputsSummary,
  type CalculationTrace,
  type CalculationTraceStep,
  type EvidenceRef,
} from "@yrese/trace";

import {
  requirementsNotVerifiedWarning,
  type BlockedCalculationResult,
  type BlockedStepResult,
  type CalculationBlocker,
  type CalculationRequest,
  type CalculationRule,
  type ItemCalculatedStepResult,
  type PointsOnlyCopayBlockedCalculationResult,
  type StepResult,
} from "./types.js";

export const regulatoryReviewBlocker: CalculationBlocker = Object.freeze({
  type: "BLOCKED_REGULATORY_REVIEW",
  detail: "Calculation rules are not approved. Actual scoring remains blocked until regulatory review completes.",
});

export const copayEvidenceBlocker: CalculationBlocker = Object.freeze({
  type: "BLOCKED_REGULATORY_REVIEW",
  detail: "Patient copay calculation remains blocked because copay evidence has not been issued.",
});

export const ruleEffectiveFrom = CalendarDate.fromString("2026-06-01");
export const notificationTitle = "調剤報酬点数表(令和8年告示第69号)別表第三";
export const notificationVersion = "R8";

export function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export function freezeBlocker(blocker: CalculationBlocker): CalculationBlocker {
  return Object.freeze({ ...blocker });
}

export function assertNonEmptyString(value: string, label: string): void {
  if (!isNonEmptyString(value)) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

export function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// applicationKey / groupId / blocksGroupIdPrefixes は Map キーや prefix 一致で
// 同一性を判定する。前後空白を含む値は同一性判定をすり抜けるため canonical
// form(前後空白なし)を要求する。
export function isCanonicalIdentityString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

// Array.from で疎配列の hole を undefined として検査対象に含める
// (Array.prototype.every は hole を skip するため malformed を見逃す。
// blocksGroupIdPrefixes の検査と同じ規律)。
export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && Array.from(value).every((item) => typeof item === "string");
}

export function calculationEvidenceRef(id: string): EvidenceRef {
  return Object.freeze({
    evidenceId: evidenceId(id),
    sourceType: "notification",
    title: notificationTitle,
    version: notificationVersion,
  });
}

export function createInputsSummary(request: CalculationRequest): CalculationInputsSummary {
  return {
    ids: [
      { kind: "tenant", id: request.tenantId },
      { kind: "pharmacy", id: request.pharmacyId },
      { kind: "patient", id: request.patient.patientId },
      { kind: "prescription", id: request.prescription.prescriptionId },
      { kind: "dispensing", id: request.dispensing.dispensingId },
    ],
    dates: [
      { kind: "prescription_date", value: request.prescription.prescriptionDate.toString() },
      { kind: "dispensing_date", value: request.dispensing.dispensingDate.toString() },
      { kind: "reception_date", value: request.receptionDate.toString() },
      { kind: "claim_month", value: request.claimMonth.toString() },
    ],
    masterVersions: [
      {
        masterName: "calculation",
        version: request.masterVersion,
      },
    ],
    ruleVersions: [
      {
        ruleName: "calculation",
        version: request.calculationRuleVersion,
      },
    ],
  };
}

export function createTrace(
  request: CalculationRequest,
  steps: readonly CalculationTraceStep[],
  warnings: readonly string[] = [],
  blockers: readonly CalculationBlocker[] = [],
): CalculationTrace {
  return createCalculationTrace({
    inputsSummary: createInputsSummary(request),
    masterVersion: request.masterVersion,
    calculationRuleVersion: request.calculationRuleVersion,
    steps,
    warnings,
    blockers: blockers.map((blocker) => blocker.type),
  });
}

export function createBlockedResult(
  request: CalculationRequest,
  blockers: readonly CalculationBlocker[],
  steps: readonly CalculationTraceStep[],
  warnings: readonly string[] = [],
): BlockedCalculationResult {
  return Object.freeze({
    status: "BLOCKED",
    blockers: freezeArray(blockers.map(freezeBlocker)),
    trace: createTrace(request, steps, warnings, blockers),
  });
}

export function createPointsOnlyCopayBlockedResult(
  request: CalculationRequest,
  total: Points,
  steps: readonly CalculationTraceStep[],
  warnings: readonly string[],
): PointsOnlyCopayBlockedCalculationResult {
  const allWarnings = warnings.includes(requirementsNotVerifiedWarning)
    ? warnings
    : [...warnings, requirementsNotVerifiedWarning];
  const blockers = [copayEvidenceBlocker];

  return Object.freeze({
    status: "POINTS_ONLY_COPAY_BLOCKED",
    claimable: false,
    total,
    blockers: freezeArray(blockers.map(freezeBlocker)),
    trace: createTrace(request, steps, allWarnings, blockers),
    warnings: freezeArray(allWarnings),
  });
}

export function blockerStep(blocker: CalculationBlocker): CalculationTraceStep {
  return Object.freeze({
    stepId: "blocked:regulatory-review",
    description: "Stop calculation because no approved calculation rules are available",
    affectsClaim: false,
    evidenceRefs: [],
    inputRefs: [],
    output: blocker.type,
  });
}

export function ruleStep(rule: CalculationRule, result: StepResult): CalculationTraceStep {
  const evidenceRefs =
    result.status === "ITEM_CALCULATED" && result.exclusivityGroup !== undefined
      ? [...rule.evidenceRefs, result.exclusivityGroup.evidenceRef]
      : rule.evidenceRefs;

  return Object.freeze({
    stepId: rule.ruleId,
    description: result.description,
    affectsClaim: result.affectsClaim,
    evidenceRefs,
    inputRefs: result.inputRefs ?? [],
    // 計算項目は適用対象識別子を output に残す(trace 上で対象を区別できるようにする — A5)
    output:
      result.status === "ITEM_CALCULATED"
        ? `${result.output};applicationKey=${result.applicationKey}`
        : result.output,
  });
}

export function effectiveFromBlockedStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:effective-from`,
    description: "Stop rule application because the dispensing date is before the rule effective date",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: ["dispensing.dispensingDate"],
    output: "BLOCKED_REGULATORY_REVIEW:適用日前",
  };
}

export function createEffectiveFromBlocker(rule: CalculationRule): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `適用日前: ${rule.ruleId} is effective from ${rule.effectiveFrom.toString()}`,
  };
}

export function effectiveToBlockedStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:effective-to`,
    description: "Stop rule application because the dispensing date is after the rule expiry date",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: ["dispensing.dispensingDate"],
    output: "BLOCKED_REGULATORY_REVIEW:適用終了後",
  };
}

export function createEffectiveToBlocker(rule: CalculationRule, effectiveTo: CalendarDate): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `適用終了後: ${rule.ruleId} was effective through ${effectiveTo.toString()}`,
  };
}

export function createMaxApplicationsMismatchBlocker(
  ruleId: string,
  declared: number | undefined,
  observed: number | undefined,
): CalculationBlocker {
  const format = (value: number | undefined) => (value === undefined ? "(undeclared)" : String(value));
  return {
    type: "SSOT_UPDATE_REQUIRED",
    detail: `inconsistent maxApplications declarations for ruleId=${ruleId}: ${format(declared)} vs ${format(observed)}`,
  };
}

export function maxApplicationsMismatchStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:max-applications-mismatch`,
    description:
      "Stop calculation because applications of the same rule declared different maxApplications limits",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: "SSOT_UPDATE_REQUIRED:maxApplications宣言不整合",
  };
}

export function createInvalidEffectiveRangeBlocker(rule: CalculationRule, effectiveTo: CalendarDate): CalculationBlocker {
  return {
    type: "SSOT_UPDATE_REQUIRED",
    detail: `invalid effective range for ruleId=${rule.ruleId}: effectiveTo ${effectiveTo.toString()} is before effectiveFrom ${rule.effectiveFrom.toString()}`,
  };
}

export function invalidEffectiveRangeStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:invalid-effective-range`,
    description: "Stop calculation because the rule declares an effective range that ends before it starts",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: "SSOT_UPDATE_REQUIRED:適用期間不正",
  };
}

export function createDuplicateBlocker(ruleId: string, applicationKey: string): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `duplicate calculation application detected for ruleId=${ruleId}, applicationKey=${applicationKey}`,
  };
}

export function createMaxApplicationsBlocker(ruleId: string, maxApplications: number): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `application count exceeds evidence-backed limit for ruleId=${ruleId}; maxApplications=${maxApplications}`,
  };
}

export function createExclusivityBlocker(groupId: string): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `exclusive calculation group applied more than once: ${groupId}`,
  };
}

export function duplicateBlockedStep(rule: CalculationRule, applicationKey: string): CalculationTraceStep {
  return Object.freeze({
    stepId: `${rule.ruleId}:duplicate-application:${applicationKey}`,
    description: "Reject application because the same (ruleId, applicationKey) pair was already calculated",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: `BLOCKED_REGULATORY_REVIEW:重複適用(applicationKey=${applicationKey})`,
  });
}

export function maxApplicationsBlockedStep(rule: CalculationRule, maxApplications: number): CalculationTraceStep {
  return Object.freeze({
    stepId: `${rule.ruleId}:max-applications-exceeded`,
    description: "Reject application because the declared maxApplications limit was exceeded",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: `BLOCKED_REGULATORY_REVIEW:上限超過(maxApplications=${maxApplications})`,
  });
}

export function exclusivityBlockedStep(rule: CalculationRule, groupId: string): CalculationTraceStep {
  return Object.freeze({
    stepId: `${rule.ruleId}:exclusivity:${groupId}`,
    description: "Reject application because an exclusivity group (or blocked prefix) was already applied",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: `BLOCKED_REGULATORY_REVIEW:排他グループ衝突(${groupId})`,
  });
}

export function createInvalidStepResultBlocker(ruleId: string, reason: string): CalculationBlocker {
  return {
    type: "SSOT_UPDATE_REQUIRED",
    detail: `invalid StepResult for ruleId=${ruleId}: ${reason}`,
  };
}

export function invalidStepResultStep(rule: CalculationRule, reason: string): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:invalid-step-result`,
    description: "Stop calculation because the rule returned a StepResult shape outside the approved SSOT",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: `SSOT_UPDATE_REQUIRED:${reason}`,
  };
}

export type StepResultValidation = { readonly ok: true; readonly result: StepResult } | { readonly ok: false; readonly reason: string };

export function validateCommonStepTraceOutput(result: Readonly<Record<string, unknown>>): string | undefined {
  if (!isNonEmptyString(result.description)) {
    return "description must be a non-empty string";
  }
  if (typeof result.affectsClaim !== "boolean") {
    return "affectsClaim must be a boolean";
  }
  if (!isNonEmptyString(result.output)) {
    return "output must be a non-empty string";
  }
  if (result.inputRefs !== undefined && !isStringArray(result.inputRefs)) {
    return "inputRefs must be a string array";
  }
  if (result.warnings !== undefined && !isStringArray(result.warnings)) {
    return "warnings must be a string array";
  }
  return undefined;
}

export const BLOCKER_FIELDS = new Set<string>(["type", "detail"]);

export function validateBlockerShape(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "blocker must be an object";
  }
  const unknownField = findUnknownField(value, BLOCKER_FIELDS);
  if (unknownField !== undefined) {
    return `unknown blocker field outside the approved SSOT: ${unknownField}`;
  }
  if (typeof value.type !== "string" || !isBlockerType(value.type)) {
    return "blocker.type must be a registered BlockerType";
  }
  if (!isNonEmptyString(value.detail)) {
    return "blocker.detail must be a non-empty string";
  }
  return undefined;
}

export function validateEvidenceRefShape(value: unknown, label: string): string | undefined {
  if (!isRecord(value)) {
    return `${label} must be an object`;
  }
  if ("url" in value) {
    return `${label}.url must not be present`;
  }
  const unknownField = findUnknownField(value, EVIDENCE_REF_FIELDS);
  if (unknownField !== undefined) {
    return `${label} must not include unknown field: ${unknownField}`;
  }
  if (!isNonEmptyString(value.evidenceId)) {
    return `${label}.evidenceId must be a non-empty string`;
  }
  if (!isNonEmptyString(value.sourceType)) {
    return `${label}.sourceType must be a non-empty string`;
  }
  if (!isEvidenceSourceType(value.sourceType)) {
    return `${label}.sourceType must be a supported EvidenceSourceType`;
  }
  if (!isNonEmptyString(value.title)) {
    return `${label}.title must be a non-empty string`;
  }
  if (value.version !== undefined && typeof value.version !== "string") {
    return `${label}.version must be a string`;
  }
  if (value.effectiveFrom !== undefined && typeof value.effectiveFrom !== "string") {
    return `${label}.effectiveFrom must be a string`;
  }
  return undefined;
}

export const EVIDENCE_REF_FIELDS = new Set<string>([
  "evidenceId",
  "sourceType",
  "title",
  "version",
  "effectiveFrom",
]);

export const EXCLUSIVITY_GROUP_FIELDS = new Set<string>([
  "groupId",
  "evidenceRef",
  "blocksGroupIdPrefixes",
]);

export function validateExclusivityGroupShape(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "exclusivityGroup must be an object";
  }
  const unknownField = Object.keys(value).find((key) => !EXCLUSIVITY_GROUP_FIELDS.has(key));
  if (unknownField !== undefined) {
    return `unknown exclusivityGroup field outside the approved SSOT: ${unknownField}`;
  }
  if (!isNonEmptyString(value.groupId)) {
    return "exclusivityGroup.groupId must be a non-empty string";
  }
  if (!isCanonicalIdentityString(value.groupId)) {
    return "exclusivityGroup.groupId must be a canonical string without surrounding whitespace";
  }
  if (value.blocksGroupIdPrefixes !== undefined) {
    // Array.from で疎配列の hole を undefined として検査対象に含める
    // (Array.prototype.every/some は hole を skip するため malformed を見逃す)
    if (
      !Array.isArray(value.blocksGroupIdPrefixes) ||
      !Array.from(value.blocksGroupIdPrefixes).every(isNonEmptyString)
    ) {
      return "exclusivityGroup.blocksGroupIdPrefixes must be an array of non-empty strings";
    }
    if (!Array.from(value.blocksGroupIdPrefixes).every(isCanonicalIdentityString)) {
      return "exclusivityGroup.blocksGroupIdPrefixes must not contain surrounding whitespace";
    }
  }
  return validateEvidenceRefShape(value.evidenceRef, "exclusivityGroup.evidenceRef");
}

export const COMMON_STEP_RESULT_FIELDS = ["status", "description", "affectsClaim", "output", "inputRefs", "warnings"] as const;
export const BLOCKED_STEP_RESULT_FIELDS = new Set<string>([...COMMON_STEP_RESULT_FIELDS, "blocker"]);
export const ITEM_STEP_RESULT_FIELDS = new Set<string>([
  ...COMMON_STEP_RESULT_FIELDS,
  "itemPoints",
  "applicationKey",
  "maxApplications",
  "exclusivityGroup",
]);

export const zeroPoints = Points.fromInteger(0);

export function findUnknownField(
  value: Readonly<Record<string, unknown>>,
  allowedFields: ReadonlySet<string>,
): string | undefined {
  return Object.keys(value).find((key) => !allowedFields.has(key));
}

export function validateStepResult(value: unknown): StepResultValidation {
  if (!isRecord(value)) {
    return { ok: false, reason: "StepResult must be an object" };
  }

  if (value.status !== "BLOCKED" && value.status !== "ITEM_CALCULATED") {
    return { ok: false, reason: "status must be BLOCKED or ITEM_CALCULATED" };
  }

  // SSOT 外のフィールドは黙認しない(BLOCKED 結果への itemPoints 密輸や
  // 未承認 DSL フィールドの先行導入を SSOT_UPDATE_REQUIRED として停止する)
  const unknownField = findUnknownField(
    value,
    value.status === "BLOCKED" ? BLOCKED_STEP_RESULT_FIELDS : ITEM_STEP_RESULT_FIELDS,
  );
  if (unknownField !== undefined) {
    return { ok: false, reason: `unknown StepResult field outside the approved SSOT: ${unknownField}` };
  }

  const commonFailure = validateCommonStepTraceOutput(value);
  if (commonFailure !== undefined) {
    return { ok: false, reason: commonFailure };
  }

  if (value.status === "BLOCKED") {
    const blockerFailure = validateBlockerShape(value.blocker);
    return blockerFailure === undefined
      ? { ok: true, result: value as unknown as BlockedStepResult }
      : { ok: false, reason: blockerFailure };
  }

  if (!(value.itemPoints instanceof Points)) {
    return { ok: false, reason: "itemPoints must be a Points value" };
  }
  // 減算・負点数は CAL-004 §2 のスコープ外(禁止)。負値の固定点数として
  // 混入した減算を fail-closed に停止する(0 は合算に無害のため許容)
  if (value.itemPoints.compare(zeroPoints) < 0) {
    return { ok: false, reason: "itemPoints must not be negative (減算は CAL-004 §2 スコープ外)" };
  }
  // 合算対象の計算項目は必ず claim-affecting とする。affectsClaim:false の正点数は
  // trace 層の evidenceRefs 強制(CAL-004 §2)を回避して合計に混入できてしまうため拒否。
  if (value.affectsClaim !== true) {
    return { ok: false, reason: "ITEM_CALCULATED items must be affectsClaim: true (合算項目は evidence 強制対象)" };
  }
  if (!isNonEmptyString(value.applicationKey)) {
    return { ok: false, reason: "applicationKey must be a non-empty string" };
  }
  if (!isCanonicalIdentityString(value.applicationKey)) {
    return { ok: false, reason: "applicationKey must be a canonical string without surrounding whitespace" };
  }
  if (
    value.maxApplications !== undefined &&
    (typeof value.maxApplications !== "number" || !Number.isSafeInteger(value.maxApplications) || value.maxApplications < 1)
  ) {
    return { ok: false, reason: "maxApplications must be a positive safe integer" };
  }
  if (value.exclusivityGroup !== undefined) {
    const exclusivityGroupFailure = validateExclusivityGroupShape(value.exclusivityGroup);
    if (exclusivityGroupFailure !== undefined) {
      return { ok: false, reason: exclusivityGroupFailure };
    }
  }

  return { ok: true, result: value as unknown as ItemCalculatedStepResult };
}

