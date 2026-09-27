import { evidenceId } from "@yrese/shared-kernel";
import { CalendarDate } from "@yrese/date-time";
import { Points, type ScaledDecimal } from "@yrese/money";
import type { EvidenceRef } from "@yrese/trace";

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
import {
  assertNonEmptyString,
  assertPositiveSafeInteger,
  calculationEvidenceRef,
  freezeArray,
  ruleEffectiveFrom,
} from "./engine.js";
import type {
  CalculationExclusivityGroup,
  CalculationRule,
  StepResult,
} from "./types.js";


function createFixedPointsRule(input: {
  readonly ruleId: string;
  readonly evidenceRef: EvidenceRef;
  readonly itemPoints: Points;
  readonly applicationKey: string;
  readonly description: string;
  readonly output: string;
  readonly maxApplications?: number;
  readonly effectiveTo?: CalendarDate;
  readonly exclusivityGroup?: CalculationExclusivityGroup;
}): CalculationRule {
  const {
    ruleId,
    evidenceRef,
    itemPoints,
    applicationKey,
    description,
    output,
    maxApplications,
    effectiveTo,
    exclusivityGroup,
  } = input;
  assertNonEmptyString(applicationKey, "applicationKey");
  if (maxApplications !== undefined) {
    assertPositiveSafeInteger(maxApplications, "maxApplications");
  }
  const frozenExclusivityGroup =
    exclusivityGroup === undefined
      ? undefined
      : Object.freeze({
          groupId: exclusivityGroup.groupId,
          evidenceRef: exclusivityGroup.evidenceRef,
          ...(exclusivityGroup.blocksGroupIdPrefixes !== undefined
            ? { blocksGroupIdPrefixes: freezeArray(exclusivityGroup.blocksGroupIdPrefixes) }
            : {}),
        });

  return Object.freeze({
    ruleId,
    evidenceRefs: freezeArray([evidenceRef]),
    effectiveFrom: ruleEffectiveFrom,
    ...(effectiveTo !== undefined ? { effectiveTo } : {}),
    apply: () =>
      Object.freeze({
        status: "ITEM_CALCULATED",
        description,
        affectsClaim: true,
        inputRefs: [],
        output,
        itemPoints,
        applicationKey,
        ...(maxApplications !== undefined ? { maxApplications } : {}),
        ...(frozenExclusivityGroup !== undefined ? { exclusivityGroup: frozenExclusivityGroup } : {}),
      }),
  });
}


export {
  dispensingBasicFee1Rule,
  createOralMedicinePreparationFeeRule,
  dispensingManagementFee2Rule,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
} from './rules-shared.js';
export * from './rules-preparation.js';
export * from './rules-basic-fee.js';
export * from './rules-additions.js';
export * from './rules-management.js';
export * from './rules-home.js';
export * from './rules-misc.js';
