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
import { Points, type ScaledDecimal, type Yen } from "@yrese/money";

import {
  applyPointsMultiplier,
  basicFeeCompositionOrderWarning,
  composeDispensingBasicFeePoints,
  decoctionPreparationFeePoints,
  drugFeeProvisionalRoundingWarning,
  drugPriceToPoints,
  materialFeeProvisionalWarning,
  materialPriceToPoints,
  onePackagingSupportFeePoints,
  type PointsRatio,
  selfPreparationAdditionPoints,
  type SelfPreparationKind,
  weighingMixingAdditionPoints,
  type WeighingMixingKind,
} from "./formulas.js";

export * from "./formulas.js";
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

/* ------------------------------------------------------------------
 * 区分01 薬剤調製料 — 剤形別(CAL-004 v0.3.0 §2 で解禁。evidence は CAL-003)
 * 剤・調剤の数量、適用可否は算定要件未検証のため呼び出し側指定(§5)。
 * ------------------------------------------------------------------ */

/** EVD-CAL-0022 屯服薬: 21点。 */
export const tonpukuPreparationFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0022:tonpuku-preparation-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0022"),
  itemPoints: Points.fromInteger(21),
  applicationKey: "tonpuku",
  description: "Tonpuku (as-needed) medicine preparation fee: 21 points",
  output: "itemPoints=21",
});

/** EVD-CAL-0023 浸煎薬: 190点(1調剤につき。4調剤以上は算定しない=上限3適用)。 */
export function createSenzenPreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0023:senzen-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0023"),
    itemPoints: Points.fromInteger(190),
    applicationKey,
    description: "Senzen (decocted crude drug) preparation fee: 190 points per dispensing, up to 3",
    output: "itemPoints=190",
    maxApplications: 3,
  });
}

/** EVD-CAL-0027 注射薬: 26点。 */
export const injectionPreparationFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0027:injection-preparation-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0027"),
  itemPoints: Points.fromInteger(26),
  applicationKey: "injection",
  description: "Injection medicine preparation fee: 26 points",
  output: "itemPoints=26",
});

/** EVD-CAL-0028 外用薬: 10点(1調剤につき。4調剤以上は算定しない=上限3適用)。 */
export function createExternalPreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0028:external-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0028"),
    itemPoints: Points.fromInteger(10),
    applicationKey,
    description: "External-use medicine preparation fee: 10 points per dispensing, up to 3",
    output: "itemPoints=10",
    maxApplications: 3,
  });
}

/** EVD-CAL-0029 注1 内服用滴剤: 1調剤につき10点。 */
export function createOralDropPreparationFeeRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0029:oral-drop-preparation-fee",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0029"),
    itemPoints: Points.fromInteger(10),
    applicationKey,
    description: "Oral drop preparation fee: 10 points per dispensing",
    output: "itemPoints=10",
  });
}

/** EVD-CAL-0030 注3 麻薬加算: 1調剤につき70点。 */
export function createNarcoticPreparationAdditionRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0030:narcotic-preparation-addition",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0030"),
    itemPoints: Points.fromInteger(70),
    applicationKey,
    description: "Narcotic preparation addition: 70 points per dispensing",
    output: "itemPoints=70",
  });
}

/** EVD-CAL-0030 注3 向精神薬・覚醒剤原料・毒薬加算: 1調剤につき8点。 */
export function createPsychotropicEtcPreparationAdditionRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0030:psychotropic-etc-preparation-addition",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0030"),
    itemPoints: Points.fromInteger(8),
    applicationKey,
    description: "Psychotropic/raw-stimulant/poison preparation addition: 8 points per dispensing",
    output: "itemPoints=8",
  });
}

/**
 * 湯薬の薬剤調製料(EVD-CAL-0024/0025/0026 — 数量段階型)。
 * 日数は算定要件未検証の入力(呼び出し側指定)。適用された段の evidence を evidenceRefs に持つ。
 */
export function createDecoctionPreparationFeeRule(
  applicationKey: string,
  daysSupply: number,
): CalculationRule {
  assertNonEmptyString(applicationKey, "applicationKey");
  const fee = decoctionPreparationFeePoints(daysSupply);
  return Object.freeze({
    ruleId: `${fee.appliedEvidenceId}:decoction-preparation-fee`,
    evidenceRefs: freezeArray([calculationEvidenceRef(fee.appliedEvidenceId)]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Decoction (tou-yaku) preparation fee for ${daysSupply} days supply`,
        affectsClaim: true,
        inputRefs: ["daysSupply"],
        output: `itemPoints=${fee.points.toString()};daysSupply=${daysSupply}`,
        itemPoints: fee.points,
        applicationKey,
      }),
  });
}

/**
 * 使用薬剤料(EVD-CAL-0067 — 薬価→点数変換)。
 * 薬価(所定単位あたり・円)は薬価基準由来の入力として呼び出し側が指定する。
 * EVD-CAL-0067 の caveat により暫定 warning を必ず付与する(CAL-004 §2)。
 */
export function createDrugFeeRule(input: {
  readonly applicationKey: string;
  /** 所定単位あたり薬価(円)。ScaledDecimal(小数薬価対応)。 */
  readonly unitPriceYen: ScaledDecimal;
}): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  const points = drugPriceToPoints(input.unitPriceYen);
  return Object.freeze({
    ruleId: "EVD-CAL-0067:drug-fee",
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0067")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Drug fee converted from unit price ${input.unitPriceYen.toString()} yen`,
        affectsClaim: true,
        inputRefs: ["unitPriceYen"],
        output: `itemPoints=${points.toString()};unitPriceYen=${input.unitPriceYen.toString()}`,
        itemPoints: points,
        applicationKey: input.applicationKey,
        warnings: [drugFeeProvisionalRoundingWarning],
      }),
  });
}

