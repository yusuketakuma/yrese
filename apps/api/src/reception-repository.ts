import {
  receptionQueueEntrySchema,
  receptionIdempotencyKeySchema,
  patientSearchResultSchema,
  RECEPTION_BUSINESS_REASON_CODE_PATTERN,
  RECEPTION_QUEUE_MAX_ENTRIES,
  type PatientSearchResult,
  type ReceptionQueueEntry,
  type ReceptionStatus,
  type ReceptionTransitionTarget,
} from '@yrese/contracts';
import { CalendarDate } from '@yrese/date-time';
import {
  isReceptionStatus,
  isReceptionTransitionAllowed,
  patientId,
  pharmacyId,
  receptionId,
  tenantId,
  type PatientId,
  type PharmacyId,
  type ReceptionId,
  type TenantId,
} from '@yrese/shared-kernel';

import {
  createInMemoryEligibilityStore,
  findLinkedSnapshot,
  toReceptionEligibility,
  type InMemoryEligibilityStore,
  type ReceptionEligibility,
} from './eligibility-snapshot-repository.js';
import { snapshotDateInstant } from './instant.js';
import {
  createOwnDataPropertyReader,
  type OwnDataPropertyRead,
} from './own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from './repository-command.js';
import { compareTextByCodePoints } from './text-order.js';

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

/**
 * WP-7201 / API-006 0.3.x: 受付状態遷移コマンド入力。
 * statusChangedAt はサーバ時計由来の単一 instant で、status_changed_at 列と
 * (in-memory 経路の)監査 wallClock に同値を使う。
 */
export interface ReceptionTransitionInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  readonly to: ReceptionTransitionTarget;
  readonly expectedVersion: number;
  /** CANCELLED のみ必須の構造化理由コード(MOD-008)。その他の遷移では拒否。 */
  readonly businessReason?: string;
  readonly statusChangedAt: Date;
}

/** transitioned 結果に添付する巻き戻し証跡(in-memory 補償専用)。 */
export interface ReceptionTransitionUndo {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  readonly postStatus: ReceptionStatus;
  readonly postVersion: number;
  readonly priorStatus: ReceptionStatus;
  readonly priorVersion: number;
  readonly priorStatusChangedAt: string;
  readonly priorCancelReason?: string;
}

export type ReceptionTransitionResult =
  | {
      readonly kind: 'transitioned';
      readonly receptionId: ReceptionId;
      readonly receptionStatus: ReceptionStatus;
      readonly version: number;
      readonly statusChangedAt: string;
      readonly undo: ReceptionTransitionUndo;
    }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'transition_not_allowed' | 'version_conflict';
      readonly currentStatus: ReceptionStatus;
      readonly currentVersion: number;
    };

