import type {
  BlockerType,
  DispensingId,
  PatientId,
  PharmacyId,
  PrescriptionId,
  TenantId,
} from "@yrese/shared-kernel";
import { evidenceId, isBlockerType } from "@yrese/shared-kernel";
import type { ClaimMonth, DispensingDate, PrescriptionDate, ReceptionDate } from "@yrese/date-time";
import { CalendarDate } from "@yrese/date-time";
import { Points, type Yen } from "@yrese/money";
import {
  createCalculationTrace,
  isEvidenceSourceType,
  type CalculationInputsSummary,
  type CalculationTrace,
  type CalculationTraceStep,
  type EvidenceRef,
} from "@yrese/trace";

export interface InsuranceSnapshotRef {
  readonly id: string;
}

export interface PublicExpenseRef {
  readonly id: string;
}

export interface CalculationRequest {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patient: {
    readonly patientId: PatientId;
  };
  readonly insurance: {
    readonly insuranceSnapshot: InsuranceSnapshotRef;
    readonly publicExpenses: readonly PublicExpenseRef[];
  };
  readonly prescription: {
    readonly prescriptionId: PrescriptionId;
    readonly prescriptionDate: PrescriptionDate;
  };
  readonly dispensing: {
    readonly dispensingId: DispensingId;
    readonly dispensingDate: DispensingDate;
  };
  readonly receptionDate: ReceptionDate;
  readonly claimMonth: ClaimMonth;
  readonly masterVersion: string;
  readonly calculationRuleVersion: string;
}

export interface CalculationBlocker {
  readonly type: BlockerType;
  readonly detail: string;
}

export interface CalculationRuleContext {
  readonly request: CalculationRequest;
  readonly ruleId: string;
}

export interface StepTraceOutput {
  readonly description: string;
  readonly affectsClaim: boolean;
  readonly inputRefs?: readonly string[];
  readonly output: string;
}

export interface BlockedStepResult extends StepTraceOutput {
  readonly status: "BLOCKED";
  readonly blocker: CalculationBlocker;
  readonly warnings?: readonly string[];
}

export interface CalculationExclusivityGroup {
  readonly groupId: string;
  readonly evidenceRef: EvidenceRef;
}

export interface ItemCalculatedStepResult extends StepTraceOutput {
  readonly status: "ITEM_CALCULATED";
  readonly itemPoints: Points;
  readonly applicationKey: string;
  readonly maxApplications?: number;
  readonly exclusivityGroup?: CalculationExclusivityGroup;
  readonly warnings?: readonly string[];
}

export type StepResult = BlockedStepResult | ItemCalculatedStepResult;

export interface CalculationRule {
  readonly ruleId: string;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly effectiveFrom: CalendarDate;
  /**
   * 最終有効日(その日を含む)。未設定=現行(廃止未定)。
   * CAL-006 §3.1 停止条件: 第2版 evidence(改定・修正版)の導入は effectiveTo ガードが前提。
   * 失効ルールの適用継続(誤請求)を機械的に禁止する。
   */
  readonly effectiveTo?: CalendarDate;
  readonly apply: (ctx: CalculationRuleContext) => StepResult;
}

export interface CalculationRuleSet {
  readonly rules: readonly CalculationRule[];
}

export interface BlockedCalculationResult {
  readonly status: "BLOCKED";
  readonly blockers: readonly CalculationBlocker[];
  readonly trace: CalculationTrace;
}

export interface PointsOnlyCopayBlockedCalculationResult {
  readonly status: "POINTS_ONLY_COPAY_BLOCKED";
  readonly claimable: false;
  readonly total: Points;
  readonly blockers: readonly CalculationBlocker[];
  readonly trace: CalculationTrace;
  readonly warnings: readonly string[];
}

export interface CalculatedCalculationResult {
  readonly status: "CALCULATED";
  readonly total: Points;
  readonly patientCopay: Yen;
  readonly trace: CalculationTrace;
  readonly warnings: readonly string[];
}

