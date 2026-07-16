import type { Pool } from 'pg';
import { type PatientSearchResult, patientSearchResultSchema } from '@yrese/contracts';

import type {
  PatientLookupInput,
  PatientRepository,
  PatientSearchInput,
  PatientSearchPage,
} from '../patient-repository.js';
import { snapshotDatabaseInstant } from '../instant.js';
import {
  readDatabaseRowOwnDataProperty,
  snapshotDatabaseQueryRows,
} from './database-row.js';

interface PatientRow {
  readonly patient_id: string;
  readonly name: string;
  readonly kana: string;
  readonly birth_date: string;
  readonly sex: string;
  readonly patient_number: string;
  readonly eligibility_status: string;
  readonly eligibility_checked_at: Date | string | null;
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

export class PostgresPatientRepository implements PatientRepository {
  constructor(private readonly pool: Pool) {}

  async findById(input: PatientLookupInput): Promise<PatientSearchResult | undefined> {
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
      [input.tenantId, input.pharmacyId, input.patientId],
    );

    const rows = snapshotDatabaseQueryRows<PatientRow>(
      result,
      1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const row = rows[0];
    return row === undefined ? undefined : patientRowToSearchResult(row);
  }

  async search(input: PatientSearchInput): Promise<PatientSearchPage> {
    const offset = input.cursor?.offset ?? 0;
    const pattern = `%${escapeLikePattern(input.q.trim())}%`;
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
       ORDER BY patient_number ASC, patient_id ASC
       LIMIT $4 OFFSET $5`,
      [input.tenantId, input.pharmacyId, pattern, input.limit + 1, offset],
    );

    const rows = snapshotDatabaseQueryRows<PatientRow>(
      result,
      input.limit + 1,
      databasePatientRowSetInvariantErrorMessage,
    );
    const pageRows = rows.slice(0, input.limit);
    const nextOffset = offset + input.limit;

    return {
      results: pageRows.map(patientRowToSearchResult),
      ...(rows.length > input.limit ? { nextCursor: { offset: nextOffset } } : {}),
    };
  }
}