/**
 * 一包化: 外来服薬支援料2(EVD-CAL-0055/0056 — 数量段階型)。
 * - 42日分以下: 7日ごと34点(EVD-CAL-0055)
 * - 43日分以上: 240点(EVD-CAL-0056)
 * 日数は算定要件未検証の入力(呼び出し側指定)。処方箋単位(applicationKey="prescription")。
 */
export function createOnePackagingSupportFeeRule(
  applicationKey: string,
  daysSupply: number,
): CalculationRule {
  assertNonEmptyString(applicationKey, "applicationKey");
  const fee = onePackagingSupportFeePoints(daysSupply);
  return Object.freeze({
    ruleId: `${fee.appliedEvidenceId}:one-packaging-support-fee`,
    evidenceRefs: freezeArray([calculationEvidenceRef(fee.appliedEvidenceId)]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `One-packaging (outpatient medication support fee 2) for ${daysSupply} days supply`,
        affectsClaim: true,
        inputRefs: ["daysSupply"],
        output: `itemPoints=${fee.points.toString()};daysSupply=${daysSupply}`,
        itemPoints: fee.points,
        applicationKey,
      }),
  });
}

export interface SelfPreparationAdditionRuleInput {
  readonly applicationKey: string;
  readonly kind: SelfPreparationKind;
  /** oral_tablet_like(7日ごと)のみ必須。粉砕はここ。 */
  readonly daysSupply?: number;
  /** 予製剤・錠剤分割は所定点数の100分の20(EVD-CAL-0033 括弧書き)。 */
  readonly prePrepared?: boolean;
}

/**
 * 自家製剤加算(EVD-CAL-0033)。粉砕は kind="oral_tablet_like"(20点×⌈日数/7⌉)。
 * 予製剤の乗率(100分の20)で端数が出る場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 */
export function createSelfPreparationAdditionRule(
  input: SelfPreparationAdditionRuleInput,
): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  const outcome = selfPreparationAdditionPoints({
    kind: input.kind,
    ...(input.daysSupply !== undefined ? { daysSupply: input.daysSupply } : {}),
    ...(input.prePrepared !== undefined ? { prePrepared: input.prePrepared } : {}),
  });
  return Object.freeze({
    ruleId: `EVD-CAL-0033:self-preparation-addition:${input.kind}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0033")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (outcome.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: `Self-preparation addition (${input.kind}): pre-prepared multiplier produced a fractional value`,
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: 自家製剤加算(予製剤 100分の20)の適用結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Self-preparation addition (${input.kind})`,
        affectsClaim: true,
        inputRefs: input.daysSupply !== undefined ? ["daysSupply"] : [],
        output: `itemPoints=${outcome.points.toString()};kind=${input.kind}`,
        itemPoints: outcome.points,
        applicationKey: input.applicationKey,
      });
    },
  });
}

export interface WeighingMixingAdditionRuleInput {
  readonly applicationKey: string;
  readonly kind: WeighingMixingKind;
  /** 予製剤は所定点数の100分の20。 */
  readonly prePrepared?: boolean;
}

/**
 * 計量混合調剤加算(EVD-CAL-0034): 液剤35 / 散剤・顆粒剤45 / 軟・硬膏剤80。
 * 予製剤の乗率(100分の20)で端数が出る場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 */
export function createWeighingMixingAdditionRule(
  input: WeighingMixingAdditionRuleInput,
): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  const outcome = weighingMixingAdditionPoints(input.kind, input.prePrepared ?? false);
  return Object.freeze({
    ruleId: `EVD-CAL-0034:weighing-mixing-addition:${input.kind}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0034")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (outcome.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: `Weighing-mixing addition (${input.kind}): pre-prepared multiplier produced a fractional value`,
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: 計量混合調剤加算(予製剤 100分の20)の適用結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Weighing-mixing addition (${input.kind})`,
        affectsClaim: true,
        inputRefs: [],
        output: `itemPoints=${outcome.points.toString()};kind=${input.kind}`,
        itemPoints: outcome.points,
        applicationKey: input.applicationKey,
      });
    },
  });
}

/* ------------------------------------------------------------------
 * 区分00 調剤基本料 — 合成計算(基礎点数 → 乗率 → 減算 → 下限)
 * 区分選択(1/2/3イロハ/特別A)は施設基準(P-05)前提のため呼び出し側指定。
 * ------------------------------------------------------------------ */

export interface DispensingBasicFeeBase {
  readonly evidenceId: string;
  readonly points: Points;
  readonly label: string;
}

