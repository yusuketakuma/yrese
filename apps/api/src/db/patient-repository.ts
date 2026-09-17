import type { Pool, PoolClient } from 'pg';
import {
  type PatientSearchResult,
  type PatientVersionedSummary,
  patientSearchResultSchema,
  patientVersionedSummarySchema,
} from '@yrese/contracts';

import {
  AUTO_PATIENT_NUMBER_PREFIX,
  AUTO_PATIENT_NUMBER_WIDTH,
  PATIENT_DUPLICATE_CANDIDATE_LIMIT,
  snapshotPatientCreateCommand,
  snapshotPatientLookupCommand,
  snapshotPatientNextCursor,
  snapshotPatientSearchCommand,
  snapshotPatientUpdateCommand,
  type PatientCreateInput,
  type PatientCreateResult,
  type PatientLookupInput,
  type PatientRepository,
  type PatientSearchInput,
  type PatientSearchPage,
  type PatientUpdateInput,
  type PatientUpdateResult,
} from '../patient-repository.js';
import { snapshotDatabaseInstant } from '../instant.js';
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
  snapshotUnboundedDatabaseQueryRows,
} from './database-row.js';
import { runInPooledTransaction } from './pool.js';

interface PatientRow {
  readonly patient_id: string;
  readonly name: string;
  readonly kana: string;
  readonly birth_date: string;
  readonly sex: string;
  readonly patient_number: string;
  readonly eligibility_status: string;
  readonly eligibility_checked_at: Date | string | null;
  readonly version?: number;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export const databasePatientEligibilityTimestampInvariantErrorMessage =
  'Patient database returned an invalid eligibility timestamp';
export const databasePatientRowInvariantErrorMessage =
  'Patient database returned an invalid patient row';
export const databasePatientRowSetInvariantErrorMessage =
  'Patient database returned an invalid patient row set';

function snapshotEligibilityCheckedAt(row: PatientRow): string | undefined {
  const value = readDatabaseRowOwnDataProperty(
    row,
    'eligibility_checked_at',
    databasePatientEligibilityTimestampInvariantErrorMessage,
  );
  return value === null
    ? undefined
    : snapshotDatabaseInstant(
        value,
        databasePatientEligibilityTimestampInvariantErrorMessage,
      );
}

export function patientRowToSearchResult(row: PatientRow): PatientSearchResult {
  const eligibilityCheckedAt = snapshotEligibilityCheckedAt(row);
  const readCoreString = (property: keyof PatientRow): string => {
    const value = readDatabaseRowOwnDataProperty(
      row,
      property,
      databasePatientRowInvariantErrorMessage,
    );
    if (typeof value !== 'string') {
      throw new Error(databasePatientRowInvariantErrorMessage);
    }
    return value;
  };
  const patientIdValue = readCoreString('patient_id');
  const name = readCoreString('name');
  const kana = readCoreString('kana');
  const birthDate = readCoreString('birth_date');
  const sex = readCoreString('sex');
  const patientNumber = readCoreString('patient_number');
  const eligibilityStatus = readCoreString('eligibility_status');
  try {
    return patientSearchResultSchema.parse({
      patientId: patientIdValue,
      name,
      kana,
      birthDate,
      sex,
      patientNumber,
      eligibilityStatus,
      ...(eligibilityCheckedAt === undefined ? {} : { eligibilityCheckedAt }),
    });
  } catch {
    throw new Error(databasePatientRowInvariantErrorMessage);
  }
}

function patientRowToVersionedSummary(row: PatientRow): PatientVersionedSummary {
  const base = patientRowToSearchResult(row);
  const version = readDatabaseRowOwnDataProperty(
    row,
    'version',
    databasePatientRowInvariantErrorMessage,
  );
  try {
    return patientVersionedSummarySchema.parse({ ...base, version });
  } catch {
    throw new Error(databasePatientRowInvariantErrorMessage);
  }
}

/**
 * WP-7202: POST /patients の永続化(監査は command 層が同一 tx で追記する)。
 *
 * ロック順序: scope 単位の advisory xact lock(patientNumber 採番と
 * idempotency 判定の直列化)→ patient_create_idempotency 参照 →
 * patients INSERT + idempotency INSERT。重複候補の列挙は同一 tx 内で行い、
 * 応答に返す候補が登録時点の確定的な集合となる。
 */
export async function runPatientCreateWithinTransaction(
  client: PoolClient,
  input: PatientCreateInput,
): Promise<PatientCreateResult> {
  const command = snapshotPatientCreateCommand(input);
  // scope 単位の直列化: 採番・一意性・idempotency 判定の競合を防ぐ。
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 7202))`,
    [command.tenantId, command.pharmacyId],
  );

  const idempotency = await client.query<{
    request_fingerprint: string;
    patient_id: string;
  }>(
    `SELECT request_fingerprint, patient_id
       FROM patient_create_idempotency
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND idempotency_key = $3`,
    [command.tenantId, command.pharmacyId, command.idempotencyKey],
  );
  const idempotencyRows = snapshotDatabaseQueryRows<{
    readonly request_fingerprint: string;
    readonly patient_id: string;
  }>(
    idempotency,
    1,
    databasePatientRowSetInvariantErrorMessage,
  );
  const recorded = idempotencyRows[0];
  if (recorded !== undefined) {
    if (recorded.request_fingerprint !== command.requestFingerprint) {
      return { kind: 'idempotency_conflict' };
    }
    const existing = await client.query<PatientRow>(
      `SELECT patient_id, name, kana, birth_date::text AS birth_date, sex,
              patient_number, eligibility_status, eligibility_checked_at, version
         FROM patients
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3`,
      [command.tenantId, command.pharmacyId, recorded.patient_id],
    );
    const existingRows = snapshotDatabaseQueryRows<PatientRow>(
      existing,
      1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const existingRow = existingRows[0];
    if (existingRow === undefined) {
      throw new Error(databasePatientRowInvariantErrorMessage);
    }
    return { kind: 'existing', patient: patientRowToVersionedSummary(existingRow) };
  }

  const requestedNumber = command.attributes.patientNumber;
  let patientNumber: string;
  if (requestedNumber !== undefined) {
    patientNumber = requestedNumber;
  } else {
    // numeric(任意精度)で採番する — int4/int8 の CAST は桁数の大きい
    // 明示 patientNumber(例: P-3000000000)で overflow し、その scope の
    // 自動採番が恒久的に 500 化する。wire 契約は桁数を制限しないため、
    // 任意精度でのみ fail-safe に振る舞える。
    const sequence = await client.query<{ next: string }>(
      `SELECT COALESCE(MAX(CAST(substring(patient_number from 3) AS numeric)), 0) + 1 AS next
         FROM patients
        WHERE tenant_id = $1 AND pharmacy_id = $2
          AND patient_number ~ '^P-[0-9]+$'`,
      [command.tenantId, command.pharmacyId],
    );
    const sequenceRows = snapshotDatabaseQueryRows<{ readonly next: string }>(
      sequence,
      1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const next = sequenceRows[0]?.next;
    let nextSequence: bigint;
    try {
      nextSequence = typeof next === 'string' ? BigInt(next) : -1n;
    } catch {
      nextSequence = -1n;
    }
    if (nextSequence < 1n) {
      throw new Error(databasePatientRowInvariantErrorMessage);
    }
    patientNumber = `${AUTO_PATIENT_NUMBER_PREFIX}${nextSequence
      .toString()
      .padStart(AUTO_PATIENT_NUMBER_WIDTH, '0')}`;
  }

  const duplicates = await client.query<PatientRow>(
    `SELECT patient_id, name, kana, birth_date::text AS birth_date, sex,
            patient_number, eligibility_status, eligibility_checked_at, version
       FROM patients
      WHERE tenant_id = $1 AND pharmacy_id = $2
        AND (name = $3 OR birth_date = $4::date)
      ORDER BY patient_number COLLATE "C" ASC, patient_id COLLATE "C" ASC
      LIMIT $5`,
    [
      command.tenantId,
      command.pharmacyId,
      command.attributes.name.trim(),
      command.attributes.birthDate,
      PATIENT_DUPLICATE_CANDIDATE_LIMIT,
    ],
  );
  const duplicateRows = snapshotUnboundedDatabaseQueryRows<PatientRow>(
    duplicates,
    databasePatientRowSetInvariantErrorMessage,
  );

  let inserted;
  try {
    inserted = await client.query<PatientRow>(
      `INSERT INTO patients (
         tenant_id, pharmacy_id, patient_id, name, kana, birth_date, sex,
         patient_number, eligibility_status, eligibility_checked_at,
         version, created_at, updated_at, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, 'NOT_CHECKED', NULL,
                 1, $9, $9, $10, $10)
       RETURNING patient_id, name, kana, birth_date::text AS birth_date, sex,
                 patient_number, eligibility_status, eligibility_checked_at, version`,
      [
        command.tenantId,
        command.pharmacyId,
        command.patientId,
        command.attributes.name,
        command.attributes.kana,
        command.attributes.birthDate,
        command.attributes.sex,
        patientNumber,
        command.recordedAt,
        command.actorId,
      ],
    );
  } catch (error) {
    // patient_number の scope 一意制約違反のみ conflict へ写像する。
    // PK(patient_id)衝突等の他の一意違反は混同せず fail-visible にする。
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505' &&
      'constraint' in error &&
      (error as { constraint?: string }).constraint ===
        'patients_tenant_pharmacy_patient_number_unique'
    ) {
      return { kind: 'patient_number_conflict' };
    }
    throw error;
  }
  const insertedRows = snapshotDatabaseQueryRows<PatientRow>(
    inserted,
    1,
    databasePatientRowSetInvariantErrorMessage,
  );
  const insertedRow = insertedRows[0];
  if (insertedRow === undefined) {
    throw new Error(databasePatientRowInvariantErrorMessage);
  }

  await client.query(
    `INSERT INTO patient_create_idempotency (
       tenant_id, pharmacy_id, idempotency_key, request_fingerprint,
       patient_id, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      command.tenantId,
      command.pharmacyId,
      command.idempotencyKey,
      command.requestFingerprint,
      command.patientId,
      command.recordedAt,
    ],
  );

  return {
    kind: 'created',
    patient: patientRowToVersionedSummary(insertedRow),
    duplicateCandidates: duplicateRows.map(patientRowToSearchResult),
    undo: null,
  };
}

