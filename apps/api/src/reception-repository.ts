import {
  receptionQueueEntrySchema,
  type PatientSearchResult,
  type ReceptionQueueEntry,
  type ReceptionStatus,
} from '@yrese/contracts';
import {
  patientId,
  pharmacyId,
  receptionId,
  tenantId,
  type PatientId,
  type PharmacyId,
  type ReceptionId,
  type TenantId,
} from '@yrese/shared-kernel';

export interface ReceptionListInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly date: string;
}

export interface ReceptionCreateInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly patient: PatientSearchResult;
  readonly idempotencyKey: string;
  readonly acceptedAt: Date;
}

export type ReceptionCreateResult =
  | {
      readonly kind: 'created' | 'existing';
      readonly entry: ReceptionQueueEntry;
    }
  | {
      readonly kind: 'idempotency_conflict';
    };

export interface ReceptionRepository {
  list(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]>;
  create(input: ReceptionCreateInput): Promise<ReceptionCreateResult>;
}

interface ReceptionRecord {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  readonly patientId: PatientId;
  readonly patient: PatientSearchResult;
  readonly acceptedAt: string;
  readonly date: string;
  readonly receptionStatus: ReceptionStatus;
  readonly idempotencyKey?: string;
}

interface IdempotencyRecord {
  readonly patientId: PatientId;
  readonly receptionId: ReceptionId;
}

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

const syntheticReceptionRecords = [
  {
    tenantId: tenantId('tenant-001'),
    pharmacyId: pharmacyId('pharmacy-001'),
    receptionId: receptionId('reception-syn-002'),
    patientId: syntheticPatientB.patientId,
    patient: syntheticPatientB,
    acceptedAt: '2026-07-09T08:30:00.000Z',
    date: '2026-07-09',
    receptionStatus: 'WAITING',
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
  },
] as const satisfies readonly ReceptionRecord[];

function toIdempotencyKey(input: {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly idempotencyKey: string;
}): string {
  return `${input.tenantId}\u001f${input.pharmacyId}\u001f${input.idempotencyKey}`;
}

function toEntry(record: ReceptionRecord): ReceptionQueueEntry {
  return receptionQueueEntrySchema.parse({
    receptionId: record.receptionId,
    patient: record.patient,
    acceptedAt: record.acceptedAt,
    receptionStatus: record.receptionStatus,
    prescriptionIntakeType: 'paper',
  });
}

function sortRecords(left: ReceptionRecord, right: ReceptionRecord): number {
  const acceptedAtOrder = left.acceptedAt.localeCompare(right.acceptedAt);
  if (acceptedAtOrder !== 0) {
    return acceptedAtOrder;
  }
  return left.receptionId.localeCompare(right.receptionId);
}

const JAPAN_BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function businessDateFromAcceptedAt(acceptedAt: Date): string {
  const parts = JAPAN_BUSINESS_DATE_FORMATTER.formatToParts(acceptedAt);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('failed to format acceptedAt as Asia/Tokyo business date');
  }
  return `${year}-${month}-${day}`;
}

export class InMemoryReceptionRepository implements ReceptionRepository {
  private nextSequence: number;
  private readonly records: ReceptionRecord[];
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  constructor(records: readonly ReceptionRecord[] = syntheticReceptionRecords) {
    this.records = [...records];
    this.nextSequence = records.length + 1;
  }

  async list(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]> {
    return this.records
      .filter(
        (record) =>
          record.tenantId === input.tenantId &&
          record.pharmacyId === input.pharmacyId &&
          record.date === input.date,
      )
      .sort(sortRecords)
      .map(toEntry);
  }

  async create(input: ReceptionCreateInput): Promise<ReceptionCreateResult> {
    const inputPatientId = patientId(input.patient.patientId);
    const idempotencyKey = toIdempotencyKey(input);
    const existing = this.idempotencyRecords.get(idempotencyKey);
    if (existing !== undefined) {
      if (existing.patientId !== inputPatientId) {
        return { kind: 'idempotency_conflict' };
      }

      const existingRecord = this.records.find(
        (record) =>
          record.tenantId === input.tenantId &&
          record.pharmacyId === input.pharmacyId &&
          record.receptionId === existing.receptionId,
      );
      if (existingRecord !== undefined) {
        return {
          kind: 'existing',
          entry: toEntry(existingRecord),
        };
      }
    }

    const acceptedAt = input.acceptedAt.toISOString();
    const record: ReceptionRecord = {
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      receptionId: receptionId(`reception-${String(this.nextSequence).padStart(6, '0')}`),
      patientId: inputPatientId,
      patient: input.patient,
      acceptedAt,
      date: businessDateFromAcceptedAt(input.acceptedAt),
      receptionStatus: 'WAITING',
      idempotencyKey: input.idempotencyKey,
    };
    this.nextSequence += 1;
    this.records.push(record);
    this.idempotencyRecords.set(idempotencyKey, {
      patientId: inputPatientId,
      receptionId: record.receptionId,
    });

    return {
      kind: 'created',
      entry: toEntry(record),
    };
  }
}