/** 区分00 の基礎点数プリセット(CAL-003 EVD-CAL-0001〜0006)。 */
export const DISPENSING_BASIC_FEE_BASES = Object.freeze({
  FEE_1: { evidenceId: "EVD-CAL-0001", points: Points.fromInteger(47), label: "調剤基本料1" },
  FEE_2: { evidenceId: "EVD-CAL-0002", points: Points.fromInteger(30), label: "調剤基本料2" },
  FEE_3_I: { evidenceId: "EVD-CAL-0003", points: Points.fromInteger(25), label: "調剤基本料3イ" },
  FEE_3_RO: { evidenceId: "EVD-CAL-0004", points: Points.fromInteger(20), label: "調剤基本料3ロ" },
  FEE_3_HA: { evidenceId: "EVD-CAL-0005", points: Points.fromInteger(37), label: "調剤基本料3ハ" },
  SPECIAL_A: { evidenceId: "EVD-CAL-0006", points: Points.fromInteger(5), label: "特別調剤基本料A" },
} satisfies Readonly<Record<string, DispensingBasicFeeBase>>);

export interface DispensingBasicFeeRuleInput {
  /** 基礎区分(DISPENSING_BASIC_FEE_BASES のいずれか、または evidence 付き同型値)。 */
  readonly base: DispensingBasicFeeBase;
  /** 注3(EVD-CAL-0007): 複数医療機関の処方箋同時受付の2枚目以降(所定点数の100分の80)。 */
  readonly secondOrLaterConcurrentPrescription?: boolean;
  /** 注8(EVD-CAL-0012): 後発医薬品減算(▲5点)。 */
  readonly genericDispensingReduction?: boolean;
  /** 注15(EVD-CAL-0019): 門前薬局等立地依存減算(▲15点)。 */
  readonly locationDependencyReduction?: boolean;
}

/**
 * 調剤基本料の合成ルール(区分00)。
 * 合成計算は composeDispensingBasicFeePoints(乗率→減算→下限3点 EVD-CAL-0020)。
 * 乗率で端数が出る場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 * 同一処方箋受付での基本料区分の重複適用は exclusivityGroup で排他する。
 */
export function createDispensingBasicFeeRule(input: DispensingBasicFeeRuleInput): CalculationRule {
  const evidenceRefs: EvidenceRef[] = [calculationEvidenceRef(input.base.evidenceId)];
  const reductions: Points[] = [];
  const noteOutputs: string[] = [];

  const multiplier = input.secondOrLaterConcurrentPrescription === true
    ? { numerator: 80, denominator: 100 }
    : undefined;
  if (multiplier !== undefined) {
    evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0007"));
    noteOutputs.push("multiplier=80/100");
  }
  if (input.genericDispensingReduction === true) {
    evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0012"));
    reductions.push(Points.fromInteger(5));
    noteOutputs.push("reduction=5");
  }
  if (input.locationDependencyReduction === true) {
    evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0019"));
    reductions.push(Points.fromInteger(15));
    noteOutputs.push("reduction=15");
  }
  // 注16(下限3点)は区分00 の合算に常に効く規定
  evidenceRefs.push(calculationEvidenceRef("EVD-CAL-0020"));

  const composed = composeDispensingBasicFeePoints({
    basePoints: input.base.points,
    ...(multiplier !== undefined ? { multiplier } : {}),
    reductions,
    minimumPoints: Points.fromInteger(3),
  });
  const usesComposition = multiplier !== undefined || reductions.length > 0;

  return Object.freeze({
    ruleId: `${input.base.evidenceId}:dispensing-basic-fee`,
    evidenceRefs: freezeArray(evidenceRefs),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (composed.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: `${input.base.label}: multiplier produced a fractional value and no rounding evidence is issued`,
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${composed.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: ${input.base.label} の乗率適用結果 ${composed.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      if (composed.kind === "negative_without_minimum") {
        // minimumPoints=3 を常時宣言しているため到達しない(防御)
        return Object.freeze({
          status: "BLOCKED",
          description: `${input.base.label}: reductions produced a negative value without a floor`,
          affectsClaim: false,
          inputRefs: [],
          output: "SSOT_UPDATE_REQUIRED:減算結果が負",
          blocker: {
            type: "SSOT_UPDATE_REQUIRED" as const,
            detail: `${input.base.label}: 減算結果が負(下限宣言なし)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `${input.base.label}: composed dispensing basic fee (base=${input.base.points.toString()})`,
        affectsClaim: true,
        inputRefs: [],
        output: [
          `itemPoints=${composed.points.toString()}`,
          ...noteOutputs,
          ...(composed.clampedToMinimum ? ["clampedToMinimum=3"] : []),
        ].join(";"),
        itemPoints: composed.points,
        applicationKey: "dispensing-basic-fee",
        exclusivityGroup: {
          groupId: "dispensing-basic-fee",
          evidenceRef: calculationEvidenceRef(input.base.evidenceId),
        },
        ...(usesComposition ? { warnings: [basicFeeCompositionOrderWarning] } : {}),
      });
    },
  });
}

/* ==================================================================
 * 乗率適用型ルールの共通ステップ生成(注意: 端数は BLOCKED = MOD-010 §1-4)。
 * ================================================================== */
function multiplierAppliedStep(input: {
  readonly base: Points;
  readonly ratio: PointsRatio;
  readonly applicationKey: string;
  readonly ruleLabelJa: string;
  readonly descriptionEn: string;
  readonly inputRefs: readonly string[];
  readonly extraWarnings?: readonly string[];
}): StepResult {
  const outcome = applyPointsMultiplier(input.base, input.ratio);
  if (outcome.kind === "requires_rounding_evidence") {
    return Object.freeze({
      status: "BLOCKED",
      description: `${input.descriptionEn}: multiplier produced a fractional value`,
      affectsClaim: false,
      inputRefs: [],
      output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
      blocker: {
        type: "BLOCKED_REGULATORY_REVIEW" as const,
        detail: `丸め根拠未発行: ${input.ruleLabelJa} の乗率適用結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
      },
    });
  }
  return Object.freeze({
    status: "ITEM_CALCULATED",
    description: input.descriptionEn,
    affectsClaim: true,
    inputRefs: input.inputRefs,
    output: `itemPoints=${outcome.points.toString()}`,
    itemPoints: outcome.points,
    applicationKey: input.applicationKey,
    ...(input.extraWarnings && input.extraWarnings.length > 0
      ? { warnings: input.extraWarnings }
      : {}),
  });
}

/* ==================================================================
 * 区分00 調剤基本料 加算(注5〜注14)。施設基準(P-05)前提のため呼び出し側指定。
 * 注4別薬局減算(EVD-CAL-0008 100分の50)・特別調剤基本料B(保留P-01)・
 * 分割調剤(EVD-CAL-0013〜0015 除算)は本バッチ対象外(下部コメント参照)。
 * ================================================================== */

/** EVD-CAL-0009 注5 地域支援体制加算・医薬品供給対応体制加算 1〜5(27/59/67/37/59点)。 */
export type RegionalSupportAdditionLevel = 1 | 2 | 3 | 4 | 5;
const regionalSupportAdditionPoints: Readonly<Record<RegionalSupportAdditionLevel, number>> = {
  1: 27,
  2: 59,
  3: 67,
  4: 37,
  5: 59,
};
export function createRegionalSupportSystemAdditionRule(
  level: RegionalSupportAdditionLevel,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0009:regional-support-system-addition:${level}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0009"),
    itemPoints: Points.fromInteger(regionalSupportAdditionPoints[level]),
    applicationKey,
    description: `Regional support / drug supply system addition level ${level}`,
    output: `itemPoints=${regionalSupportAdditionPoints[level]};level=${level}`,
  });
}

/** EVD-CAL-0010 注6 連携強化加算: 5点。 */
export const cooperationEnhancementAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0010:cooperation-enhancement-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0010"),
  itemPoints: Points.fromInteger(5),
  applicationKey: "prescription",
  description: "Cooperation enhancement addition: 5 points",
  output: "itemPoints=5",
});

/** EVD-CAL-0011 注7 バイオ後続品調剤体制加算: 50点。 */
export const biosimilarDispensingSystemAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0011:biosimilar-dispensing-system-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0011"),
  itemPoints: Points.fromInteger(50),
  applicationKey: "prescription",
  description: "Biosimilar dispensing system addition: 50 points",
  output: "itemPoints=50",
});

