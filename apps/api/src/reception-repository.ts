import {
  receptionQueueEntrySchema,
  receptionIdempotencyKeySchema,
  patientSearchResultSchema,
  type PatientSearchResult,
  type ReceptionQueueEntry,
  type ReceptionStatus,
} from '@yrese/contracts';
import { CalendarDate } from '@yrese/date-time';
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
import {
  createOwnDataPropertyReader,
  type OwnDataPropertyRead,
} from './own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from './repository-command.js';

export const inMemoryReceptionTimestampInvariantErrorMessage =
  'in-memory reception acceptedAt must be a valid Date';
export const inMemoryReceptionCommandSnapshotInvariantErrorMessage =
  'In-memory reception command snapshot is invalid';
export const inMemoryReceptionPatientSnapshotInvariantErrorMessage =
  'In-memory reception patient snapshot is invalid';
export const receptionListCommandSnapshotInvariantErrorMessage =
  'Reception list command snapshot is invalid';

export interface ReceptionListInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly date: string;
}

interface ReceptionListCommandSnapshot {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly date: string;
}

function snapshotReceptionListDate(result: OwnDataPropertyRead): string {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(receptionListCommandSnapshotInvariantErrorMessage);
  }
  try {
    return CalendarDate.fromString(result.value).toString();
  } catch {
    throw new Error(receptionListCommandSnapshotInvariantErrorMessage);
  }
}

export function snapshotReceptionListCommand(
  input: unknown,
): ReceptionListCommandSnapshot {
  const readProperty = createOwnDataPropertyReader(
    input,
    receptionListCommandSnapshotInvariantErrorMessage,
  );
  const commandTenantId = snapshotRepositoryTenantId(
    readProperty('tenantId'),
    receptionListCommandSnapshotInvariantErrorMessage,
  );
  const commandPharmacyId = snapshotRepositoryPharmacyId(
    readProperty('pharmacyId'),
    receptionListCommandSnapshotInvariantErrorMessage,
  );
  const date = snapshotReceptionListDate(readProperty('date'));
  return Object.freeze({
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    date,
  });
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

function readReceptionScopeString(
  result: OwnDataPropertyRead,
  invariantErrorMessage: string,
): string {
  if (!result.present || typeof result.value !== 'string') {
    throw new Error(invariantErrorMessage);
  }
  return result.value;
}

export function snapshotReceptionIdempotencyKey(
  result: OwnDataPropertyRead,
  invariantErrorMessage: string,
): string {
  const value = readReceptionScopeString(result, invariantErrorMessage);
  const parsed = receptionIdempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(invariantErrorMessage);
  }
  return parsed.data;
}

