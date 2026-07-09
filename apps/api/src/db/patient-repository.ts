import type { Pool } from 'pg';
import { type PatientSearchResult, patientSearchResultSchema } from '@yrese/contracts';

import type {
  PatientLookupInput,
  PatientRepository,
  PatientSearchInput,
  PatientSearchPage,
} from '../patient-repository.js';

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

function optionalInstantToIso(value: Date | string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export function patientRowToSearchResult(row: PatientRow): PatientSearchResult {
  return patientSearchResultSchema.parse({
    patientId: row.patient_id,
    name: row.name,
    kana: row.kana,
    birthDate: row.birth_date,
    sex: row.sex,
    patientNumber: row.patient_number,
    eligibilityStatus: row.eligibility_status,
    ...(row.eligibility_checked_at === null ? {} : { eligibilityCheckedAt: optionalInstantToIso(row.eligibility_checked_at) }),
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
