import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  patientSearchResultSchema,
  receptionQueueEntrySchema,
  RECEPTION_QUEUE_MAX_ENTRIES,
  type PatientSearchResult,
  type ReceptionQueueEntry,
} from '@yrese/contracts';
import {
  allowsFinalCalculationForEligibility,
  allowsProvisionalCalculationForEligibility,
  isReceptionEligibilityState,
  isReceptionStatus,
  isReceptionTransitionAllowed,
  patientId,
  pharmacyId,
  receptionId,
  tenantId,
  type RecordedEligibilityState,
} from '@yrese/shared-kernel';

import {
  deriveEligibilityState,
  type EligibilitySnapshot,
} from './eligibility-snapshot-repository.js';
import {
  businessDateFromAcceptedAt,
  snapshotReceptionIdempotencyKey,
  snapshotReceptionListCommand,
  snapshotReceptionTransitionCommand,
  type ReceptionCreateInput,
  type ReceptionCreateResult,
  type ReceptionListInput,
  type ReceptionRepository,
  type ReceptionTransitionInput,
  type ReceptionTransitionResult,
  type ReceptionTransitionUndo,
} from '../reception-repository.js';
import { snapshotDatabaseInstant, snapshotDateInstant } from '../instant.js';
import { createOwnDataPropertyReader } from '../own-data-property.js';
import {
  snapshotRepositoryPharmacyId,
  snapshotRepositoryTenantId,
} from '../repository-command.js';
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
  snapshotUnboundedDatabaseQueryRows,
} from './database-row.js';
import { patientRowToSearchResult } from './patient-repository.js';
import { runInPooledTransaction } from './pool.js';

interface ReceptionEntryRow {
  readonly reception_id: string;
  readonly accepted_at: Date | string;
  readonly reception_status: string;
  readonly version: number;
  readonly patient_id: string;
  readonly name: string;
  readonly kana: string;
  readonly birth_date: string;
  readonly sex: string;
  readonly patient_number: string;
  readonly eligibility_status: string;
  readonly eligibility_checked_at: Date | string | null;
  /**
   * queue entry の資格表示導出用(API-006 0.3.2)。LEFT JOIN 由来のため
   * 紐づけなしでは null。INSERT RETURNING 経路では列自体が存在しない
   * (その場合も未確認 = UNVERIFIED として扱う)。
   */
  readonly elig_snapshot_id?: string | null;
  readonly elig_state?: string | null;
  readonly elig_verified_method?: string | null;
  readonly elig_valid_from?: string | null;
  readonly elig_valid_to?: string | null;
  /** 資格導出の業務日付権威(idempotency replay 経路でSELECTされる)。 */
  readonly business_date?: string;
}

interface IdempotencyRow extends ReceptionEntryRow {
  readonly stored_patient_id: string;
  readonly stored_tenant_id: string;
  readonly stored_pharmacy_id: string;
  readonly stored_idempotency_key: string;
}

type ReceptionCreateRow = ReceptionEntryRow &
  Pick<
    IdempotencyRow,
    | 'stored_patient_id'
    | 'stored_tenant_id'
    | 'stored_pharmacy_id'
    | 'stored_idempotency_key'
  >;

export const databaseReceptionProvenanceInvariantErrorMessage =
  'Reception database returned invalid idempotency provenance';
export const databaseReceptionTimestampInvariantErrorMessage =
  'Reception database returned an invalid timestamp';
export const databaseReceptionRowInvariantErrorMessage =
  'Reception database returned an invalid reception row';
export const databaseReceptionRowSetInvariantErrorMessage =
  'Reception database returned an invalid reception row set';
export const databaseReceptionCreatedStatusInvariantErrorMessage =
  'Reception database returned an invalid created status';
export const databaseReceptionCreatedAcceptedAtInvariantErrorMessage =
  'Reception database returned an invalid created timestamp';
export const databaseReceptionCommandProvenanceInvariantErrorMessage =
  'Reception database returned mismatched command provenance';
export const databaseReceptionEntryIdentityInvariantErrorMessage =
  'Reception database returned mismatched entry identity';