/** EVD-CAL-0016 注12 在宅薬学総合体制加算1: 30点。 */
export const inHomePharmacyComprehensiveSystemAddition1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0016:in-home-pharmacy-comprehensive-system-addition-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0016"),
  itemPoints: Points.fromInteger(30),
  applicationKey: "prescription",
  description: "In-home pharmacy comprehensive system addition 1: 30 points",
  output: "itemPoints=30",
});

/** EVD-CAL-0017 注13 在宅薬学総合体制加算2: イ 100点 / ロ 50点。 */
export type InHomePharmacyAddition2Variant = "i" | "ro";
const inHomePharmacyAddition2Points: Readonly<Record<InHomePharmacyAddition2Variant, number>> = {
  i: 100,
  ro: 50,
};
export function createInHomePharmacyComprehensiveSystemAddition2Rule(
  variant: InHomePharmacyAddition2Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0017:in-home-pharmacy-comprehensive-system-addition-2:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0017"),
    itemPoints: Points.fromInteger(inHomePharmacyAddition2Points[variant]),
    applicationKey,
    description: `In-home pharmacy comprehensive system addition 2 (${variant})`,
    output: `itemPoints=${inHomePharmacyAddition2Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0018 注14 電子的調剤情報連携体制整備加算: 月1回 8点。 */
export const electronicDispensingInfoCooperationAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0018:electronic-dispensing-info-cooperation-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0018"),
  itemPoints: Points.fromInteger(8),
  applicationKey: "claim-month",
  description: "Electronic dispensing info cooperation addition: 8 points (monthly)",
  output: "itemPoints=8",
  maxApplications: 1,
});

/* ==================================================================
 * 区分01 薬剤調製料 加算(注4 時間外・休日・深夜加算)。
 * ================================================================== */

/** EVD-CAL-0031 注4 時間外・休日・深夜加算: 100分の100 / 140 / 200(薬剤調製料所定点数に対する乗率)。 */
export type TimeSurchargeKind = "afterHours" | "holiday" | "lateNight";
const timeSurchargeRatios: Readonly<Record<TimeSurchargeKind, PointsRatio>> = {
  afterHours: { numerator: 100, denominator: 100 },
  holiday: { numerator: 140, denominator: 100 },
  lateNight: { numerator: 200, denominator: 100 },
};
/** 時間帯定義が留意事項通知精読後に確定であることの必須警告(EVD-CAL-0031 caveat)。 */
export const timeSurchargeProvisionalWarning =
  "時間外・休日・深夜加算の時間帯定義は暫定(EVD-CAL-0031 caveat — 留意事項通知精読後に確定)";
export function createTimeSurchargeAdditionRule(input: {
  readonly applicationKey: string;
  /** 薬剤調製料の所定点数(乗率の基礎)。呼び出し側指定。 */
  readonly basePoints: Points;
  readonly kind: TimeSurchargeKind;
}): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  return Object.freeze({
    ruleId: `EVD-CAL-0031:time-surcharge-addition:${input.kind}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0031")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult =>
      multiplierAppliedStep({
        base: input.basePoints,
        ratio: timeSurchargeRatios[input.kind],
        applicationKey: input.applicationKey,
        ruleLabelJa: `時間外等加算(${input.kind})`,
        descriptionEn: `Time surcharge addition (${input.kind})`,
        inputRefs: ["basePoints"],
        extraWarnings: [timeSurchargeProvisionalWarning],
      }),
  });
}