export type CalculationResult =
  | BlockedCalculationResult
  | PointsOnlyCopayBlockedCalculationResult
  | CalculatedCalculationResult;

export const requirementsNotVerifiedWarning = "算定要件未検証(適用可否は呼び出し側指定)";
export const invalidStepResultWarning = "算定ルール戻り値SSOT不一致(SSOT_UPDATE_REQUIRED)";

const regulatoryReviewBlocker: CalculationBlocker = Object.freeze({
  type: "BLOCKED_REGULATORY_REVIEW",
  detail: "Calculation rules are not approved. Actual scoring remains blocked until regulatory review completes.",
});

const copayEvidenceBlocker: CalculationBlocker = Object.freeze({
  type: "BLOCKED_REGULATORY_REVIEW",
  detail: "Patient copay calculation remains blocked because copay evidence has not been issued.",
});

const ruleEffectiveFrom = CalendarDate.fromString("2026-06-01");
const notificationTitle = "調剤報酬点数表(令和8年告示第69号)別表第三";
const notificationVersion = "R8";

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function freezeBlocker(blocker: CalculationBlocker): CalculationBlocker {
  return Object.freeze({ ...blocker });
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function calculationEvidenceRef(id: string): EvidenceRef {
  return Object.freeze({
    evidenceId: evidenceId(id),
    sourceType: "notification",
    title: notificationTitle,
    version: notificationVersion,
  });
}

function createInputsSummary(request: CalculationRequest): CalculationInputsSummary {
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

function createTrace(
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

function createBlockedResult(
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

function createPointsOnlyCopayBlockedResult(
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

function blockerStep(blocker: CalculationBlocker): CalculationTraceStep {
  return Object.freeze({
    stepId: "blocked:regulatory-review",
    description: "Stop calculation because no approved calculation rules are available",
    affectsClaim: false,
    evidenceRefs: [],
    inputRefs: [],
    output: blocker.type,
  });
}

function ruleStep(rule: CalculationRule, result: StepResult): CalculationTraceStep {
  const evidenceRefs =
    result.status === "ITEM_CALCULATED" && result.exclusivityGroup !== undefined
      ? [...rule.evidenceRefs, result.exclusivityGroup.evidenceRef]
      : rule.evidenceRefs;

  return {
    stepId: rule.ruleId,
    description: result.description,
    affectsClaim: result.affectsClaim,
    evidenceRefs,
    inputRefs: result.inputRefs ?? [],
    output: result.output,
  };
}

function effectiveFromBlockedStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:effective-from`,
    description: "Stop rule application because the dispensing date is before the rule effective date",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: ["dispensing.dispensingDate"],
    output: "BLOCKED_REGULATORY_REVIEW:適用日前",
  };
}

function createEffectiveFromBlocker(rule: CalculationRule): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `適用日前: ${rule.ruleId} is effective from ${rule.effectiveFrom.toString()}`,
  };
}

function effectiveToBlockedStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:effective-to`,
    description: "Stop rule application because the dispensing date is after the rule expiry date",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: ["dispensing.dispensingDate"],
    output: "BLOCKED_REGULATORY_REVIEW:適用終了後",
  };
}

function createEffectiveToBlocker(rule: CalculationRule, effectiveTo: CalendarDate): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `適用終了後: ${rule.ruleId} was effective through ${effectiveTo.toString()}`,
  };
}

function createMaxApplicationsMismatchBlocker(
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

function maxApplicationsMismatchStep(rule: CalculationRule): CalculationTraceStep {
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

function createInvalidEffectiveRangeBlocker(rule: CalculationRule, effectiveTo: CalendarDate): CalculationBlocker {
  return {
    type: "SSOT_UPDATE_REQUIRED",
    detail: `invalid effective range for ruleId=${rule.ruleId}: effectiveTo ${effectiveTo.toString()} is before effectiveFrom ${rule.effectiveFrom.toString()}`,
  };
}

function invalidEffectiveRangeStep(rule: CalculationRule): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:invalid-effective-range`,
    description: "Stop calculation because the rule declares an effective range that ends before it starts",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: "SSOT_UPDATE_REQUIRED:適用期間不正",
  };
}

function createDuplicateBlocker(ruleId: string, applicationKey: string): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `duplicate calculation application detected for ruleId=${ruleId}, applicationKey=${applicationKey}`,
  };
}

function createMaxApplicationsBlocker(ruleId: string, maxApplications: number): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `application count exceeds evidence-backed limit for ruleId=${ruleId}; maxApplications=${maxApplications}`,
  };
}

function createExclusivityBlocker(groupId: string): CalculationBlocker {
  return {
    type: "BLOCKED_REGULATORY_REVIEW",
    detail: `exclusive calculation group applied more than once: ${groupId}`,
  };
}

function createInvalidStepResultBlocker(ruleId: string, reason: string): CalculationBlocker {
  return {
    type: "SSOT_UPDATE_REQUIRED",
    detail: `invalid StepResult for ruleId=${ruleId}: ${reason}`,
  };
}

function invalidStepResultStep(rule: CalculationRule, reason: string): CalculationTraceStep {
  return {
    stepId: `${rule.ruleId}:invalid-step-result`,
    description: "Stop calculation because the rule returned a StepResult shape outside the approved SSOT",
    affectsClaim: false,
    evidenceRefs: rule.evidenceRefs,
    inputRefs: [],
    output: `SSOT_UPDATE_REQUIRED:${reason}`,
  };
}

type StepResultValidation = { readonly ok: true; readonly result: StepResult } | { readonly ok: false; readonly reason: string };

function validateCommonStepTraceOutput(result: Readonly<Record<string, unknown>>): string | undefined {
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

function validateBlockerShape(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "blocker must be an object";
  }
  if (typeof value.type !== "string" || !isBlockerType(value.type)) {
    return "blocker.type must be a registered BlockerType";
  }
  if (!isNonEmptyString(value.detail)) {
    return "blocker.detail must be a non-empty string";
  }
  return undefined;
}

function validateEvidenceRefShape(value: unknown, label: string): string | undefined {
  if (!isRecord(value)) {
    return `${label} must be an object`;
  }
  if ("url" in value) {
    return `${label}.url must not be present`;
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

function validateExclusivityGroupShape(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "exclusivityGroup must be an object";
  }
  if (!isNonEmptyString(value.groupId)) {
    return "exclusivityGroup.groupId must be a non-empty string";
  }
  return validateEvidenceRefShape(value.evidenceRef, "exclusivityGroup.evidenceRef");
}

const COMMON_STEP_RESULT_FIELDS = ["status", "description", "affectsClaim", "output", "inputRefs", "warnings"] as const;
const BLOCKED_STEP_RESULT_FIELDS = new Set<string>([...COMMON_STEP_RESULT_FIELDS, "blocker"]);
const ITEM_STEP_RESULT_FIELDS = new Set<string>([
  ...COMMON_STEP_RESULT_FIELDS,
  "itemPoints",
  "applicationKey",
  "maxApplications",
  "exclusivityGroup",
]);

const zeroPoints = Points.fromInteger(0);

function findUnknownField(
  value: Readonly<Record<string, unknown>>,
  allowedFields: ReadonlySet<string>,
): string | undefined {
  return Object.keys(value).find((key) => !allowedFields.has(key));
}

function validateStepResult(value: unknown): StepResultValidation {
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
  if (!isNonEmptyString(value.applicationKey)) {
    return { ok: false, reason: "applicationKey must be a non-empty string" };
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

function createFixedPointsRule(input: {
  readonly ruleId: string;
  readonly evidenceRef: EvidenceRef;
  readonly itemPoints: Points;
  readonly applicationKey: string;
  readonly description: string;
  readonly output: string;
  readonly maxApplications?: number;
}): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  if (input.maxApplications !== undefined) {
    assertPositiveSafeInteger(input.maxApplications, "maxApplications");
  }

  return Object.freeze({
    ruleId: input.ruleId,
    evidenceRefs: freezeArray([input.evidenceRef]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: input.description,
        affectsClaim: true,
        inputRefs: [],
        output: input.output,
        itemPoints: input.itemPoints,
        applicationKey: input.applicationKey,
        ...(input.maxApplications !== undefined ? { maxApplications: input.maxApplications } : {}),
      }),
  });
}

export const dispensingBasicFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0001:dispensing-basic-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0001"),
  itemPoints: Points.fromInteger(47),
  applicationKey: "prescription",
  description: "Dispensing basic fee 1: 47 points per prescription reception",
  output: "itemPoints=47",
});

export function createOralMedicinePreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0021:oral-medicine-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0021"),
    itemPoints: Points.fromInteger(24),
    applicationKey,
    description: "Oral medicine preparation fee: 24 points per application, up to 3 applications",
    output: "itemPoints=24",
    maxApplications: 3,
  });
}

export const dispensingManagementFee2Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0037:dispensing-management-fee-2",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0037"),
  itemPoints: Points.fromInteger(10),
  applicationKey: "prescription",
  description: "Dispensing management fee 2: 10 points",
  output: "itemPoints=10",
});

export const medicationManagementGuidanceFee3Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0042:medication-management-guidance-fee-3",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0042"),
  itemPoints: Points.fromInteger(45),
  applicationKey: "prescription",
  description: "Medication management guidance fee 3: 45 points",
  output: "itemPoints=45",
});

export const nightHolidayAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0032:night-holiday-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0032"),
  itemPoints: Points.fromInteger(40),
  applicationKey: "prescription",
  description: "Night and holiday addition: 40 points per prescription reception",
  output: "itemPoints=40",
});

export const calculationRulesV20260601 = Object.freeze([
  dispensingBasicFee1Rule,
  createOralMedicinePreparationFeeRule("oral-medicine:1"),
  dispensingManagementFee2Rule,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
] satisfies readonly CalculationRule[]);

export function calculate(request: CalculationRequest, ruleSet: CalculationRuleSet): CalculationResult {
  if (ruleSet.rules.length === 0) {
    return createBlockedResult(request, [regulatoryReviewBlocker], [blockerStep(regulatoryReviewBlocker)]);
  }

  const steps: CalculationTraceStep[] = [];
  const blockers: CalculationBlocker[] = [];
  const warnings: string[] = [];
  const seenWarnings = new Set<string>();
  const seenApplications = new Set<string>();
  const applicationCountsByRuleId = new Map<string, number>();
  // 同一 ruleId の全適用は同一の maxApplications 宣言(未宣言含む)を持たなければならない
  // (evidence 文言との1:1対応 — CAL-004 §2)。値は undefined(未宣言)も区別して記録する。
  const declaredMaxApplicationsByRuleId = new Map<string, number | undefined>();
  const seenExclusivityGroups = new Set<string>();
  let total = Points.fromInteger(0);
  let hasItemCalculation = false;

  // 同一警告の重複蓄積を防ぐ(初出順維持 — warning fatigue 抑制。必須警告の存在保証は不変)
  const pushWarnings = (values: readonly string[] | undefined): void => {
    for (const value of values ?? []) {
      if (!seenWarnings.has(value)) {
        seenWarnings.add(value);
        warnings.push(value);
      }
    }
  };

  for (const rule of ruleSet.rules) {
    const dispensingCalendarDate = request.dispensing.dispensingDate.toCalendarDate();

    // 適用期間の宣言不正(終了日が開始日より前)はルール定義エラーとして即時停止
    if (rule.effectiveTo !== undefined && rule.effectiveTo.compare(rule.effectiveFrom) < 0) {
      const blocker = createInvalidEffectiveRangeBlocker(rule, rule.effectiveTo);
      return createBlockedResult(
        request,
        [...blockers, blocker],
        [...steps, invalidEffectiveRangeStep(rule)],
        [...warnings, invalidStepResultWarning],
      );
    }

    if (dispensingCalendarDate.compare(rule.effectiveFrom) < 0) {
      blockers.push(createEffectiveFromBlocker(rule));
      steps.push(effectiveFromBlockedStep(rule));
      continue;
    }

    // 適用終了ガード(CAL-006 §3.1 停止条件): 失効ルールの適用継続を機械的に禁止する。
    // effectiveTo は最終有効日(その日を含む)。
    if (rule.effectiveTo !== undefined && dispensingCalendarDate.compare(rule.effectiveTo) > 0) {
      blockers.push(createEffectiveToBlocker(rule, rule.effectiveTo));
      steps.push(effectiveToBlockedStep(rule));
      continue;
    }

    const resultValidation = validateStepResult(rule.apply(Object.freeze({ request, ruleId: rule.ruleId })));
    if (!resultValidation.ok) {
      const blocker = createInvalidStepResultBlocker(rule.ruleId, resultValidation.reason);
      return createBlockedResult(
        request,
        [...blockers, blocker],
        [...steps, invalidStepResultStep(rule, resultValidation.reason)],
        [...warnings, invalidStepResultWarning],
      );
    }

    const result = resultValidation.result;
    steps.push(ruleStep(rule, result));
    pushWarnings(result.warnings);

    if (result.status === "BLOCKED") {
      blockers.push(result.blocker);
      continue;
    }

    assertNonEmptyString(result.applicationKey, "applicationKey");
    const applicationIdentity = `${rule.ruleId}\u0000${result.applicationKey}`;
    if (seenApplications.has(applicationIdentity)) {
      blockers.push(createDuplicateBlocker(rule.ruleId, result.applicationKey));
      continue;
    }
    seenApplications.add(applicationIdentity);

    // maxApplications 宣言の一貫性(同一 ruleId 内で宣言値が食い違えば定義エラーとして即時停止)
    if (declaredMaxApplicationsByRuleId.has(rule.ruleId)) {
      const declared = declaredMaxApplicationsByRuleId.get(rule.ruleId);
      if (declared !== result.maxApplications) {
        const blocker = createMaxApplicationsMismatchBlocker(rule.ruleId, declared, result.maxApplications);
        return createBlockedResult(
          request,
          [...blockers, blocker],
          [...steps, maxApplicationsMismatchStep(rule)],
          [...warnings, invalidStepResultWarning],
        );
      }
    } else {
      declaredMaxApplicationsByRuleId.set(rule.ruleId, result.maxApplications);
    }

    const nextCount = (applicationCountsByRuleId.get(rule.ruleId) ?? 0) + 1;
    applicationCountsByRuleId.set(rule.ruleId, nextCount);
    if (result.maxApplications !== undefined) {
      assertPositiveSafeInteger(result.maxApplications, "maxApplications");
      if (nextCount > result.maxApplications) {
        blockers.push(createMaxApplicationsBlocker(rule.ruleId, result.maxApplications));
        continue;
      }
    }

    if (result.exclusivityGroup !== undefined) {
      assertNonEmptyString(result.exclusivityGroup.groupId, "exclusivityGroup.groupId");
      if (seenExclusivityGroups.has(result.exclusivityGroup.groupId)) {
        blockers.push(createExclusivityBlocker(result.exclusivityGroup.groupId));
        continue;
      }
      seenExclusivityGroups.add(result.exclusivityGroup.groupId);
    }

    total = total.add(result.itemPoints);
    hasItemCalculation = true;
  }

  if (blockers.length > 0) {
    return createBlockedResult(request, blockers, steps, warnings);
  }

  if (!hasItemCalculation) {
    return createBlockedResult(request, [regulatoryReviewBlocker], [...steps, blockerStep(regulatoryReviewBlocker)], warnings);
  }

  return createPointsOnlyCopayBlockedResult(request, total, steps, warnings);
}
