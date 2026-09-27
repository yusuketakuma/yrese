import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { patientId, pharmacyId, tenantId } from '@yrese/shared-kernel';

import {
  PostgresPatientRepository,
  databasePatientEligibilityTimestampInvariantErrorMessage,
  databasePatientRowInvariantErrorMessage,
  databasePatientRowSetInvariantErrorMessage,
  patientRowToSearchResult,
} from './patient-repository.js';
import {
  patientRepositoryCommandSnapshotInvariantErrorMessage,
  patientRepositoryPaginationInvariantErrorMessage,
} from '../../patient/patient-repository.js';
import { PostgresReceptionRepository } from '../reception/reception-repository.js';


export const scope = {
  tenantId: tenantId('tenant-patient-db-4215'),
  pharmacyId: pharmacyId('pharmacy-patient-db-4215'),
} as const;

export const patientRow = {
  patient_id: 'patient-db-4215',
  name: '合成DB患者',
  kana: 'ゴウセイディービーカンジャ',
  birth_date: '1980-01-01',
  sex: 'unknown',
  patient_number: 'DB-4215',
  eligibility_status: 'VERIFIED',
  eligibility_checked_at: null,
};

export type PatientCoreColumn =
  | 'patient_id'
  | 'name'
  | 'kana'
  | 'birth_date'
  | 'sex'
  | 'patient_number'
  | 'eligibility_status';

export const patientCoreColumns: readonly PatientCoreColumn[] = [
  'patient_id',
  'name',
  'kana',
  'birth_date',
  'sex',
  'patient_number',
  'eligibility_status',
];

export function rowWithEligibility(
  value: unknown,
): Parameters<typeof patientRowToSearchResult>[0] {
  return { ...patientRow, eligibility_checked_at: value } as unknown as Parameters<
    typeof patientRowToSearchResult
  >[0];
}

export const receptionInput = {
  ...scope,
  patient: {
    patientId: patientId(patientRow.patient_id),
    name: patientRow.name,
    kana: patientRow.kana,
    birthDate: patientRow.birth_date,
    sex: 'unknown' as const,
    patientNumber: patientRow.patient_number,
    eligibilityStatus: 'VERIFIED' as const,
  },
  idempotencyKey: 'patient-db-reception-4215',
  acceptedAt: new Date('2026-07-17T00:00:00.000Z'),
};

export function receptionRow(storedPatientId: string) {
  return {
    stored_tenant_id: scope.tenantId,
    stored_pharmacy_id: scope.pharmacyId,
    stored_idempotency_key: receptionInput.idempotencyKey,
    stored_patient_id: storedPatientId,
    reception_id: 'reception-patient-db-4215',
    accepted_at: receptionInput.acceptedAt,
    reception_status: 'WAITING',
    version: 1,
    business_date: '2026-07-17',
    ...patientRow,
    eligibility_checked_at: { toISOString: () => 'fake eligibility timestamp' },
  };
}
