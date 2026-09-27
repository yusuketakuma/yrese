import {
  patientSearchResultSchema,
  type PatientSearchResult,
  type PatientVersionedSummary,
} from '@yrese/contracts';
import {
  patientId,
  pharmacyId,
  tenantId,
  type PatientId,
  type PharmacyId,
  type TenantId,
  type UserId,
} from '@yrese/shared-kernel';

import { compareTextByCodePoints } from '../text-order.js';

export interface PatientSearchCursor {
  readonly offset: number;
}

export interface PatientSearchInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly q: string;
  readonly limit: number;
  readonly cursor?: PatientSearchCursor;
}

export interface PatientSearchPage {
  readonly results: readonly PatientSearchResult[];
  readonly nextCursor?: PatientSearchCursor;
}

export interface PatientRepository {
  search(input: PatientSearchInput): Promise<PatientSearchPage>;
  findById(input: PatientLookupInput): Promise<PatientSearchResult | undefined>;
  /**
   * WP-7202: GET 詳細・write 応答用の version 付き患者要約。
   * 検索結果と同一射影 + version( PUT の CAS 入力を取得する唯一の読取り経路)。
   */
  findVersionedById(
    input: PatientLookupInput,
  ): Promise<PatientVersionedSummary | undefined>;
  create(input: PatientCreateInput): Promise<PatientCreateResult>;
  update(input: PatientUpdateInput): Promise<PatientUpdateResult>;
}

export interface PatientLookupInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
}

/** WP-7202: POST /patients の書込み属性(連絡先・備考は契約対象外)。 */
export interface PatientCreateAttributes {
  readonly name: string;
  readonly kana: string;
  readonly birthDate: string;
  readonly sex: 'male' | 'female' | 'unknown';
  readonly patientNumber?: string;
}

export interface PatientCreateInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  /** サーバー採番の patientId(クライアントは指定しない)。 */
  readonly patientId: PatientId;
  readonly attributes: PatientCreateAttributes;
  readonly idempotencyKey: string;
  /** 正規化 request の fingerprint(同一 key + 異なる payload の検出用)。 */
  readonly requestFingerprint: string;
  readonly actorId: UserId;
  /** ISO instant。created_at/updated_at と監査 wallClock の基準。 */
  readonly recordedAt: string;
}

export type PatientCreateResult =
  | {
      readonly kind: 'created';
      readonly patient: PatientVersionedSummary;
      /** 同姓同名または同生年月日の既存患者(最大 PATIENT_DUPLICATE_WARNING_MAX_CANDIDATES 件)。 */
      readonly duplicateCandidates: readonly PatientSearchResult[];
      /** 補償識別子(in-memory の巻き戻し用。Postgres は tx で巻き戻すため使わない)。 */
      readonly undo: unknown;
    }
  | {
      readonly kind: 'existing';
      readonly patient: PatientVersionedSummary;
    }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'patient_number_conflict' };

export interface PatientUpdateAttributes {
  readonly name?: string;
  readonly kana?: string;
  readonly birthDate?: string;
  readonly sex?: 'male' | 'female' | 'unknown';
}

export interface PatientUpdateInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
  readonly expectedVersion: number;
  readonly attributes: PatientUpdateAttributes;
  readonly actorId: UserId;
  readonly recordedAt: string;
}

export type PatientUpdateResult =
  | {
      readonly kind: 'updated';
      readonly patient: PatientVersionedSummary;
      readonly undo: unknown;
    }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'version_conflict'; readonly currentVersion: number };

/** サーバー採番の patientNumber 形式(P-<scope内連番6桁>)。 */
export const AUTO_PATIENT_NUMBER_PREFIX = 'P-';
export const AUTO_PATIENT_NUMBER_WIDTH = 6;
export const PATIENT_DUPLICATE_CANDIDATE_LIMIT = 5;

