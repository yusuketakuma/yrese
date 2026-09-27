import {
  patientId,
  receptionId,
  tenantId,
  pharmacyId,
  type PatientId,
  type PharmacyId,
  type ReceptionId,
  type TenantId,
} from '@yrese/shared-kernel';
import type { PatientSearchResult, ReceptionStatus } from '@yrese/contracts';
import type { OwnDataPropertyRead } from '../own-data-property.js';


export interface ReceptionRecord {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  readonly patientId: PatientId;
  readonly patient: PatientSearchResult;
  readonly acceptedAt: string;
  readonly date: string;
  readonly receptionStatus: ReceptionStatus;
  readonly version: number;
  readonly statusChangedAt: string;
  readonly cancelReason?: string;
  readonly idempotencyKey?: string;
  /**
   * 現在紐づく資格 snapshot(API-019)。未確認は null。
   * eligibility リポジトリ内部境界(linkEligibilitySnapshot)経由でのみ更新する。
   */
  readonly eligibilitySnapshotId: string | null;
}
export const inMemoryReceptionIdempotencyInvariantErrorMessage =
  'In-memory reception idempotency index is inconsistent';

const syntheticPatientA = {
  patientId: patientId('patient-syn-001'),
  name: '合成患者A',
  kana: 'ゴウセイカンジャエー',
  birthDate: '1980-01-01',
  sex: 'female',
  patientNumber: 'SYN-001',
  eligibilityStatus: 'VERIFIED',
  eligibilityCheckedAt: '2026-07-09T08:16:15.000Z',
} as const satisfies PatientSearchResult;

const syntheticPatientB = {
  patientId: patientId('patient-syn-002'),
  name: '合成患者B',
  kana: 'ゴウセイカンジャビー',
  birthDate: '1975-02-02',
  sex: 'male',
  patientNumber: 'SYN-002',
  eligibilityStatus: 'PENDING_REVERIFY',
  eligibilityCheckedAt: '2026-07-08T08:16:15.000Z',
} as const satisfies PatientSearchResult;

const syntheticPatientC = {
  patientId: patientId('patient-syn-003'),
  name: '合成患者C',
  kana: 'ゴウセイカンジャシー',
  birthDate: '1990-03-03',
  sex: 'unknown',
  patientNumber: 'SYN-003',
  eligibilityStatus: 'LOCAL_ONLY_UNVERIFIED',
} as const satisfies PatientSearchResult;

export const syntheticReceptionRecords = [
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    receptionId: receptionId('reception-syn-002'),
    patientId: syntheticPatientB.patientId,
    patient: syntheticPatientB,
    acceptedAt: '2026-07-09T08:30:00.000Z',
    date: '2026-07-09',
    receptionStatus: 'WAITING',
    version: 1,
    statusChangedAt: '2026-07-09T08:30:00.000Z',
    eligibilitySnapshotId: null,
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    receptionId: receptionId('reception-syn-001'),
    patientId: syntheticPatientA.patientId,
    patient: syntheticPatientA,
    acceptedAt: '2026-07-09T08:30:00.000Z',
    date: '2026-07-09',
    receptionStatus: 'IN_PROGRESS',
    version: 2,
    statusChangedAt: '2026-07-09T08:35:00.000Z',
    eligibilitySnapshotId: null,
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    receptionId: receptionId('reception-syn-003'),
    patientId: syntheticPatientC.patientId,
    patient: syntheticPatientC,
    acceptedAt: '2026-07-09T08:45:00.000Z',
    date: '2026-07-09',
    receptionStatus: 'COMPLETED',
    version: 2,
    statusChangedAt: '2026-07-09T09:00:00.000Z',
    eligibilitySnapshotId: null,
  },
] as const satisfies readonly ReceptionRecord[];


export const inMemoryReceptionTimestampInvariantErrorMessage =
  'in-memory reception acceptedAt must be a valid Date';
export const inMemoryReceptionCommandSnapshotInvariantErrorMessage =
  'In-memory reception command snapshot is invalid';
export const inMemoryReceptionPatientSnapshotInvariantErrorMessage =
  'In-memory reception patient snapshot is invalid';
export const receptionListCommandSnapshotInvariantErrorMessage =
  'Reception list command snapshot is invalid';
export const receptionTransitionCommandSnapshotInvariantErrorMessage =
  'Reception transition command snapshot is invalid';
export const receptionTransitionUndoInvariantErrorMessage =
  'Reception transition rollback provenance is inconsistent';

export function readReceptionScopeString(
  result: OwnDataPropertyRead,
  invariantErrorMessage: string,
): string {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(invariantErrorMessage);
  }
  return result.value;
}