/**
 * WP-7202: PUT /patients/{id} の永続化(監査は command 層が同一 tx で追記)。
 * SELECT FOR UPDATE → version CAS → identity field 変更時に旧値を
 * patient_identity_history へ記録 → UPDATE。patientNumber は更新しない
 * (不変 field、422 は route 層で判定済み)。
 */
export async function runPatientUpdateWithinTransaction(
  client: PoolClient,
  input: PatientUpdateInput,
): Promise<PatientUpdateResult> {
  const command = snapshotPatientUpdateCommand(input);
  const current = await client.query<PatientRow>(
    `SELECT patient_id, name, kana, birth_date::text AS birth_date, sex,
            patient_number, eligibility_status, eligibility_checked_at, version
       FROM patients
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3
      FOR UPDATE`,
    [command.tenantId, command.pharmacyId, command.patientId],
  );
  const currentRows = snapshotDatabaseQueryRows<PatientRow>(
    current,
    1,
    databasePatientRowSetInvariantErrorMessage,
  );
  const row = currentRows[0];
  if (row === undefined) {
    return { kind: 'not_found' };
  }
  if (row.version !== command.expectedVersion) {
    return {
      kind: 'version_conflict',
      currentVersion: row.version ?? 0,
    };
  }

  const attributes = command.attributes;
  const nextName = attributes.name ?? row.name;
  const nextKana = attributes.kana ?? row.kana;
  const nextBirthDate = attributes.birthDate ?? row.birth_date;
  const nextSex = attributes.sex ?? row.sex;
  const identityChanged =
    nextName !== row.name ||
    nextKana !== row.kana ||
    nextBirthDate !== row.birth_date ||
    nextSex !== row.sex;

  if (identityChanged) {
    await client.query(
      `INSERT INTO patient_identity_history (
         tenant_id, pharmacy_id, patient_id, version, name, kana,
         birth_date, sex, superseded_at, superseded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10)`,
      [
        command.tenantId,
        command.pharmacyId,
        command.patientId,
        row.version,
        row.name,
        row.kana,
        row.birth_date,
        row.sex,
        command.recordedAt,
        command.actorId,
      ],
    );
  }

  const updated = await client.query<PatientRow>(
    `UPDATE patients
        SET name = $4, kana = $5, birth_date = $6::date, sex = $7,
            version = version + 1, updated_at = $8, updated_by = $9
      WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3
        AND version = $10
      RETURNING patient_id, name, kana, birth_date::text AS birth_date, sex,
                patient_number, eligibility_status, eligibility_checked_at, version`,
    [
      command.tenantId,
      command.pharmacyId,
      command.patientId,
      nextName,
      nextKana,
      nextBirthDate,
      nextSex,
      command.recordedAt,
      command.actorId,
      command.expectedVersion,
    ],
  );
  const updatedRows = snapshotDatabaseQueryRows<PatientRow>(
    updated,
    1,
    databasePatientRowSetInvariantErrorMessage,
  );
  const updatedRow = updatedRows[0];
  if (updatedRow === undefined) {
    throw new Error(databasePatientRowInvariantErrorMessage);
  }

  return {
    kind: 'updated',
    patient: patientRowToVersionedSummary(updatedRow),
    undo: null,
  };
}