function readRequiredOwnDataProperty(
  readProperty: (property: PropertyKey) => OwnDataPropertyRead,
  property: keyof PatientSearchResult,
): unknown {
  const result = readProperty(property);
  if (!result.present) {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
  return result.value;
}

function captureInMemoryPatientId(
  readPatientProperty: (property: PropertyKey) => OwnDataPropertyRead,
): PatientId {
  const value = readRequiredOwnDataProperty(readPatientProperty, 'patientId');
  if (typeof value !== 'string') {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
  try {
    return patientId(value);
  } catch {
    throw new Error(inMemoryReceptionPatientSnapshotInvariantErrorMessage);
  }
}

function snapshotInMemoryPatient(
  readPatientProperty: (property: PropertyKey) => OwnDataPropertyRead,
  capturedPatientId: PatientId,
): Readonly<PatientSearchResult> {
  const readRequired = (property: keyof PatientSearchResult): unknown =>
    readRequiredOwnDataProperty(readPatientProperty, property);
  const eligibilityCheckedAt = readPatientProperty('eligibilityCheckedAt');
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

// MOD-011 defines MVP business dates as fixed JST. IANA Asia/Tokyo applies
// historical local-mean offsets to ancient years, so it is not authoritative here.
const japanStandardTimeOffsetMilliseconds = 9 * 60 * 60 * 1_000;

export function businessDateFromAcceptedAt(
  acceptedAt: unknown,
  invariantErrorMessage: string,
): string {
  try {
    const epochMilliseconds = Date.prototype.getTime.call(acceptedAt);
    if (!Number.isFinite(epochMilliseconds)) {
      throw new Error(invariantErrorMessage);
    }
    const jstWallClock = new Date(
      epochMilliseconds + japanStandardTimeOffsetMilliseconds,
    );
    const year = Date.prototype.getUTCFullYear.call(jstWallClock);
    const month = Date.prototype.getUTCMonth.call(jstWallClock) + 1;
    const day = Date.prototype.getUTCDate.call(jstWallClock);
    if (![year, month, day].every(Number.isSafeInteger)) {
      throw new Error(invariantErrorMessage);
    }
    return CalendarDate.fromParts({
      year,
      month,
      day,
    }).toString();
  } catch {
    throw new Error(invariantErrorMessage);
  }
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
    const command = snapshotReceptionListCommand(input);
    return this.records
      .filter(
        (record) =>
          record.tenantId === command.tenantId &&
          record.pharmacyId === command.pharmacyId &&
          record.date === command.date,
      )
      .sort(sortRecords)
      .map(toEntry);
  }

  async create(input: ReceptionCreateInput): Promise<ReceptionCreateResult> {
    const readCommandProperty = createOwnDataPropertyReader(
      input,
      inMemoryReceptionCommandSnapshotInvariantErrorMessage,
    );
    const patientProperty = readCommandProperty('patient');
    if (!patientProperty.present) {
      throw new Error(inMemoryReceptionCommandSnapshotInvariantErrorMessage);
    }
    const readPatientProperty = createOwnDataPropertyReader(
      patientProperty.value,
      inMemoryReceptionPatientSnapshotInvariantErrorMessage,
    );
    const inputPatientId = captureInMemoryPatientId(readPatientProperty);
    const tenantIdValue = snapshotRepositoryTenantId(
      readCommandProperty('tenantId'),
      inMemoryReceptionCommandSnapshotInvariantErrorMessage,
    );
    const pharmacyIdValue = snapshotRepositoryPharmacyId(
      readCommandProperty('pharmacyId'),
      inMemoryReceptionCommandSnapshotInvariantErrorMessage,
    );
    const idempotencyKeyValue = snapshotReceptionIdempotencyKey(
      readCommandProperty('idempotencyKey'),
      inMemoryReceptionCommandSnapshotInvariantErrorMessage,
    );
    const command = Object.freeze({
      tenantId: tenantIdValue,
      pharmacyId: pharmacyIdValue,
      idempotencyKey: idempotencyKeyValue,
    });
    const idempotencyKey = toIdempotencyKey(command);
    const existing = this.idempotencyRecords.get(idempotencyKey);
    if (existing !== undefined) {
      const existingRecord = this.records.find(
        (record) => record.receptionId === existing.receptionId,
      );
      if (
        existingRecord === undefined ||
        existingRecord.tenantId !== command.tenantId ||
        existingRecord.pharmacyId !== command.pharmacyId ||
        existingRecord.idempotencyKey !== command.idempotencyKey
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
        record.tenantId === command.tenantId &&
        record.pharmacyId === command.pharmacyId &&
        record.idempotencyKey === command.idempotencyKey,
    );
    if (unindexedRecord !== undefined) {
      throw new Error(inMemoryReceptionIdempotencyInvariantErrorMessage);
    }

    const acceptedAtProperty = readCommandProperty('acceptedAt');
    if (!acceptedAtProperty.present) {
      throw new Error(inMemoryReceptionCommandSnapshotInvariantErrorMessage);
    }
    const acceptedAt = snapshotDateInstant(
      acceptedAtProperty.value,
      inMemoryReceptionTimestampInvariantErrorMessage,
    );
    const patientSnapshot = snapshotInMemoryPatient(readPatientProperty, inputPatientId);
    const record: ReceptionRecord = {
      tenantId: command.tenantId,
      pharmacyId: command.pharmacyId,
      receptionId: receptionId(`reception-${String(this.nextSequence).padStart(6, '0')}`),
      patientId: inputPatientId,
      patient: patientSnapshot,
      acceptedAt,
      date: businessDateFromAcceptedAt(
        new Date(acceptedAt),
        inMemoryReceptionTimestampInvariantErrorMessage,
      ),
      receptionStatus: 'WAITING',
      idempotencyKey: command.idempotencyKey,
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
