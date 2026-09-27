import { describe, expect, it } from "vitest";

import {
  patientId,
  pharmacyId,
  prescriptionId,
  prescriptionInquiryId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";

import { InMemoryActorQualificationRepository } from '../actor-qualification-repository.js';
import { InMemoryAuditRepository } from '../audit/audit-repository.js';
import type { PrescriptionDraftContent } from "@yrese/contracts";
import { InMemoryMasterRepository } from '../master/master-repository.js';

import {
  InMemoryPrescriptionDraftService,
  InMemoryPrescriptionFinalizedOutbox,
  type PrescriptionDraftFromPriorInput,
  type PrescriptionDraftSaveInput,
  type PrescriptionLifecycleCommandInput,
} from './prescription-draft-service.js';
import { InMemoryReceptionRepository } from '../reception/reception-repository.js';


export const scope = {
  tenantId: tenantId("tenant-001"),
  pharmacyId: pharmacyId("pharmacy-001"),
  actorId: userId("actor-test-001"),
  receptionId: receptionId("reception-syn-001"),
  businessDate: "2026-07-09",
  wallClock: "2026-08-25T00:00:09.000Z",
} as const;

export const RESOLVED_UUID_A = "00000000-0000-4000-8000-0000000000a1";
export const RESOLVED_UUID_B = "00000000-0000-4000-8000-0000000000b1";
export const RESOLVED_UUID_C = "00000000-0000-4000-8000-0000000000c1";
export const RESOLVED_UUID_D = "00000000-0000-4000-8000-0000000000d1";

export function confirmableDraft(): PrescriptionDraftContent {
  return {
    prescriptionType: "OUTPATIENT" as const,
    sourceMetadata: {
      medicalInstitution: { code: "1234567", name: "合成病院" },
      prescriberName: "合成 医師",
      issueDate: "2026-08-20",
      validUntil: "2026-08-24",
      refill: null,
      splitDispensing: null,
    },
    rpGroups: [
      {
        rpGroupId: RESOLVED_UUID_A,
        sequence: 1,
        dosageForm: "ORAL" as const,
        usage: { kind: "unresolved" as const, text: "1日1回 朝食後" },
        daysOrCount: 7,
        items: [
          {
            rpItemId: RESOLVED_UUID_B,
            sequence: 1,
            medication: {
              kind: "resolved" as const,
              masterVersionId: RESOLVED_UUID_C,
              medicationItemId: RESOLVED_UUID_D,
            },
            doseOnce: null,
            dosePerDay: null,
            doseTotal: "7錠",
            unit: null,
            genericNamePrescription: false,
            genericSubstitutionPermitted: null,
          },
        ],
      },
    ],
    prescriptionDate: "2026-07-09",
    defaultDays: 7,
    flags: [],
    note: "",
    rows: [],
  };
}

export function saveInput(
  draft: ReturnType<typeof confirmableDraft>,
): PrescriptionDraftSaveInput {
  return {
    ...scope,
    patientId: patientId("patient-syn-001"),
    expectedVersion: 0,
    draft,
  };
}

export function command(
  prescription: string,
  idempotencyKey: string,
): PrescriptionLifecycleCommandInput {
  return {
    tenantId: scope.tenantId,
    pharmacyId: scope.pharmacyId,
    actorId: scope.actorId,
    prescriptionId: prescriptionId(prescription),
    idempotencyKey,
    wallClock: scope.wallClock,
  };
}

export function harness(options?: { readonly qualified?: boolean }) {
  const audit = new InMemoryAuditRepository();
  const qualification = new InMemoryActorQualificationRepository();
  const outbox = new InMemoryPrescriptionFinalizedOutbox();
  if (options?.qualified !== false) {
    qualification.grant({
      tenantId: scope.tenantId,
      pharmacyId: scope.pharmacyId,
      actorId: scope.actorId,
      kind: "PHARMACIST_LICENSE",
    });
  }
  const service = new InMemoryPrescriptionDraftService(
    new InMemoryReceptionRepository(),
    audit,
    () => prescriptionId("prescription-lifecycle-001"),
    {
      qualificationRepository: qualification,
      finalizedOutbox: outbox,
      nextOutboxEventId: () => "00000000-0000-4000-8000-0000000000e1",
    },
  );
  return { audit, qualification, outbox, service };
}