export const databaseReceptionCreatedPatientSnapshotInvariantErrorMessage =
  'Reception database returned a mismatched created patient snapshot';
export const databaseReceptionCommandSnapshotInvariantErrorMessage =
  'Reception create command snapshot is invalid';
export const databaseReceptionTransitionInvariantErrorMessage =
  'Reception database returned an invalid transition result';

function snapshotCreatePatient(patient: unknown): PatientSearchResult {
  const readOwnPatientProperty = createOwnDataPropertyReader(
    patient,
    databaseReceptionCreatedPatientSnapshotInvariantErrorMessage,
  );
  const readPatientProperty = (property: keyof PatientSearchResult): unknown => {
    const result = readOwnPatientProperty(property);
    if (!result.present) {
      throw new Error(databaseReceptionCreatedPatientSnapshotInvariantErrorMessage);
    }
    return result.value;
  };
  const patientIdValue = readPatientProperty('patientId');
  const name = readPatientProperty('name');
  const kana = readPatientProperty('kana');
  const birthDate = readPatientProperty('birthDate');
  const sex = readPatientProperty('sex');
  const patientNumber = readPatientProperty('patientNumber');
  const eligibilityStatus = readPatientProperty('eligibilityStatus');
  const eligibilityCheckedAtProperty = readOwnPatientProperty('eligibilityCheckedAt');
  try {
    return patientSearchResultSchema.parse({
      patientId: patientIdValue,
      name,
      kana,
      birthDate,
      sex,
      patientNumber,
      eligibilityStatus,
      ...(eligibilityCheckedAtProperty.present
        ? { eligibilityCheckedAt: eligibilityCheckedAtProperty.value }
        : {}),
    });
  } catch {
    throw new Error(databaseReceptionCreatedPatientSnapshotInvariantErrorMessage);
  }
}

function patientSnapshotsMatch(
  actual: PatientSearchResult,
  expected: PatientSearchResult,
): boolean {
  return (
    actual.patientId === expected.patientId &&
    actual.name === expected.name &&
    actual.kana === expected.kana &&
    actual.birthDate === expected.birthDate &&
    actual.sex === expected.sex &&
    actual.patientNumber === expected.patientNumber &&
    actual.eligibilityStatus === expected.eligibilityStatus &&
    Object.hasOwn(actual, 'eligibilityCheckedAt') ===
      Object.hasOwn(expected, 'eligibilityCheckedAt') &&
    actual.eligibilityCheckedAt === expected.eligibilityCheckedAt
  );
}

/** queue entry の資格表示(API-006 0.3.2): 紐づく snapshot を業務日付で導出。 */
function rowToEligibility(
  row: ReceptionEntryRow,
  asOfDate: string,
): {
  readonly state:
    | 'UNVERIFIED'
    | 'VERIFIED_MYNA'
    | 'VERIFIED_CARD'
    | 'PROVISIONAL_VISUAL'
    | 'OFFLINE_PROVISIONAL'
    | 'EXPIRED'
    | 'MISMATCH';
  readonly snapshotId: string | null;
  readonly allowsProvisionalCalculation: boolean;
  readonly allowsFinalCalculation: boolean;
} {
  const snapshotId = row.elig_snapshot_id;
  if (typeof snapshotId !== 'string') {
    return {
      state: 'UNVERIFIED',
      snapshotId: null,
      allowsProvisionalCalculation: false,
      allowsFinalCalculation: false,
    };
  }
  const state = row.elig_state;
  const validFrom = row.elig_valid_from;
  const validTo = row.elig_valid_to;
  if (
    typeof state !== 'string' ||
    !isReceptionEligibilityState(state) ||
    state === 'UNVERIFIED' ||
    typeof validFrom !== 'string' ||
    (validTo !== null && typeof validTo !== 'string')
  ) {
    throw new Error(databaseReceptionRowInvariantErrorMessage);
  }
  const derived = deriveEligibilityState(
    {
      state: state as RecordedEligibilityState,
      validFrom,
      validTo: validTo ?? null,
    },
    asOfDate,
  );
  return {
    state: derived,
    snapshotId,
    allowsProvisionalCalculation:
      allowsProvisionalCalculationForEligibility(derived),
    allowsFinalCalculation: allowsFinalCalculationForEligibility(derived),
  };
}