/* ==================================================================
 * 区分10の2 調剤管理料(1イ/1ロ 本体、注3残薬調整加算、注4薬学的有害事象等防止加算)。
 * ================================================================== */

/** EVD-CAL-0035 調剤管理料1 イ(内服薬・28日分以上): 60点(1剤につき。4剤以上算定しない)。 */
export function createDispensingManagementFee1IRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0035:dispensing-management-fee-1-i",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0035"),
    itemPoints: Points.fromInteger(60),
    applicationKey,
    description: "Dispensing management fee 1-i (oral, 28+ days): 60 points per group, up to 3",
    output: "itemPoints=60",
    maxApplications: 3,
  });
}

/** EVD-CAL-0036 調剤管理料1 ロ(イ以外): 10点(1剤につき。4剤以上算定しない)。 */
export function createDispensingManagementFee1RoRule(applicationKey: string): CalculationRule {
  return createFixedPointsRule({
    ruleId: "EVD-CAL-0036:dispensing-management-fee-1-ro",
    evidenceRef: calculationEvidenceRef("EVD-CAL-0036"),
    itemPoints: Points.fromInteger(10),
    applicationKey,
    description: "Dispensing management fee 1-ro (other): 10 points per group, up to 3",
    output: "itemPoints=10",
    maxApplications: 3,
  });
}

/** イ/ロ/ハ=50点、ニ=30点 の4区分共通の点数マップ(EVD-CAL-0038 / 0039)。 */
export type IrohaNiVariant = "i" | "ro" | "ha" | "ni";
const irohaNi50_30Points: Readonly<Record<IrohaNiVariant, number>> = {
  i: 50,
  ro: 50,
  ha: 50,
  ni: 30,
};

/** EVD-CAL-0038 注3 調剤時残薬調整加算: イ/ロ/ハ 各50点、ニ 30点。 */
export function createResidualDrugAdjustmentAdditionRule(
  variant: IrohaNiVariant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0038:residual-drug-adjustment-addition:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0038"),
    itemPoints: Points.fromInteger(irohaNi50_30Points[variant]),
    applicationKey,
    description: `Residual drug adjustment addition (${variant})`,
    output: `itemPoints=${irohaNi50_30Points[variant]};variant=${variant}`,
  });
}

/**
 * EVD-CAL-0039 注4 薬学的有害事象等防止加算: イ/ロ/ハ 各50点、ニ 30点。
 * 重複投薬確認等の判定は行わず、適用可否は呼び出し側指定(表示専用)。
 * SaMD該当性(REG-005)評価が別途必要である旨を warning で明示する。
 */
export const adverseEventPreventionSamdWarning =
  "薬学的有害事象等防止加算は表示専用(判定ロジック非搭載)。SaMD該当性評価(REG-005)・外部確認前提との整合は別途整理が必要";
export function createAdverseEventPreventionAdditionRule(
  variant: IrohaNiVariant,
  applicationKey = "prescription",
): CalculationRule {
  const points = Points.fromInteger(irohaNi50_30Points[variant]);
  return Object.freeze({
    ruleId: `EVD-CAL-0039:adverse-event-prevention-addition:${variant}`,
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0039")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Pharmaceutical adverse event prevention addition (${variant})`,
        affectsClaim: true,
        inputRefs: [],
        output: `itemPoints=${points.toString()};variant=${variant}`,
        itemPoints: points,
        applicationKey,
        warnings: [adverseEventPreventionSamdWarning],
      }),
  });
}

/* ==================================================================
 * 区分10の3 服薬管理指導料(1/2/4 本体、注6〜注17 加算)。
 * ================================================================== */

/** EVD-CAL-0040 服薬管理指導料1(3月以内再来+手帳提示): 45点(イ/ロ同点)。 */
export const medicationManagementGuidanceFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0040:medication-management-guidance-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0040"),
  itemPoints: Points.fromInteger(45),
  applicationKey: "prescription",
  description: "Medication management guidance fee 1: 45 points",
  output: "itemPoints=45",
});

