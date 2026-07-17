import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  patientSearchResultSchema,
  receptionQueueEntrySchema,
  type PatientSearchResult,
  type ReceptionQueueEntry,
} from '@yrese/contracts';
import { patientId, pharmacyId, receptionId, tenantId } from '@yrese/shared-kernel';

import {
  businessDateFromAcceptedAt,
  snapshotReceptionIdempotencyKey,
  snapshotReceptionPharmacyId,
  snapshotReceptionTenantId,
  type ReceptionCreateInput,
  type ReceptionCreateResult,
  type ReceptionListInput,
  type ReceptionRepository,
} from '../reception-repository.js';
import { snapshotDatabaseInstant, snapshotDateInstant } from '../instant.js';
import { createOwnDataPropertyReader } from '../own-data-property.js';
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
} from './database-row.js';
import { patientRowToSearchResult } from './patient-repository.js';

interface ReceptionEntryRow {
  readonly reception_id: string;
  readonly accepted_at: Date | string;
  readonly reception_status: string;
  readonly patient_id: string;
  readonly name: string;
  readonly kana: string;
  readonly birth_date: string;
  readonly sex: string;
  readonly patient_number: string;
  readonly eligibility_status: string;
  readonly eligibility_checked_at: Date | string | null;
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

function rowToEntry(row: ReceptionEntryRow): ReceptionQueueEntry {
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
  try {
    return receptionQueueEntrySchema.parse({
      receptionId: receptionIdValue,
      patient,
      acceptedAt,
      receptionStatus,
      prescriptionIntakeType: 'paper',
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
       p.patient_id,
       p.name,
       p.kana,
       p.birth_date::text AS birth_date,
       p.sex,
       p.patient_number,
       p.eligibility_status,
       p.eligibility_checked_at
     FROM reception_entries r
     INNER JOIN patients p
       ON p.tenant_id = r.tenant_id
      AND p.pharmacy_id = r.pharmacy_id
      AND p.patient_id = r.patient_id
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

export class PostgresReceptionRepository implements ReceptionRepository {
  constructor(private readonly pool: Pool) {}

  async list(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]> {
    const result = await this.pool.query<ReceptionEntryRow>(
      `SELECT
         r.reception_id,
         r.accepted_at,
         r.reception_status,
         p.patient_id,
         p.name,
         p.kana,
         p.birth_date::text AS birth_date,
         p.sex,
         p.patient_number,
         p.eligibility_status,
         p.eligibility_checked_at
       FROM reception_entries r
       INNER JOIN patients p
         ON p.tenant_id = r.tenant_id
        AND p.pharmacy_id = r.pharmacy_id
        AND p.patient_id = r.patient_id
       WHERE r.tenant_id = $1 AND r.pharmacy_id = $2 AND r.business_date = $3::date
       ORDER BY r.accepted_at ASC, r.reception_id ASC`,
      [input.tenantId, input.pharmacyId, input.date],
    );

    return result.rows.map(rowToEntry);
  }

  async create(input: ReceptionCreateInput): Promise<ReceptionCreateResult> {
    const readCommandProperty = createOwnDataPropertyReader(
      input,
      databaseReceptionCommandSnapshotInvariantErrorMessage,
    );
    const commandTenantId = snapshotReceptionTenantId(
      readCommandProperty('tenantId'),
      databaseReceptionCommandSnapshotInvariantErrorMessage,
    );
    const commandPharmacyId = snapshotReceptionPharmacyId(
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
    const businessDate = businessDateFromAcceptedAt(new Date(acceptedAt));
    const client = await this.pool.connect();
    let destroyClient = false;
    try {
      await client.query('BEGIN');

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
        const entry = rowToEntry(insertedRow);
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
        await client.query('COMMIT');
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
        await client.query('COMMIT');
        return { kind: 'idempotency_conflict', provenance };
      }

      const entry = rowToEntry(existing);
      if (
        entry.receptionId !== provenance.receptionId ||
        entry.patient.patientId !== provenance.patientId
      ) {
        throw new Error(databaseReceptionEntryIdentityInvariantErrorMessage);
      }
      await client.query('COMMIT');
      return {
        kind: 'existing',
        entry,
        provenance,
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
      throw error;
    } finally {
      if (destroyClient) {
        client.release(true);
      } else {
        client.release();
      }
    }
  }
}