function rowToEntry(row: ReceptionEntryRow, asOfDate: string): ReceptionQueueEntry {
  const receptionIdValue = readDatabaseRowOwnDataProperty(
    row,
    'reception_id',
    databaseReceptionRowInvariantErrorMessage,
  );
  if (typeof receptionIdValue !== 'string') {
    throw new Error(databaseReceptionRowInvariantErrorMessage);
  }
  const patient = patientRowToSearchResult(row);
  const acceptedAt = snapshotDatabaseInstant(
    readDatabaseRowOwnDataProperty(
      row,
      'accepted_at',
      databaseReceptionTimestampInvariantErrorMessage,
    ),
    databaseReceptionTimestampInvariantErrorMessage,
  );
  const receptionStatus = readDatabaseRowOwnDataProperty(
    row,
    'reception_status',
    databaseReceptionRowInvariantErrorMessage,
  );
  if (typeof receptionStatus !== 'string') {
    throw new Error(databaseReceptionRowInvariantErrorMessage);
  }
  const version = readDatabaseRowOwnDataProperty(
    row,
    'version',
    databaseReceptionRowInvariantErrorMessage,
  );
  const eligibility = rowToEligibility(row, asOfDate);
  try {
    return receptionQueueEntrySchema.parse({
      receptionId: receptionIdValue,
      patient,
      acceptedAt,
      receptionStatus,
      prescriptionIntakeType: 'paper',
      version,
      eligibility,
    });
  } catch {
    throw new Error(databaseReceptionRowInvariantErrorMessage);
  }
}

function rowToProvenance(row: ReceptionCreateRow) {
  const readProvenanceString = (property: keyof ReceptionCreateRow): string => {
    const value = readDatabaseRowOwnDataProperty(
      row,
      property,
      databaseReceptionProvenanceInvariantErrorMessage,
    );
    if (typeof value !== 'string') {
      throw new Error(databaseReceptionProvenanceInvariantErrorMessage);
    }
    return value;
  };
  const storedTenantId = readProvenanceString('stored_tenant_id');
  const storedPharmacyId = readProvenanceString('stored_pharmacy_id');
  const storedIdempotencyKey = readProvenanceString('stored_idempotency_key');
  const storedReceptionId = readProvenanceString('reception_id');
  const storedPatientId = readProvenanceString('stored_patient_id');
  try {
    return {
      tenantId: tenantId(storedTenantId),
      pharmacyId: pharmacyId(storedPharmacyId),
      idempotencyKey: storedIdempotencyKey,
      receptionId: receptionId(storedReceptionId),
      patientId: patientId(storedPatientId),
    };
  } catch {
    throw new Error(databaseReceptionProvenanceInvariantErrorMessage);
  }
}

async function selectByIdempotencyKey(
  client: PoolClient,
  input: Pick<ReceptionCreateInput, 'tenantId' | 'pharmacyId' | 'idempotencyKey'>,
): Promise<IdempotencyRow | undefined> {
  const result = await client.query<IdempotencyRow>(
    `SELECT
       r.patient_id AS stored_patient_id,
       r.tenant_id AS stored_tenant_id,
       r.pharmacy_id AS stored_pharmacy_id,
       r.idempotency_key AS stored_idempotency_key,
       r.reception_id,
       r.accepted_at,
       r.reception_status,
       r.version,
       p.patient_id,
       p.name,
       p.kana,
       p.birth_date::text AS birth_date,
       p.sex,
       p.patient_number,
       p.eligibility_status,
       p.eligibility_checked_at,
       r.business_date::text AS business_date,
       es.snapshot_id AS elig_snapshot_id,
       es.state AS elig_state,
       es.valid_from::text AS elig_valid_from,
       es.valid_to::text AS elig_valid_to
     FROM reception_entries r
     INNER JOIN patients p
       ON p.tenant_id = r.tenant_id
      AND p.pharmacy_id = r.pharmacy_id
      AND p.patient_id = r.patient_id
     LEFT JOIN eligibility_snapshots es
       ON es.tenant_id = r.tenant_id
      AND es.pharmacy_id = r.pharmacy_id
      AND es.patient_id = r.patient_id
      AND es.snapshot_id = r.eligibility_snapshot_id
     WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.idempotency_key = $3`,
    [input.tenantId, input.pharmacyId, input.idempotencyKey],
  );
  const rows = snapshotDatabaseQueryRows<IdempotencyRow>(
    result,
    1,
    databaseReceptionRowSetInvariantErrorMessage,
  );
  if (rows.length === 0) {
    return undefined;
  }
  const row = rows[0];
  if (row === undefined) {
    throw new Error(databaseReceptionRowSetInvariantErrorMessage);
  }
  return row;
}

