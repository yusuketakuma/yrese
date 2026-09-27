import type {
  BlockerType,
  DispensingId,
  PatientId,
  PharmacyId,
  PrescriptionId,
  TenantId,
} from "@yrese/shared-kernel";
import type {
  CalendarDate,
  ClaimMonth,
  DispensingDate,
  PrescriptionDate,
  ReceptionDate,
} from "@yrese/date-time";
import type { Points, Yen } from "@yrese/money";
import type { CalculationTrace, EvidenceRef } from "@yrese/trace";

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
  /**
   * この項目が、指定接頭辞の groupId を持つ他項目との併算定を禁じる(非対称排他)。
   * 調剤管理料2「1以外の場合」が剤別 group を持つ料1の任意適用と衝突する等、
   * 「同一 group 内の相互排他」では表現できない区分間排他に使う。評価は順序非依存。
   */
  readonly blocksGroupIdPrefixes?: readonly string[];
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