export class PostgresPatientRepository implements PatientRepository {
  constructor(private readonly pool: Pool) {}

  async findById(input: PatientLookupInput): Promise<PatientSearchResult | undefined> {
    const command = snapshotPatientLookupCommand(input);
    const result = await this.pool.query<PatientRow>(
      `SELECT
         patient_id,
         name,
         kana,
         birth_date::text AS birth_date,
         sex,
         patient_number,
         eligibility_status,
         eligibility_checked_at
       FROM patients
       WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3`,
      [command.tenantId, command.pharmacyId, command.patientId],
    );

    const rows = snapshotDatabaseQueryRows<PatientRow>(
      result,
      1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const row = rows[0];
    return row === undefined ? undefined : patientRowToSearchResult(row);
  }

  async findVersionedById(
    input: PatientLookupInput,
  ): Promise<PatientVersionedSummary | undefined> {
    const command = snapshotPatientLookupCommand(input);
    const result = await this.pool.query<PatientRow>(
      `SELECT patient_id, name, kana, birth_date::text AS birth_date, sex,
              patient_number, eligibility_status, eligibility_checked_at, version
         FROM patients
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND patient_id = $3`,
      [command.tenantId, command.pharmacyId, command.patientId],
    );
    const rows = snapshotDatabaseQueryRows<PatientRow>(
      result,
      1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const row = rows[0];
    return row === undefined ? undefined : patientRowToVersionedSummary(row);
  }

  /** 裸の create(監査なし)。永続経路は PostgresPatientWriteCommand が束ねる。 */
  async create(input: PatientCreateInput): Promise<PatientCreateResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runPatientCreateWithinTransaction(client, input);
      await client.query('COMMIT');
      return result;
    });
  }

  /** 裸の update(監査なし)。永続経路は PostgresPatientWriteCommand が束ねる。 */
  async update(input: PatientUpdateInput): Promise<PatientUpdateResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      const result = await runPatientUpdateWithinTransaction(client, input);
      await client.query('COMMIT');
      return result;
    });
  }

  async search(input: PatientSearchInput): Promise<PatientSearchPage> {
    const command = snapshotPatientSearchCommand(input);
    const pattern = `%${escapeLikePattern(command.q)}%`;
    const result = await this.pool.query<PatientRow>(
      `SELECT
         patient_id,
         name,
         kana,
         birth_date::text AS birth_date,
         sex,
         patient_number,
         eligibility_status,
         eligibility_checked_at
       FROM patients
       WHERE tenant_id = $1
         AND pharmacy_id = $2
         AND (name ILIKE $3 ESCAPE '\\' OR kana ILIKE $3 ESCAPE '\\' OR patient_number ILIKE $3 ESCAPE '\\')
       -- C collation: database locale に依存しない code point 順で in-memory 実装と一致させる。
       ORDER BY patient_number COLLATE "C" ASC, patient_id COLLATE "C" ASC
       LIMIT $4 OFFSET $5`,
      [
        command.tenantId,
        command.pharmacyId,
        pattern,
        command.limit + 1,
        command.offset,
      ],
    );

    const rows = snapshotDatabaseQueryRows<PatientRow>(
      result,
      command.limit + 1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const pageRows = rows.slice(0, command.limit);
    const nextCursor = snapshotPatientNextCursor(command, rows.length > command.limit);

    return {
      results: pageRows.map(patientRowToSearchResult),
      ...(nextCursor === undefined ? {} : { nextCursor }),
    };
  }
}
