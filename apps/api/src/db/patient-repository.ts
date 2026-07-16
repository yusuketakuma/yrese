import { isProxy } from 'node:util/types';
import type { Pool } from 'pg';
import { type PatientSearchResult, patientSearchResultSchema } from '@yrese/contracts';

import type {
  PatientLookupInput,
  PatientRepository,
  PatientSearchInput,
  PatientSearchPage,
} from '../patient-repository.js';
import { snapshotDatabaseInstant } from '../instant.js';

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

function snapshotEligibilityCheckedAt(row: PatientRow): string | undefined {
  if (isProxy(row)) {
    throw new Error(databasePatientEligibilityTimestampInvariantErrorMessage);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(row, 'eligibility_checked_at');
  } catch {
    throw new Error(databasePatientEligibilityTimestampInvariantErrorMessage);
  }
  if (descriptor === undefined || !('value' in descriptor)) {
    throw new Error(databasePatientEligibilityTimestampInvariantErrorMessage);
  }
  return descriptor.value === null
    ? undefined
    : snapshotDatabaseInstant(
        descriptor.value,
        databasePatientEligibilityTimestampInvariantErrorMessage,
      );
}

export function patientRowToSearchResult(row: PatientRow): PatientSearchResult {
  const eligibilityCheckedAt = snapshotEligibilityCheckedAt(row);
  return patientSearchResultSchema.parse({
    patientId: row.patient_id,
    name: row.name,
    kana: row.kana,
    birthDate: row.birth_date,
    sex: row.sex,
    patientNumber: row.patient_number,
    eligibilityStatus: row.eligibility_status,
    ...(eligibilityCheckedAt === undefined ? {} : { eligibilityCheckedAt }),
  });
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

    const row = result.rows[0];
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

    const pageRows = result.rows.slice(0, input.limit);
    const nextOffset = offset + input.limit;

    return {
      results: pageRows.map(patientRowToSearchResult),
      ...(result.rows.length > input.limit ? { nextCursor: { offset: nextOffset } } : {}),
    };
  }
}