export interface PostgresReceptionCreateSnapshot {
  readonly tenantId: ReturnType<typeof tenantId>;
  readonly pharmacyId: ReturnType<typeof pharmacyId>;
  readonly idempotencyKey: string;
  readonly patient: PatientSearchResult;
  readonly acceptedAt: string;
  readonly businessDate: string;
}

/** create コマンド入力の検証済みスナップショット(WP-4050 コマンド境界と共用)。 */
export function snapshotPostgresReceptionCreate(
  input: ReceptionCreateInput,
): PostgresReceptionCreateSnapshot {
  const readCommandProperty = createOwnDataPropertyReader(
    input,
    databaseReceptionCommandSnapshotInvariantErrorMessage,
  );
  const commandTenantId = snapshotRepositoryTenantId(
    readCommandProperty('tenantId'),
    databaseReceptionCommandSnapshotInvariantErrorMessage,
  );
  const commandPharmacyId = snapshotRepositoryPharmacyId(
    readCommandProperty('pharmacyId'),
    databaseReceptionCommandSnapshotInvariantErrorMessage,
  );
  const commandIdempotencyKey = snapshotReceptionIdempotencyKey(
    readCommandProperty('idempotencyKey'),
    databaseReceptionCommandSnapshotInvariantErrorMessage,
  );
  const patientProperty = readCommandProperty('patient');
  if (!patientProperty.present) {
    throw new Error(databaseReceptionCommandSnapshotInvariantErrorMessage);
  }
  const commandPatient = snapshotCreatePatient(patientProperty.value);
  const acceptedAtProperty = readCommandProperty('acceptedAt');
  if (!acceptedAtProperty.present) {
    throw new Error(databaseReceptionCommandSnapshotInvariantErrorMessage);
  }
  const acceptedAt = snapshotDateInstant(
    acceptedAtProperty.value,
    databaseReceptionTimestampInvariantErrorMessage,
  );
  const businessDate = businessDateFromAcceptedAt(
    new Date(acceptedAt),
    databaseReceptionTimestampInvariantErrorMessage,
  );
  return {
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    idempotencyKey: commandIdempotencyKey,
    patient: commandPatient,
    acceptedAt,
    businessDate,
  };
}

/**
 * 呼び出し側が所有するトランザクション内で受付 create を実行する
 * (BEGIN/COMMIT/ROLLBACK は呼び出し側の責務)。結果検証を含む。
 * PostgresReceptionRepository.create と WP-4050 の原子コマンド境界が共用する。
 */
