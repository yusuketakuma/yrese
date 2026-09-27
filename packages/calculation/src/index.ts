import { Points } from "@yrese/money";
import type { CalculationTraceStep } from "@yrese/trace";

import {
  assertNonEmptyString,
  assertPositiveSafeInteger,
  blockerStep,
  createBlockedResult,
  createDuplicateBlocker,
  createEffectiveFromBlocker,
  createEffectiveToBlocker,
  createExclusivityBlocker,
  createInvalidEffectiveRangeBlocker,
  createInvalidStepResultBlocker,
  createMaxApplicationsBlocker,
  createMaxApplicationsMismatchBlocker,
  createPointsOnlyCopayBlockedResult,
  duplicateBlockedStep,
  effectiveFromBlockedStep,
  effectiveToBlockedStep,
  exclusivityBlockedStep,
  invalidEffectiveRangeStep,
  invalidStepResultStep,
  maxApplicationsBlockedStep,
  maxApplicationsMismatchStep,
  regulatoryReviewBlocker,
  ruleStep,
  validateStepResult,
} from "./engine.js";
import {
  invalidStepResultWarning,
  type CalculationBlocker,
  type CalculationRequest,
  type CalculationResult,
  type CalculationRuleSet,
} from "./types.js";

export * from "./types.js";
export * from "./rules.js";
export * from "./formulas.js";

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
  // 非対称排他(blocksGroupIdPrefixes)が宣言した接頭辞。後続項目の groupId が
  // これに前方一致すれば拒否し、宣言項目の接頭辞が既出 groupId に前方一致しても拒否する
  // (順序非依存)。
  const seenExclusivityGroupPrefixes: string[] = [];
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

  const dispensingCalendarDate = request.dispensing.dispensingDate.toCalendarDate();

  for (const rule of ruleSet.rules) {

    // 適用期間の宣言不正(終了日が開始日より前)はルール定義エラーとして即時停止
    if (rule.effectiveTo !== undefined && rule.effectiveTo.compare(rule.effectiveFrom) < 0) {
      const blocker = createInvalidEffectiveRangeBlocker(rule, rule.effectiveTo);
      pushWarnings([invalidStepResultWarning]);
      return createBlockedResult(
        request,
        [...blockers, blocker],
        [...steps, invalidEffectiveRangeStep(rule)],
        warnings,
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
      pushWarnings([invalidStepResultWarning]);
      return createBlockedResult(
        request,
        [...blockers, blocker],
        [...steps, invalidStepResultStep(rule, resultValidation.reason)],
        warnings,
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
      steps.push(duplicateBlockedStep(rule, result.applicationKey));
      continue;
    }
    seenApplications.add(applicationIdentity);

    // maxApplications 宣言の一貫性(同一 ruleId 内で宣言値が食い違えば定義エラーとして即時停止)
    if (declaredMaxApplicationsByRuleId.has(rule.ruleId)) {
      const declared = declaredMaxApplicationsByRuleId.get(rule.ruleId);
      if (declared !== result.maxApplications) {
        const blocker = createMaxApplicationsMismatchBlocker(rule.ruleId, declared, result.maxApplications);
        pushWarnings([invalidStepResultWarning]);
        return createBlockedResult(
          request,
          [...blockers, blocker],
          [...steps, maxApplicationsMismatchStep(rule)],
          warnings,
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
        steps.push(maxApplicationsBlockedStep(rule, result.maxApplications));
        continue;
      }
    }

    if (result.exclusivityGroup !== undefined) {
      const { groupId, blocksGroupIdPrefixes } = result.exclusivityGroup;
      assertNonEmptyString(groupId, "exclusivityGroup.groupId");
      const blockedBySeenPrefix = seenExclusivityGroupPrefixes.find((prefix) => groupId.startsWith(prefix));
      const blocksSeenGroup = (blocksGroupIdPrefixes ?? []).find((prefix) => {
        for (const seen of seenExclusivityGroups) {
          if (seen.startsWith(prefix)) return true;
        }
        return false;
      });
      if (seenExclusivityGroups.has(groupId) || blockedBySeenPrefix !== undefined || blocksSeenGroup !== undefined) {
        blockers.push(createExclusivityBlocker(groupId));
        steps.push(exclusivityBlockedStep(rule, groupId));
        continue;
      }
      seenExclusivityGroups.add(groupId);
      for (const prefix of blocksGroupIdPrefixes ?? []) {
        seenExclusivityGroupPrefixes.push(prefix);
      }
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
