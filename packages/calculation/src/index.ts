import type {
  BlockerType,
  DispensingId,
  PatientId,
  PharmacyId,
  PrescriptionId,
  TenantId,
} from "@yrese/shared-kernel";
import { evidenceId } from "@yrese/shared-kernel";
import type { ClaimMonth, DispensingDate, PrescriptionDate, ReceptionDate } from "@yrese/date-time";
import { CalendarDate } from "@yrese/date-time";
import { Points, type Yen } from "@yrese/money";
import {
  createCalculationTrace,
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
  const seenApplications = new Set<string>();
  const applicationCountsByRuleId = new Map<string, number>();
  const seenExclusivityGroups = new Set<string>();
  let total = Points.fromInteger(0);
  let hasItemCalculation = false;

  for (const rule of ruleSet.rules) {
    if (request.dispensing.dispensingDate.toCalendarDate().compare(rule.effectiveFrom) < 0) {
      blockers.push(createEffectiveFromBlocker(rule));
      steps.push(effectiveFromBlockedStep(rule));
      continue;
    }

    const result = rule.apply(Object.freeze({ request, ruleId: rule.ruleId }));
    steps.push(ruleStep(rule, result));
    warnings.push(...(result.warnings ?? []));

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

    if (result.maxApplications !== undefined) {
      assertPositiveSafeInteger(result.maxApplications, "maxApplications");
      const nextCount = (applicationCountsByRuleId.get(rule.ruleId) ?? 0) + 1;
      applicationCountsByRuleId.set(rule.ruleId, nextCount);
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