export async function runReceptionCreateWithinTransaction(
  client: PoolClient,
  snapshot: PostgresReceptionCreateSnapshot,
): Promise<ReceptionCreateResult> {
  const {
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    idempotencyKey: commandIdempotencyKey,
    patient: commandPatient,
    acceptedAt,
    businessDate,
  } = snapshot;

  const newReceptionId = receptionId(`reception-${randomUUID()}`);
  const inserted = await client.query<ReceptionCreateRow>(
    `INSERT INTO reception_entries (
       tenant_id,
       pharmacy_id,
       reception_id,
       patient_id,
       accepted_at,
       business_date,
       reception_status,
       prescription_intake_type,
       idempotency_key
     )
     VALUES ($1, $2, $3, $4, $5, $6::date, 'WAITING', 'paper', $7)
     ON CONFLICT (tenant_id, pharmacy_id, idempotency_key) DO NOTHING
     RETURNING
       tenant_id AS stored_tenant_id,
       pharmacy_id AS stored_pharmacy_id,
       idempotency_key AS stored_idempotency_key,
       patient_id AS stored_patient_id,
       reception_id,
       accepted_at,
       reception_status,
       version,
       $4::text AS patient_id,
       $8::text AS name,
       $9::text AS kana,
       $10::date::text AS birth_date,
       $11::text AS sex,
       $12::text AS patient_number,
       $13::text AS eligibility_status,
       $14::timestamptz AS eligibility_checked_at`,
    [
      commandTenantId,
      commandPharmacyId,
      newReceptionId,
      commandPatient.patientId,
      acceptedAt,
      businessDate,
      commandIdempotencyKey,
      commandPatient.name,
      commandPatient.kana,
      commandPatient.birthDate,
      commandPatient.sex,
      commandPatient.patientNumber,
      commandPatient.eligibilityStatus,
      commandPatient.eligibilityCheckedAt ?? null,
    ],
  );

  const insertedRows = snapshotDatabaseQueryRows<ReceptionCreateRow>(
    inserted,
    1,
    databaseReceptionRowSetInvariantErrorMessage,
  );
  if (insertedRows.length === 1) {
    const insertedRow = insertedRows[0];
    if (insertedRow === undefined) {
      throw new Error(databaseReceptionRowSetInvariantErrorMessage);
    }
    const provenance = rowToProvenance(insertedRow);
    if (
      provenance.tenantId !== commandTenantId ||
      provenance.pharmacyId !== commandPharmacyId ||
      provenance.idempotencyKey !== commandIdempotencyKey ||
      provenance.receptionId !== newReceptionId ||
      provenance.patientId !== commandPatient.patientId
    ) {
      throw new Error(databaseReceptionCommandProvenanceInvariantErrorMessage);
    }
    const entry = rowToEntry(insertedRow, businessDate);
    if (
      entry.receptionId !== provenance.receptionId ||
      entry.patient.patientId !== provenance.patientId
    ) {
      throw new Error(databaseReceptionEntryIdentityInvariantErrorMessage);
    }
    if (!patientSnapshotsMatch(entry.patient, commandPatient)) {
      throw new Error(databaseReceptionCreatedPatientSnapshotInvariantErrorMessage);
    }
    if (entry.receptionStatus !== 'WAITING') {
      throw new Error(databaseReceptionCreatedStatusInvariantErrorMessage);
    }
    if (entry.acceptedAt !== acceptedAt) {
      throw new Error(databaseReceptionCreatedAcceptedAtInvariantErrorMessage);
    }
    return {
      kind: 'created',
      entry,
      provenance,
    };
  }

  const existing = await selectByIdempotencyKey(client, {
    tenantId: commandTenantId,
    pharmacyId: commandPharmacyId,
    idempotencyKey: commandIdempotencyKey,
  });
  if (existing === undefined) {
    throw new Error('idempotency conflict row was not visible after unique constraint conflict');
  }

  const provenance = rowToProvenance(existing);
  if (
    provenance.tenantId !== commandTenantId ||
    provenance.pharmacyId !== commandPharmacyId ||
    provenance.idempotencyKey !== commandIdempotencyKey
  ) {
    throw new Error(databaseReceptionCommandProvenanceInvariantErrorMessage);
  }
  if (provenance.patientId !== commandPatient.patientId) {
    return { kind: 'idempotency_conflict', provenance };
  }

  const existingBusinessDate = readDatabaseRowOwnDataProperty(
    existing,
    'business_date',
    databaseReceptionRowInvariantErrorMessage,
  );
  if (typeof existingBusinessDate !== 'string') {
    throw new Error(databaseReceptionRowInvariantErrorMessage);
  }
  const entry = rowToEntry(existing, existingBusinessDate);
  if (
    entry.receptionId !== provenance.receptionId ||
    entry.patient.patientId !== provenance.patientId
  ) {
    throw new Error(databaseReceptionEntryIdentityInvariantErrorMessage);
  }
  return {
    kind: 'existing',
    entry,
    provenance,
  };
}