/** EVD-CAL-0041 服薬管理指導料2(1以外の患者): 59点。 */
export const medicationManagementGuidanceFee2Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0041:medication-management-guidance-fee-2",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0041"),
  itemPoints: Points.fromInteger(59),
  applicationKey: "prescription",
  description: "Medication management guidance fee 2: 59 points",
  output: "itemPoints=59",
});

/** EVD-CAL-0043 服薬管理指導料4(情報通信機器): イ45点 / ロ・ハ・ニ 59点。 */
export type MedicationManagementGuidanceFee4Variant = "i" | "ro" | "ha" | "ni";
const medicationManagementGuidanceFee4Points: Readonly<
  Record<MedicationManagementGuidanceFee4Variant, number>
> = { i: 45, ro: 59, ha: 59, ni: 59 };
export function createMedicationManagementGuidanceFee4Rule(
  variant: MedicationManagementGuidanceFee4Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0043:medication-management-guidance-fee-4:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0043"),
    itemPoints: Points.fromInteger(medicationManagementGuidanceFee4Points[variant]),
    applicationKey,
    description: `Medication management guidance fee 4 (${variant})`,
    output: `itemPoints=${medicationManagementGuidanceFee4Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0044 注6 麻薬管理指導加算: 22点。 */
export const narcoticManagementGuidanceAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0044:narcotic-management-guidance-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0044"),
  itemPoints: Points.fromInteger(22),
  applicationKey: "prescription",
  description: "Narcotic management guidance addition: 22 points",
  output: "itemPoints=22",
});

/** EVD-CAL-0045 注7 特定薬剤管理指導加算1: イ 10点 / ロ 5点。 */
export type SpecificDrugManagementAddition1Variant = "i" | "ro";
const specificDrugManagementAddition1Points: Readonly<
  Record<SpecificDrugManagementAddition1Variant, number>
> = { i: 10, ro: 5 };
export function createSpecificDrugManagementGuidanceAddition1Rule(
  variant: SpecificDrugManagementAddition1Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0045:specific-drug-management-guidance-addition-1:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0045"),
    itemPoints: Points.fromInteger(specificDrugManagementAddition1Points[variant]),
    applicationKey,
    description: `Specific drug management guidance addition 1 (${variant})`,
    output: `itemPoints=${specificDrugManagementAddition1Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0046 注8 特定薬剤管理指導加算2: 月1回 100点。 */
export const specificDrugManagementGuidanceAddition2Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0046:specific-drug-management-guidance-addition-2",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0046"),
  itemPoints: Points.fromInteger(100),
  applicationKey: "claim-month",
  description: "Specific drug management guidance addition 2: 100 points (monthly)",
  output: "itemPoints=100",
  maxApplications: 1,
});

/** EVD-CAL-0047 注9 特定薬剤管理指導加算3: イ 5点 / ロ 10点。 */
export type SpecificDrugManagementAddition3Variant = "i" | "ro";
const specificDrugManagementAddition3Points: Readonly<
  Record<SpecificDrugManagementAddition3Variant, number>
