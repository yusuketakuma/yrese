import { isProxy } from 'node:util/types';

import {
  receptionQueueEntrySchema,
  patientSearchResultSchema,
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

import { snapshotDateInstant } from './instant.js';

export const inMemoryReceptionTimestampInvariantErrorMessage =
  'in-memory reception acceptedAt must be a valid Date';
export const inMemoryReceptionPatientSnapshotInvariantErrorMessage =
  'In-memory reception patient snapshot is invalid';

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

export interface ReceptionCreateProvenance {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly idempotencyKey: string;
  readonly receptionId: ReceptionId;
  readonly patientId: PatientId;
}

export type ReceptionCreateResult =
  | {
      readonly kind: 'created' | 'existing';
      readonly entry: ReceptionQueueEntry;
      readonly provenance: ReceptionCreateProvenance;
    }
  | {
      readonly kind: 'idempotency_conflict';
      readonly provenance: ReceptionCreateProvenance;
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
  readonly receptionId: ReceptionId;
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

function readInMemoryPatientOwnDataProperty(
  patient: unknown,
  property: keyof PatientSearchResult,
): { readonly present: boolean; readonly value?: unknown } {
  if (
    (typeof patient !== 'object' && typeof patient !== 'function') ||
    patient === null ||
    isProxy(patient)
  ) {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(patient, property);
  } catch {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
  if (descriptor === undefined) return { present: false };
  if (!('value' in descriptor)) {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
  return { present: true, value: descriptor.value };
}

function captureInMemoryPatientId(patient: unknown): PatientId {
  const property = readInMemoryPatientOwnDataProperty(patient, 'patientId');
  if (!property.present || typeof property.value !== 'string') {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
  try {
    return patientId(property.value);
  } catch {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
}

function snapshotInMemoryPatient(
  patient: unknown,
  capturedPatientId: PatientId,
): Readonly<PatientSearchResult> {
  const readRequired = (property: keyof PatientSearchResult): unknown => {
    const value = readInMemoryPatientOwnDataProperty(patient, property);
    if (!value.present) {
      throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
    }
    return value.value;
  };
  const eligibilityCheckedAt = readInMemoryPatientOwnDataProperty(
    patient,
    'eligibilityCheckedAt',
  );
  try {
    return Object.freeze(
      patientSearchResultSchema.parse({
        patientId: capturedPatientId,
        name: readRequired('name'),
        kana: readRequired('kana'),
        birthDate: readRequired('birthDate'),
        sex: readRequired('sex'),
        patientNumber: readRequired('patientNumber'),
        eligibilityStatus: readRequired('eligibilityStatus'),
        ...(eligibilityCheckedAt.present
          ? { eligibilityCheckedAt: eligibilityCheckedAt.value }
          : {}),
      }),
    );
  } catch {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
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

function toProvenance(record: ReceptionRecord): ReceptionCreateProvenance {
  if (record.idempotencyKey === undefined) {
    throw new Error(inMemoryReceptionIdempotencyInvariantErrorMessage);
  }
  return {
    tenantId: record.tenantId,
    pharmacyId: record.pharmacyId,
    idempotencyKey: record.idempotencyKey,
    receptionId: record.receptionId,
    patientId: record.patientId,
  };
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

  constructor() {
    this.records = [...syntheticReceptionRecords];
    this.nextSequence = syntheticReceptionRecords.length + 1;
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
    const inputPatientId = captureInMemoryPatientId(input.patient);
    const idempotencyKey = toIdempotencyKey(input);
    const existing = this.idempotencyRecords.get(idempotencyKey);
    if (existing !== undefined) {
      const existingRecord = this.records.find(
        (record) => record.receptionId === existing.receptionId,
      );
      if (
        existingRecord === undefined ||
        existingRecord.tenantId !== input.tenantId ||
        existingRecord.pharmacyId !== input.pharmacyId ||
        existingRecord.idempotencyKey !== input.idempotencyKey
      ) {
        throw new Error(inMemoryReceptionIdempotencyInvariantErrorMessage);
      }
      const provenance = toProvenance(existingRecord);
      if (existingRecord.patientId !== inputPatientId) {
        return { kind: 'idempotency_conflict', provenance };
      }
      return {
        kind: 'existing',
        entry: toEntry(existingRecord),
        provenance,
      };
    }

    const unindexedRecord = this.records.find(
      (record) =>
        record.tenantId === input.tenantId &&
        record.pharmacyId === input.pharmacyId &&
        record.idempotencyKey === input.idempotencyKey,
    );
    if (unindexedRecord !== undefined) {
      throw new Error(inMemoryReceptionIdempotencyInvariantErrorMessage);
    }

    const acceptedAt = snapshotDateInstant(
      input.acceptedAt,
      inMemoryReceptionTimestampInvariantErrorMessage,
    );
    const patientSnapshot = snapshotInMemoryPatient(input.patient, inputPatientId);
    const record: ReceptionRecord = {
      tenantId: input.tenantId,
      pharmacyId: input.pharmacyId,
      receptionId: receptionId(`reception-${String(this.nextSequence).padStart(6, '0')}`),
      patientId: inputPatientId,
      patient: patientSnapshot,
      acceptedAt,
      date: businessDateFromAcceptedAt(new Date(acceptedAt)),
      receptionStatus: 'WAITING',
      idempotencyKey: input.idempotencyKey,
    };
    this.nextSequence += 1;
    this.records.push(record);
    this.idempotencyRecords.set(idempotencyKey, {
      receptionId: record.receptionId,
    });

    return {
      kind: 'created',
      entry: toEntry(record),
      provenance: toProvenance(record),
    };
  }
}