export interface ReceptionRepository {
  list(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]>;
  create(input: ReceptionCreateInput): Promise<ReceptionCreateResult>;
  transition(input: ReceptionTransitionInput): Promise<ReceptionTransitionResult>;
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

function toEntry(
  record: ReceptionRecord,
  eligibilityStore: InMemoryEligibilityStore,
): ReceptionQueueEntry {
  // queue entry の資格表示は受付業務日付で導出した snapshot 状態(API-006 0.3.2)。
  // 患者要約の eligibilityStatus とは別概念であり、UI はこの値だけを表示する。
  const eligibility: ReceptionEligibility = toReceptionEligibility(
    findLinkedSnapshot(eligibilityStore, record.eligibilitySnapshotId),
    record.date,
  );
  return receptionQueueEntrySchema.parse({
    receptionId: record.receptionId,
    patient: record.patient,
    acceptedAt: record.acceptedAt,
    receptionStatus: record.receptionStatus,
    prescriptionIntakeType: 'paper',
    version: record.version,
    eligibility,
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
  const acceptedAtOrder = compareTextByCodePoints(
    left.acceptedAt,
    right.acceptedAt,
  );
  if (acceptedAtOrder !== 0) {
    return acceptedAtOrder;
  }
  return compareTextByCodePoints(left.receptionId, right.receptionId);
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

function snapshotReceptionTransitionTarget(value: unknown): ReceptionTransitionTarget {
  switch (value) {
    case 'IN_PROGRESS':
    case 'COMPLETED':
    case 'CANCELLED':
      return value;
    default:
      throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
}

function snapshotReceptionTransitionExpectedVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  return value;
}

export interface ReceptionTransitionCommandSnapshot {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly receptionId: ReceptionId;
  readonly to: ReceptionTransitionTarget;
  readonly expectedVersion: number;
  readonly businessReason?: string;
  readonly statusChangedAt: string;
}

/**
 * transition 入力の検証済みスナップショット(in-memory / Postgres で共用する
 * 規律: own-property 単一読取り、businessReason は CANCELLED でだけ必須の
 * 構造化コード — 監査層の MOD-008 規律と同じ形をここでも fail-closed で要求)。
 */
export function snapshotReceptionTransitionCommand(
  input: unknown,
): ReceptionTransitionCommandSnapshot {
  const readProperty = createOwnDataPropertyReader(
    input,
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  const commandTenantId = snapshotRepositoryTenantId(
    readProperty('tenantId'),
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  const commandPharmacyId = snapshotRepositoryPharmacyId(
    readProperty('pharmacyId'),
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  const receptionIdValue = readReceptionScopeString(
    readProperty('receptionId'),
    receptionTransitionCommandSnapshotInvariantErrorMessage,
  );
  let commandReceptionId: ReceptionId;
  try {
    commandReceptionId = receptionId(receptionIdValue);
  } catch {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  const toProperty = readProperty('to');
  const to = snapshotReceptionTransitionTarget(
    toProperty.present ? toProperty.value : undefined,
  );
  const expectedVersionProperty = readProperty('expectedVersion');
  const expectedVersion = snapshotReceptionTransitionExpectedVersion(
    expectedVersionProperty.present ? expectedVersionProperty.value : undefined,
  );
  const businessReasonProperty = readProperty('businessReason');
  let businessReason: string | undefined;
  if (businessReasonProperty.present && businessReasonProperty.value !== undefined) {
    const candidate = businessReasonProperty.value;
    if (
      typeof candidate !== 'string' ||
      !RECEPTION_BUSINESS_REASON_CODE_PATTERN.test(candidate)
    ) {
      throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
    }
    businessReason = candidate;
  }
  if (to === 'CANCELLED' && businessReason === undefined) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  if (to !== 'CANCELLED' && businessReason !== undefined) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  const statusChangedAtProperty = readProperty('statusChangedAt');
  if (!statusChangedAtProperty.present) {
    throw new Error(receptionTransitionCommandSnapshotInvariantErrorMessage);
  }
  const statusChangedAt = snapshotDateInstant(
    statusChangedAtProperty.value,
    inMemoryReceptionTimestampInvariantErrorMessage,
  );
  return Object.freeze({
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    receptionId: commandReceptionId,
    to,
    expectedVersion,
    ...(businessReason === undefined ? {} : { businessReason }),
    statusChangedAt,
  });
}

export class InMemoryReceptionRepository implements ReceptionRepository {
  private nextSequence: number;
  private readonly records: ReceptionRecord[];
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();
  /**
   * WP-7204: queue entry の資格導出が参照する共有 store。
   * buildServer が同じインスタンスを InMemoryEligibilitySnapshotRepository へ渡す。
   */
  readonly eligibilityStore: InMemoryEligibilityStore;

  constructor(eligibilityStore?: InMemoryEligibilityStore) {
    this.records = syntheticReceptionRecords.map((record) => ({ ...record }));
    this.nextSequence = syntheticReceptionRecords.length + 1;
    this.eligibilityStore = eligibilityStore ?? createInMemoryEligibilityStore();
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
      // C-021(選択肢 b): Postgres 側の LIMIT cap+1 と同じ bound を
      // in-memory にも適用し、route が `> RECEPTION_QUEUE_MAX_ENTRIES` を
      // 検出できるようにする(超過検出用に +1)。
      .slice(0, RECEPTION_QUEUE_MAX_ENTRIES + 1)
      .map((record) => toEntry(record, this.eligibilityStore));
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
        entry: toEntry(existingRecord, this.eligibilityStore),
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
      version: 1,
      statusChangedAt: acceptedAt,
      idempotencyKey: command.idempotencyKey,
      eligibilitySnapshotId: null,
    };
    this.nextSequence += 1;
    this.records.push(record);
    this.idempotencyRecords.set(idempotencyKey, {
      receptionId: record.receptionId,
    });

    return {
      kind: 'created',
      entry: toEntry(record, this.eligibilityStore),
      provenance: toProvenance(record),
    };
  }

  /**
   * WP-7204: in-memory eligibility リポジトリとの内部境界(API 面には出さない)。
   * 受付のスコープ内存在検査・患者紐づけ・現在の snapshot link を返す。
   */
  eligibilityLinkTarget(command: {
    readonly tenantId: TenantId;
    readonly pharmacyId: PharmacyId;
    readonly receptionId: ReceptionId;
  }): { readonly patientId: string; readonly snapshotId: string | null; readonly businessDate: string } | undefined {
    const record = this.records.find(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.pharmacyId === command.pharmacyId &&
        entry.receptionId === command.receptionId,
    );
    if (record === undefined) {
      return undefined;
    }
    return {
      patientId: record.patientId,
      snapshotId: record.eligibilitySnapshotId,
      businessDate: record.date,
    };
  }

  /**
   * WP-7204: eligibility snapshot 記録と同一 unit of work で受付の link を更新する
   * (in-memory)。link の単独 API は持たない。
   */
  linkEligibilitySnapshot(command: {
    readonly tenantId: TenantId;
    readonly pharmacyId: PharmacyId;
    readonly receptionId: ReceptionId;
    readonly snapshotId: string;
  }): void {
    const index = this.records.findIndex(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.pharmacyId === command.pharmacyId &&
        entry.receptionId === command.receptionId,
    );
    const record = this.records[index];
    if (record === undefined) {
      throw new Error(inMemoryReceptionIdempotencyInvariantErrorMessage);
    }
    this.records[index] = {
      ...record,
      eligibilitySnapshotId: command.snapshotId,
    };
  }

  /**
   * WP-7204: in-memory unit of work の補償専用。直前に link した受付を、
   * 監査追記が失敗した同一 unit of work 内でだけ直前の link へ戻す。
   * 現行 link が巻き戻し対象の snapshotId と一致しない限り復元しない
   * (rollbackTransition と同じ規律)。
   */
  restoreEligibilityLink(command: {
    readonly tenantId: TenantId;
    readonly pharmacyId: PharmacyId;
    readonly receptionId: ReceptionId;
    readonly snapshotId: string;
    readonly priorSnapshotId: string | null;
  }): void {
    const index = this.records.findIndex(
      (entry) =>
        entry.tenantId === command.tenantId &&
        entry.pharmacyId === command.pharmacyId &&
        entry.receptionId === command.receptionId,
    );
    const record = this.records[index];
    if (
      record === undefined ||
      record.eligibilitySnapshotId !== command.snapshotId
    ) {
      throw new Error(receptionTransitionUndoInvariantErrorMessage);
    }
    this.records[index] = {
      ...record,
      eligibilitySnapshotId: command.priorSnapshotId,
    };
  }

  /**
   * WP-7201: DOM-004 §2 の副状態機械を駆動する遷移。スコープ内で受付を解決し、
   * 遷移表(isReceptionTransitionAllowed)と expectedVersion CAS をこの順で検査して
   * 原子的に書き換える。不許可遷移は version より先に拒否する(API-006 §2.3)。
   */
  async transition(input: ReceptionTransitionInput): Promise<ReceptionTransitionResult> {
    const command = snapshotReceptionTransitionCommand(input);
    const index = this.records.findIndex(
      (record) =>
        record.tenantId === command.tenantId &&
        record.pharmacyId === command.pharmacyId &&
        record.receptionId === command.receptionId,
    );
    const record = this.records[index];
    if (record === undefined) {
      return { kind: 'not_found' };
    }
    if (!isReceptionTransitionAllowed(record.receptionStatus, command.to)) {
      return {
        kind: 'transition_not_allowed',
        currentStatus: record.receptionStatus,
        currentVersion: record.version,
      };
    }
    if (record.version !== command.expectedVersion) {
      return {
        kind: 'version_conflict',
        currentStatus: record.receptionStatus,
        currentVersion: record.version,
      };
    }
    const undo: ReceptionTransitionUndo = {
      tenantId: record.tenantId,
      pharmacyId: record.pharmacyId,
      receptionId: record.receptionId,
      postStatus: command.to,
      postVersion: record.version + 1,
      priorStatus: record.receptionStatus,
      priorVersion: record.version,
      priorStatusChangedAt: record.statusChangedAt,
      ...(record.cancelReason === undefined
        ? {}
        : { priorCancelReason: record.cancelReason }),
    };
    const nextBase = {
      ...record,
      receptionStatus: command.to,
      version: record.version + 1,
      statusChangedAt: command.statusChangedAt,
    };
    const { cancelReason: _discardedCancelReason, ...nextWithoutCancelReason } =
      nextBase;
    this.records[index] =
      command.businessReason === undefined
        ? nextWithoutCancelReason
        : { ...nextWithoutCancelReason, cancelReason: command.businessReason };
    return {
      kind: 'transitioned',
      receptionId: record.receptionId,
      receptionStatus: command.to,
      version: record.version + 1,
      statusChangedAt: command.statusChangedAt,
      undo,
    };
  }

  /**
   * WP-7201: in-memory unit of work の補償専用。直前に transition した受付を、
   * 監査追記が失敗した同一 unit of work 内でだけ直前状態へ巻き戻す。
   * undo が現行状態(post-status/version)と一致しない限り復元しない。
   * (Postgres 実装はトランザクションで巻き戻すため、この補償を持たない。)
   */
  rollbackTransition(undo: unknown): void {
    const readProperty = createOwnDataPropertyReader(
      undo,
      receptionTransitionUndoInvariantErrorMessage,
    );
    const undoTenantId = snapshotRepositoryTenantId(
      readProperty('tenantId'),
      receptionTransitionUndoInvariantErrorMessage,
    );
    const undoPharmacyId = snapshotRepositoryPharmacyId(
      readProperty('pharmacyId'),
      receptionTransitionUndoInvariantErrorMessage,
    );
    const undoReceptionIdValue = readReceptionScopeString(
      readProperty('receptionId'),
      receptionTransitionUndoInvariantErrorMessage,
    );
    let undoReceptionId: ReceptionId;
    try {
      undoReceptionId = receptionId(undoReceptionIdValue);
    } catch {
      throw new Error(receptionTransitionUndoInvariantErrorMessage);
    }
    const postVersionProperty = readProperty('postVersion');
    const postVersion = snapshotReceptionTransitionExpectedVersion(
      postVersionProperty.present ? postVersionProperty.value : undefined,
    );
    const postStatusProperty = readProperty('postStatus');
    const postStatusValue = postStatusProperty.present
      ? postStatusProperty.value
      : undefined;
    if (typeof postStatusValue !== 'string' || !isReceptionStatus(postStatusValue)) {
      throw new Error(receptionTransitionUndoInvariantErrorMessage);
    }
    const priorStatusProperty = readProperty('priorStatus');
    const priorStatusValue = priorStatusProperty.present
      ? priorStatusProperty.value
      : undefined;
    if (typeof priorStatusValue !== 'string' || !isReceptionStatus(priorStatusValue)) {
      throw new Error(receptionTransitionUndoInvariantErrorMessage);
    }
    const priorVersionProperty = readProperty('priorVersion');
    const priorVersion = snapshotReceptionTransitionExpectedVersion(
      priorVersionProperty.present ? priorVersionProperty.value : undefined,
    );
    const priorStatusChangedAtProperty = readProperty('priorStatusChangedAt');
    const priorStatusChangedAtValue = priorStatusChangedAtProperty.present
      ? priorStatusChangedAtProperty.value
      : undefined;
    if (typeof priorStatusChangedAtValue !== 'string') {
      throw new Error(receptionTransitionUndoInvariantErrorMessage);
    }
    const priorCancelReasonProperty = readProperty('priorCancelReason');
    const priorCancelReasonValue = priorCancelReasonProperty.present
      ? priorCancelReasonProperty.value
      : undefined;

    const index = this.records.findIndex(
      (record) => record.receptionId === undoReceptionId,
    );
    const record = this.records[index];
    if (
      record === undefined ||
      record.tenantId !== undoTenantId ||
      record.pharmacyId !== undoPharmacyId ||
      record.receptionStatus !== postStatusValue ||
      record.version !== postVersion ||
      postVersion !== priorVersion + 1
    ) {
      throw new Error(receptionTransitionUndoInvariantErrorMessage);
    }
    const restoredBase = {
      ...record,
      receptionStatus: priorStatusValue,
      version: priorVersion,
      statusChangedAt: priorStatusChangedAtValue,
    };
    const { cancelReason: _postCancelReason, ...restoredWithoutCancelReason } =
      restoredBase;
    this.records[index] =
      typeof priorCancelReasonValue === 'string'
        ? { ...restoredWithoutCancelReason, cancelReason: priorCancelReasonValue }
        : restoredWithoutCancelReason;
  }

  /**
   * WP-4050: in-memory unit of work の補償専用。直前に create した受付を、
   * 監査/outbox 追記が失敗した同一 unit of work 内でだけ取り消す。
   * provenance 全体が一致しない取り消しは整合性違反として拒否する。
   * (Postgres 実装はトランザクションで巻き戻すため、この補償を持たない。)
   */
  rollbackCreated(provenance: ReceptionCreateProvenance): void {
    const index = this.records.findIndex(
      (record) => record.receptionId === provenance.receptionId,
    );
    const record = this.records[index];
    if (
      record === undefined ||
      record.tenantId !== provenance.tenantId ||
      record.pharmacyId !== provenance.pharmacyId ||
      record.idempotencyKey !== provenance.idempotencyKey ||
      record.patientId !== provenance.patientId
    ) {
      throw new Error(inMemoryReceptionIdempotencyInvariantErrorMessage);
    }
    this.records.splice(index, 1);
    this.idempotencyRecords.delete(
      toIdempotencyKey({
        tenantId: provenance.tenantId,
        pharmacyId: provenance.pharmacyId,
        idempotencyKey: provenance.idempotencyKey,
      }),
    );
  }
}