> = { i: 5, ro: 10 };
export function createSpecificDrugManagementGuidanceAddition3Rule(
  variant: SpecificDrugManagementAddition3Variant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0047:specific-drug-management-guidance-addition-3:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0047"),
    itemPoints: Points.fromInteger(specificDrugManagementAddition3Points[variant]),
    applicationKey,
    description: `Specific drug management guidance addition 3 (${variant})`,
    output: `itemPoints=${specificDrugManagementAddition3Points[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0048 注10 乳幼児服薬指導加算: 12点。 */
export const infantMedicationGuidanceAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0048:infant-medication-guidance-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0048"),
  itemPoints: Points.fromInteger(12),
  applicationKey: "prescription",
  description: "Infant medication guidance addition: 12 points",
  output: "itemPoints=12",
});

/** EVD-CAL-0049 注11 小児特定加算: 350点。 */
export const pediatricSpecificAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0049:pediatric-specific-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0049"),
  itemPoints: Points.fromInteger(350),
  applicationKey: "prescription",
  description: "Pediatric specific addition: 350 points",
  output: "itemPoints=350",
});

/** EVD-CAL-0050 注12 吸入薬指導加算: 6月に1回 30点。 */
export const inhalationDrugGuidanceAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0050:inhalation-drug-guidance-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0050"),
  itemPoints: Points.fromInteger(30),
  applicationKey: "prescription",
  description: "Inhalation drug guidance addition: 30 points",
  output: "itemPoints=30",
});

/** EVD-CAL-0051 注13 かかりつけ薬剤師フォローアップ加算: 3月に1回 50点。 */
export const familyPharmacistFollowUpAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0051:family-pharmacist-follow-up-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0051"),
  itemPoints: Points.fromInteger(50),
  applicationKey: "prescription",
  description: "Family pharmacist follow-up addition: 50 points",
  output: "itemPoints=50",
});

/** EVD-CAL-0052 注14 かかりつけ薬剤師訪問加算: 6月に1回 230点。 */
export const familyPharmacistVisitAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0052:family-pharmacist-visit-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0052"),
  itemPoints: Points.fromInteger(230),
  applicationKey: "prescription",
  description: "Family pharmacist visit addition: 230 points",
  output: "itemPoints=230",
});

/** EVD-CAL-0053 注17 服薬管理指導料の特例: 13点。 */
export const medicationManagementGuidanceSpecialCaseRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0053:medication-management-guidance-special-case",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0053"),
  itemPoints: Points.fromInteger(13),
  applicationKey: "prescription",
  description: "Medication management guidance special case: 13 points",
  output: "itemPoints=13",
});

/* ==================================================================
 * 区分14の2 外来服薬支援料 / 14の3 服用薬剤調整支援料。
 * ================================================================== */

/** EVD-CAL-0054 外来服薬支援料1: 185点。 */
export const outpatientMedicationSupportFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0054:outpatient-medication-support-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0054"),
  itemPoints: Points.fromInteger(185),
  applicationKey: "prescription",
  description: "Outpatient medication support fee 1: 185 points",
  output: "itemPoints=185",
});

/** EVD-CAL-0057 注4 施設連携加算: 月1回 50点。 */
export const facilityCooperationAdditionRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0057:facility-cooperation-addition",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0057"),
  itemPoints: Points.fromInteger(50),
  applicationKey: "claim-month",
  description: "Facility cooperation addition: 50 points (monthly)",
  output: "itemPoints=50",
  maxApplications: 1,
});

/** EVD-CAL-0058 服用薬剤調整支援料1: 125点(支援料2=1,000点判読は保留 P-02)。 */
export const medicationAdjustmentSupportFee1Rule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0058:medication-adjustment-support-fee-1",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0058"),
  itemPoints: Points.fromInteger(125),
  applicationKey: "prescription",
  description: "Medication adjustment support fee 1: 125 points",
  output: "itemPoints=125",
});

/* ==================================================================
 * 区分15系 在宅関連(CAL-003 発行済みのみ)。
 * 在宅患者訪問薬剤管理指導料(区分15)本体・在宅患者緊急訪問(15の2)本体は保留 P-04 のため未実装。
 * ================================================================== */

/**
 * EVD-CAL-0059 15の3 在宅患者緊急時等共同指導料。
 * 本体700点 + 各加算(麻薬管理指導100 / 在宅麻薬持続注射250 / 乳幼児100 / 小児特定450 / 中心静脈栄養150。各1回)。
 */
export type HomeEmergencyJointGuidanceVariant =
  | "base"
  | "narcotic"
  | "continuousNarcoticInjection"
  | "infant"
  | "pediatricSpecific"
  | "centralVenousNutrition";
const homeEmergencyJointGuidancePoints: Readonly<Record<HomeEmergencyJointGuidanceVariant, number>> = {
  base: 700,
  narcotic: 100,
  continuousNarcoticInjection: 250,
  infant: 100,
  pediatricSpecific: 450,
  centralVenousNutrition: 150,
};
export function createHomePatientEmergencyJointGuidanceRule(
  variant: HomeEmergencyJointGuidanceVariant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0059:home-patient-emergency-joint-guidance:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0059"),
    itemPoints: Points.fromInteger(homeEmergencyJointGuidancePoints[variant]),
    applicationKey,
    description: `Home patient emergency joint guidance (${variant})`,
    output: `itemPoints=${homeEmergencyJointGuidancePoints[variant]};variant=${variant}`,
    maxApplications: 1,
  });
}

/** EVD-CAL-0061 15の4 退院時共同指導料: 600点。 */
export const dischargeJointGuidanceFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0061:discharge-joint-guidance-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0061"),
  itemPoints: Points.fromInteger(600),
  applicationKey: "prescription",
  description: "Discharge joint guidance fee: 600 points",
  output: "itemPoints=600",
});

/** EVD-CAL-0062 15の5 服薬情報等提供料: 1=30点 / 2 イ・ロ・ハ=各20点 / 3=50点。 */
export type MedicationInfoProvisionVariant = "1" | "2i" | "2ro" | "2ha" | "3";
const medicationInfoProvisionPoints: Readonly<Record<MedicationInfoProvisionVariant, number>> = {
  "1": 30,
  "2i": 20,
  "2ro": 20,
  "2ha": 20,
  "3": 50,
};
export function createMedicationInfoProvisionFeeRule(
  variant: MedicationInfoProvisionVariant,
  applicationKey = "prescription",
): CalculationRule {
  return createFixedPointsRule({
    ruleId: `EVD-CAL-0062:medication-info-provision-fee:${variant}`,
    evidenceRef: calculationEvidenceRef("EVD-CAL-0062"),
    itemPoints: Points.fromInteger(medicationInfoProvisionPoints[variant]),
    applicationKey,
    description: `Medication info provision fee (${variant})`,
    output: `itemPoints=${medicationInfoProvisionPoints[variant]};variant=${variant}`,
  });
}

/** EVD-CAL-0063 15の7 経管投薬支援料: 初回のみ 100点。 */
export const tubeFeedingMedicationSupportFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0063:tube-feeding-medication-support-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0063"),
  itemPoints: Points.fromInteger(100),
  applicationKey: "patient",
  description: "Tube feeding medication support fee: 100 points (first time only)",
  output: "itemPoints=100",
  maxApplications: 1,
});

/** EVD-CAL-0064 15の8 在宅移行初期管理料: 230点。 */
export const inHomeTransitionInitialManagementFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0064:in-home-transition-initial-management-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0064"),
  itemPoints: Points.fromInteger(230),
  applicationKey: "prescription",
  description: "In-home transition initial management fee: 230 points",
  output: "itemPoints=230",
});

/** EVD-CAL-0065 15の9 訪問薬剤管理医師同時指導料: 6月に1回 150点。 */
export const visitPharmacistPhysicianJointGuidanceFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0065:visit-pharmacist-physician-joint-guidance-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0065"),
  itemPoints: Points.fromInteger(150),
  applicationKey: "prescription",
  description: "Visit pharmacist-physician joint guidance fee: 150 points",
  output: "itemPoints=150",
});

/** EVD-CAL-0066 15の10 複数名薬剤管理指導訪問料: 300点。 */
export const multiPharmacistManagementVisitFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0066:multi-pharmacist-management-visit-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0066"),
  itemPoints: Points.fromInteger(300),
  applicationKey: "prescription",
  description: "Multi-pharmacist management visit fee: 300 points",
  output: "itemPoints=300",
});

/* ==================================================================
 * 第3節〜第5節(区分20 注2 多剤逓減 / 区分30 材料料 / 区分40・41 評価料)。
 * ================================================================== */

/**
 * EVD-CAL-0068 区分20 注2 多剤逓減: 1処方7種類以上の内服薬 → 所定点数の100分の90。
 * 使用薬剤料の所定点数(呼び出し側指定)に乗率を適用する。端数は BLOCKED(MOD-010 §1-4)。
 */
export function createMultiDrugReductionRule(input: {
  readonly applicationKey: string;
  /** 逓減対象の使用薬剤料 所定点数(呼び出し側指定)。 */
  readonly basePoints: Points;
}): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  return Object.freeze({
    ruleId: "EVD-CAL-0068:multi-drug-reduction",
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0068")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult =>
      multiplierAppliedStep({
        base: input.basePoints,
        ratio: { numerator: 90, denominator: 100 },
        applicationKey: input.applicationKey,
        ruleLabelJa: "多剤逓減(100分の90)",
        descriptionEn: "Multi-drug reduction (90/100)",
        inputRefs: ["basePoints"],
      }),
  });
}

/**
 * EVD-CAL-0069 区分30 特定保険医療材料料: 材料価格を10円で除して得た点数。
 * 材料価格(円)は材料価格基準由来の入力として呼び出し側が指定する。
 * 10円で割り切れない場合は丸め evidence 未発行のため BLOCKED(MOD-010 §1-4)。
 */
export function createSpecificMedicalMaterialFeeRule(input: {
  readonly applicationKey: string;
  readonly materialPriceYen: ScaledDecimal;
}): CalculationRule {
  assertNonEmptyString(input.applicationKey, "applicationKey");
  const outcome = materialPriceToPoints(input.materialPriceYen);
  return Object.freeze({
    ruleId: "EVD-CAL-0069:specific-medical-material-fee",
    evidenceRefs: freezeArray([calculationEvidenceRef("EVD-CAL-0069")]),
    effectiveFrom: ruleEffectiveFrom,
    apply: (): StepResult => {
      if (outcome.kind === "requires_rounding_evidence") {
        return Object.freeze({
          status: "BLOCKED",
          description: "Specific medical material fee: material price is not divisible by 10 yen",
          affectsClaim: false,
          inputRefs: [],
          output: `BLOCKED_REGULATORY_REVIEW:丸め根拠未発行(${outcome.exactFraction})`,
          blocker: {
            type: "BLOCKED_REGULATORY_REVIEW" as const,
            detail: `丸め根拠未発行: 特定保険医療材料料(材料価格÷10)の結果 ${outcome.exactFraction} 点は整数でない。丸め evidence 発行まで算定不可(MOD-010 §1-4)`,
          },
        });
      }
      return Object.freeze({
        status: "ITEM_CALCULATED",
        description: `Specific medical material fee from material price ${input.materialPriceYen.toString()} yen`,
        affectsClaim: true,
        inputRefs: ["materialPriceYen"],
        output: `itemPoints=${outcome.points.toString()};materialPriceYen=${input.materialPriceYen.toString()}`,
        itemPoints: outcome.points,
        applicationKey: input.applicationKey,
        warnings: [materialFeeProvisionalWarning],
      });
    },
  });
}

/** EVD-CAL-0070 区分40 調剤ベースアップ評価料: 4点(施設基準届出。令和9年6月以降は100分の200)。 */
export const dispensingBaseUpEvaluationFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0070:dispensing-base-up-evaluation-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0070"),
  itemPoints: Points.fromInteger(4),
  applicationKey: "prescription",
  description: "Dispensing base-up evaluation fee: 4 points",
  output: "itemPoints=4",
});

/** EVD-CAL-0071 区分41 調剤物価対応料: 1点(処方箋受付、3月に1回。令和9年6月以降は100分の200)。 */
export const dispensingPriceResponseFeeRule: CalculationRule = createFixedPointsRule({
  ruleId: "EVD-CAL-0071:dispensing-price-response-fee",
  evidenceRef: calculationEvidenceRef("EVD-CAL-0071"),
  itemPoints: Points.fromInteger(1),
  applicationKey: "prescription",
  description: "Dispensing price response fee: 1 point",
  output: "itemPoints=1",
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