export interface SyntheticPatientRecord extends PatientSearchResult {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly version: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

export const syntheticPatients = [
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-001'),
    name: '合成患者A',
    kana: 'ゴウセイカンジャエー',
    birthDate: '1980-01-01',
    sex: 'female',
    patientNumber: 'SYN-001',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-09T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-002'),
    name: '合成患者B',
    kana: 'ゴウセイカンジャビー',
    birthDate: '1975-02-02',
    sex: 'male',
    patientNumber: 'SYN-002',
    version: 1,
    eligibilityStatus: 'PENDING_REVERIFY',
    eligibilityCheckedAt: '2026-07-08T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-003'),
    name: '合成患者C',
    kana: 'ゴウセイカンジャシー',
    birthDate: '1990-03-03',
    sex: 'unknown',
    patientNumber: 'SYN-003',
    version: 1,
    eligibilityStatus: 'LOCAL_ONLY_UNVERIFIED',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-004'),
    name: '合成患者D',
    kana: 'ゴウセイカンジャディー',
    birthDate: '1965-04-04',
    sex: 'female',
    patientNumber: 'SYN-004',
    version: 1,
    eligibilityStatus: 'NOT_CHECKED',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-005'),
    name: '合成患者E',
    kana: 'ゴウセイカンジャイー',
    birthDate: '2001-05-05',
    sex: 'male',
    patientNumber: 'SYN-005',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-07T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-006'),
    name: '合成患者F',
    kana: 'ゴウセイカンジャエフ',
    birthDate: '1988-06-06',
    sex: 'female',
    patientNumber: 'SYN-006',
    version: 1,
    eligibilityStatus: 'PENDING_REVERIFY',
    eligibilityCheckedAt: '2026-07-06T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-007'),
    name: '合成患者G',
    kana: 'ゴウセイカンジャジー',
    birthDate: '1970-07-07',
    sex: 'unknown',
    patientNumber: 'SYN-007',
    version: 1,
    eligibilityStatus: 'NOT_CHECKED',
  },
  {
    tenantId: tenantId('t-dev'),
    pharmacyId: pharmacyId('ph-dev'),
    patientId: patientId('patient-dev-001'),
    name: '合成開発患者A',
    kana: 'ゴウセイカイハツカンジャエー',
    birthDate: '1981-11-11',
    sex: 'female',
    patientNumber: 'DEV-001',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-09T08:16:15.000Z',
  },
  {
    tenantId: tenantId('t-dev'),
    pharmacyId: pharmacyId('ph-dev'),
    patientId: patientId('patient-dev-002'),
    name: '合成開発患者B',
    kana: 'ゴウセイカイハツカンジャビー',
    birthDate: '1992-12-12',
    sex: 'male',
    patientNumber: 'DEV-002',
    version: 1,
    eligibilityStatus: 'PENDING_REVERIFY',
    eligibilityCheckedAt: '2026-07-08T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-002'),
    patientId: patientId('patient-syn-008'),
    name: '合成別薬局H',
    kana: 'ゴウセイベツヤッキョクエイチ',
    birthDate: '1982-08-08',
    sex: 'male',
    patientNumber: 'SYN-008',
    version: 1,
    eligibilityStatus: 'VERIFIED',
    eligibilityCheckedAt: '2026-07-05T08:16:15.000Z',
  },
  {
    tenantId: tenantId('tenant-002'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-009'),
    name: '合成別店I',
    kana: 'ゴウセイベツテンアイ',
    birthDate: '1995-09-09',
    sex: 'female',
    patientNumber: 'SYN-009',
    version: 1,
    eligibilityStatus: 'LOCAL_ONLY_UNVERIFIED',
  },
  {
    tenantId: tenantId('tenant-002'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-010'),
    name: '合成別店J',
    kana: 'ゴウセイベツテンジェイ',
    birthDate: '1977-10-10',
    sex: 'male',
    patientNumber: 'SYN-010',
    version: 1,
    eligibilityStatus: 'NOT_CHECKED',
  },
] as const satisfies readonly SyntheticPatientRecord[];

export function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

export function toSearchResult(record: SyntheticPatientRecord): PatientSearchResult {
  return patientSearchResultSchema.parse({
    patientId: record.patientId,
    name: record.name,
    kana: record.kana,
    birthDate: record.birthDate,
    sex: record.sex,
    patientNumber: record.patientNumber,
    eligibilityStatus: record.eligibilityStatus,
    ...(record.eligibilityCheckedAt === undefined ? {} : { eligibilityCheckedAt: record.eligibilityCheckedAt }),
  });
}

export function toVersionedSummary(record: SyntheticPatientRecord): PatientVersionedSummary {
  return { ...toSearchResult(record), version: record.version };
}

export function comparePatientSearchOrder(
  left: SyntheticPatientRecord,
  right: SyntheticPatientRecord,
): number {
  const patientNumberOrder = compareTextByCodePoints(
    left.patientNumber,
    right.patientNumber,
  );
  if (patientNumberOrder !== 0) return patientNumberOrder;
  return compareTextByCodePoints(left.patientId, right.patientId);
}