interface ReceptionTransitionRow {
  readonly reception_status: string;
  readonly version: number;
  readonly status_changed_at: Date | string | null;
  readonly cancel_reason: string | null;
}

function readTransitionRowStatus(row: ReceptionTransitionRow) {
  const value = readDatabaseRowOwnDataProperty(
    row,
    'reception_status',
    databaseReceptionTransitionInvariantErrorMessage,
  );
  if (typeof value !== 'string' || !isReceptionStatus(value)) {
    throw new Error(databaseReceptionTransitionInvariantErrorMessage);
  }
  return value;
}

function readTransitionRowVersion(row: ReceptionTransitionRow): number {
  const value = readDatabaseRowOwnDataProperty(
    row,
    'version',
    databaseReceptionTransitionInvariantErrorMessage,
  );
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(databaseReceptionTransitionInvariantErrorMessage);
  }
  return value;
}

/**
 * WP-7201: 呼び出し側が所有するトランザクション内で受付遷移を実行する
 * (BEGIN/COMMIT/ROLLBACK は呼び出し側の責務)。
 * SELECT ... FOR UPDATE で対象行をスコープ内に固定し、DOM-004 §2 遷移表 →
 * expectedVersion CAS の順で検査してから単調増加 version で書き換える。
 * 不許可遷移は version より先に拒否する(API-006 §2.3 の 409 区別の正本順序)。
 */
export async function runReceptionTransitionWithinTransaction(
  client: PoolClient,
  input: ReceptionTransitionInput,
): Promise<ReceptionTransitionResult> {
  const command = snapshotReceptionTransitionCommand(input);

  const locked = await client.query<ReceptionTransitionRow>(
    `SELECT reception_status, version, status_changed_at, cancel_reason
       FROM reception_entries
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND reception_id = $3
      FOR UPDATE`,
    [command.tenantId, command.pharmacyId, command.receptionId],
  );
  const lockedRows = snapshotDatabaseQueryRows<ReceptionTransitionRow>(
    locked,
    1,
    databaseReceptionTransitionInvariantErrorMessage,
  );
  const lockedRow = lockedRows[0];
  if (lockedRow === undefined) {
    return { kind: 'not_found' };
  }

  const currentStatus = readTransitionRowStatus(lockedRow);
  const currentVersion = readTransitionRowVersion(lockedRow);
  if (!isReceptionTransitionAllowed(currentStatus, command.to)) {
    return {
      kind: 'transition_not_allowed',
      currentStatus,
      currentVersion,
    };
  }
  if (currentVersion !== command.expectedVersion) {
    return {
      kind: 'version_conflict',
      currentStatus,
      currentVersion,
    };
  }

  const priorStatusChangedAtValue = readDatabaseRowOwnDataProperty(
    lockedRow,
    'status_changed_at',
    databaseReceptionTransitionInvariantErrorMessage,
  );
  const priorCancelReasonValue = readDatabaseRowOwnDataProperty(
    lockedRow,
    'cancel_reason',
    databaseReceptionTransitionInvariantErrorMessage,
  );
  const undo: ReceptionTransitionUndo = {
    tenantId: command.tenantId,
    pharmacyId: command.pharmacyId,
    receptionId: command.receptionId,
    postStatus: command.to,
    postVersion: currentVersion + 1,
    priorStatus: currentStatus,
    priorVersion: currentVersion,
    priorStatusChangedAt:
      priorStatusChangedAtValue === null
        ? command.statusChangedAt
        : snapshotDatabaseInstant(
            priorStatusChangedAtValue,
            databaseReceptionTimestampInvariantErrorMessage,
          ),
    ...(typeof priorCancelReasonValue === 'string'
      ? { priorCancelReason: priorCancelReasonValue }
      : {}),
  };

  const updated = await client.query<ReceptionTransitionRow>(
    `UPDATE reception_entries
        SET reception_status = $4,
            version = version + 1,
            status_changed_at = $5,
            cancel_reason = $6
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND reception_id = $3
        AND version = $7
      RETURNING reception_status, version, status_changed_at, cancel_reason`,
    [
      command.tenantId,
      command.pharmacyId,
      command.receptionId,
      command.to,
      command.statusChangedAt,
      command.to === 'CANCELLED' ? command.businessReason ?? null : null,
      command.expectedVersion,
    ],
  );
  const updatedRows = snapshotDatabaseQueryRows<ReceptionTransitionRow>(
    updated,
    1,
    databaseReceptionTransitionInvariantErrorMessage,
  );
  const updatedRow = updatedRows[0];
  if (updatedRow === undefined) {
    throw new Error(databaseReceptionTransitionInvariantErrorMessage);
  }
  const newStatus = readTransitionRowStatus(updatedRow);
  const newVersion = readTransitionRowVersion(updatedRow);
  if (newStatus !== command.to || newVersion !== command.expectedVersion + 1) {
    throw new Error(databaseReceptionTransitionInvariantErrorMessage);
  }
  const statusChangedAt = snapshotDatabaseInstant(
    readDatabaseRowOwnDataProperty(
      updatedRow,
      'status_changed_at',
      databaseReceptionTimestampInvariantErrorMessage,
    ),
    databaseReceptionTimestampInvariantErrorMessage,
  );

  return {
    kind: 'transitioned',
    receptionId: command.receptionId,
    receptionStatus: newStatus,
    version: newVersion,
    statusChangedAt,
    undo,
  };
}

