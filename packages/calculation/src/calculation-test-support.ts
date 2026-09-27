/**
 * 原本再照合まで暫定(CAL-004 §6)。
 * Golden expectations below are derived only from CAL-003 evidence values.
 */
import { describe, expect, it } from "vitest";
import { CalendarDate, ClaimMonth, DispensingDate, PrescriptionDate, ReceptionDate } from "@yrese/date-time";
import { Points, ScaledDecimal } from "@yrese/money";
import { evidenceId } from "@yrese/shared-kernel";
import {
  dispensingId,
  patientId,
  pharmacyId,
  prescriptionId,
  tenantId,
  type BlockerType,
} from "@yrese/shared-kernel";
import type { EvidenceRef } from "@yrese/trace";

import {
  basicFeeCompositionOrderWarning,
  calculate,
  calculationRulesV20260601,
  createDecoctionPreparationFeeRule,
  createDispensingBasicFeeRule,
  createDrugFeeRule,
  createExternalPreparationFeeRule,
  createNarcoticPreparationAdditionRule,
  createOnePackagingSupportFeeRule,
  createOralDropPreparationFeeRule,
  createOralMedicinePreparationFeeRule,
  createPsychotropicEtcPreparationAdditionRule,
  createSelfPreparationAdditionRule,
  createSenzenPreparationFeeRule,
  createWeighingMixingAdditionRule,
  DISPENSING_BASIC_FEE_BASES,
  dispensingBasicFee1Rule,
  dispensingManagementFee2Rule,
  drugFeeProvisionalRoundingWarning,
  injectionPreparationFeeRule,
  invalidStepResultWarning,
  medicationManagementGuidanceFee3Rule,
  nightHolidayAdditionRule,
  requirementsNotVerifiedWarning,
  tonpukuPreparationFeeRule,
  type BlockedCalculationResult,
  type CalculationRequest,
  type CalculationResult,
  type CalculationRule,
  type CalculationRuleSet,
  type PointsOnlyCopayBlockedCalculationResult,
} from "./index.js";
import {
  adverseEventPreventionSamdWarning,
  biosimilarDispensingSystemAdditionRule,
  cooperationEnhancementAdditionRule,
  createAdverseEventPreventionAdditionRule,
  createDispensingManagementFee1IRule,
  createDispensingManagementFee1RoRule,
  createHomePatientEmergencyJointGuidanceRule,
  createInHomePharmacyComprehensiveSystemAddition2Rule,
  createMedicationInfoProvisionFeeRule,
  createMedicationManagementGuidanceFee4Rule,
  createMultiDrugReductionRule,
  createRegionalSupportSystemAdditionRule,
  createResidualDrugAdjustmentAdditionRule,
  createSpecificDrugManagementGuidanceAddition1Rule,
  createSpecificDrugManagementGuidanceAddition3Rule,
  createSpecificMedicalMaterialFeeRule,
  createTimeSurchargeAdditionRule,
  dischargeJointGuidanceFeeRule,
  dispensingBaseUpEvaluationFeeRule,
  dispensingPriceResponseFeeRule,
  electronicDispensingInfoCooperationAdditionRule,
  facilityCooperationAdditionRule,
  familyPharmacistFollowUpAdditionRule,
  familyPharmacistVisitAdditionRule,
  inHomePharmacyComprehensiveSystemAddition1Rule,
  inHomeTransitionInitialManagementFeeRule,
  infantMedicationGuidanceAdditionRule,
  inhalationDrugGuidanceAdditionRule,
  materialFeeProvisionalWarning,
  medicationAdjustmentSupportFee1Rule,
  medicationManagementGuidanceFee1Rule,
  medicationManagementGuidanceFee2Rule,
  medicationManagementGuidanceSpecialCaseRule,
  multiPharmacistManagementVisitFeeRule,
  narcoticManagementGuidanceAdditionRule,
  outpatientMedicationSupportFee1Rule,
  pediatricSpecificAdditionRule,
  specificDrugManagementGuidanceAddition2Rule,
  timeSurchargeProvisionalWarning,
  tubeFeedingMedicationSupportFeeRule,
  visitPharmacistPhysicianJointGuidanceFeeRule,
} from "./index.js";


export function request(dispensingDate = "2026-07-02"): CalculationRequest {
  return {
    tenantId: tenantId("tenant-001"),
    pharmacyId: pharmacyId("pharmacy-001"),
    patient: {
      patientId: patientId("patient-001"),
    },
    insurance: {
      insuranceSnapshot: {
        id: "insurance-snapshot-001",
      },
      publicExpenses: [
        {
          id: "public-expense-001",
        },
      ],
    },
    prescription: {
      prescriptionId: prescriptionId("prescription-001"),
      prescriptionDate: PrescriptionDate.fromString("2026-07-01"),
    },
    dispensing: {
      dispensingId: dispensingId("dispensing-001"),
      dispensingDate: DispensingDate.fromString(dispensingDate),
    },
    receptionDate: ReceptionDate.fromString("2026-07-03"),
    claimMonth: ClaimMonth.fromString("2026-07"),
    masterVersion: "master-CAL-003",
    calculationRuleVersion: "CAL-004-v0.2.1",
  };
}

export function evidenceRef(id: string): EvidenceRef {
  return {
    evidenceId: evidenceId(id),
    sourceType: "notification",
    title: "調剤報酬点数表(令和8年告示第69号)別表第三",
    version: "R8",
  };
}

export function expectBlocked(result: CalculationResult): BlockedCalculationResult {
  expect(result.status).toBe("BLOCKED");
  if (result.status === "BLOCKED") {
    return result;
  }
  throw new Error("expected blocked result");
}

export function expectPointsOnly(
  result: CalculationResult,
  expectedPoints: string,
): PointsOnlyCopayBlockedCalculationResult {
  expect(result.status).toBe("POINTS_ONLY_COPAY_BLOCKED");
  if (result.status === "POINTS_ONLY_COPAY_BLOCKED") {
    expect(result.claimable).toBe(false);
    expect(result.total.toString()).toBe(expectedPoints);
    expect(result.warnings).toContain(requirementsNotVerifiedWarning);
    expect(result.blockers).toEqual([
      {
        type: "BLOCKED_REGULATORY_REVIEW" satisfies BlockerType,
        detail: "Patient copay calculation remains blocked because copay evidence has not been issued.",
      },
    ]);
    expect(result.trace.blockers).toEqual(["BLOCKED_REGULATORY_REVIEW"]);
    return result;
  }
  throw new Error("expected points-only result");
}

