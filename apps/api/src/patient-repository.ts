import type { PatientSearchResult } from '@yrese/contracts';
import { patientSearchResultSchema } from '@yrese/contracts';
import {
  patientId,
  pharmacyId,
  type PatientId,
  tenantId,
  type PharmacyId,
  type TenantId,
} from '@yrese/shared-kernel';

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
}

export interface PatientLookupInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patientId: PatientId;
}

interface SyntheticPatientRecord extends PatientSearchResult {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
}

const syntheticPatients = [
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    patientId: patientId('patient-syn-001'),
    name: '合成患者A',
    kana: 'ゴウセイカンジャエー',
    birthDate: '1980-01-01',
    sex: 'female',
    patientNumber: 'SYN-001',
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
    eligibilityStatus: 'NOT_CHECKED',
  },
] as const satisfies readonly SyntheticPatientRecord[];

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

function toSearchResult(record: SyntheticPatientRecord): PatientSearchResult {
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

function comparePatientSearchOrder(
  left: SyntheticPatientRecord,
  right: SyntheticPatientRecord,
): number {
  if (left.patientNumber < right.patientNumber) return -1;
  if (left.patientNumber > right.patientNumber) return 1;
  if (left.patientId < right.patientId) return -1;
  if (left.patientId > right.patientId) return 1;
  return 0;
}

export class InMemoryPatientRepository implements PatientRepository {
  constructor(private readonly records: readonly SyntheticPatientRecord[] = syntheticPatients) {}

  async findById(input: PatientLookupInput): Promise<PatientSearchResult | undefined> {
    const record = this.records.find(
      (candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.pharmacyId === input.pharmacyId &&
        candidate.patientId === input.patientId,
    );

    return record === undefined ? undefined : toSearchResult(record);
  }

  async search(input: PatientSearchInput): Promise<PatientSearchPage> {
    const normalizedQuery = normalizeSearchText(input.q);
    const offset = input.cursor?.offset ?? 0;
    const matches = this.records
      .filter((record) => record.tenantId === input.tenantId && record.pharmacyId === input.pharmacyId)
      .filter((record) =>
        [record.name, record.kana, record.patientNumber].some((value) =>
          normalizeSearchText(value).includes(normalizedQuery),
        ),
      )
      .sort(comparePatientSearchOrder);
    const results = matches.slice(offset, offset + input.limit).map(toSearchResult);
    const nextOffset = offset + input.limit;

    return {
      results,
      ...(nextOffset < matches.length ? { nextCursor: { offset: nextOffset } } : {}),
    };
  }
}