export class PostgresReceptionRepository implements ReceptionRepository {
  constructor(private readonly pool: Pool) {}

  async list(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]> {
    const command = snapshotReceptionListCommand(input);
    const result = await this.pool.query<ReceptionEntryRow>(
      `SELECT
         r.reception_id,
         r.accepted_at,
         r.reception_status,
         r.version,
         p.patient_id,
         p.name,
         p.kana,
         p.birth_date::text AS birth_date,
         p.sex,
         p.patient_number,
         p.eligibility_status,
         p.eligibility_checked_at,
         es.snapshot_id AS elig_snapshot_id,
         es.state AS elig_state,
         es.valid_from::text AS elig_valid_from,
         es.valid_to::text AS elig_valid_to
       FROM reception_entries r
       INNER JOIN patients p
         ON p.tenant_id = r.tenant_id
        AND p.pharmacy_id = r.pharmacy_id
        AND p.patient_id = r.patient_id
       LEFT JOIN eligibility_snapshots es
         ON es.tenant_id = r.tenant_id
        AND es.pharmacy_id = r.pharmacy_id
        AND es.patient_id = r.patient_id
        AND es.snapshot_id = r.eligibility_snapshot_id
       WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.business_date = $3::date
       -- C collation: database locale に依存しない code point 順で in-memory 実装と一致させる。
       ORDER BY r.accepted_at ASC, r.reception_id COLLATE "C" ASC
       -- C-021(選択肢 b): 防御的 cap。超過検出用に cap+1 まで読み、
       -- route が cap 超過を検出して明示 error にする。
       LIMIT $4`,
      [
        command.tenantId,
        command.pharmacyId,
        command.date,
        RECEPTION_QUEUE_MAX_ENTRIES + 1,
      ],
    );

    const rows = snapshotUnboundedDatabaseQueryRows<ReceptionEntryRow>(
      result,
      databaseReceptionRowSetInvariantErrorMessage,
    );
    for (const row of rows) {
      if (row === undefined) {
        throw new Error(databaseReceptionRowSetInvariantErrorMessage);
      }
    }
    return rows.map((row) => rowToEntry(row, command.date));
  }

  async create(input: ReceptionCreateInput): Promise<ReceptionCreateResult> {
    const snapshot = snapshotPostgresReceptionCreate(input);
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runReceptionCreateWithinTransaction(client, snapshot);
      await client.query('COMMIT');
      return result;
    });
  }

  /**
   * 裸の transition(監査なし)。永続経路の実利用は
   * PostgresReceptionTransitionCommand が遷移と監査を単一トランザクションで
   * 束ねるため、こちらは command 外の直接呼び出し向け。
   */
  async transition(input: ReceptionTransitionInput): Promise<ReceptionTransitionResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runReceptionTransitionWithinTransaction(client, input);
      await client.query('COMMIT');
      return result;
    });
  }
}
